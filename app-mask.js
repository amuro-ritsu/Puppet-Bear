/**
 * 🐻 Puppet Bear - マスク機能モジュール
 * 
 * 機能:
 * - 矩形マスク
 * - 楕円マスク
 * - ベジェ曲線マスク（自由形状）
 * - フェザー（ぼかし）
 * - マスクモード（加算/減算/反転）
 * - クリッピングレイヤーとの連携
 */

// ===== マスク編集モード =====
let maskEditMode = null; // 'rect', 'ellipse', 'bezier', null
let maskEditLayerId = null;
let maskEditPoints = []; // ベジェ編集中の点（ワールド座標）
let maskDraggingPoint = null; // ドラッグ中の点インデックス
let maskDraggingHandle = null; // ドラッグ中のハンドル 'in' or 'out'
let maskIsDrawing = false; // 矩形/楕円描画中
let maskDrawStart = { x: 0, y: 0 };

// ベジェ編集サブモード
let bezierEditSubMode = 'add'; // 'add' (頂点追加) or 'handle' (ハンドル操作)

// 頂点・ハンドルの表示サイズ
let maskVertexSize = 7;  // 頂点（青い●）のサイズ
let maskHandleSize = 5;  // ハンドル（黄色い●）のサイズ

// ===== ワールド座標をレイヤーローカル座標に変換 =====
function worldToLayerLocal(worldX, worldY, layer) {
    // 親のトランスフォームを取得
    let parentTransform = { x: 0, y: 0, rotation: 0, scale: 1 };
    if (typeof getParentTransform === 'function' && layer.parentLayerId) {
        parentTransform = getParentTransform(layer.parentLayerId);
    }
    
    // レイヤーのワールド位置
    const layerWorldX = layer.x + parentTransform.x;
    const layerWorldY = layer.y + parentTransform.y;
    
    // ワールド座標からレイヤー位置を引く
    let localX = worldX - layerWorldX;
    let localY = worldY - layerWorldY;
    
    // レイヤーの回転を逆適用
    const totalRotation = (layer.rotation || 0) + parentTransform.rotation;
    const rad = -totalRotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = localX * cos - localY * sin;
    const rotatedY = localX * sin + localY * cos;
    
    // レイヤーのスケールを逆適用
    const totalScale = (layer.scale || 1) * parentTransform.scale;
    const scaledX = rotatedX / totalScale;
    const scaledY = rotatedY / totalScale;
    
    // アンカーオフセットを加算（マスクはレイヤーの左上からの相対座標）
    const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
    const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    const anchorOffsetX = anchorX * layer.width;
    const anchorOffsetY = anchorY * layer.height;
    
    return {
        x: scaledX + anchorOffsetX,
        y: scaledY + anchorOffsetY
    };
}

// ===== レイヤーローカル座標をワールド座標に変換 =====
function layerLocalToWorld(localX, localY, layer) {
    // アンカーオフセットを減算
    const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
    const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    const anchorOffsetX = anchorX * layer.width;
    const anchorOffsetY = anchorY * layer.height;
    
    let x = localX - anchorOffsetX;
    let y = localY - anchorOffsetY;
    
    // 親のトランスフォームを取得
    let parentTransform = { x: 0, y: 0, rotation: 0, scale: 1 };
    if (typeof getParentTransform === 'function' && layer.parentLayerId) {
        parentTransform = getParentTransform(layer.parentLayerId);
    }
    
    // レイヤーのスケールを適用
    const totalScale = (layer.scale || 1) * parentTransform.scale;
    x *= totalScale;
    y *= totalScale;
    
    // レイヤーの回転を適用
    const totalRotation = (layer.rotation || 0) + parentTransform.rotation;
    const rad = totalRotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;
    
    // レイヤーのワールド位置を加算
    const layerWorldX = layer.x + parentTransform.x;
    const layerWorldY = layer.y + parentTransform.y;
    
    return {
        x: rotatedX + layerWorldX,
        y: rotatedY + layerWorldY
    };
};

