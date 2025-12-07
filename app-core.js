/**
 * ⭐ Starlit Puppet Editor v1.10.4
 * コア機能 - レイヤー管理・描画
 * - パペットレイヤーの軸アンカー描画でアンカーオフセットを考慮
 * - フォルダ間親子関係の描画対応
 * - パペット・バウンスレイヤーの親変形対応
 */

// ===== 画像読み込み =====
function loadImage(file) {
    // loadImageWithOriginalNameを使用（app-layers.jsで定義）
    if (typeof loadImageWithOriginalName === 'function') {
        loadImageWithOriginalName(file);
        return;
    }
    
    // フォールバック
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const layer = {
                id: nextLayerId++,
                type: 'image',
                name: file.name,
                img: img,
                x: canvas.width / 2,
                y: canvas.height / 2,
                width: img.width,
                height: img.height,
                rotation: 0,
                scale: 1,
                opacity: 1.0,
                anchorX: 0.5,
                anchorY: 0.5,
                visible: true,
                blendMode: 'source-over',
                parentLayerId: null,
                windSwayEnabled: false,
                windSwayParams: getDefaultWindSwayParams(),
                colorClipping: {
                    enabled: false,
                    referenceLayerId: null,
                    color: { r: 0, g: 255, b: 0 },
                    tolerance: 30,
                    invertClipping: false
                },
                keyframes: [{
                    frame: 0,
                    x: canvas.width / 2,
                    y: canvas.height / 2,
                    rotation: 0,
                    scale: 1,
                    opacity: 1.0
                }]
            };
            
            layers.push(layer);
            updateLayerList();
            selectLayer(layer.id, false);
            
            if (typeof applyKeyframeInterpolation === 'function') {
                applyKeyframeInterpolation();
            }
            
            render();
            
            if (typeof saveHistory === 'function') {
                saveHistory();
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ===== 連番画像読み込み（口パク・まばたき用） =====
function loadSequenceImages(files, callback) {
    const images = [];
    let loadedCount = 0;
    
    // ファイルを名前順にソート
    const sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    
    sortedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                images[index] = img;
                loadedCount++;
                
                if (loadedCount === sortedFiles.length) {
                    callback(images);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ===== 描画 =====
function render() {
    // キャンバスクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 透過書き出し中でなければ背景を描画
    if (typeof isTransparentExport === 'undefined' || !isTransparentExport) {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // 現在の時間を取得（アニメーション用）
    const localTime = currentTime;
    
    // レイヤーを描画（親子関係とフォルダを考慮）
    layers.forEach(layer => {
        if (!layer.visible) return;
        
        // フォルダの場合
        if (layer.type === 'folder') {
            // フォルダに風揺れが有効な場合は特別処理
            if (layer.windSwayEnabled) {
                drawFolderWithWindSway(layer, localTime);
            } else {
                // 子レイヤーを通常通り描画（子レイヤー自身が描画される）
                // フォルダ自体は何も描画しない
            }
            return;
        }
        
        // ジャンプフォルダーの場合（描画は子レイヤー側で行う）
        if (layer.type === 'folder') {
            // フォルダ自体は何も描画しない（ジャンプ機能は子レイヤーの描画時に適用）
            return;
        }
        
        // 画像レイヤーの場合
        // 親がフォルダで、親に風揺れが有効な場合はスキップ（親が一括描画）
        const parent = layers.find(l => l.id === layer.parentLayerId);
        if (parent && parent.type === 'folder' && parent.windSwayEnabled) {
            return;
        }
        
        // 口パクレイヤーとまばたきレイヤーは専用描画
        if (layer.type === 'lipsync') {
            drawLipSyncLayer(layer, localTime);
            return;
        }
        
        if (layer.type === 'blink') {
            drawBlinkLayer(layer, localTime);
            return;
        }
        
        // 連番アニメレイヤーは専用描画
        if (layer.type === 'sequence') {
            drawSequenceLayer(layer, localTime);
            return;
        }
        
        // 断面図レイヤーは連番アニメと同じ描画処理
        if (layer.type === 'crosssection') {
            drawSequenceLayer(layer, localTime);
            return;
        }
        
        // 揺れモーションレイヤーは専用描画
        if (layer.type === 'bounce') {
            drawBounceLayer(layer, localTime);
            return;
        }
        
        // パペットレイヤーは専用描画
        if (layer.type === 'puppet') {
            drawPuppetLayer(layer, localTime);
            
            // 軸アンカー（赤い十字マーク）を描画 - 書き出し中は描画しない
            if (typeof isExporting === 'undefined' || !isExporting) {
                ctx.save();
                const parentTransform = getParentTransform(layer.parentLayerId);
                
                // ★ 子のローカル座標を親の回転・スケールで変換 ★
                const parentRad = parentTransform.rotation * Math.PI / 180;
                const parentCos = Math.cos(parentRad);
                const parentSin = Math.sin(parentRad);
                const transformedLayerX = layer.x * parentTransform.scale * parentCos - layer.y * parentTransform.scale * parentSin;
                const transformedLayerY = layer.x * parentTransform.scale * parentSin + layer.y * parentTransform.scale * parentCos;
                
                const finalX = parentTransform.x + transformedLayerX;
                const finalY = parentTransform.y + transformedLayerY;
                const finalRotation = layer.rotation + parentTransform.rotation;
                const finalScale = layer.scale * parentTransform.scale;
                
                ctx.translate(finalX, finalY);
                
                // ★ アンカーオフセット処理（通常の画像レイヤーと同じ）★
                const imgWidth = layer.img ? layer.img.width : 100;
                const imgHeight = layer.img ? layer.img.height : 100;
                const anchorOffsetX = (layer.anchorX || 0.5) * imgWidth;
                const anchorOffsetY = (layer.anchorY || 0.5) * imgHeight;
                ctx.translate(anchorOffsetX - imgWidth / 2, anchorOffsetY - imgHeight / 2);
                
                ctx.rotate(finalRotation * Math.PI / 180);
                ctx.scale(finalScale, finalScale);
                
                // アンカーポイントの円
                ctx.fillStyle = '#ff6b6b';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3 / finalScale;
            ctx.beginPath();
            ctx.arc(0, 0, 10 / finalScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // 十字線（大きく）
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3 / finalScale;
            ctx.beginPath();
            ctx.moveTo(-25 / finalScale, 0);
            ctx.lineTo(25 / finalScale, 0);
            ctx.moveTo(0, -25 / finalScale);
            ctx.lineTo(0, 25 / finalScale);
            ctx.stroke();
            
            ctx.restore();
            }
            return;
        }
        
        // 色抜きクリッピングが有効な場合は一時キャンバスを使用
        const useClipping = layer.colorClipping && layer.colorClipping.enabled && layer.colorClipping.referenceLayerId;
        
        let tempCanvas, tempCtx;
        if (useClipping) {
            tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            tempCtx = tempCanvas.getContext('2d', { alpha: true });
            tempCtx.save();
        } else {
            ctx.save();
        }
        
        const targetCtx = useClipping ? tempCtx : ctx;
        
        // 不透明度とブレンドモードを適用
        targetCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
        targetCtx.globalCompositeOperation = layer.blendMode || 'source-over';
        
        // 親の変形を適用（パペット追従を含む）
        // useClippingの場合もそうでない場合も、targetCtxを渡す
        let isFollowingPuppet = false;
        if (layer.followPuppetAnchor && layer.followPuppetAnchor.layerId && typeof getPuppetFollowPosition === 'function') {
            // パペットアンカーに追従する場合
            const followPos = getPuppetFollowPosition(layer.followPuppetAnchor);
            console.log('🎯 [追従描画] レイヤー:', layer.name, 'followPos:', followPos, 'layer.x:', layer.x, 'layer.y:', layer.y);
            if (followPos && !isNaN(followPos.x) && !isNaN(followPos.y)) {
                targetCtx.translate(followPos.x, followPos.y);
                isFollowingPuppet = true;
            } else {
                console.error('❌ [追従描画] 無効な座標:', followPos);
            }
        } else if (useClipping) {
            applyParentTransformToContext(tempCtx, layer);
        } else {
            applyParentTransform(layer);
        }
        
        // レイヤーの位置に移動（追従中は相対オフセットとして適用しない、または小さな値のみ）
        // 追従設定時は、画像をハンドル位置を中心に配置する
        if (!isFollowingPuppet) {
            // Wiggleオフセットを適用
            const wiggleOffset = typeof getWiggleOffset === 'function' ? getWiggleOffset(layer, localTime) : { x: 0, y: 0 };
            targetCtx.translate(layer.x + wiggleOffset.x, layer.y + wiggleOffset.y);
        }
        // 追従中でもオフセットが必要な場合はここで適用（現在は無視）
        
        // アンカーポイントのオフセット（画像左上からアンカーまでの距離）
        // anchorXがundefinedの場合は0.5（中央）をデフォルトとする
        const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
        const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
        const anchorOffsetX = anchorX * layer.width;
        const anchorOffsetY = anchorY * layer.height;
        
        // アンカーポイントを原点に移動
        targetCtx.translate(anchorOffsetX - layer.width / 2, anchorOffsetY - layer.height / 2);
        
        // 回転（アンカーポイントを中心に）
        targetCtx.rotate(layer.rotation * Math.PI / 180);
        
        // スケール（アンカーポイントを中心に）
        targetCtx.scale(layer.scale, layer.scale);
        
        if (layer.windSwayEnabled) {
            // 風揺れ適用（マスクはdrawLayerWithWindSway内で画像に適用済み）
            if (useClipping) {
                // 風揺れ用に一時的にグローバルコンテキストを切り替え
                const originalCtx = ctx;
                ctx = tempCtx;
                drawLayerWithWindSway(layer, -anchorOffsetX, -anchorOffsetY, localTime);
                ctx = originalCtx;
            } else {
                drawLayerWithWindSway(layer, -anchorOffsetX, -anchorOffsetY, localTime);
            }
        } else {
            // 通常描画（アンカーポイントを基準に）
            // 画像が存在することを確認
            if (!layer.img) {
                console.error('❌ [描画エラー] layer.imgが存在しません:', layer.name);
                ctx.restore();
                return;
            }
            if (isNaN(anchorOffsetX) || isNaN(anchorOffsetY) || isNaN(layer.width) || isNaN(layer.height)) {
                console.error('❌ [描画エラー] 無効な値:', {
                    name: layer.name,
                    anchorOffsetX, anchorOffsetY,
                    width: layer.width, height: layer.height
                });
            }
            
            // マスクを適用
            let maskApplied = false;
            if (layer.mask && layer.mask.enabled && layer.mask.path && typeof applyMaskToContext === 'function') {
                maskApplied = applyMaskToContext(targetCtx, layer, -anchorOffsetX, -anchorOffsetY);
            }
            
            targetCtx.drawImage(
                layer.img,
                -anchorOffsetX,
                -anchorOffsetY,
                layer.width,
                layer.height
            );
            
            // マスクを解除
            if (maskApplied && typeof restoreFromMask === 'function') {
                restoreFromMask(targetCtx);
            }
        }
        
        // アンカーポイントは最前面で一括描画するため、ここでは描画しない
        
        if (useClipping) {
            tempCtx.restore();
            
            // 色抜きクリッピングマスクを生成
            const mask = createColorClippingMask(layer);
            if (mask) {
                // 一時キャンバスにマスクを適用
                tempCtx.globalCompositeOperation = 'destination-in';
                tempCtx.drawImage(mask, 0, 0);
                tempCtx.globalCompositeOperation = 'source-over';
            }
            
            // メインキャンバスに描画
            ctx.save();
            ctx.globalCompositeOperation = layer.blendMode || 'source-over';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        } else {
            ctx.restore();
        }
    });
    
    // ピン表示を更新（風揺れピンモードがONの場合）
    if (pinMode && selectedLayerIds.length === 1) {
        const layer = layers.find(l => l.id === selectedLayerIds[0]);
        if (layer && layer.visible && layer.type === 'image') {
            // 書き出し中はピン要素を更新しない
            if (typeof isExporting === 'undefined' || !isExporting) {
                updatePinElements();
            }
        }
    }
    
    // パペットアンカー表示を更新（関数内部で判定）
    // 書き出し中はアンカーを描画しない
    if (typeof drawPuppetAnchorElements === 'function' && (typeof isExporting === 'undefined' || !isExporting)) {
        drawPuppetAnchorElements();
    }
    
    // ★★★ 選択中レイヤーのアンカーポイントを最前面に描画 ★★★
    if (typeof isExporting === 'undefined' || !isExporting) {
        drawSelectedLayerAnchors(localTime);
    }
    
    // マスク編集中のオーバーレイを描画
    if (typeof maskEditMode !== 'undefined' && maskEditMode && typeof drawMaskEditOverlay === 'function') {
        drawMaskEditOverlay(ctx);
    }
    
    // 回転ハンドルは不要（ドラッグで回転できるため削除）
}

// ===== 選択中レイヤーのアンカーポイントを最前面に描画 =====
function drawSelectedLayerAnchors(localTime) {
    if (selectedLayerIds.length === 0) return;
    
    selectedLayerIds.forEach((layerId, index) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer || !layer.visible) return;
        
        // 音声レイヤーはスキップ
        if (layer.type === 'audio') return;
        
        ctx.save();
        
        // レイヤータイプごとのランダム色を生成（レイヤーIDをシードに）
        const hue = (layerId * 137) % 360; // 黄金角を使ったランダム色
        const anchorColor = `hsl(${hue}, 100%, 50%)`;
        const anchorColorDark = `hsl(${hue}, 100%, 35%)`;
        
        let anchorPos;
        
        // フォルダーまたはジャンプフォルダーの場合
        if (layer.type === 'folder') {
            // 親のトランスフォームを取得
            const parentTransform = getParentTransform(layer.parentLayerId);
            
            // アンカーオフセットを計算
            let anchorOffsetX = layer.anchorOffsetX || 0;
            let anchorOffsetY = layer.anchorOffsetY || 0;
            
            // 基準レイヤーがある場合はそのアンカーを使用
            if (layer.anchorReferenceLayerId) {
                const refLayer = layers.find(l => l.id === layer.anchorReferenceLayerId);
                if (refLayer) {
                    const refAnchor = getLayerAnchorOffset(refLayer);
                    // 基準レイヤーの位置 + アンカーオフセット（フォルダのローカル座標系）
                    // ※ キーフレーム補間後も相対座標になっているはず
                    anchorOffsetX = refLayer.x + refAnchor.offsetX;
                    anchorOffsetY = refLayer.y + refAnchor.offsetY;
                }
            }
            
            // フォルダの位置 + 親のトランスフォーム + アンカーオフセット
            // ただしアンカーオフセットはフォルダのスケール・回転を適用する前の座標
            const folderWorldX = layer.x + parentTransform.x;
            const folderWorldY = layer.y + parentTransform.y;
            
            // アンカー位置をワールド座標に変換
            const rad = (layer.rotation + parentTransform.rotation) * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const scale = layer.scale * parentTransform.scale;
            
            anchorPos = {
                x: folderWorldX + anchorOffsetX,
                y: folderWorldY + anchorOffsetY,
                rotation: layer.rotation + parentTransform.rotation,
                scale: scale
            };
        } else {
            // 通常のレイヤー
            anchorPos = getLayerAnchorWorldPosition(layer, localTime);
        }
        
        if (!anchorPos) {
            ctx.restore();
            return;
        }
        
        ctx.translate(anchorPos.x, anchorPos.y);
        ctx.rotate(anchorPos.rotation * Math.PI / 180);
        ctx.scale(anchorPos.scale, anchorPos.scale);
        
        // アンカー回転を取得して十字マークに適用
        const anchorRotation = layer.anchorRotation || 0;
        
        // アンカーポイントの円（大きく目立つように）
        ctx.fillStyle = anchorColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4 / anchorPos.scale;
        ctx.beginPath();
        ctx.arc(0, 0, 14 / anchorPos.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // アンカー回転を適用してから十字線を描画
        ctx.save();
        ctx.rotate(anchorRotation * Math.PI / 180);
        
        // 十字線（大きく目立つように）
        ctx.strokeStyle = anchorColorDark;
        ctx.lineWidth = 4 / anchorPos.scale;
        ctx.beginPath();
        ctx.moveTo(-30 / anchorPos.scale, 0);
        ctx.lineTo(30 / anchorPos.scale, 0);
        ctx.moveTo(0, -30 / anchorPos.scale);
        ctx.lineTo(0, 30 / anchorPos.scale);
        ctx.stroke();
        
        // 白いアウトライン
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / anchorPos.scale;
        ctx.beginPath();
        ctx.moveTo(-30 / anchorPos.scale, 0);
        ctx.lineTo(30 / anchorPos.scale, 0);
        ctx.moveTo(0, -30 / anchorPos.scale);
        ctx.lineTo(0, 30 / anchorPos.scale);
        ctx.stroke();
        
        ctx.restore(); // アンカー回転を戻す
        
        ctx.restore(); // メインの変換を戻す
    });
}

// ===== レイヤーのアンカーオフセットを取得（ローカル座標系） =====
function getLayerAnchorOffset(layer) {
    if (!layer) return { offsetX: 0, offsetY: 0 };
    
    // レイヤータイプに応じたサイズ取得
    let layerWidth = 0, layerHeight = 0;
    let anchorX = 0.5, anchorY = 0.5;
    
    if (layer.type === 'puppet' || layer.type === 'bounce') {
        if (layer.img) {
            layerWidth = layer.img.width;
            layerHeight = layer.img.height;
        }
        anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
        anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    } else if (layer.type === 'lipsync' || layer.type === 'blink' || layer.type === 'sequence' || layer.type === 'crosssection') {
        if (layer.sequenceImages && layer.sequenceImages.length > 0) {
            layerWidth = layer.sequenceImages[0].width;
            layerHeight = layer.sequenceImages[0].height;
        }
        anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
        anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    } else if (layer.type === 'image') {
        layerWidth = layer.width || 0;
        layerHeight = layer.height || 0;
        anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
        anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    }
    
    // アンカーオフセット（画像の中心からアンカーまでの距離）
    const offsetX = (anchorX - 0.5) * layerWidth;
    const offsetY = (anchorY - 0.5) * layerHeight;
    
    return { offsetX, offsetY };
}

// ===== レイヤーのアンカーポイントのワールド座標を取得 =====
function getLayerAnchorWorldPosition(layer, localTime) {
    if (!layer) return null;
    
    // 親の変形を取得
    const parentTransform = getParentTransform(layer.parentLayerId);
    
    // 子のローカル座標を親の回転・スケールで変換
    const parentRad = parentTransform.rotation * Math.PI / 180;
    const parentCos = Math.cos(parentRad);
    const parentSin = Math.sin(parentRad);
    
    // Wiggleオフセットを取得
    const wiggleOffset = typeof getWiggleOffset === 'function' ? getWiggleOffset(layer, localTime) : { x: 0, y: 0 };
    const layerX = layer.x + wiggleOffset.x;
    const layerY = layer.y + wiggleOffset.y;
    
    const transformedLayerX = layerX * parentTransform.scale * parentCos - layerY * parentTransform.scale * parentSin;
    const transformedLayerY = layerX * parentTransform.scale * parentSin + layerY * parentTransform.scale * parentCos;
    
    let finalX = parentTransform.x + transformedLayerX;
    let finalY = parentTransform.y + transformedLayerY;
    const finalRotation = layer.rotation + parentTransform.rotation;
    const finalScale = layer.scale * parentTransform.scale;
    
    // レイヤータイプに応じたサイズ取得
    let layerWidth, layerHeight;
    if (layer.type === 'puppet' || layer.type === 'bounce') {
        if (layer.img) {
            layerWidth = layer.img.width;
            layerHeight = layer.img.height;
        } else {
            return null;
        }
    } else if (layer.type === 'lipsync' || layer.type === 'blink' || layer.type === 'sequence' || layer.type === 'crosssection') {
        if (layer.sequenceImages && layer.sequenceImages.length > 0) {
            layerWidth = layer.sequenceImages[0].width;
            layerHeight = layer.sequenceImages[0].height;
        } else {
            return null;
        }
    } else {
        layerWidth = layer.width;
        layerHeight = layer.height;
    }
    
    if (!layerWidth || !layerHeight) return null;
    
    // アンカーオフセットを計算
    const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
    const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    const anchorOffsetX = anchorX * layerWidth;
    const anchorOffsetY = anchorY * layerHeight;
    
    // アンカーオフセットを回転させて加算
    const offsetX = (anchorOffsetX - layerWidth / 2) * finalScale;
    const offsetY = (anchorOffsetY - layerHeight / 2) * finalScale;
    const rotatedOffsetX = offsetX * parentCos - offsetY * parentSin;
    const rotatedOffsetY = offsetX * parentSin + offsetY * parentCos;
    
    finalX += rotatedOffsetX;
    finalY += rotatedOffsetY;
    
    return {
        x: finalX,
        y: finalY,
        rotation: finalRotation,
        scale: finalScale
    };
}

// ===== 口パクレイヤー描画 =====
function drawLipSyncLayer(layer, time) {
    if (!layer.sequenceImages || layer.sequenceImages.length === 0) return;
    
    // 色抜きクリッピングが有効な場合は一時キャンバスを使用
    const useClipping = layer.colorClipping && layer.colorClipping.enabled && layer.colorClipping.referenceLayerId;
    
    let tempCanvas, tempCtx;
    if (useClipping) {
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx = tempCanvas.getContext('2d', { alpha: true });
        tempCtx.save();
    } else {
        ctx.save();
    }
    
    const targetCtx = useClipping ? tempCtx : ctx;
    
    // 親の変形を適用
    if (useClipping) {
        if (typeof applyParentTransformToContext === 'function') {
            applyParentTransformToContext(tempCtx, layer);
        }
    } else {
        applyParentTransform(layer);
    }
    
    // 不透明度とブレンドモードを適用
    targetCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
    targetCtx.globalCompositeOperation = layer.blendMode || 'source-over';
    
    // レイヤーの位置に移動
    targetCtx.translate(layer.x, layer.y);
    
    // 現在表示すべき画像を決定
    let currentImg = layer.sequenceImages[0]; // デフォルトは閉じた口（最初のフレーム）
    let width = layer.sequenceImages[0].width;
    let height = layer.sequenceImages[0].height;
    
    // キーフレームを時間順にソート
    const sortedKeyframes = (layer.keyframes || []).slice().sort((a, b) => a.frame - b.frame);
    
    // 現在のフレーム番号を計算（30fps想定）
    const currentFrame = Math.floor(time * (typeof projectFPS !== "undefined" ? projectFPS : 30));
    
    // 喋っている区間を判定
    let isSpeaking = false;
    let speakStartFrame = 0;
    
    for (let i = 0; i < sortedKeyframes.length; i++) {
        const kf = sortedKeyframes[i];
        
        if (kf.type === 'start' && currentFrame >= kf.frame) {
            isSpeaking = true;
            speakStartFrame = kf.frame;
        }
        
        if (kf.type === 'end' && currentFrame >= kf.frame) {
            isSpeaking = false;
        }
    }
    
    // 喋っている場合は連番アニメーションをループ
    if (isSpeaking && layer.sequenceImages.length > 1) {
        const fps = layer.fps || 24;
        const framesSinceStart = currentFrame - speakStartFrame;
        const sequenceLength = layer.sequenceImages.length - 1; // 最初のフレーム（閉じた口）を除く
        const seqIndex = Math.floor((framesSinceStart * fps / 30) % sequenceLength);
        currentImg = layer.sequenceImages[seqIndex + 1]; // +1 で閉じた口をスキップ
        width = currentImg.width;
        height = currentImg.height;
    }
    
    // アンカーポイントのオフセット
    const anchorOffsetX = layer.anchorX * width;
    const anchorOffsetY = layer.anchorY * height;
    
    // アンカーポイントを原点に移動
    targetCtx.translate(anchorOffsetX - width / 2, anchorOffsetY - height / 2);
    
    // 回転（アンカーポイントを中心に）
    targetCtx.rotate(layer.rotation * Math.PI / 180);
    
    // スケール（アンカーポイントを中心に）
    targetCtx.scale(layer.scale, layer.scale);
    
    // 画像を描画
    // マスクを適用
    let maskApplied = false;
    if (layer.mask && layer.mask.enabled && layer.mask.path && typeof applyMaskToContext === 'function') {
        maskApplied = applyMaskToContext(targetCtx, layer, -anchorOffsetX, -anchorOffsetY);
    }
    
    targetCtx.drawImage(
        currentImg,
        -anchorOffsetX,
        -anchorOffsetY,
        width,
        height
    );
    
    // マスクを解除
    if (maskApplied && typeof restoreFromMask === 'function') {
        restoreFromMask(targetCtx);
    }
    
    // アンカーポイント表示 - 書き出し中は描画しない
    if (typeof isExporting === 'undefined' || !isExporting) {
        targetCtx.fillStyle = '#ff69b4';
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, 10, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        
        targetCtx.strokeStyle = '#ff69b4';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.moveTo(-25, 0);
        targetCtx.lineTo(25, 0);
        targetCtx.moveTo(0, -25);
        targetCtx.lineTo(0, 25);
        targetCtx.stroke();
    }
    
    if (useClipping) {
        tempCtx.restore();
        
        // 色抜きクリッピングマスクを生成
        const mask = typeof createColorClippingMask === 'function' ? createColorClippingMask(layer) : null;
        if (mask) {
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(mask, 0, 0);
            tempCtx.globalCompositeOperation = 'source-over';
        }
        
        // メインキャンバスに描画
        ctx.save();
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    } else {
        ctx.restore();
    }
}

// ===== まばたきレイヤー描画 =====
function drawBlinkLayer(layer, time) {
    if (!layer.sequenceImages || layer.sequenceImages.length === 0) return;
    
    // 色抜きクリッピングが有効な場合は一時キャンバスを使用
    const useClipping = layer.colorClipping && layer.colorClipping.enabled && layer.colorClipping.referenceLayerId;
    
    let tempCanvas, tempCtx;
    if (useClipping) {
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx = tempCanvas.getContext('2d', { alpha: true });
        tempCtx.save();
    } else {
        ctx.save();
    }
    
    const targetCtx = useClipping ? tempCtx : ctx;
    
    // 親の変形を適用
    if (useClipping) {
        if (typeof applyParentTransformToContext === 'function') {
            applyParentTransformToContext(tempCtx, layer);
        }
    } else {
        applyParentTransform(layer);
    }
    
    // 不透明度とブレンドモードを適用
    targetCtx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
    targetCtx.globalCompositeOperation = layer.blendMode || 'source-over';
    
    // レイヤーの位置に移動
    targetCtx.translate(layer.x, layer.y);
    
    // 現在表示すべき画像を決定
    let currentImg = layer.sequenceImages[0]; // デフォルトは開いた目（最初のフレーム）
    let width = layer.sequenceImages[0].width;
    let height = layer.sequenceImages[0].height;
    
    // 現在のフレーム番号を計算（30fps想定）
    const currentFrame = Math.floor(time * (typeof projectFPS !== "undefined" ? projectFPS : 30));
    
    // まばたきアニメーション中かチェック
    const sortedKeyframes = (layer.keyframes || []).slice().sort((a, b) => a.frame - b.frame);
    
    for (const kf of sortedKeyframes) {
        if (currentFrame >= kf.frame) {
            const framesSinceStart = currentFrame - kf.frame;
            const fps = layer.fps || 24;
            const totalAnimFrames = (layer.sequenceImages.length - 1) * (30 / fps);
            
            // まばたきアニメーションの長さ内ならアニメーション再生
            if (framesSinceStart < totalAnimFrames) {
                const seqIndex = Math.floor(framesSinceStart * fps / 30);
                if (seqIndex < layer.sequenceImages.length - 1) {
                    currentImg = layer.sequenceImages[seqIndex + 1]; // +1 で開いた目をスキップ
                    width = currentImg.width;
                    height = currentImg.height;
                }
            }
        }
    }
    
    // アンカーポイントのオフセット
    const anchorOffsetX = layer.anchorX * width;
    const anchorOffsetY = layer.anchorY * height;
    
    // アンカーポイントを原点に移動
    targetCtx.translate(anchorOffsetX - width / 2, anchorOffsetY - height / 2);
    
    // 回転（アンカーポイントを中心に）
    targetCtx.rotate(layer.rotation * Math.PI / 180);
    
    // スケール（アンカーポイントを中心に）
    targetCtx.scale(layer.scale, layer.scale);
    
    // 画像を描画
    // マスクを適用
    let blinkMaskApplied = false;
    if (layer.mask && layer.mask.enabled && layer.mask.path && typeof applyMaskToContext === 'function') {
        blinkMaskApplied = applyMaskToContext(targetCtx, layer, -anchorOffsetX, -anchorOffsetY);
    }
    
    targetCtx.drawImage(
        currentImg,
        -anchorOffsetX,
        -anchorOffsetY,
        width,
        height
    );
    
    // マスクを解除
    if (blinkMaskApplied && typeof restoreFromMask === 'function') {
        restoreFromMask(targetCtx);
    }
    
    // アンカーポイント表示 - 書き出し中は描画しない
    if (typeof isExporting === 'undefined' || !isExporting) {
        targetCtx.fillStyle = '#87ceeb';
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, 10, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        
        targetCtx.strokeStyle = '#87ceeb';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.moveTo(-25, 0);
        targetCtx.lineTo(25, 0);
        targetCtx.moveTo(0, -25);
        targetCtx.lineTo(0, 25);
        targetCtx.stroke();
    }
    
    if (useClipping) {
        tempCtx.restore();
        
        // 色抜きクリッピングマスクを生成
        const mask = typeof createColorClippingMask === 'function' ? createColorClippingMask(layer) : null;
        if (mask) {
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(mask, 0, 0);
            tempCtx.globalCompositeOperation = 'source-over';
        }
        
        // メインキャンバスに描画
        ctx.save();
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    } else {
        ctx.restore();
    }
}

// ===== 連番アニメレイヤー描画 =====
function drawSequenceLayer(layer, localTime) {
    if (!layer.sequenceImages || layer.sequenceImages.length === 0) return;
    
    // 色抜きクリッピングが有効な場合は一時キャンバスを使用
    const useClipping = layer.colorClipping && layer.colorClipping.enabled && layer.colorClipping.referenceLayerId;
    
    let tempCanvas, tempCtx;
    if (useClipping) {
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx = tempCanvas.getContext('2d', { alpha: true });
        tempCtx.save();
    } else {
        ctx.save();
    }
    
    const targetCtx = useClipping ? tempCtx : ctx;
    
    // 親の変形を適用
    if (useClipping) {
        if (typeof applyParentTransformToContext === 'function') {
            applyParentTransformToContext(tempCtx, layer);
        }
    } else {
        applyParentTransform(layer);
    }
    
    // ブレンドモード設定
    targetCtx.globalCompositeOperation = layer.blendMode || 'source-over';
    targetCtx.globalAlpha = layer.opacity;
    
    // 現在の画像を取得
    let currentImg = layer.sequenceImages[0];
    if (!currentImg) {
        if (useClipping) {
            tempCtx.restore();
        } else {
            ctx.restore();
        }
        return;
    }
    let width = currentImg.width;
    let height = currentImg.height;
    
    // 常にループ再生（コマ落とし対応）
    const fps = layer.fps || 24;
    const frameSkip = layer.frameSkip || 0; // 何フレームスキップするか
    const skipInterval = frameSkip + 1; // 実際の間隔（例: frameSkip=2なら3フレームごと）
    
    // 時間からフレーム番号を計算（FPSベース）
    const frameIndex = Math.floor(localTime * fps);
    
    // コマ落とし: フレームインデックスにスキップ間隔を掛けて画像インデックスを決定
    // 例: frameSkip=2, 連番7枚の場合
    // frameIndex=0 → 0*3=0 → 画像0
    // frameIndex=1 → 1*3=3 → 画像3
    // frameIndex=2 → 2*3=6 → 画像6
    // frameIndex=3 → 3*3=9 → 9%7=2 → 画像2
    // これにより、同じ時間でより多くの連番を飛ばすので早く見える
    const imageIndex = (frameIndex * skipInterval) % layer.sequenceImages.length;
    const selectedImg = layer.sequenceImages[imageIndex];
    if (selectedImg) {
        currentImg = selectedImg;
        width = currentImg.width;
        height = currentImg.height;
    }
    
    // アンカーポイント計算
    const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
    const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    const anchorOffsetX = width * anchorX;
    const anchorOffsetY = height * anchorY;
    
    // 位置（Wiggleオフセットを適用）
    const wiggleOffset = typeof getWiggleOffset === 'function' ? getWiggleOffset(layer, localTime) : { x: 0, y: 0 };
    targetCtx.translate(layer.x + wiggleOffset.x, layer.y + wiggleOffset.y);
    
    // 回転（アンカーポイントを中心に）
    targetCtx.rotate(layer.rotation * Math.PI / 180);
    
    // スケール（アンカーポイントを中心に）
    targetCtx.scale(layer.scale, layer.scale);
    
    // 画像を描画（有効な画像のみ）
    // マスクを適用
    let seqMaskApplied = false;
    if (layer.mask && layer.mask.enabled && layer.mask.path && typeof applyMaskToContext === 'function') {
        seqMaskApplied = applyMaskToContext(targetCtx, layer, -anchorOffsetX, -anchorOffsetY);
    }
    
    if (currentImg && currentImg.complete && currentImg.naturalWidth > 0) {
        targetCtx.drawImage(
            currentImg,
            -anchorOffsetX,
            -anchorOffsetY,
            width,
            height
        );
    }
    
    // マスクを解除
    if (seqMaskApplied && typeof restoreFromMask === 'function') {
        restoreFromMask(targetCtx);
    }
    
    // アンカーポイント表示 - 書き出し中は描画しない
    if (typeof isExporting === 'undefined' || !isExporting) {
        targetCtx.fillStyle = '#20b2aa';
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, 10, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        
        targetCtx.strokeStyle = '#20b2aa';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.moveTo(-25, 0);
        targetCtx.lineTo(25, 0);
        targetCtx.moveTo(0, -25);
        targetCtx.lineTo(0, 25);
        targetCtx.stroke();
    }
    
    if (useClipping) {
        tempCtx.restore();
        
        // 色抜きクリッピングマスクを生成
        const mask = typeof createColorClippingMask === 'function' ? createColorClippingMask(layer) : null;
        if (mask) {
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(mask, 0, 0);
            tempCtx.globalCompositeOperation = 'source-over';
        }
        
        // メインキャンバスに描画
        ctx.save();
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    } else {
        ctx.restore();
    }
}

// ===== 親のトランスフォームを取得（累積） =====
function getParentTransform(parentLayerId) {
    let result = { x: 0, y: 0, rotation: 0, scale: 1 };
    
    if (!parentLayerId) return result;
    
    let parent = layers.find(l => l.id === parentLayerId);
    while (parent) {
        // 親の回転を考慮して座標を変換
        const rad = result.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        // 親の位置を取得
        let parentX = parent.x;
        let parentY = parent.y;
        
        // フォルダの歩行アニメーションオフセット
        if (parent.type === 'folder' && parent.walkingEnabled && typeof calculateWalkingOffset === 'function') {
            const walkingOffset = calculateWalkingOffset(parent, currentTime);
            if (walkingOffset.active) {
                parentX += walkingOffset.x;
                parentY += walkingOffset.y;
            }
        }
        
        // フォルダのジャンプオフセット（ジャンプ機能有効時）
        if (parent.type === 'folder' && parent.jumpParams && typeof calculateJumpOffset === 'function') {
            const jumpOffset = calculateJumpOffset(parent, currentTime);
            parentX += jumpOffset.x;
            parentY += jumpOffset.y;
        }
        
        // 現在の累積座標に親の変形を適用
        const scaledX = result.x * parent.scale;
        const scaledY = result.y * parent.scale;
        const parentRad = parent.rotation * Math.PI / 180;
        const parentCos = Math.cos(parentRad);
        const parentSin = Math.sin(parentRad);
        const rotatedX = scaledX * parentCos - scaledY * parentSin;
        const rotatedY = scaledX * parentSin + scaledY * parentCos;
        
        result.x = parentX + rotatedX;
        result.y = parentY + rotatedY;
        result.rotation += parent.rotation;
        result.scale *= parent.scale;
        
        parent = layers.find(l => l.id === parent.parentLayerId);
    }
    
    return result;
}

// ===== 静的な親の変形を取得（アニメーションオフセットなし） =====
// 親子関係の設定時に使用（ジャンプ・歩行オフセットを除外）
function getStaticParentTransform(parentLayerId) {
    let result = { x: 0, y: 0, rotation: 0, scale: 1 };
    
    if (!parentLayerId) return result;
    
    let parent = layers.find(l => l.id === parentLayerId);
    while (parent) {
        // 親の位置を取得（アニメーションオフセットなし）
        let parentX = parent.x;
        let parentY = parent.y;
        
        // 現在の累積座標に親の変形を適用
        const scaledX = result.x * parent.scale;
        const scaledY = result.y * parent.scale;
        const parentRad = parent.rotation * Math.PI / 180;
        const parentCos = Math.cos(parentRad);
        const parentSin = Math.sin(parentRad);
        const rotatedX = scaledX * parentCos - scaledY * parentSin;
        const rotatedY = scaledX * parentSin + scaledY * parentCos;
        
        result.x = parentX + rotatedX;
        result.y = parentY + rotatedY;
        result.rotation += parent.rotation;
        result.scale *= parent.scale;
        
        parent = layers.find(l => l.id === parent.parentLayerId);
    }
    
    return result;
}

// ===== 親の変形を適用 =====
function applyParentTransform(layer) {
    // パペットアンカーに追従する場合
    if (layer.followPuppetAnchor && layer.followPuppetAnchor.layerId && typeof getPuppetFollowPosition === 'function') {
        const followPos = getPuppetFollowPosition(layer.followPuppetAnchor);
        ctx.translate(followPos.x, followPos.y);
        return;
    }
    
    if (!layer.parentLayerId) return;
    
    const parent = layers.find(l => l.id === layer.parentLayerId);
    if (!parent) return;
    
    // 親の変形を再帰的に適用（親がフォルダでも他のレイヤーでも処理）
    applyParentTransform(parent);
    
    // 親の位置に移動
    ctx.translate(parent.x, parent.y);
    
    // フォルダの場合（ジャンプ機能含む）
    if (parent.type === 'folder') {
        // アンカー基準レイヤーがある場合はそのアンカーを使用
        let anchorOffsetX = parent.anchorOffsetX || 0;
        let anchorOffsetY = parent.anchorOffsetY || 0;
        
        if (parent.anchorReferenceLayerId) {
            const refLayer = layers.find(l => l.id === parent.anchorReferenceLayerId);
            if (refLayer) {
                const refAnchor = getLayerAnchorOffset(refLayer);
                // 基準レイヤーの位置 + アンカーオフセット
                anchorOffsetX = refLayer.x + refAnchor.offsetX;
                anchorOffsetY = refLayer.y + refAnchor.offsetY;
            }
        }
        
        // 歩行アニメーションのオフセットを適用
        if (parent.walkingEnabled && typeof calculateWalkingOffset === 'function') {
            const walkingOffset = calculateWalkingOffset(parent, currentTime);
            if (walkingOffset.active) {
                ctx.translate(walkingOffset.x, walkingOffset.y);
            }
        }
        
        // ジャンプオフセットを適用（ジャンプ機能有効時）
        if (parent.jumpParams && typeof calculateJumpOffset === 'function') {
            const jumpOffset = calculateJumpOffset(parent, currentTime);
            ctx.translate(jumpOffset.x, jumpOffset.y);
        }
        
        // アンカーポイントを原点に移動して回転・スケール、その後戻す
        ctx.translate(anchorOffsetX, anchorOffsetY);
        ctx.rotate(parent.rotation * Math.PI / 180);
        ctx.scale(parent.scale, parent.scale);
        ctx.translate(-anchorOffsetX, -anchorOffsetY);
        return;
    }
    
    // パペットレイヤーの場合
    if (parent.type === 'puppet') {
        if (parent.img) {
            const parentWidth = parent.img.width;
            const parentHeight = parent.img.height;
            const parentAnchorOffsetX = parent.anchorX * parentWidth;
            const parentAnchorOffsetY = parent.anchorY * parentHeight;
            ctx.translate(parentAnchorOffsetX - parentWidth / 2, parentAnchorOffsetY - parentHeight / 2);
        }
        ctx.rotate(parent.rotation * Math.PI / 180);
        ctx.scale(parent.scale, parent.scale);
        return;
    }
    
    // 画像レイヤー、口パク、まばたき、連番アニメ、断面図、バウンスレイヤーの場合
    let parentWidth, parentHeight;
    
    if (parent.type === 'lipsync' || parent.type === 'blink' || parent.type === 'sequence' || parent.type === 'crosssection') {
        // 口パク・まばたき・連番アニメ・断面図レイヤーの場合は最初の画像のサイズを使用
        if (parent.sequenceImages && parent.sequenceImages.length > 0) {
            parentWidth = parent.sequenceImages[0].width;
            parentHeight = parent.sequenceImages[0].height;
        } else {
            return;
        }
    } else if (parent.type === 'bounce') {
        if (parent.img) {
            parentWidth = parent.img.width;
            parentHeight = parent.img.height;
        } else {
            return;
        }
    } else {
        // 通常の画像レイヤー
        parentWidth = parent.width;
        parentHeight = parent.height;
    }
    
    // 親のアンカーポイントのオフセット
    const parentAnchorOffsetX = parent.anchorX * parentWidth;
    const parentAnchorOffsetY = parent.anchorY * parentHeight;
    
    // 親のアンカーポイントを原点に移動
    ctx.translate(parentAnchorOffsetX - parentWidth / 2, parentAnchorOffsetY - parentHeight / 2);
    
    // 親の回転（アンカーポイントを中心に）
    ctx.rotate(parent.rotation * Math.PI / 180);
    
    // 親のスケール（アンカーポイントを中心に）
    ctx.scale(parent.scale, parent.scale);
}

// ===== フォルダ内レイヤーを風揺れ付きで描画 =====
function drawFolderWithWindSway(folder, localTime) {
    if (!folder || folder.type !== 'folder' || !folder.windSwayEnabled) return;
    
    // フォルダの子レイヤーを取得
    const childLayers = layers.filter(l => l.parentLayerId === folder.id);
    if (childLayers.length === 0) return;
    
    // フォルダの変形を計算
    const folderAnchorOffsetX = folder.anchorOffsetX || 0;
    const folderAnchorOffsetY = folder.anchorOffsetY || 0;
    
    // 各子レイヤーを描画
    childLayers.forEach(layer => {
        if (!layer.visible) return;
        if (!layer.img) return;
        
        ctx.save();
        
        // 不透明度とブレンドモードを適用
        ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
        ctx.globalCompositeOperation = layer.blendMode || 'source-over';
        
        // フォルダの位置に移動
        ctx.translate(folder.x, folder.y);
        
        // 歩行アニメーションのオフセットを適用
        if (folder.walkingEnabled && typeof calculateWalkingOffset === 'function') {
            const walkingOffset = calculateWalkingOffset(folder, localTime);
            if (walkingOffset.active) {
                ctx.translate(walkingOffset.x, walkingOffset.y);
            }
        }
        
        // フォルダのアンカーポイントを適用
        ctx.translate(folderAnchorOffsetX, folderAnchorOffsetY);
        
        // フォルダの回転とスケールを適用
        ctx.rotate(folder.rotation * Math.PI / 180);
        ctx.scale(folder.scale, folder.scale);
        
        // 子レイヤーの位置に移動
        ctx.translate(layer.x, layer.y);
        
        // アンカーポイントのオフセット
        const anchorOffsetX = layer.anchorX * layer.width;
        const anchorOffsetY = layer.anchorY * layer.height;
        
        // アンカーポイントを原点に移動
        ctx.translate(anchorOffsetX - layer.width / 2, anchorOffsetY - layer.height / 2);
        
        // 子レイヤーの回転とスケールを適用
        ctx.rotate(layer.rotation * Math.PI / 180);
        ctx.scale(layer.scale, layer.scale);
        
        // 風揺れを適用して描画（フォルダの風揺れパラメータを使用）
        if (typeof applyWindShakeWebGL === 'function') {
            applyWindShakeWebGL(ctx, layer.img, layer.width, layer.height, localTime, folder.windSwayParams, layer.anchorX, layer.anchorY);
        } else {
            // 風揺れが使用できない場合は通常描画
            ctx.drawImage(layer.img, -anchorOffsetX, -anchorOffsetY, layer.width, layer.height);
        }
        
        // アンカーポイント表示（書き出し中は描画しない）
        if (typeof isExporting === 'undefined' || !isExporting) {
            ctx.fillStyle = '#ff6b6b';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-25, 0);
            ctx.lineTo(25, 0);
            ctx.moveTo(0, -25);
            ctx.lineTo(0, 25);
            ctx.stroke();
        }
        
        ctx.restore();
    });
}

// ===== ジャンプオフセット計算 =====
function calculateJumpOffset(folder, localTime) {
    if (!folder || folder.type !== 'folder') return { x: 0, y: 0 };
    if (!folder.jumpParams) return { x: 0, y: 0 };
    
    const jp = folder.jumpParams;
    const direction = jp.direction || 'up';
    
    let offsetValue = 0;
    
    // ループモードの場合
    if (jp.loop) {
        const period = jp.loopPeriod || 1.0;
        const omega = 2 * Math.PI / period;
        // サイン波で移動
        const wave = Math.sin(omega * localTime);
        offsetValue = Math.abs(wave) * jp.amplitude;
    } else {
        // 通常モード（キーフレームベース）
        if (!jp.keyframes || jp.keyframes.length === 0) {
            return { x: 0, y: 0 };
        }
        
        // アクティブなキーフレームを探す（現在のフレームより前で最も近いもの）
        const fps = typeof projectFPS !== 'undefined' ? projectFPS : 24;
        const currentFrameNum = Math.floor(localTime * fps);
        
        let activeKeyframe = null;
        for (let i = jp.keyframes.length - 1; i >= 0; i--) {
            if (jp.keyframes[i].frame <= currentFrameNum) {
                activeKeyframe = jp.keyframes[i];
                break;
            }
        }
        
        if (!activeKeyframe) {
            return { x: 0, y: 0 };
        }
        
        // キーフレームからの経過時間を計算
        const keyframeTime = activeKeyframe.frame / fps;
        const elapsedTime = localTime - keyframeTime;
        
        if (elapsedTime < 0) {
            return { x: 0, y: 0 };
        }
        
        // 減衰付き弾みアニメーション
        const damping = Math.exp(-5 * (elapsedTime / jp.dampingTime));
        const omega = 2 * Math.PI * jp.frequency / jp.dampingTime;
        const wave = Math.sin(omega * elapsedTime) * damping;
        
        offsetValue = Math.abs(wave) * jp.amplitude;
    }
    
    // 方向に応じてローカル座標系でのオフセットを決定
    let localX = 0, localY = 0;
    switch (direction) {
        case 'up':
            localX = 0; localY = -offsetValue;
            break;
        case 'down':
            localX = 0; localY = offsetValue;
            break;
        case 'left':
            localX = -offsetValue; localY = 0;
            break;
        case 'right':
            localX = offsetValue; localY = 0;
            break;
        default:
            localX = 0; localY = -offsetValue;
    }
    
    // フォルダの回転を考慮してワールド座標系に変換
    const folderRotation = folder.rotation || 0;
    const rad = folderRotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // 回転行列を適用
    const worldX = localX * cos - localY * sin;
    const worldY = localX * sin + localY * cos;
    
    return { x: worldX, y: worldY };
}

// ===== キャンバスサイズ設定 =====
function setCanvasSize() {
    const widthInput = document.getElementById('canvas-width-input');
    const heightInput = document.getElementById('canvas-height-input');
    
    if (!widthInput || !heightInput) return;
    
    const newWidth = parseInt(widthInput.value) || 1920;
    const newHeight = parseInt(heightInput.value) || 1080;
    
    // 範囲制限
    const clampedWidth = Math.max(100, Math.min(7680, newWidth));
    const clampedHeight = Math.max(100, Math.min(4320, newHeight));
    
    // 入力欄を更新
    widthInput.value = clampedWidth;
    heightInput.value = clampedHeight;
    
    // キャンバスサイズを変更
    canvas.width = clampedWidth;
    canvas.height = clampedHeight;
    
    console.log(`📐 キャンバスサイズ変更: ${clampedWidth}×${clampedHeight}`);
    
    // 再描画
    render();
    
    // 履歴に保存
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== キャンバスサイズプリセット =====
function setCanvasSizePreset(width, height) {
    const widthInput = document.getElementById('canvas-width-input');
    const heightInput = document.getElementById('canvas-height-input');
    
    if (widthInput) widthInput.value = width;
    if (heightInput) heightInput.value = height;
    
    setCanvasSize();
}

// ===== 現在のキャンバスサイズをUIに反映 =====
function updateCanvasSizeUI() {
    const widthInput = document.getElementById('canvas-width-input');
    const heightInput = document.getElementById('canvas-height-input');
    
    if (widthInput) widthInput.value = canvas.width;
    if (heightInput) heightInput.value = canvas.height;
}
