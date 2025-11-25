/**
 * 🚶 Puppet Bear - 歩行アニメーションエフェクト
 * フォルダ専用の歩行（前後揺れ + 上下弧）アニメーション
 * 
 * 特徴:
 * - 前後揺れ・上下運動（弧を描く動き）
 * - ループ再生可能（開始/終了キーフレームで制御）
 * - ランダム揺らぎで自然な動き
 * - フォルダ内レイヤー + 親子関係レイヤーに一括適用
 */

// ===== デフォルトパラメータ =====
function getDefaultWalkingParams() {
    return {
        swingWidth: 30,        // 前後揺れ幅（ピクセル）
        bounceHeight: 15,      // 上下の高さ（ピクセル）
        stepDuration: 1,       // 1歩の時間（秒）- 1秒単位
        dampingRange: 0.2,     // 中間減衰の範囲（0-1）
        randomness: 0.15,      // ランダム揺らぎの強さ（0-1）
        seed: 12345,           // ランダムシード
        keyframes: []          // { frame: number, type: 'start' | 'end' }
    };
}

// ===== ランダム値生成（シード付き） =====
function walkingRandom(seed, index) {
    const x = Math.sin(seed * 9999 + index * 7777) * 10000;
    return x - Math.floor(x);
}

// ===== 歩行オフセット計算 =====
function calculateWalkingOffset(layer, localTime) {
    if (!layer.walkingEnabled || !layer.walkingParams) {
        return { x: 0, y: 0, active: false };
    }
    
    const params = layer.walkingParams;
    const fps = typeof projectFPS !== 'undefined' ? projectFPS : 30;
    const currentFrame = Math.floor(localTime * fps);
    
    // キーフレームをソート
    const sortedKeyframes = (params.keyframes || []).slice().sort((a, b) => a.frame - b.frame);
    
    // 現在アクティブな歩行区間を探す
    let isWalking = false;
    let walkingStartFrame = 0;
    let walkingEndFrame = Infinity;
    
    for (let i = 0; i < sortedKeyframes.length; i++) {
        const kf = sortedKeyframes[i];
        
        if (kf.type === 'start' && currentFrame >= kf.frame) {
            isWalking = true;
            walkingStartFrame = kf.frame;
            walkingEndFrame = Infinity;
        }
        
        if (kf.type === 'end' && currentFrame >= kf.frame && kf.frame > walkingStartFrame) {
            isWalking = false;
            walkingEndFrame = kf.frame;
        }
    }
    
    // 歩行中でなければオフセットなし
    if (!isWalking) {
        return { x: 0, y: 0, active: false };
    }
    
    // 歩行開始からの経過時間
    const elapsedFrames = currentFrame - walkingStartFrame;
    const elapsedTime = elapsedFrames / fps;
    
    // 歩行サイクルの位相を計算
    const stepDuration = params.stepDuration || 0.5;
    const phase = (elapsedTime / stepDuration) * Math.PI * 2;
    
    // ランダム減衰（自然な揺らぎ）
    const cycleIndex = Math.floor(elapsedTime / stepDuration);
    const randomFactor = walkingRandom(params.seed || 12345, cycleIndex);
    const damping = 1 - (params.dampingRange || 0.2) * randomFactor;
    
    // ランダム揺らぎ
    const randomnessX = (walkingRandom(params.seed || 12345, cycleIndex * 2) - 0.5) * 2 * (params.randomness || 0.15);
    const randomnessY = (walkingRandom(params.seed || 12345, cycleIndex * 2 + 1) - 0.5) * 2 * (params.randomness || 0.15);
    
    // 前後揺れ（sin波）
    const swingWidth = params.swingWidth || 30;
    const offsetX = swingWidth * Math.sin(phase) * damping * (1 + randomnessX);
    
    // 上下運動（弧を描く - abs(sin)で常に上に）
    // phase * 2 で前後1往復につき上下2往復（足が地面につくたびに上に跳ねる）
    const bounceHeight = params.bounceHeight || 15;
    const offsetY = -Math.abs(bounceHeight * Math.sin(phase * 2)) * damping * (1 + randomnessY);
    
    return { x: offsetX, y: offsetY, active: true };
}