// ===== デフォルトマスク設定 =====
function getDefaultMask(type) {
    return {
        enabled: true,
        type: type, // 'rect', 'ellipse', 'bezier'
        mode: 'add', // 'add', 'subtract', 'intersect'
        feather: 0, // ぼかし量（px）
        opacity: 1.0,
        expansion: 0, // 拡張/収縮（px）
        inverted: false, // 反転
        // 形状データ
        path: null // 形状によって異なる
    };
}

// ===== 矩形マスクパス =====
function createRectMaskPath(x, y, width, height) {
    return {
        type: 'rect',
        x: x,
        y: y,
        width: width,
        height: height
    };
}

// ===== 楕円マスクパス =====
function createEllipseMaskPath(cx, cy, rx, ry) {
    return {
        type: 'ellipse',
        cx: cx,
        cy: cy,
        rx: rx,
        ry: ry
    };
}

// ===== ベジェマスクパス =====
function createBezierMaskPath(points) {
    // points: [{ x, y, handleIn: {x, y}, handleOut: {x, y} }, ...]
    return {
        type: 'bezier',
        points: points,
        closed: true
    };
}

// ===== マスク編集モード開始 =====
function startMaskEdit(layerId, maskType) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    maskEditMode = maskType;
    maskEditLayerId = layerId;
    maskEditPoints = [];
    maskIsDrawing = false;
    
    // ベジェの場合、既存マスクがあれば操作モード、なければ追加モードで開始
    if (maskType === 'bezier') {
        if (layer.mask && layer.mask.path && layer.mask.path.type === 'bezier') {
            bezierEditSubMode = 'handle'; // 既存マスクがあれば操作モード
        } else {
            bezierEditSubMode = 'add'; // 新規は追加モード
        }
    }
    
    // 既存のマスクがあれば編集用にロード（ローカル座標→ワールド座標に変換）
    if (layer.mask && layer.mask.path) {
        if (layer.mask.path.type === 'bezier' && layer.mask.path.points) {
            maskEditPoints = layer.mask.path.points.map(point => {
                const worldPos = layerLocalToWorld(point.x, point.y, layer);
                return {
                    x: worldPos.x,
                    y: worldPos.y,
                    handleIn: point.handleIn ? { ...point.handleIn } : { x: -30, y: 0 },
                    handleOut: point.handleOut ? { ...point.handleOut } : { x: 30, y: 0 }
                };
            });
        }
    }
    
    // カーソルを変更
    const canvasEl = document.getElementById('canvas');
    canvasEl.style.cursor = bezierEditSubMode === 'add' ? 'crosshair' : 'pointer';
    
    // ツール表示を更新
    updateMaskToolUI();
    
    console.log(`🎭 マスク編集モード開始: ${maskType}`);
}

// ===== マスク編集モード終了 =====
function endMaskEdit(save = true) {
    if (!maskEditMode || !maskEditLayerId) return;
    
    const layer = layers.find(l => l.id === maskEditLayerId);
    
    if (save && layer) {
        // ベジェの場合、点が3つ以上あれば保存
        if (maskEditMode === 'bezier' && maskEditPoints.length >= 3) {
            if (!layer.mask) {
                layer.mask = getDefaultMask('bezier');
            }
            
            // ワールド座標をレイヤーローカル座標に変換
            const localPoints = maskEditPoints.map(point => {
                const localPos = worldToLayerLocal(point.x, point.y, layer);
                return {
                    x: localPos.x,
                    y: localPos.y,
                    handleIn: point.handleIn ? { ...point.handleIn } : { x: -30, y: 0 },
                    handleOut: point.handleOut ? { ...point.handleOut } : { x: 30, y: 0 }
                };
            });
            
            layer.mask.path = createBezierMaskPath(localPoints);
            layer.mask.type = 'bezier';
        }
        
        if (typeof saveHistory === 'function') {
            saveHistory();
        }
    }
    
    maskEditMode = null;
    maskEditLayerId = null;
    maskEditPoints = [];
    maskDraggingPoint = null;
    maskIsDrawing = false;
    
    // カーソルを戻す
    const canvasEl = document.getElementById('canvas');
    canvasEl.style.cursor = 'default';
    
    updateMaskToolUI();
    render();
    
    console.log('🎭 マスク編集モード終了');
}

