/**
 * 🐻 Puppet Bear v1.16.0
 * まばたきレイヤー専用モジュール - 表情プレビュー・最後の表情指定
 */

// ===== まばたきキーフレーム追加（既存関数を拡張） =====
function addBlinkKeyframe(layerId) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.type !== 'blink') return;
    
    // 現在のフレーム位置を取得
    const currentFrame = Math.floor(currentTime * (typeof projectFPS !== 'undefined' ? projectFPS : 30));
    
    // キーフレームを初期化
    if (!layer.keyframes) {
        layer.keyframes = [];
    }
    
    // 同じフレームに既存のまばたきキーフレームがあるか確認
    const existingIndex = layer.keyframes.findIndex(kf => 
        kf.frame === currentFrame && (kf.type === 'blink' || !kf.type)
    );
    
    if (existingIndex >= 0) {
        console.log(`⚠️ フレーム ${currentFrame} には既にまばたきキーフレームがあります`);
        return;
    }
    
    // 新しいキーフレームを追加
    layer.keyframes.push({
        frame: currentFrame,
        type: 'blink'
    });
    
    // タイムラインを更新
    if (typeof updateTimelineContent === 'function') {
        updateTimelineContent();
    }
    
    // プロパティパネルを更新
    if (typeof updatePropertiesPanel === 'function') {
        updatePropertiesPanel();
    }
    
    // 描画を更新
    render();
    
    // 履歴保存
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
    
    console.log(`👀 まばたきキーフレームを挿入: フレーム ${currentFrame}`);
}

// ===== まばたきキーフレーム削除 =====
function removeBlinkKeyframe(layerId, index) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.type !== 'blink' || !layer.keyframes) return;
    
    // ソートされた配列から実際のインデックスを取得
    const sortedKeyframes = layer.keyframes.slice().sort((a, b) => a.frame - b.frame);
    const targetKeyframe = sortedKeyframes[index];
    
    if (!targetKeyframe) return;
    
    // 元の配列から削除
    const originalIndex = layer.keyframes.findIndex(kf => 
        kf.frame === targetKeyframe.frame && kf.type === targetKeyframe.type
    );
    
    if (originalIndex >= 0) {
        layer.keyframes.splice(originalIndex, 1);
    }
    
    // タイムラインを更新
    if (typeof updateTimelineContent === 'function') {
        updateTimelineContent();
    }
    
    // プロパティパネルを更新
    if (typeof updatePropertiesPanel === 'function') {
        updatePropertiesPanel();
    }
    
    // 描画を更新
    render();
    
    // 履歴保存
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== 表情プレビューキャンバスの更新 =====
function updateExpressionPreview(layer, index) {
    if (!layer || !layer.sequenceImages || layer.sequenceImages.length === 0) {
        console.log('❌ updateExpressionPreview: レイヤーまたは画像がない');
        return;
    }
    
    const previewCanvas = document.getElementById('expression-preview-canvas');
    if (!previewCanvas) {
        console.log('❌ updateExpressionPreview: キャンバスが見つからない');
        return;
    }
    
    const img = layer.sequenceImages[index];
    if (!img) {
        console.log('❌ updateExpressionPreview: 画像インデックス', index, 'が見つからない');
        return;
    }
    
    console.log('🖼️ プレビュー更新: index=', index, 'img.width=', img.width, 'img.height=', img.height);
    
    const previewCtx = previewCanvas.getContext('2d');
    
    // 画像の描画範囲を計算（透明部分をトリミング）
    const bounds = getImageBounds(img);
    
    // プレビューサイズを計算（最大120px、アスペクト比維持）
    const maxSize = 120;
    const boundWidth = bounds.width || img.width;
    const boundHeight = bounds.height || img.height;
    const scale = Math.min(maxSize / boundWidth, maxSize / boundHeight, 1);
    
    const displayWidth = Math.ceil(boundWidth * scale);
    const displayHeight = Math.ceil(boundHeight * scale);
    
    previewCanvas.width = displayWidth;
    previewCanvas.height = displayHeight;
    
    // 背景をクリア（透明チェッカーパターン）
    drawCheckerPattern(previewCtx, displayWidth, displayHeight);
    
    // 画像を描画（トリミングして描画）
    previewCtx.drawImage(
        img,
        bounds.x, bounds.y, boundWidth, boundHeight,
        0, 0, displayWidth, displayHeight
    );
    
    // インデックス表示を更新
    const indexDisplay = document.getElementById('expression-current-index');
    if (indexDisplay) {
        indexDisplay.textContent = `${index + 1} / ${layer.sequenceImages.length}`;
    }
}