// ===== フォルダの歩行オフセットを取得（親子関係含む） =====
function getFolderWalkingOffset(layer, localTime) {
    // フォルダ自身に歩行が設定されている場合
    if (layer.type === 'folder' && layer.walkingEnabled) {
        return calculateWalkingOffset(layer, localTime);
    }
    
    // 親をたどって歩行が設定されているフォルダを探す
    if (layer.parentLayerId) {
        const parent = layers.find(l => l.id === layer.parentLayerId);
        if (parent) {
            return getFolderWalkingOffset(parent, localTime);
        }
    }
    
    return { x: 0, y: 0, active: false };
}

// ===== 歩行開始キーフレーム追加 =====
function addWalkingStartKeyframe() {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || layer.type !== 'folder') return;
    
    if (!layer.walkingParams) {
        layer.walkingParams = getDefaultWalkingParams();
    }
    
    const fps = typeof projectFPS !== 'undefined' ? projectFPS : 30;
    const currentFrame = Math.floor(currentTime * fps);
    
    // 同じフレームに既存の開始キーフレームがあれば削除
    layer.walkingParams.keyframes = layer.walkingParams.keyframes.filter(
        kf => !(kf.type === 'start' && kf.frame === currentFrame)
    );
    
    layer.walkingParams.keyframes.push({
        frame: currentFrame,
        type: 'start'
    });
    
    console.log('🚶 歩行開始キーフレーム追加:', currentFrame, 'f');
    
    updatePropertiesPanel();
    if (typeof updateTimeline === 'function') {
        updateTimeline();
    }
    render();
}

// ===== 歩行終了キーフレーム追加 =====
function addWalkingEndKeyframe() {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || layer.type !== 'folder') return;
    
    if (!layer.walkingParams) {
        layer.walkingParams = getDefaultWalkingParams();
    }
    
    const fps = typeof projectFPS !== 'undefined' ? projectFPS : 30;
    const currentFrame = Math.floor(currentTime * fps);
    
    // 同じフレームに既存の終了キーフレームがあれば削除
    layer.walkingParams.keyframes = layer.walkingParams.keyframes.filter(
        kf => !(kf.type === 'end' && kf.frame === currentFrame)
    );
    
    layer.walkingParams.keyframes.push({
        frame: currentFrame,
        type: 'end'
    });
    
    console.log('🛑 歩行終了キーフレーム追加:', currentFrame, 'f');
    
    updatePropertiesPanel();
    if (typeof updateTimeline === 'function') {
        updateTimeline();
    }
    render();
}

// ===== 歩行キーフレーム削除 =====
function removeWalkingKeyframe(index) {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || !layer.walkingParams || !layer.walkingParams.keyframes) return;
    
    layer.walkingParams.keyframes.splice(index, 1);
    
    updatePropertiesPanel();
    if (typeof updateTimeline === 'function') {
        updateTimeline();
    }
    render();
}

// ===== 歩行パラメータ更新 =====
function updateWalkingParam(param, value) {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || layer.type !== 'folder') return;
    
    if (!layer.walkingParams) {
        layer.walkingParams = getDefaultWalkingParams();
    }
    
    layer.walkingParams[param] = value;
    render();
}