// ===== マスクを削除 =====
function removeMask(layerId) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    delete layer.mask;
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
    
    updatePropertiesPanel();
    render();
    
    console.log('🎭 マスクを削除:', layer.name);
}

// ===== マスク有効/無効切り替え =====
function toggleMaskEnabled(layerId) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || !layer.mask) return;
    
    layer.mask.enabled = !layer.mask.enabled;
    
    updatePropertiesPanel();
    render();
}

// ===== マスクプロパティ更新 =====
function updateMaskProperty(layerId, property, value) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || !layer.mask) return;
    
    layer.mask[property] = value;
    
    render();
}

// ===== キャンバスマウスダウン（マスク編集） =====
function handleMaskMouseDown(e) {
    if (!maskEditMode) return false;
    
    const canvasEl = document.getElementById('canvas');
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (maskEditMode === 'rect' || maskEditMode === 'ellipse') {
        // 矩形/楕円: ドラッグで描画開始
        maskIsDrawing = true;
        maskDrawStart = { x, y };
        return true;
    } else if (maskEditMode === 'bezier') {
        if (bezierEditSubMode === 'add') {
            // 追加モード: 新しい点を追加
            const newPoint = {
                x: x,
                y: y,
                handleIn: { x: -30, y: 0 },
                handleOut: { x: 30, y: 0 }
            };
            maskEditPoints.push(newPoint);
            maskDraggingPoint = maskEditPoints.length - 1;
            maskDraggingHandle = null;
        } else if (bezierEditSubMode === 'handle') {
            // ハンドル操作モード: まずハンドルを検索、次に頂点を検索
            let found = false;
            
            // 全ての点のハンドルを先にチェック
            for (let i = 0; i < maskEditPoints.length; i++) {
                const point = maskEditPoints[i];
                const handleIn = getHandlePosition(point, 'in');
                const handleOut = getHandlePosition(point, 'out');
                
                if (handleIn && distance(x, y, handleIn.x, handleIn.y) < 15) {
                    maskDraggingPoint = i;
                    maskDraggingHandle = 'in';
                    found = true;
                    break;
                }
                if (handleOut && distance(x, y, handleOut.x, handleOut.y) < 15) {
                    maskDraggingPoint = i;
                    maskDraggingHandle = 'out';
                    found = true;
                    break;
                }
            }
            
            // ハンドルが見つからなければ頂点をチェック
            if (!found) {
                const clickedPointIndex = findNearestMaskPoint(x, y, 20);
                if (clickedPointIndex !== null) {
                    maskDraggingPoint = clickedPointIndex;
                    maskDraggingHandle = null;
                }
            }
        }
        
        render();
        return true;
    }
    
    return false;
}

// ===== キャンバスマウスムーブ（マスク編集） =====
function handleMaskMouseMove(e) {
    if (!maskEditMode) return false;
    
    const canvasEl = document.getElementById('canvas');
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (maskEditMode === 'rect' && maskIsDrawing) {
        // 矩形プレビュー
        const layer = layers.find(l => l.id === maskEditLayerId);
        if (layer) {
            const maskPath = createRectMaskPath(
                Math.min(maskDrawStart.x, x),
                Math.min(maskDrawStart.y, y),
                Math.abs(x - maskDrawStart.x),
                Math.abs(y - maskDrawStart.y)
            );
            layer._tempMaskPath = maskPath;
            render();
        }
        return true;
    } else if (maskEditMode === 'ellipse' && maskIsDrawing) {
        // 楕円プレビュー
        const layer = layers.find(l => l.id === maskEditLayerId);
        if (layer) {
            const cx = (maskDrawStart.x + x) / 2;
            const cy = (maskDrawStart.y + y) / 2;
            const rx = Math.abs(x - maskDrawStart.x) / 2;
            const ry = Math.abs(y - maskDrawStart.y) / 2;
            const maskPath = createEllipseMaskPath(cx, cy, rx, ry);
            layer._tempMaskPath = maskPath;
            render();
        }
        return true;
    } else if (maskEditMode === 'bezier' && maskDraggingPoint !== null) {
        const point = maskEditPoints[maskDraggingPoint];
        
        if (maskDraggingHandle === 'in') {
            point.handleIn = {
                x: x - point.x,
                y: y - point.y
            };
        } else if (maskDraggingHandle === 'out') {
            point.handleOut = {
                x: x - point.x,
                y: y - point.y
            };
        } else {
            // 点自体を移動
            point.x = x;
            point.y = y;
        }
        
        render();
        return true;
    }
    
    return false;
}