// ===== 画像の描画範囲を取得（透明部分を除外） =====
function getImageBounds(img) {
    try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        
        let minX = img.width;
        let minY = img.height;
        let maxX = 0;
        let maxY = 0;
        
        // 透明でないピクセルを探す
        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const alpha = data[(y * img.width + x) * 4 + 3];
                if (alpha > 10) { // ほぼ透明でないピクセル
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        
        // 余白を追加
        const padding = 4;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(img.width - 1, maxX + padding);
        maxY = Math.min(img.height - 1, maxY + padding);
        
        // 有効な範囲が見つからない場合は全体を返す
        if (minX >= maxX || minY >= maxY) {
            return { x: 0, y: 0, width: img.width, height: img.height };
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    } catch (e) {
        console.log('❌ getImageBounds エラー:', e);
        return { x: 0, y: 0, width: img.width, height: img.height };
    }
}

// ===== チェッカーパターン描画（透明背景表示用） =====
function drawCheckerPattern(ctx, width, height) {
    const size = 8;
    const colors = ['#3a3a3a', '#2a2a2a'];
    
    for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
            const colorIndex = ((Math.floor(x / size) + Math.floor(y / size)) % 2);
            ctx.fillStyle = colors[colorIndex];
            ctx.fillRect(x, y, size, size);
        }
    }
}

// ===== まばたきレイヤーの表情設定UIを生成 =====
function generateBlinkExpressionUI(layer) {
    if (!layer || layer.type !== 'blink' || !layer.sequenceImages || layer.sequenceImages.length === 0) {
        return '';
    }
    
    const maxIndex = layer.sequenceImages.length - 1;
    // selectedExpressionIndexを優先（スライダーで選択中の値）
    const currentIndex = layer.selectedExpressionIndex !== undefined 
        ? layer.selectedExpressionIndex 
        : (layer.lastExpressionIndex || 0);
    const isEnabled = layer.useLastExpression || false;
    
    return `
        <div class="property-group">
            <h4>😊 表情設定</h4>
            
            <!-- 表情プレビューコンテナ（常に表示） -->
            <div class="expression-preview-container" id="expression-preview-wrapper">
                <div class="expression-preview-label">表情プレビュー</div>
                <canvas id="expression-preview-canvas" class="expression-preview-canvas" width="120" height="120"></canvas>
                <div class="expression-current-index" id="expression-current-index">${currentIndex + 1} / ${layer.sequenceImages.length}</div>
                
                <!-- スライダー（oninputで直接関数呼び出し） -->
                <div class="expression-slider-container">
                    <input type="range" 
                        id="expression-slider" 
                        class="expression-slider"
                        min="0" 
                        max="${maxIndex}" 
                        value="${currentIndex}"
                        oninput="handleExpressionSliderInput(${layer.id}, this.value)">
                    <div class="expression-index-display">
                        <span>1</span>
                        <span>${layer.sequenceImages.length}</span>
                    </div>
                </div>
            </div>
            
            <!-- 最後の表情を指定するチェックボックス -->
            <label class="expression-checkbox-label" style="margin-top: 8px;">
                <input type="checkbox" 
                    id="use-last-expression" 
                    ${isEnabled ? 'checked' : ''}
                    onchange="toggleLastExpression(${layer.id}, this.checked)">
                <span>デフォルト表情として使用</span>
            </label>
            <div style="font-size: 10px; color: var(--biscuit); margin-top: 4px; padding-left: 24px;">
                チェックすると、まばたき後この表情に戻ります
            </div>
            
            <!-- 表情指定キーフレーム挿入ボタン -->
            <button class="btn-expression-keyframe" 
                onclick="insertExpressionKeyframe(${layer.id})"
                title="現在のフレーム位置に表情指定キーフレームを挿入">
                🎯 表情キーフレームを挿入
            </button>
            <div style="font-size: 10px; color: var(--biscuit); margin-top: 4px;">
                現在の表情 → 選択した表情へ遷移アニメーション
            </div>
        </div>
    `;
}

// ===== スライダー入力ハンドラ（グローバル関数） =====
function handleExpressionSliderInput(layerId, value) {
    const index = parseInt(value);
    const layer = layers.find(l => l.id === layerId);
    if (!layer) {
        console.log('❌ handleExpressionSliderInput: レイヤーが見つからない', layerId);
        return;
    }
    
    console.log('🎚️ スライダー入力:', index, 'layerId=', layerId);
    
    // selectedExpressionIndexに保存（キーフレーム挿入用）
    layer.selectedExpressionIndex = index;
    
    // デフォルト表情が有効なら lastExpressionIndex も更新
    if (layer.useLastExpression) {
        layer.lastExpressionIndex = index;
    }
    
    // プレビュー更新
    updateExpressionPreview(layer, index);
    
    // インデックス表示を更新
    const indexDisplay = document.getElementById('expression-current-index');
    if (indexDisplay && layer.sequenceImages) {
        indexDisplay.textContent = `${index + 1} / ${layer.sequenceImages.length}`;
    }
}

