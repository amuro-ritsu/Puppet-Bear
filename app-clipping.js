/**
 * ⭐ Starlit Puppet Editor v1.5.0
 * 色抜きクリッピング機能モジュール
 */

// グローバル変数
let eyedropperActive = false;
let eyedropperHandler = null;

// ===== レイヤーのクリッピングプロパティを初期化 =====
function initLayerClippingProperties(layer) {
    if (!layer.colorClipping) {
        layer.colorClipping = {
            enabled: false,
            referenceLayerId: null,
            color: { r: 0, g: 255, b: 0 },
            tolerance: 30,
            invertClipping: false // false: 選択色にクリッピング, true: 選択色以外にクリッピング
        };
    }
}

// ===== 参照レイヤーセレクトを更新 =====
function updateColorClippingReferenceSelect(layer) {
    const select = document.getElementById('colorClippingReferenceSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">なし</option>';
    
    // 自分以外の画像レイヤーを選択肢に追加
    const availableLayers = layers.filter(l => 
        l.id !== layer.id && l.type === 'image' && l.visible
    );
    
    availableLayers.forEach(l => {
        const option = document.createElement('option');
        option.value = l.id;
        option.textContent = l.name;
        
        if (layer.colorClipping && layer.colorClipping.referenceLayerId == l.id) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// ===== 色抜きクリッピングの有効/無効を切り替え =====
function toggleColorClipping(enabled) {
    if (selectedLayerIds.length !== 1) return;
    
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    initLayerClippingProperties(layer);
    layer.colorClipping.enabled = enabled;
    
    render();
    updatePropertiesPanel();
}

// ===== 参照レイヤーを設定 =====
function setColorClippingReference() {
    if (selectedLayerIds.length !== 1) return;
    
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    initLayerClippingProperties(layer);
    
    const select = document.getElementById('colorClippingReferenceSelect');
    if (!select) return;
    
    const value = select.value;
    
    if (value) {
        layer.colorClipping.referenceLayerId = Number(value);
    } else {
        layer.colorClipping.referenceLayerId = null;
    }
    
    render();
    updatePropertiesPanel();
}

// ===== 色抜きクリッピングの許容値を設定 =====
function setColorClippingTolerance(tolerance) {
    if (selectedLayerIds.length !== 1) return;
    
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    initLayerClippingProperties(layer);
    layer.colorClipping.tolerance = tolerance;
    
    render();
}

// ===== 反転設定を切り替え =====
function toggleColorClippingInvert(invert) {
    if (selectedLayerIds.length !== 1) return;
    
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    initLayerClippingProperties(layer);
    layer.colorClipping.invertClipping = invert;
    
    render();
    updatePropertiesPanel();
}

// ===== スポイトツールを有効化 =====
function activateColorClippingEyedropper() {
    console.log('色抜きクリッピング用スポイトツール有効化');
    
    if (selectedLayerIds.length !== 1) {
        alert('レイヤーを選択してください');
        return;
    }
    
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    initLayerClippingProperties(layer);
    
    if (!layer.colorClipping.referenceLayerId) {
        alert('参照レイヤーを先に選択してください');
        return;
    }
    
    eyedropperActive = true;
    
    // スポイト用のカーソルクラスを追加
    canvas.classList.add('eyedropper-active');
    
    // 既存のハンドラーをクリーンアップ
    if (eyedropperHandler) {
        canvas.removeEventListener('mousedown', eyedropperHandler, true);
        canvas.removeEventListener('touchstart', eyedropperHandler, true);
    }
    
    // 新しいハンドラーを作成（マウス・タッチ両対応）
    eyedropperHandler = (e) => {
        console.log('スポイトクリック/タッチ検出', e.type);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        pickColorForColorClipping(e);
        deactivateEyedropper();
        return false;
    };
    
    // キャプチャフェーズで優先的にイベントを取得（マウス・タッチ両方）
    canvas.addEventListener('mousedown', eyedropperHandler, true);
    canvas.addEventListener('touchstart', eyedropperHandler, { capture: true, passive: false });
}

// ===== スポイトツールを無効化 =====
function deactivateEyedropper() {
    console.log('スポイトツール無効化');
    eyedropperActive = false;
    
    // スポイト用のカーソルクラスを削除
    canvas.classList.remove('eyedropper-active');
    
    // イベントリスナーを削除（マウス・タッチ両方）
    if (eyedropperHandler) {
        canvas.removeEventListener('mousedown', eyedropperHandler, true);
        canvas.removeEventListener('touchstart', eyedropperHandler, true);
        eyedropperHandler = null;
    }
}

// ===== 参照レイヤーから色を取得（プレビューから取得） =====
function pickColorForColorClipping(e) {
    console.log('色抜きクリッピング用に色を取得中...');
    
    if (selectedLayerIds.length !== 1) return;
    
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || !layer.colorClipping.referenceLayerId) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // マウスとタッチの両方に対応
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // キャンバスのスケールを考慮
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = Math.floor(x * scaleX);
    const canvasY = Math.floor(y * scaleY);
    
    console.log(`クリック/タッチ座標: (${canvasX}, ${canvasY})`);
    
    // 参照レイヤーを取得
    const refLayer = layers.find(l => l.id == layer.colorClipping.referenceLayerId);
    if (!refLayer || !refLayer.visible) {
        alert('参照レイヤーが表示されていません');
        return;
    }
    
    // プレビューと同じ変形で一時キャンバスに描画
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    
    // 参照レイヤーをプレビューと同じ変形で描画
    tempCtx.save();
    
    // 親の変形を適用
    applyParentTransformToContext(tempCtx, refLayer);
    
    // レイヤーの位置に移動
    tempCtx.translate(refLayer.x, refLayer.y);
    
    // アンカーポイントのオフセット
    const anchorOffsetX = refLayer.anchorX * refLayer.width;
    const anchorOffsetY = refLayer.anchorY * refLayer.height;
    
    // アンカーポイントを原点に移動
    tempCtx.translate(anchorOffsetX - refLayer.width / 2, anchorOffsetY - refLayer.height / 2);
    
    // 回転
    tempCtx.rotate(refLayer.rotation * Math.PI / 180);
    
    // スケール
    tempCtx.scale(refLayer.scale, refLayer.scale);
    
    // 画像を描画（プレビューと同じスムージング）
    tempCtx.drawImage(
        refLayer.img,
        -anchorOffsetX,
        -anchorOffsetY,
        refLayer.width,
        refLayer.height
    );
    
    tempCtx.restore();
    
    // クリック位置のピクセルを取得
    try {
        const imageData = tempCtx.getImageData(canvasX, canvasY, 1, 1);
        const data = imageData.data;
        
        if (data[3] === 0) {
            alert('クリック位置に画像がありません（透明部分）');
            return;
        }
        
        console.log(`取得した色（プレビュー）: RGB(${data[0]}, ${data[1]}, ${data[2]})`);
        
        // 色を設定
        layer.colorClipping.color = {
            r: data[0],
            g: data[1],
            b: data[2]
        };
        
        render();
        updatePropertiesPanel();
        
    } catch (err) {
        alert('クリック位置が範囲外です');
        return;
    }
}

// ===== 親のトランスフォームを計算 =====
function calculateParentTransform(layer) {
    let transform = {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1
    };
    
    if (!layer.parentLayerId) return transform;
    
    const parent = layers.find(l => l.id === layer.parentLayerId);
    if (!parent) return transform;
    
    // 親の親のトランスフォームを再帰的に取得
    const grandParentTransform = calculateParentTransform(parent);
    
    // 親の回転をラジアンに変換
    const parentRadians = grandParentTransform.rotation * Math.PI / 180;
    const cos = Math.cos(parentRadians);
    const sin = Math.sin(parentRadians);
    
    // 親の位置を祖父母のトランスフォームで変換
    const transformedX = grandParentTransform.x + (parent.x * cos - parent.y * sin) * grandParentTransform.scale;
    const transformedY = grandParentTransform.y + (parent.x * sin + parent.y * cos) * grandParentTransform.scale;
    
    transform.x = transformedX;
    transform.y = transformedY;
    transform.rotation = grandParentTransform.rotation + parent.rotation;
    transform.scale = grandParentTransform.scale * parent.scale;
    
    return transform;
}

// ===== 親の変形を一時コンテキストに適用 =====
function applyParentTransformToContext(ctx, layer) {
    // パペットアンカーに追従する場合
    if (layer.followPuppetAnchor && layer.followPuppetAnchor.layerId && typeof getPuppetFollowPosition === 'function') {
        const followPos = getPuppetFollowPosition(layer.followPuppetAnchor);
        ctx.translate(followPos.x, followPos.y);
        return;
    }
    
    if (!layer.parentLayerId) return;
    
    const parent = layers.find(l => l.id === layer.parentLayerId);
    if (!parent) return;
    
    // 再帰的に親の親の変形も適用
    applyParentTransformToContext(ctx, parent);
    
    // 親の位置に移動
    ctx.translate(parent.x, parent.y);
    
    // 親の回転を適用
    ctx.rotate(parent.rotation * Math.PI / 180);
    
    // 親のスケールを適用
    ctx.scale(parent.scale, parent.scale);
}

// ===== 色抜きクリッピングマスクを生成（原寸画像で色判定） =====
function createColorClippingMask(layer) {
    if (!layer.colorClipping || !layer.colorClipping.enabled || !layer.colorClipping.referenceLayerId) {
        return null;
    }
    
    const refLayer = layers.find(l => l.id == layer.colorClipping.referenceLayerId);
    if (!refLayer || !refLayer.visible) {
        return null;
    }
    
    const targetColor = layer.colorClipping.color;
    const tolerance = layer.colorClipping.tolerance;
    const invert = layer.colorClipping.invertClipping;
    
    // 色が設定されていない場合(スポイトで取得していない場合)は参照レイヤー全体にクリッピング
    const noColorSet = !targetColor || (targetColor.r === 0 && targetColor.g === 255 && targetColor.b === 0);
    
    // 原寸画像で色判定マスクを作成
    const originalWidth = refLayer.img.width;
    const originalHeight = refLayer.img.height;
    
    const originalMaskCanvas = document.createElement('canvas');
    originalMaskCanvas.width = originalWidth;
    originalMaskCanvas.height = originalHeight;
    const originalMaskCtx = originalMaskCanvas.getContext('2d', { willReadFrequently: true });
    
    // 原寸画像を描画
    originalMaskCtx.drawImage(refLayer.img, 0, 0);
    
    // イメージデータを取得
    const imageData = originalMaskCtx.getImageData(0, 0, originalWidth, originalHeight);
    const data = imageData.data;
    
    // 各ピクセルを処理（原寸で判定）
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // 色が設定されていない場合は参照レイヤーの不透明部分全体をマスクに
        if (noColorSet) {
            if (a > 0) {
                // 不透明・半透明部分は白にしてアルファ値を保持
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
                // data[i + 3] = a; // アルファ値はそのまま保持
            }
            // 透明部分はそのまま（何もしない）
        } else {
            // 色の距離を計算（原寸ピクセルで判定）
            const distance = Math.sqrt(
                Math.pow(r - targetColor.r, 2) +
                Math.pow(g - targetColor.g, 2) +
                Math.pow(b - targetColor.b, 2)
            );
            
            // 許容値以内かどうか
            const withinTolerance = distance <= tolerance;
            
            if (invert) {
                // 選択色以外にクリッピング
                if (withinTolerance) {
                    data[i + 3] = 0; // 選択色を透明に
                } else if (a > 0) {
                    // 選択色以外の不透明部分を白(マスク)に
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                } else {
                    data[i + 3] = 0;
                }
            } else {
                // 選択色にクリッピング
                if (!withinTolerance || a === 0) {
                    data[i + 3] = 0; // 選択色以外を透明に
                } else {
                    // 選択色の部分を白(マスク)に
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                }
            }
        }
    }
    
    // 処理したイメージデータを戻す
    originalMaskCtx.putImageData(imageData, 0, 0);
    
    // 原寸マスクを参照レイヤーと同じ変形でcanvasサイズのマスクに描画
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d', { alpha: true });
    
    maskCtx.save();
    
    // 親の変形を適用
    applyParentTransformToContext(maskCtx, refLayer);
    
    // レイヤーの位置に移動
    maskCtx.translate(refLayer.x, refLayer.y);
    
    // アンカーポイントのオフセット
    const anchorOffsetX = refLayer.anchorX * refLayer.width;
    const anchorOffsetY = refLayer.anchorY * refLayer.height;
    
    // アンカーポイントを原点に移動
    maskCtx.translate(anchorOffsetX - refLayer.width / 2, anchorOffsetY - refLayer.height / 2);
    
    // 回転
    maskCtx.rotate(refLayer.rotation * Math.PI / 180);
    
    // スケール
    maskCtx.scale(refLayer.scale, refLayer.scale);
    
    // 原寸マスクを表示サイズで描画（スムージングなし）
    maskCtx.imageSmoothingEnabled = false;
    maskCtx.drawImage(
        originalMaskCanvas,
        -anchorOffsetX,
        -anchorOffsetY,
        refLayer.width,
        refLayer.height
    );
    
    maskCtx.restore();
    
    return maskCanvas;
}

// ===== 色抜きクリッピングを適用 =====
function applyColorClipping(layer) {
    if (!layer.colorClipping || !layer.colorClipping.enabled) {
        return false;
    }
    
    const mask = createColorClippingMask(layer);
    if (!mask) {
        return false;
    }
    
    // 既存の描画内容にマスクを適用
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    
    return true;
}