// ===== キャンバスマウスアップ（マスク編集） =====
function handleMaskMouseUp(e) {
    if (!maskEditMode) return false;
    
    const canvasEl = document.getElementById('canvas');
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (maskEditMode === 'rect' && maskIsDrawing) {
        // 矩形確定
        const layer = layers.find(l => l.id === maskEditLayerId);
        if (layer) {
            const width = Math.abs(x - maskDrawStart.x);
            const height = Math.abs(y - maskDrawStart.y);
            
            if (width > 5 && height > 5) {
                if (!layer.mask) {
                    layer.mask = getDefaultMask('rect');
                }
                
                // ワールド座標をローカル座標に変換
                const topLeft = worldToLayerLocal(Math.min(maskDrawStart.x, x), Math.min(maskDrawStart.y, y), layer);
                const bottomRight = worldToLayerLocal(Math.max(maskDrawStart.x, x), Math.max(maskDrawStart.y, y), layer);
                
                layer.mask.path = createRectMaskPath(
                    topLeft.x,
                    topLeft.y,
                    bottomRight.x - topLeft.x,
                    bottomRight.y - topLeft.y
                );
                layer.mask.type = 'rect';
            }
            delete layer._tempMaskPath;
        }
        
        maskIsDrawing = false;
        endMaskEdit(true);
        return true;
    } else if (maskEditMode === 'ellipse' && maskIsDrawing) {
        // 楕円確定
        const layer = layers.find(l => l.id === maskEditLayerId);
        if (layer) {
            const rx = Math.abs(x - maskDrawStart.x) / 2;
            const ry = Math.abs(y - maskDrawStart.y) / 2;
            
            if (rx > 5 && ry > 5) {
                if (!layer.mask) {
                    layer.mask = getDefaultMask('ellipse');
                }
                
                // ワールド座標をローカル座標に変換
                const center = worldToLayerLocal((maskDrawStart.x + x) / 2, (maskDrawStart.y + y) / 2, layer);
                // 半径はスケールを考慮
                let parentTransform = { scale: 1 };
                if (typeof getParentTransform === 'function' && layer.parentLayerId) {
                    parentTransform = getParentTransform(layer.parentLayerId);
                }
                const totalScale = (layer.scale || 1) * parentTransform.scale;
                
                layer.mask.path = createEllipseMaskPath(
                    center.x,
                    center.y,
                    rx / totalScale,
                    ry / totalScale
                );
                layer.mask.type = 'ellipse';
            }
            delete layer._tempMaskPath;
        }
        
        maskIsDrawing = false;
        endMaskEdit(true);
        return true;
    } else if (maskEditMode === 'bezier') {
        maskDraggingPoint = null;
        maskDraggingHandle = null;
        return true;
    }
    
    return false;
}

// ===== ダブルクリックでベジェ編集終了 =====
function handleMaskDoubleClick(e) {
    if (maskEditMode === 'bezier') {
        endMaskEdit(true);
        return true;
    }
    return false;
}

// ===== 最寄りのマスク点を探す =====
function findNearestMaskPoint(x, y, threshold) {
    for (let i = 0; i < maskEditPoints.length; i++) {
        const point = maskEditPoints[i];
        if (distance(x, y, point.x, point.y) < threshold) {
            return i;
        }
    }
    return null;
}