// ===== 最後の表情指定のトグル =====
function toggleLastExpression(layerId, enabled) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.type !== 'blink') return;
    
    layer.useLastExpression = enabled;
    
    // 有効になった場合は現在のスライダー値を保存
    if (enabled && layer.selectedExpressionIndex !== undefined) {
        layer.lastExpressionIndex = layer.selectedExpressionIndex;
    }
    
    // 描画を更新
    render();
    
    // 履歴保存
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== 表情指定キーフレームの挿入 =====
function insertExpressionKeyframe(layerId) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.type !== 'blink') {
        console.log('❌ レイヤーが見つからないか、blinkタイプではありません', layerId);
        return;
    }
    
    // 現在のフレーム位置を取得
    const currentFrame = Math.floor(currentTime * (typeof projectFPS !== 'undefined' ? projectFPS : 30));
    
    // selectedExpressionIndex を使用（スライダーで選択した値）
    const targetExpressionIndex = layer.selectedExpressionIndex !== undefined 
        ? layer.selectedExpressionIndex 
        : (layer.lastExpressionIndex || 0);
    
    console.log('🔍 ターゲット表情インデックス:', targetExpressionIndex, '(layer.selectedExpressionIndex:', layer.selectedExpressionIndex, ')');
    
    // キーフレームを初期化
    if (!layer.keyframes) {
        layer.keyframes = [];
    }
    
    // 現在の表情インデックスを計算（この時点での表示表情）
    const startExpressionIndex = getCurrentExpressionIndex(layer, currentFrame);
    
    console.log('🔍 開始表情インデックス:', startExpressionIndex);
    console.log('🔍 挿入前のキーフレーム数:', layer.keyframes.length);
    
    // 同じフレームに既存の表情キーフレームがあるか確認
    const existingIndex = layer.keyframes.findIndex(kf => 
        kf.frame === currentFrame && kf.type === 'expression'
    );
    
    if (existingIndex >= 0) {
        // 既存のキーフレームを更新
        layer.keyframes[existingIndex].expressionIndex = targetExpressionIndex;
        layer.keyframes[existingIndex].startExpressionIndex = startExpressionIndex;
        console.log('🔄 既存キーフレームを更新');
    } else {
        // 新しいキーフレームを追加
        layer.keyframes.push({
            frame: currentFrame,
            type: 'expression',
            expressionIndex: targetExpressionIndex,
            startExpressionIndex: startExpressionIndex
        });
        console.log('➕ 新しいキーフレームを追加');
    }
    
    console.log('🔍 挿入後のキーフレーム数:', layer.keyframes.length);
    console.log('🔍 キーフレーム内容:', JSON.stringify(layer.keyframes));
    
    // タイムラインを更新
    if (typeof updateTimelineContent === 'function') {
        updateTimelineContent();
    }
    
    // プロパティパネルを更新（キーフレームリストのみ）
    updateBlinkKeyframeListOnly(layer);
    
    // 描画を更新
    render();
    
    // 履歴保存
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
    
    // フィードバック
    const direction = targetExpressionIndex > startExpressionIndex ? '→' : '←';
    console.log(`🎯 表情キーフレームを挿入: フレーム ${currentFrame}, 表情 ${startExpressionIndex + 1} ${direction} ${targetExpressionIndex + 1}`);
}

// ===== キーフレームリストのみを更新 =====
function updateBlinkKeyframeListOnly(layer) {
    const listContainer = document.getElementById('blink-keyframe-list');
    if (!listContainer || !layer) return;
    
    const sortedKeyframes = (layer.keyframes || []).slice().sort((a, b) => a.frame - b.frame);
    
    listContainer.innerHTML = sortedKeyframes.map((kf, i) => {
        if (kf.type === 'expression') {
            const startIdx = kf.startExpressionIndex !== undefined ? kf.startExpressionIndex + 1 : '?';
            const endIdx = kf.expressionIndex + 1;
            const direction = kf.startExpressionIndex !== undefined 
                ? (kf.expressionIndex > kf.startExpressionIndex ? '→' : '←')
                : '→';
            return `
                <div style="display: flex; gap: 8px; align-items: center; padding: 4px; background: rgba(95, 168, 211, 0.3); border-radius: 4px; margin-bottom: 4px; border-left: 3px solid #5fa8d3;">
                    <span style="flex: 1; font-size: 11px;">😊 ${startIdx} ${direction} ${endIdx}: ${kf.frame}f</span>
                    <button onclick="removeBlinkKeyframe(${layer.id}, ${i})" style="padding: 2px 6px; background: var(--chocolate-dark); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">削除</button>
                </div>
            `;
        } else {
            return `
                <div style="display: flex; gap: 8px; align-items: center; padding: 4px; background: rgba(135, 206, 235, 0.2); border-radius: 4px; margin-bottom: 4px;">
                    <span style="flex: 1; font-size: 11px;">👀 まばたき: ${kf.frame}f</span>
                    <button onclick="removeBlinkKeyframe(${layer.id}, ${i})" style="padding: 2px 6px; background: var(--chocolate-dark); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">削除</button>
                </div>
            `;
        }
    }).join('');
}