// ===== 歩行UI生成 =====
function generateWalkingUI(layer) {
    const params = layer.walkingParams || getDefaultWalkingParams();
    const fps = typeof projectFPS !== 'undefined' ? projectFPS : 30;
    
    // キーフレームリストHTML生成
    const sortedKeyframes = (params.keyframes || []).slice().sort((a, b) => a.frame - b.frame);
    const keyframeListHTML = sortedKeyframes.length > 0 
        ? sortedKeyframes.map((kf, i) => `
            <div style="display: flex; gap: 8px; align-items: center; padding: 6px 8px; background: ${kf.type === 'start' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}; border-radius: 4px; margin-bottom: 4px;">
                <span style="flex: 1; font-size: 11px; color: var(--biscuit-light);">
                    ${kf.type === 'start' ? '🚶 開始' : '🛑 終了'}: ${kf.frame}f (${(kf.frame / fps).toFixed(2)}秒)
                </span>
                <button onclick="removeWalkingKeyframe(${i})" style="padding: 2px 8px; background: var(--chocolate-dark); color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">×</button>
            </div>
        `).join('')
        : '<p style="text-align: center; color: var(--biscuit); padding: 10px; font-size: 11px;">キーフレームなし</p>';
    
    return `
        <div class="property-group">
            <h4>🚶 歩行アニメーション</h4>
            
            <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(76, 175, 80, 0.2); border-radius: 4px; cursor: pointer;">
                    <input type="checkbox" id="prop-walking" ${layer.walkingEnabled ? 'checked' : ''}>
                    <span style="font-weight: bold;">歩行アニメーションを有効化</span>
                </label>
            </div>
            
            <div id="walking-controls" style="display: ${layer.walkingEnabled ? 'block' : 'none'}">
                
                <!-- 前後揺れ幅 -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px;">
                        前後揺れ幅: <span id="walkingSwingValue">${params.swingWidth}px</span>
                    </label>
                    <input type="range" class="property-slider" id="prop-walking-swing" value="${params.swingWidth}" 
                        min="0" max="100" step="1">
                </div>
                
                <!-- 上下の高さ -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px;">
                        上下の高さ: <span id="walkingBounceValue">${params.bounceHeight}px</span>
                    </label>
                    <input type="range" class="property-slider" id="prop-walking-bounce" value="${params.bounceHeight}" 
                        min="0" max="50" step="1">
                </div>
                
                <!-- 歩行スピード -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px;">
                        歩行スピード: <span id="walkingStepValue">${Math.round(params.stepDuration)}秒/歩</span>
                    </label>
                    <input type="range" class="property-slider" id="prop-walking-step" value="${Math.round(params.stepDuration)}" 
                        min="1" max="5" step="1">
                </div>
                
                <!-- 中間減衰 -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px;">
                        中間減衰: <span id="walkingDampingValue">${Math.round(params.dampingRange * 100)}%</span>
                    </label>
                    <input type="range" class="property-slider" id="prop-walking-damping" value="${params.dampingRange}" 
                        min="0" max="0.5" step="0.01">
                    <small style="font-size: 10px; color: var(--biscuit-light);">ランダムに動きが小さくなる割合</small>
                </div>
                
                <!-- ランダム揺らぎ -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px;">
                        ランダム揺らぎ: <span id="walkingRandomValue">${Math.round(params.randomness * 100)}%</span>
                    </label>
                    <input type="range" class="property-slider" id="prop-walking-random" value="${params.randomness}" 
                        min="0" max="0.5" step="0.01">
                    <small style="font-size: 10px; color: var(--biscuit-light);">動きにばらつきを加える</small>
                </div>
                
                <!-- シード値 -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; display: block; margin-bottom: 4px;">
                        シード値: <span id="walkingSeedValue">${params.seed}</span>
                    </label>
                    <input type="range" class="property-slider" id="prop-walking-seed" value="${params.seed}" 
                        min="1" max="99999" step="1">
                </div>
                
                <!-- 開始/終了ボタン -->
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                    <h5 style="font-weight: bold; margin-bottom: 8px;">📍 キーフレーム</h5>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button onclick="addWalkingStartKeyframe()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">
                            🚶 歩行開始
                        </button>
                        <button onclick="addWalkingEndKeyframe()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #f44336, #d32f2f); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">
                            🛑 歩行終了
                        </button>
                    </div>
                    
                    <div id="walking-keyframe-list" style="max-height: 200px; overflow-y: auto;">
                        ${keyframeListHTML}
                    </div>
                </div>
                
                <div style="background: rgba(76, 175, 80, 0.2); padding: 8px; margin-top: 12px; border-radius: 4px; font-size: 10px; line-height: 1.4; color: var(--biscuit-light);">
                    💡 フォルダ内の全レイヤーに歩行動作を適用<br>
                    🔄 開始〜終了間でループ再生<br>
                    🎯 終了地点でデフォルト位置に戻ります<br>
                    ✨ 中間減衰で自然な揺らぎを演出
                </div>
            </div>
        </div>
    `;
}