// ===== ハンドル位置を取得 =====
function getHandlePosition(point, type) {
    if (type === 'in' && point.handleIn) {
        return { x: point.x + point.handleIn.x, y: point.y + point.handleIn.y };
    } else if (type === 'out' && point.handleOut) {
        return { x: point.x + point.handleOut.x, y: point.y + point.handleOut.y };
    }
    return null;
}

// ===== 距離計算 =====
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ===== マスクをキャンバスに適用（クリッピング） =====
// マスクパスはレイヤーのローカル座標系で保存されている
// offsetX, offsetY は描画時のアンカーオフセット（負の値）
function applyMaskToContext(ctx, layer, offsetX = 0, offsetY = 0) {
    if (!layer.mask || !layer.mask.enabled || !layer.mask.path) return false;
    
    const mask = layer.mask;
    const path = mask.path;
    
    ctx.save();
    ctx.beginPath();
    
    // マスクパスはレイヤーのローカル座標（左上が0,0）
    // offsetX, offsetY はアンカーオフセットの負の値なので、そのまま加算
    if (path.type === 'rect') {
        ctx.rect(
            path.x + offsetX,
            path.y + offsetY,
            path.width,
            path.height
        );
    } else if (path.type === 'ellipse') {
        ctx.ellipse(
            path.cx + offsetX,
            path.cy + offsetY,
            path.rx,
            path.ry,
            0, 0, Math.PI * 2
        );
    } else if (path.type === 'bezier' && path.points && path.points.length >= 3) {
        drawBezierPath(ctx, path.points, offsetX, offsetY);
    }
    
    ctx.closePath();
    
    // 反転モード
    if (mask.inverted) {
        // 全体を描画してからマスク部分をくり抜く
        // ローカル座標系なのでレイヤーサイズを使う
        ctx.rect(offsetX - 100, offsetY - 100, layer.width + 200, layer.height + 200);
        ctx.clip('evenodd');
    } else {
        ctx.clip();
    }
    
    return true;
}

// ===== マスクのクリッピングを解除 =====
function restoreFromMask(ctx) {
    ctx.restore();
}

// ===== ベジェパスを描画 =====
function drawBezierPath(ctx, points, offsetX = 0, offsetY = 0) {
    if (points.length < 2) return;
    
    ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
    
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        
        const cp1 = getHandlePosition(current, 'out');
        const cp2 = getHandlePosition(next, 'in');
        
        if (cp1 && cp2) {
            ctx.bezierCurveTo(
                cp1.x + offsetX, cp1.y + offsetY,
                cp2.x + offsetX, cp2.y + offsetY,
                next.x + offsetX, next.y + offsetY
            );
        } else {
            ctx.lineTo(next.x + offsetX, next.y + offsetY);
        }
    }
}