// ===== 現在の表情インデックスを取得（drawBlinkLayerと同じロジック） =====
function getCurrentExpressionIndex(layer, currentFrame) {
    if (!layer || !layer.sequenceImages) return 0;
    
    const fps = layer.fps || 12;
    const projectFps = typeof projectFPS !== 'undefined' ? projectFPS : 30;
    
    // デフォルト表情
    let displayIndex = layer.useLastExpression ? (layer.lastExpressionIndex || 0) : 0;
    
    // キーフレームを時間順にソート
    const sortedKeyframes = (layer.keyframes || []).slice().sort((a, b) => a.frame - b.frame);
    
    // 現在アクティブなキーフレームを探す（後ろから）
    for (let i = sortedKeyframes.length - 1; i >= 0; i--) {
        const kf = sortedKeyframes[i];
        if (currentFrame < kf.frame) continue;
        
        const framesSinceStart = currentFrame - kf.frame;
        
        // まばたきキーフレーム
        if (kf.type === 'blink' || !kf.type) {
            const totalAnimFrames = (layer.sequenceImages.length - 1) * (projectFps / fps);
            
            if (framesSinceStart < totalAnimFrames) {
                // まばたきアニメーション中
                const seqIndex = Math.floor(framesSinceStart * fps / projectFps);
                if (seqIndex < layer.sequenceImages.length - 1) {
                    displayIndex = seqIndex + 1;
                }
            }
            break;
        }
        
        // 表情キーフレーム
        if (kf.type === 'expression') {
            const startIndex = kf.startExpressionIndex !== undefined ? kf.startExpressionIndex : 0;
            const targetIndex = kf.expressionIndex;
            const steps = Math.abs(targetIndex - startIndex);
            
            if (steps === 0) {
                displayIndex = targetIndex;
            } else {
                const direction = targetIndex > startIndex ? 1 : -1;
                const framesPerStep = Math.max(1, Math.round(projectFps / fps));
                const totalAnimFrames = steps * framesPerStep;
                
                if (framesSinceStart >= totalAnimFrames) {
                    displayIndex = targetIndex;
                } else {
                    const stepIndex = Math.floor(framesSinceStart / framesPerStep);
                    displayIndex = startIndex + (direction * Math.min(stepIndex + 1, steps));
                }
            }
            break;
        }
    }
    
    return Math.max(0, Math.min(displayIndex, layer.sequenceImages.length - 1));
}

// ===== 表情プレビューの初期化 =====
function initExpressionPreview(layer) {
    if (!layer || layer.type !== 'blink' || !layer.sequenceImages || layer.sequenceImages.length === 0) {
        console.log('❌ initExpressionPreview: 条件を満たさない', layer?.type, layer?.sequenceImages?.length);
        return;
    }
    
    console.log('🎬 initExpressionPreview開始: レイヤー', layer.name, '画像数:', layer.sequenceImages.length);
    
    // 少し遅延させてDOMが構築されてから実行
    setTimeout(() => {
        const slider = document.getElementById('expression-slider');
        const previewCanvas = document.getElementById('expression-preview-canvas');
        
        console.log('🔍 DOM確認: slider=', !!slider, 'canvas=', !!previewCanvas);
        
        if (!slider || !previewCanvas) {
            console.log('❌ DOM要素が見つからない');
            return;
        }
        
        // スライダーにイベントリスナーを追加（inputイベント）
        slider.addEventListener('input', function(e) {
            const index = parseInt(this.value);
            console.log('🎚️ スライダー入力:', index);
            
            // selectedExpressionIndexに保存（キーフレーム挿入用）
            layer.selectedExpressionIndex = index;
            
            // デフォルト表情が有効なら lastExpressionIndex も更新
            if (layer.useLastExpression) {
                layer.lastExpressionIndex = index;
            }
            
            // プレビュー更新
            updateExpressionPreview(layer, index);
        });
        
        console.log('✅ スライダーイベントリスナー追加完了');
        
        // 初期プレビュー表示
        const initialIndex = layer.selectedExpressionIndex !== undefined 
            ? layer.selectedExpressionIndex 
            : (layer.lastExpressionIndex || 0);
        
        console.log('🖼️ 初期プレビュー: index=', initialIndex);
        updateExpressionPreview(layer, initialIndex);
        
    }, 100);
}

console.log('😊 まばたき表情設定モジュール読み込み完了');