// ===== 歩行イベントリスナー設定 =====
function setupWalkingEventListeners() {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || layer.type !== 'folder') return;
    
    // 有効化チェックボックス
    const enableCheckbox = document.getElementById('prop-walking');
    if (enableCheckbox) {
        enableCheckbox.addEventListener('change', (e) => {
            layer.walkingEnabled = e.target.checked;
            
            // パラメータを初期化
            if (e.target.checked && !layer.walkingParams) {
                layer.walkingParams = getDefaultWalkingParams();
            }
            
            const controls = document.getElementById('walking-controls');
            if (controls) {
                controls.style.display = e.target.checked ? 'block' : 'none';
            }
            updateLayerList();
            render();
        });
    }
    
    // 前後揺れ幅
    const swingSlider = document.getElementById('prop-walking-swing');
    if (swingSlider) {
        swingSlider.addEventListener('input', (e) => {
            document.getElementById('walkingSwingValue').textContent = e.target.value + 'px';
            updateWalkingParam('swingWidth', parseFloat(e.target.value));
        });
    }
    
    // 上下の高さ
    const bounceSlider = document.getElementById('prop-walking-bounce');
    if (bounceSlider) {
        bounceSlider.addEventListener('input', (e) => {
            document.getElementById('walkingBounceValue').textContent = e.target.value + 'px';
            updateWalkingParam('bounceHeight', parseFloat(e.target.value));
        });
    }
    
    // 歩行スピード
    const stepSlider = document.getElementById('prop-walking-step');
    if (stepSlider) {
        stepSlider.addEventListener('input', (e) => {
            document.getElementById('walkingStepValue').textContent = Math.round(e.target.value) + '秒/歩';
            updateWalkingParam('stepDuration', parseInt(e.target.value));
        });
    }
    
    // 中間減衰
    const dampingSlider = document.getElementById('prop-walking-damping');
    if (dampingSlider) {
        dampingSlider.addEventListener('input', (e) => {
            document.getElementById('walkingDampingValue').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
            updateWalkingParam('dampingRange', parseFloat(e.target.value));
        });
    }
    
    // ランダム揺らぎ
    const randomSlider = document.getElementById('prop-walking-random');
    if (randomSlider) {
        randomSlider.addEventListener('input', (e) => {
            document.getElementById('walkingRandomValue').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
            updateWalkingParam('randomness', parseFloat(e.target.value));
        });
    }
    
    // シード値
    const seedSlider = document.getElementById('prop-walking-seed');
    if (seedSlider) {
        seedSlider.addEventListener('input', (e) => {
            document.getElementById('walkingSeedValue').textContent = e.target.value;
            updateWalkingParam('seed', parseInt(e.target.value));
        });
    }
}

// ===== タイムライン用：歩行キーフレームかどうか判定 =====
function isWalkingKeyframe(layer, frame) {
    if (!layer.walkingParams || !layer.walkingParams.keyframes) return false;
    return layer.walkingParams.keyframes.some(kf => kf.frame === frame);
}

// ===== タイムライン用：歩行キーフレームのタイプを取得 =====
function getWalkingKeyframeType(layer, frame) {
    if (!layer.walkingParams || !layer.walkingParams.keyframes) return null;
    const kf = layer.walkingParams.keyframes.find(k => k.frame === frame);
    return kf ? kf.type : null;
}

console.log('🚶 歩行アニメーションエフェクト読み込み完了');