// ===== マスク編集UIを描画（オーバーレイ） =====
function drawMaskEditOverlay(ctx) {
    const layer = layers.find(l => l.id === maskEditLayerId);
    if (!layer) return;
    
    // 一時的なマスクパス（矩形/楕円描画中）
    if (layer._tempMaskPath) {
        drawMaskPath(ctx, layer._tempMaskPath, 0, 0, true);
    }
    
    // ベジェ編集中の点とハンドル
    if (maskEditMode === 'bezier' && maskEditPoints.length > 0) {
        // パスを描画
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        
        if (maskEditPoints.length >= 2) {
            drawBezierPath(ctx, maskEditPoints, 0, 0);
            ctx.closePath();
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 点とハンドルを描画
        maskEditPoints.forEach((point, index) => {
            // ハンドル線
            ctx.strokeStyle = '#888888';
            ctx.lineWidth = 1;
            
            const handleIn = getHandlePosition(point, 'in');
            const handleOut = getHandlePosition(point, 'out');
            
            if (handleIn) {
                ctx.beginPath();
                ctx.moveTo(point.x, point.y);
                ctx.lineTo(handleIn.x, handleIn.y);
                ctx.stroke();
                
                // ハンドル点
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(handleIn.x, handleIn.y, maskHandleSize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            if (handleOut) {
                ctx.beginPath();
                ctx.moveTo(point.x, point.y);
                ctx.lineTo(handleOut.x, handleOut.y);
                ctx.stroke();
                
                // ハンドル点
                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(handleOut.x, handleOut.y, maskHandleSize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 頂点
            ctx.fillStyle = index === maskDraggingPoint ? '#ff0000' : '#00ffff';
            ctx.beginPath();
            ctx.arc(point.x, point.y, maskVertexSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
        
        // ヘルプテキスト
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 320, 45);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        if (bezierEditSubMode === 'add') {
            ctx.fillText('【追加モード】クリックで頂点を追加', 20, 30);
            ctx.fillText('操作モードに切り替えてハンドルを調整', 20, 50);
        } else {
            ctx.fillText('【操作モード】頂点・ハンドルをドラッグ', 20, 30);
            ctx.fillText('追加モードに切り替えて頂点を追加', 20, 50);
        }
    }
}

// ===== マスクパスを描画（表示用） =====
function drawMaskPath(ctx, path, offsetX, offsetY, isEditing = false) {
    ctx.strokeStyle = isEditing ? '#00ffff' : 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = isEditing ? 2 : 1;
    ctx.setLineDash(isEditing ? [5, 5] : []);
    
    ctx.beginPath();
    
    if (path.type === 'rect') {
        ctx.rect(path.x + offsetX, path.y + offsetY, path.width, path.height);
    } else if (path.type === 'ellipse') {
        ctx.ellipse(path.cx + offsetX, path.cy + offsetY, path.rx, path.ry, 0, 0, Math.PI * 2);
    } else if (path.type === 'bezier' && path.points) {
        drawBezierPath(ctx, path.points, offsetX, offsetY);
        ctx.closePath();
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
}

// ===== マスクツールUI更新 =====
function updateMaskToolUI() {
    const toolbar = document.getElementById('mask-toolbar');
    if (!toolbar) return;
    
    if (maskEditMode) {
        toolbar.style.display = 'block';
        
        if (maskEditMode === 'bezier') {
            // ベジェ編集時はサブモード切替ボタンを表示
            const addActive = bezierEditSubMode === 'add' ? 'active' : '';
            const handleActive = bezierEditSubMode === 'handle' ? 'active' : '';
            
            toolbar.innerHTML = `
                <div class="mask-toolbar-row">
                    <span style="color: #00ffff;">🎭 ベジェマスク編集</span>
                    <button onclick="setBezierSubMode('add')" class="btn-small mask-mode-btn ${addActive}" title="頂点追加モード">➕ 追加</button>
                    <button onclick="setBezierSubMode('handle')" class="btn-small mask-mode-btn ${handleActive}" title="ハンドル操作モード">✋ 操作</button>
                    <span style="color: #888; margin: 0 5px;">|</span>
                    <button onclick="deleteLastMaskPoint()" class="btn-small" title="最後の頂点を削除">🗑️ 頂点削除</button>
                    <span style="color: #888; margin: 0 5px;">|</span>
                    <button onclick="endMaskEdit(true)" class="btn-small btn-confirm">✓ 確定</button>
                    <button onclick="endMaskEdit(false)" class="btn-small">✕ キャンセル</button>
                </div>
                <div class="mask-toolbar-row mask-size-controls">
                    <label>🔵 頂点</label>
                    <input type="range" min="3" max="20" value="${maskVertexSize}" 
                           oninput="setMaskVertexSize(this.value)" class="mask-size-slider">
                    <span id="mask-vertex-size-label">${maskVertexSize}</span>
                    <span style="color: #888; margin: 0 8px;">|</span>
                    <label>🟡 ハンドル</label>
                    <input type="range" min="2" max="15" value="${maskHandleSize}" 
                           oninput="setMaskHandleSize(this.value)" class="mask-size-slider">
                    <span id="mask-handle-size-label">${maskHandleSize}</span>
                </div>
            `;
        } else {
            toolbar.innerHTML = `
                <div class="mask-toolbar-row">
                    <span style="color: #00ffff;">🎭 マスク編集中: ${maskEditMode}</span>
                    <button onclick="endMaskEdit(true)" class="btn-small btn-confirm">✓ 確定</button>
                    <button onclick="endMaskEdit(false)" class="btn-small">✕ キャンセル</button>
                </div>
            `;
        }
    } else {
        toolbar.style.display = 'none';
    }
}

// ===== 頂点サイズ変更 =====
function setMaskVertexSize(size) {
    maskVertexSize = parseInt(size);
    document.getElementById('mask-vertex-size-label').textContent = size;
    render();
}

// ===== ハンドルサイズ変更 =====
function setMaskHandleSize(size) {
    maskHandleSize = parseInt(size);
    document.getElementById('mask-handle-size-label').textContent = size;
    render();
}

// ===== ベジェ編集サブモード切替 =====
function setBezierSubMode(mode) {
    bezierEditSubMode = mode;
    updateMaskToolUI();
    
    // カーソルを変更
    const canvasEl = document.getElementById('canvas');
    if (mode === 'add') {
        canvasEl.style.cursor = 'crosshair';
    } else {
        canvasEl.style.cursor = 'pointer';
    }
    
    render();
}

// ===== 最後のマスク頂点を削除 =====
function deleteLastMaskPoint() {
    if (maskEditPoints.length > 0) {
        maskEditPoints.pop();
        render();
    }
}

// ===== プロパティパネル用マスクUI生成 =====
function generateMaskUI(layer) {
    if (!layer) return '';
    
    const hasMask = layer.mask && layer.mask.path;
    const mask = layer.mask || {};
    
    let html = `
        <div class="property-section">
            <h4>🎭 マスク</h4>
    `;
    
    if (hasMask) {
        html += `
            <div class="property-row">
                <label>
                    <input type="checkbox" ${mask.enabled ? 'checked' : ''} 
                           onchange="toggleMaskEnabled(${layer.id})">
                    有効
                </label>
                <span style="color: #888; font-size: 11px;">${mask.type || ''}</span>
            </div>
            <div class="property-row">
                <label>フェザー</label>
                <input type="range" min="0" max="50" value="${mask.feather || 0}"
                       onchange="updateMaskProperty(${layer.id}, 'feather', parseFloat(this.value))">
                <span>${mask.feather || 0}px</span>
            </div>
            <div class="property-row">
                <label>不透明度</label>
                <input type="range" min="0" max="100" value="${(mask.opacity || 1) * 100}"
                       onchange="updateMaskProperty(${layer.id}, 'opacity', parseFloat(this.value) / 100)">
                <span>${Math.round((mask.opacity || 1) * 100)}%</span>
            </div>
            <div class="property-row">
                <label>
                    <input type="checkbox" ${mask.inverted ? 'checked' : ''} 
                           onchange="updateMaskProperty(${layer.id}, 'inverted', this.checked)">
                    反転
                </label>
            </div>
            <div class="property-row">
                <button onclick="startMaskEdit(${layer.id}, '${mask.type}')" class="btn-small">✏️ 編集</button>
                <button onclick="removeMask(${layer.id})" class="btn-small btn-danger">🗑️ 削除</button>
            </div>
        `;
    } else {
        html += `
            <div class="property-row">
                <span style="color: #888;">マスクなし</span>
            </div>
            <div class="property-row" style="gap: 5px;">
                <button onclick="startMaskEdit(${layer.id}, 'rect')" class="btn-small">⬜ 矩形</button>
                <button onclick="startMaskEdit(${layer.id}, 'ellipse')" class="btn-small">⭕ 楕円</button>
                <button onclick="startMaskEdit(${layer.id}, 'bezier')" class="btn-small">✒️ ベジェ</button>
            </div>
        `;
    }
    
    html += `</div>`;
    
    return html;
}

// ===== ESCキーでマスク編集キャンセル =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && maskEditMode) {
        endMaskEdit(false);
    }
});

console.log('🎭 マスク機能モジュール読み込み完了');
