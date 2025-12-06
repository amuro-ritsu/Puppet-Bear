/**
 * 🦴 Puppet Bear v1.16.0
 * ボーンアニメーション機能
 * 
 * - 2本以上のボーンを配置可能
 * - 追加順で自動的に親子関係を設定
 * - ボーン角度によるメッシュスキニング変形
 * - キーフレームでボーン角度をアニメーション
 * - 別レイヤーのボーンを親に設定可能（Phase 5で実装予定）
 */

// ===== WebGL関連 =====
let boneCanvas = null;
let boneGL = null;
let boneProgram = null;
let boneProgramInfo = null;

// ===== ボーン編集モード =====
let boneEditMode = false;  // ボーン追加モード
let selectedBoneId = null; // 選択中のボーンID

// ===== デフォルトパラメータ =====
function getDefaultBoneParams() {
    return {
        bones: [],           // ボーン配列
        divisions: 30,       // メッシュ分割数
        influenceRadius: 0.3, // ボーン影響半径（0-1、画像サイズに対する比率）
        boneKeyframes: []    // ボーンキーフレーム配列
    };
}

// ===== ボーン構造 =====
function createBone(id, x, y, angle, length, parentId = null) {
    return {
        id: id,
        name: `bone_${id}`,
        x: x,           // 親ボーン末端からの相対X（または絶対X）
        y: y,           // 親ボーン末端からの相対Y（または絶対Y）
        angle: angle,   // ローカル角度（度）
        length: length, // ボーンの長さ
        parentId: parentId,  // 親ボーンID（null = ルート）
        // 外部親（別レイヤーのボーンを親にする場合）- Phase 5で使用
        externalParent: null // { layerId: xxx, boneId: xxx }
    };
}

// ===== ボーンキーフレーム構造 =====
function createBoneKeyframe(frame, bonesState) {
    return {
        frame: frame,
        bones: bonesState.map(b => ({
            id: b.id,
            angle: b.angle
        }))
    };
}

// ===== WebGL初期化 =====
function initBoneWebGL() {
    if (!boneCanvas) {
        boneCanvas = document.createElement('canvas');
        boneGL = boneCanvas.getContext('webgl', { 
            premultipliedAlpha: false, alpha: true 
        });
    }
    
    const gl = boneGL;
    const vs = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;
    const fs = `
        precision mediump float;
        varying vec2 v_texCoord;
        uniform sampler2D u_image;
        void main() {
            gl_FragColor = texture2D(u_image, v_texCoord);
        }
    `;
    
    const createShader = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    };
    
    const vertexShader = createShader(gl.VERTEX_SHADER, vs);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fs);
    boneProgram = gl.createProgram();
    gl.attachShader(boneProgram, vertexShader);
    gl.attachShader(boneProgram, fragmentShader);
    gl.linkProgram(boneProgram);
    
    boneProgramInfo = {
        attribLocations: {
            position: gl.getAttribLocation(boneProgram, 'a_position'),
            texCoord: gl.getAttribLocation(boneProgram, 'a_texCoord'),
        },
        uniformLocations: {
            image: gl.getUniformLocation(boneProgram, 'u_image'),
        },
    };
}

// ===== Smoothstep補間 =====
function boneSmoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// ===== ボーンのワールド変換を計算 =====
function calculateBoneWorldTransform(bone, allBones, boneAngles = null) {
    // boneAngles: { boneId: angle } のマップ（キーフレーム補間後の角度）
    const getAngle = (b) => {
        if (boneAngles && boneAngles[b.id] !== undefined) {
            return boneAngles[b.id];
        }
        return b.angle;
    };
    
    if (!bone.parentId) {
        // ルートボーン
        const angle = getAngle(bone);
        return {
            x: bone.x,
            y: bone.y,
            rotation: angle,
            // 末端位置を計算
            endX: bone.x + Math.cos(angle * Math.PI / 180) * bone.length,
            endY: bone.y + Math.sin(angle * Math.PI / 180) * bone.length
        };
    }
    
    // 親ボーンを探す
    const parentBone = allBones.find(b => b.id === bone.parentId);
    if (!parentBone) {
        // 親が見つからない場合はルートとして扱う
        const angle = getAngle(bone);
        return {
            x: bone.x,
            y: bone.y,
            rotation: angle,
            endX: bone.x + Math.cos(angle * Math.PI / 180) * bone.length,
            endY: bone.y + Math.sin(angle * Math.PI / 180) * bone.length
        };
    }
    
    // 親のワールド変換を再帰的に取得
    const parentWorld = calculateBoneWorldTransform(parentBone, allBones, boneAngles);
    
    // このボーンの角度
    const localAngle = getAngle(bone);
    const worldRotation = parentWorld.rotation + localAngle;
    
    // 親の末端位置からの相対位置を計算
    const worldX = parentWorld.endX + bone.x;
    const worldY = parentWorld.endY + bone.y;
    
    // このボーンの末端位置
    const endX = worldX + Math.cos(worldRotation * Math.PI / 180) * bone.length;
    const endY = worldY + Math.sin(worldRotation * Math.PI / 180) * bone.length;
    
    return {
        x: worldX,
        y: worldY,
        rotation: worldRotation,
        endX: endX,
        endY: endY
    };
}

// ===== 全ボーンのワールド変換を計算 =====
function calculateAllBoneTransforms(bones, boneAngles = null) {
    const transforms = {};
    for (const bone of bones) {
        transforms[bone.id] = calculateBoneWorldTransform(bone, bones, boneAngles);
    }
    return transforms;
}

// ===== ボーンキーフレーム補間 =====
function interpolateBoneAngles(layer, currentFrame) {
    if (!layer.boneParams || !layer.boneParams.boneKeyframes || layer.boneParams.boneKeyframes.length === 0) {
        // キーフレームがない場合は現在のボーン角度をそのまま返す
        const angles = {};
        if (layer.boneParams && layer.boneParams.bones) {
            for (const bone of layer.boneParams.bones) {
                angles[bone.id] = bone.angle;
            }
        }
        return angles;
    }
    
    const keyframes = layer.boneParams.boneKeyframes.sort((a, b) => a.frame - b.frame);
    
    // 現在フレーム以前と以後のキーフレームを探す
    let prevKf = null;
    let nextKf = null;
    
    for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i].frame <= currentFrame) {
            prevKf = keyframes[i];
        }
        if (keyframes[i].frame > currentFrame && !nextKf) {
            nextKf = keyframes[i];
            break;
        }
    }
    
    // 補間計算
    const angles = {};
    
    if (!prevKf && !nextKf) {
        // キーフレームが1つもない
        for (const bone of layer.boneParams.bones) {
            angles[bone.id] = bone.angle;
        }
    } else if (!prevKf) {
        // 最初のキーフレームより前
        for (const boneState of nextKf.bones) {
            angles[boneState.id] = boneState.angle;
        }
    } else if (!nextKf) {
        // 最後のキーフレームより後
        for (const boneState of prevKf.bones) {
            angles[boneState.id] = boneState.angle;
        }
    } else {
        // 2つのキーフレーム間を補間
        const t = (currentFrame - prevKf.frame) / (nextKf.frame - prevKf.frame);
        const smoothT = boneSmoothstep(0, 1, t);
        
        for (const prevBone of prevKf.bones) {
            const nextBone = nextKf.bones.find(b => b.id === prevBone.id);
            if (nextBone) {
                // 角度の補間（最短経路で）
                let diff = nextBone.angle - prevBone.angle;
                // -180〜180の範囲に正規化
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;
                angles[prevBone.id] = prevBone.angle + diff * smoothT;
            } else {
                angles[prevBone.id] = prevBone.angle;
            }
        }
    }
    
    return angles;
}

// ===== 頂点のボーンウェイトを計算 =====
function calculateVertexBoneWeights(vertexX, vertexY, bones, boneTransforms, influenceRadius, imageWidth, imageHeight) {
    // 各ボーンへの影響度を計算
    const weights = {};
    let totalWeight = 0;
    
    const maxInfluencePixels = influenceRadius * Math.max(imageWidth, imageHeight);
    
    for (const bone of bones) {
        const transform = boneTransforms[bone.id];
        if (!transform) continue;
        
        // ボーンの線分（始点〜終点）との距離を計算
        const boneStartX = transform.x;
        const boneStartY = transform.y;
        const boneEndX = transform.endX;
        const boneEndY = transform.endY;
        
        // 線分との最短距離
        const distance = pointToSegmentDistance(
            vertexX, vertexY,
            boneStartX, boneStartY,
            boneEndX, boneEndY
        );
        
        // 影響度を計算（距離に反比例、指数関数的減衰）
        if (distance < maxInfluencePixels) {
            const normalizedDist = distance / maxInfluencePixels;
            // smoothstepで滑らかに減衰
            const weight = 1 - boneSmoothstep(0, 1, normalizedDist);
            weights[bone.id] = weight;
            totalWeight += weight;
        }
    }
    
    // 正規化
    if (totalWeight > 0) {
        for (const boneId in weights) {
            weights[boneId] /= totalWeight;
        }
    }
    
    return weights;
}

// ===== 点から線分への最短距離 =====
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq === 0) {
        // 線分が点の場合
        return Math.hypot(px - x1, py - y1);
    }
    
    // 線分上の最近点を計算
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    return Math.hypot(px - closestX, py - closestY);
}

// ===== ボーンスキニングメッシュ生成 =====
function createBoneSkinnedMesh(boneParams, width, height, localTime, anchorX, anchorY) {
    const bones = boneParams.bones;
    if (!bones || bones.length < 2) {
        return null;
    }
    
    // 現在のフレームを計算
    const fps = typeof fpsRate !== 'undefined' ? fpsRate : 24;
    const currentFrame = Math.floor(localTime * fps);
    
    // ボーン角度を補間
    const boneAngles = interpolateBoneAngles({ boneParams }, currentFrame);
    
    // 初期状態（ボーン定義時の角度）
    const initialAngles = {};
    for (const bone of bones) {
        initialAngles[bone.id] = bone.angle;
    }
    
    // 初期状態と現在状態が完全に同じかチェック
    let hasChange = false;
    for (const bone of bones) {
        if (Math.abs(boneAngles[bone.id] - initialAngles[bone.id]) > 0.001) {
            hasChange = true;
            break;
        }
    }
    
    // 変化がない場合はnullを返す（通常描画にフォールバック）
    if (!hasChange) {
        return null;
    }
    
    const initialTransforms = calculateAllBoneTransforms(bones, initialAngles);
    
    // 現在の状態のボーン変換
    const currentTransforms = calculateAllBoneTransforms(bones, boneAngles);
    
    // メッシュ分割
    let N = Math.floor(boneParams.divisions || 30);
    if (N < 1) N = 1;
    if (N > 80) N = 80;
    let M = N; // 水平分割も同じ
    
    const influenceRadius = boneParams.influenceRadius || 0.3;
    
    const worldPositions = [];
    const texCoords = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // アンカーポイントの位置（ピクセル）
    const anchorPixelX = (anchorX - 0.5) * width;
    const anchorPixelY = (anchorY - 0.5) * height;
    
    for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= M; j++) {
            const xRatio = j / M;  // 0-1
            const yRatio = i / N;  // 0-1
            
            // テクスチャ座標
            texCoords.push(xRatio, yRatio);
            
            // ピクセル座標（画像中心基準）
            const pixelX = (xRatio - 0.5) * width;
            const pixelY = (yRatio - 0.5) * height;
            
            // ボーンウェイトを計算（初期状態のボーン位置で）
            const weights = calculateVertexBoneWeights(
                pixelX, pixelY,
                bones, initialTransforms,
                influenceRadius, width, height
            );
            
            // スキニング変形を適用
            let finalX = pixelX;
            let finalY = pixelY;
            
            if (Object.keys(weights).length > 0) {
                let transformedX = 0;
                let transformedY = 0;
                
                for (const boneId in weights) {
                    const weight = weights[boneId];
                    const initialT = initialTransforms[boneId];
                    const currentT = currentTransforms[boneId];
                    
                    if (!initialT || !currentT) continue;
                    
                    // 初期状態でのボーン座標系に変換
                    const initialRad = initialT.rotation * Math.PI / 180;
                    const relToInitialX = pixelX - initialT.x;
                    const relToInitialY = pixelY - initialT.y;
                    
                    // ボーンローカル座標に変換
                    const localX = relToInitialX * Math.cos(-initialRad) - relToInitialY * Math.sin(-initialRad);
                    const localY = relToInitialX * Math.sin(-initialRad) + relToInitialY * Math.cos(-initialRad);
                    
                    // 現在の状態でワールド座標に戻す
                    const currentRad = currentT.rotation * Math.PI / 180;
                    const newWorldX = localX * Math.cos(currentRad) - localY * Math.sin(currentRad) + currentT.x;
                    const newWorldY = localX * Math.sin(currentRad) + localY * Math.cos(currentRad) + currentT.y;
                    
                    transformedX += newWorldX * weight;
                    transformedY += newWorldY * weight;
                }
                
                finalX = transformedX;
                finalY = transformedY;
            }
            
            minX = Math.min(minX, finalX);
            maxX = Math.max(maxX, finalX);
            minY = Math.min(minY, finalY);
            maxY = Math.max(maxY, finalY);
            worldPositions.push(finalX, finalY);
        }
    }
    
    // インデックス生成
    const indices = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
            const topLeft = i * (M + 1) + j;
            const topRight = topLeft + 1;
            const bottomLeft = (i + 1) * (M + 1) + j;
            const bottomRight = bottomLeft + 1;
            indices.push(topLeft, bottomLeft, topRight);
            indices.push(topRight, bottomLeft, bottomRight);
        }
    }
    
    return {
        mesh: { positions: worldPositions, texCoords, indices },
        bounds: { 
            minX, maxX, minY, maxY, 
            width: maxX - minX, 
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        }
    };
}

// ===== WebGLでボーンスキニング描画 =====
function applyBoneSkinnedWebGL(layer, meshData, img) {
    if (!boneGL) initBoneWebGL();
    const gl = boneGL;
    
    const { mesh, bounds } = meshData;
    
    // WebGLキャンバスサイズを設定
    const padding = 50;
    const canvasWidth = Math.ceil(bounds.width + padding * 2);
    const canvasHeight = Math.ceil(bounds.height + padding * 2);
    
    boneCanvas.width = canvasWidth;
    boneCanvas.height = canvasHeight;
    gl.viewport(0, 0, canvasWidth, canvasHeight);
    
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(boneProgram);
    
    // 位置を正規化してNDC座標に変換
    const normalizedPositions = [];
    for (let i = 0; i < mesh.positions.length; i += 2) {
        const x = mesh.positions[i];
        const y = mesh.positions[i + 1];
        // bounds基準でNDC座標に変換
        const ndcX = ((x - bounds.minX + padding) / canvasWidth) * 2 - 1;
        const ndcY = 1 - ((y - bounds.minY + padding) / canvasHeight) * 2;
        normalizedPositions.push(ndcX, ndcY);
    }
    
    // 位置バッファ
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalizedPositions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(boneProgramInfo.attribLocations.position);
    gl.vertexAttribPointer(boneProgramInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
    
    // テクスチャ座標バッファ
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.texCoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(boneProgramInfo.attribLocations.texCoord);
    gl.vertexAttribPointer(boneProgramInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
    
    // インデックスバッファ
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
    
    // テクスチャ
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // ブレンディング有効
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // 描画
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    
    // クリーンアップ
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteBuffer(indexBuffer);
    gl.deleteTexture(texture);
    
    return {
        canvas: boneCanvas,
        offsetX: bounds.minX - padding,
        offsetY: bounds.minY - padding
    };
}

// ===== ボーンレイヤーの描画 =====
function drawBoneLayer(layer, localTime) {
    if (!layer.img || !layer.boneParams || !layer.boneParams.bones || layer.boneParams.bones.length < 2) {
        // ボーンが2本未満の場合は通常描画（スキニングなし）
        drawImageLayerNormal(layer);
        // ボーン可視化はrender()の最後で行う
        return;
    }
    
    ctx.save();
    
    // 親の変形を適用
    applyParentTransform(layer);
    
    // 不透明度とブレンドモード
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';
    
    // Wiggleオフセット
    const wiggleOffset = typeof getWiggleOffset === 'function' ? getWiggleOffset(layer, localTime) : { x: 0, y: 0 };
    ctx.translate(layer.x + wiggleOffset.x, layer.y + wiggleOffset.y);
    
    // アンカーポイント
    const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
    const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    const anchorOffsetX = anchorX * layer.width;
    const anchorOffsetY = anchorY * layer.height;
    
    ctx.translate(anchorOffsetX - layer.width / 2, anchorOffsetY - layer.height / 2);
    ctx.rotate(layer.rotation * Math.PI / 180);
    ctx.scale(layer.scale, layer.scale);
    
    // ボーンスキニングメッシュを生成
    const meshData = createBoneSkinnedMesh(
        layer.boneParams,
        layer.width, layer.height,
        localTime,
        anchorX, anchorY
    );
    
    if (meshData) {
        // WebGLで描画
        const result = applyBoneSkinnedWebGL(layer, meshData, layer.img);
        
        // 結果をメインキャンバスに転送
        ctx.drawImage(
            result.canvas,
            -anchorOffsetX + result.offsetX,
            -anchorOffsetY + result.offsetY
        );
    } else {
        // フォールバック：通常描画
        ctx.drawImage(
            layer.img,
            -anchorOffsetX,
            -anchorOffsetY,
            layer.width,
            layer.height
        );
    }
    
    ctx.restore();
    // ボーン可視化はrender()の最後で行う
}

// ===== 通常の画像レイヤー描画（フォールバック用） =====
function drawImageLayerNormal(layer) {
    if (!layer.img) return;
    
    ctx.save();
    applyParentTransform(layer);
    
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';
    ctx.translate(layer.x, layer.y);
    
    const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
    const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    const anchorOffsetX = anchorX * layer.width;
    const anchorOffsetY = anchorY * layer.height;
    
    ctx.translate(anchorOffsetX - layer.width / 2, anchorOffsetY - layer.height / 2);
    ctx.rotate(layer.rotation * Math.PI / 180);
    ctx.scale(layer.scale, layer.scale);
    
    ctx.drawImage(
        layer.img,
        -anchorOffsetX,
        -anchorOffsetY,
        layer.width,
        layer.height
    );
    
    ctx.restore();
}

// ===== ボーンの可視化描画 =====
function drawBonesVisualization(layer, localTime) {
    if (!layer.boneParams || !layer.boneParams.bones || layer.boneParams.bones.length === 0) {
        return;
    }
    
    const fps = typeof fpsRate !== 'undefined' ? fpsRate : 24;
    const currentFrame = Math.floor(localTime * fps);
    
    // ボーン角度を補間
    const boneAngles = interpolateBoneAngles(layer, currentFrame);
    
    // ボーン変換を計算
    const transforms = calculateAllBoneTransforms(layer.boneParams.bones, boneAngles);
    
    ctx.save();
    
    // レイヤー座標系に移動
    applyParentTransform(layer);
    
    const wiggleOffset = typeof getWiggleOffset === 'function' ? getWiggleOffset(layer, localTime) : { x: 0, y: 0 };
    ctx.translate(layer.x + wiggleOffset.x, layer.y + wiggleOffset.y);
    
    const anchorX = layer.anchorX !== undefined ? layer.anchorX : 0.5;
    const anchorY = layer.anchorY !== undefined ? layer.anchorY : 0.5;
    const anchorOffsetX = anchorX * layer.width;
    const anchorOffsetY = anchorY * layer.height;
    
    ctx.translate(anchorOffsetX - layer.width / 2, anchorOffsetY - layer.height / 2);
    ctx.rotate(layer.rotation * Math.PI / 180);
    ctx.scale(layer.scale, layer.scale);
    
    // 各ボーンを描画
    for (const bone of layer.boneParams.bones) {
        const transform = transforms[bone.id];
        if (!transform) continue;
        
        const isSelected = selectedBoneId === bone.id;
        
        // ボーンの線を描画
        ctx.beginPath();
        ctx.moveTo(transform.x, transform.y);
        ctx.lineTo(transform.endX, transform.endY);
        ctx.strokeStyle = isSelected ? '#ffff00' : '#00ff00';
        ctx.lineWidth = isSelected ? 4 / layer.scale : 2 / layer.scale;
        ctx.stroke();
        
        // ボーンの始点（関節）
        ctx.beginPath();
        ctx.arc(transform.x, transform.y, (isSelected ? 8 : 6) / layer.scale, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffff00' : '#00aaff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / layer.scale;
        ctx.stroke();
        
        // ボーンの終点
        ctx.beginPath();
        ctx.arc(transform.endX, transform.endY, 4 / layer.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6600';
        ctx.fill();
        
        // ボーン名（デバッグ用）
        ctx.font = `${12 / layer.scale}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(bone.name, transform.x + 10 / layer.scale, transform.y - 10 / layer.scale);
    }
    
    ctx.restore();
}

// ===== ボーン追加 =====
function addBoneToLayer(layer, x, y, angle, length) {
    if (!layer.boneParams) {
        layer.boneParams = getDefaultBoneParams();
    }
    
    const bones = layer.boneParams.bones;
    const newId = bones.length > 0 ? Math.max(...bones.map(b => b.id)) + 1 : 1;
    
    // 追加順で親を設定（前のボーンを親に）
    const parentId = bones.length > 0 ? bones[bones.length - 1].id : null;
    
    // 親がある場合、相対座標を調整
    let relX = x;
    let relY = y;
    if (parentId) {
        const parentBone = bones.find(b => b.id === parentId);
        if (parentBone) {
            const parentTransform = calculateBoneWorldTransform(parentBone, bones);
            relX = x - parentTransform.endX;
            relY = y - parentTransform.endY;
        }
    }
    
    const newBone = createBone(newId, relX, relY, angle, length, parentId);
    bones.push(newBone);
    
    // キーフレームがある場合、新しいボーンを追加
    if (layer.boneParams.boneKeyframes) {
        for (const kf of layer.boneParams.boneKeyframes) {
            kf.bones.push({ id: newId, angle: angle });
        }
    }
    
    return newBone;
}

// ===== ボーン削除 =====
function removeBoneFromLayer(layer, boneId) {
    if (!layer.boneParams || !layer.boneParams.bones) return;
    
    const bones = layer.boneParams.bones;
    const index = bones.findIndex(b => b.id === boneId);
    if (index === -1) return;
    
    // 子ボーンの親を変更（削除するボーンの親を引き継ぐ）
    const deletingBone = bones[index];
    for (const bone of bones) {
        if (bone.parentId === boneId) {
            bone.parentId = deletingBone.parentId;
        }
    }
    
    // ボーンを削除
    bones.splice(index, 1);
    
    // キーフレームからも削除
    if (layer.boneParams.boneKeyframes) {
        for (const kf of layer.boneParams.boneKeyframes) {
            const boneIndex = kf.bones.findIndex(b => b.id === boneId);
            if (boneIndex !== -1) {
                kf.bones.splice(boneIndex, 1);
            }
        }
    }
    
    if (selectedBoneId === boneId) {
        selectedBoneId = null;
    }
}

// ===== ボーンキーフレーム追加 =====
function addBoneKeyframe(layer, frame) {
    if (!layer.boneParams) return;
    if (!layer.boneParams.boneKeyframes) {
        layer.boneParams.boneKeyframes = [];
    }
    
    // 既存のキーフレームを削除
    const existingIndex = layer.boneParams.boneKeyframes.findIndex(kf => kf.frame === frame);
    if (existingIndex !== -1) {
        layer.boneParams.boneKeyframes.splice(existingIndex, 1);
    }
    
    // 現在のボーン角度でキーフレームを作成
    const bonesState = layer.boneParams.bones.map(b => ({
        id: b.id,
        angle: b.angle
    }));
    
    const keyframe = createBoneKeyframe(frame, bonesState);
    layer.boneParams.boneKeyframes.push(keyframe);
    layer.boneParams.boneKeyframes.sort((a, b) => a.frame - b.frame);
    
    console.log(`🦴 ボーンキーフレーム追加: frame=${frame}`);
}

// ===== ボーンキーフレーム削除 =====
function removeBoneKeyframe(layer, frame) {
    if (!layer.boneParams || !layer.boneParams.boneKeyframes) return;
    
    const index = layer.boneParams.boneKeyframes.findIndex(kf => kf.frame === frame);
    if (index !== -1) {
        layer.boneParams.boneKeyframes.splice(index, 1);
        console.log(`🦴 ボーンキーフレーム削除: frame=${frame}`);
    }
}

// ===== ボーン編集モードの切り替え =====
function toggleBoneEditMode() {
    console.log('🦴 toggleBoneEditMode呼び出し - 現在:', boneEditMode);
    boneEditMode = !boneEditMode;
    console.log('🦴 ボーン編集モード:', boneEditMode ? 'ON' : 'OFF');
    updateBoneEditModeUI();
    
    if (!boneEditMode) {
        selectedBoneId = null;
    }
    
    if (typeof updatePropertiesPanel === 'function') {
        updatePropertiesPanel();
    }
    render();
}

// ===== ボーン編集モードUI更新 =====
function updateBoneEditModeUI() {
    const btn = document.getElementById('boneEditModeBtn');
    if (btn) {
        if (boneEditMode) {
            btn.style.background = 'linear-gradient(135deg, var(--accent-gold), var(--biscuit-medium))';
            btn.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
            btn.textContent = '✅ ボーン編集モードON';
            canvas.style.cursor = 'crosshair';
        } else {
            btn.style.background = '';
            btn.style.boxShadow = '';
            btn.textContent = '🦴 ボーン編集モード';
            canvas.style.cursor = 'default';
        }
    }
}

// ===== ボーンクリック処理（キャンバスクリック時に呼び出し） =====
function handleBoneCanvasClick(e, layer) {
    if (!boneEditMode || !layer || layer.type !== 'bone') return false;
    
    // クリック座標を取得
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    
    // レイヤー座標系に変換
    const layerX = canvasX - layer.x;
    const layerY = canvasY - layer.y;
    
    // 既存のボーンをクリックしたかチェック
    if (layer.boneParams && layer.boneParams.bones.length > 0) {
        const fps = typeof fpsRate !== 'undefined' ? fpsRate : 24;
        const currentFrame = Math.floor(currentTime * fps);
        const boneAngles = interpolateBoneAngles(layer, currentFrame);
        const transforms = calculateAllBoneTransforms(layer.boneParams.bones, boneAngles);
        
        for (const bone of layer.boneParams.bones) {
            const transform = transforms[bone.id];
            if (!transform) continue;
            
            // 関節（始点）との距離
            const distToStart = Math.hypot(layerX - transform.x, layerY - transform.y);
            if (distToStart < 15) {
                selectedBoneId = bone.id;
                updatePropertiesPanel();
                render();
                return true;
            }
        }
    }
    
    // 新しいボーンを追加
    const defaultLength = 50;
    const defaultAngle = -90; // 上向き
    
    const newBone = addBoneToLayer(layer, layerX, layerY, defaultAngle, defaultLength);
    selectedBoneId = newBone.id;
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
    
    updatePropertiesPanel();
    render();
    
    return true;
}

// ===== ボーンプロパティUI生成 =====
function generateBonePropertiesUI(layer) {
    if (!layer.boneParams) {
        layer.boneParams = getDefaultBoneParams();
    }
    
    const bones = layer.boneParams.bones || [];
    const selectedBone = selectedBoneId ? bones.find(b => b.id === selectedBoneId) : null;
    
    let bonesListHTML = '';
    if (bones.length === 0) {
        bonesListHTML = '<p style="text-align:center;color:var(--biscuit);padding:10px;font-size:12px;">ボーンなし（編集モードでキャンバスをクリックして追加）</p>';
    } else {
        bonesListHTML = bones.map(bone => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:${selectedBoneId === bone.id ? 'var(--accent-gold)' : 'var(--chocolate-light)'};border-radius:4px;margin-bottom:4px;cursor:pointer;"
                onclick="selectBone(${bone.id})">
                <span style="font-size:11px;color:${selectedBoneId === bone.id ? 'var(--chocolate-dark)' : 'var(--biscuit-light)'};">
                    🦴 ${bone.name} (角度: ${bone.angle.toFixed(1)}°)
                </span>
                <button onclick="event.stopPropagation();removeBoneFromLayerUI(${bone.id})" 
                    style="padding:2px 6px;background:var(--chocolate-dark);color:white;border:none;border-radius:4px;cursor:pointer;font-size:10px;">×</button>
            </div>
        `).join('');
    }
    
    let selectedBoneUI = '';
    if (selectedBone) {
        selectedBoneUI = `
            <div style="background:rgba(255,215,0,0.1);border:1px solid var(--accent-gold);border-radius:6px;padding:10px;margin-top:10px;">
                <h5 style="margin:0 0 8px 0;color:var(--accent-gold);">選択中: ${selectedBone.name}</h5>
                <div style="margin-bottom:8px;">
                    <label style="font-size:11px;color:var(--biscuit);">角度: <span id="boneAngleValue">${selectedBone.angle.toFixed(1)}°</span></label>
                    <input type="range" min="-180" max="180" step="1" value="${selectedBone.angle}"
                        oninput="updateBoneAngle(${selectedBone.id}, this.value)"
                        style="width:100%;margin-top:4px;">
                </div>
                <div style="margin-bottom:8px;">
                    <label style="font-size:11px;color:var(--biscuit);">長さ: <span id="boneLengthValue">${selectedBone.length}</span>px</label>
                    <input type="range" min="10" max="200" step="1" value="${selectedBone.length}"
                        oninput="updateBoneLength(${selectedBone.id}, this.value)"
                        style="width:100%;margin-top:4px;">
                </div>
            </div>
        `;
    }
    
    // キーフレームリスト
    const keyframes = layer.boneParams.boneKeyframes || [];
    let keyframesHTML = '';
    if (keyframes.length === 0) {
        keyframesHTML = '<p style="text-align:center;color:var(--biscuit);padding:10px;font-size:12px;">キーフレームなし</p>';
    } else {
        const fps = typeof fpsRate !== 'undefined' ? fpsRate : 24;
        keyframesHTML = keyframes.map(kf => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--chocolate-light);border-radius:4px;margin-bottom:4px;">
                <span style="font-size:11px;color:var(--biscuit-light);">🎬 ${kf.frame}f (${(kf.frame / fps).toFixed(2)}秒)</span>
                <button onclick="removeBoneKeyframeUI(${kf.frame})" 
                    style="padding:2px 6px;background:var(--chocolate-dark);color:white;border:none;border-radius:4px;cursor:pointer;font-size:10px;">×</button>
            </div>
        `).join('');
    }
    
    return `
        <div class="property-group" style="background: linear-gradient(135deg, rgba(0,255,100,0.1), rgba(0,200,255,0.1)); border: 1px solid #00ff66;">
            <h4>🦴 ボーンアニメーション</h4>
            
            <button id="boneEditModeBtn" onclick="toggleBoneEditMode()"
                style="width:100%;padding:10px;margin-bottom:10px;background:${boneEditMode ? 'linear-gradient(135deg, var(--accent-gold), var(--biscuit-medium))' : 'var(--chocolate-medium)'};color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
                ${boneEditMode ? '✅ ボーン編集モードON' : '🦴 ボーン編集モード'}
            </button>
            
            <div style="margin-bottom:10px;">
                <label style="font-size:11px;color:var(--biscuit);">メッシュ分割数: <span id="boneDivisionsValue">${layer.boneParams.divisions}</span></label>
                <input type="range" min="10" max="50" step="1" value="${layer.boneParams.divisions}"
                    oninput="updateBoneParamUI('divisions', this.value)"
                    style="width:100%;margin-top:4px;">
            </div>
            
            <div style="margin-bottom:10px;">
                <label style="font-size:11px;color:var(--biscuit);">影響半径: <span id="boneInfluenceValue">${(layer.boneParams.influenceRadius * 100).toFixed(0)}%</span></label>
                <input type="range" min="10" max="100" step="5" value="${layer.boneParams.influenceRadius * 100}"
                    oninput="updateBoneParamUI('influenceRadius', this.value / 100)"
                    style="width:100%;margin-top:4px;">
            </div>
            
            <h5 style="margin:10px 0 6px 0;color:var(--biscuit-light);">📋 ボーンリスト</h5>
            <div style="max-height:150px;overflow-y:auto;margin-bottom:10px;">
                ${bonesListHTML}
            </div>
            
            ${selectedBoneUI}
            
            <h5 style="margin:15px 0 6px 0;color:var(--biscuit-light);">🎬 ボーンキーフレーム</h5>
            <button onclick="addBoneKeyframeUI()"
                style="width:100%;padding:8px;margin-bottom:8px;background:var(--accent-orange);color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">
                ➕ 現在位置にキーフレーム追加
            </button>
            <div style="max-height:120px;overflow-y:auto;">
                ${keyframesHTML}
            </div>
        </div>
    `;
}

// ===== UI操作関数 =====
function selectBone(boneId) {
    selectedBoneId = boneId;
    updatePropertiesPanel();
    render();
}

function updateBoneAngle(boneId, value) {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || !layer.boneParams) return;
    
    const bone = layer.boneParams.bones.find(b => b.id === boneId);
    if (bone) {
        bone.angle = parseFloat(value);
        document.getElementById('boneAngleValue').textContent = bone.angle.toFixed(1) + '°';
        render();
    }
}

function updateBoneLength(boneId, value) {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || !layer.boneParams) return;
    
    const bone = layer.boneParams.bones.find(b => b.id === boneId);
    if (bone) {
        bone.length = parseFloat(value);
        document.getElementById('boneLengthValue').textContent = bone.length;
        render();
    }
}

function updateBoneParamUI(param, value) {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer || !layer.boneParams) return;
    
    layer.boneParams[param] = parseFloat(value);
    
    if (param === 'divisions') {
        document.getElementById('boneDivisionsValue').textContent = value;
    } else if (param === 'influenceRadius') {
        document.getElementById('boneInfluenceValue').textContent = (value * 100).toFixed(0) + '%';
    }
    
    render();
}

function removeBoneFromLayerUI(boneId) {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    if (confirm('このボーンを削除しますか？')) {
        removeBoneFromLayer(layer, boneId);
        if (typeof saveHistory === 'function') {
            saveHistory();
        }
        updatePropertiesPanel();
        render();
    }
}

function addBoneKeyframeUI() {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    const fps = typeof fpsRate !== 'undefined' ? fpsRate : 24;
    const currentFrame = Math.floor(currentTime * fps);
    
    addBoneKeyframe(layer, currentFrame);
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
    
    updatePropertiesPanel();
}

function removeBoneKeyframeUI(frame) {
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    removeBoneKeyframe(layer, frame);
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
    
    updatePropertiesPanel();
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    initBoneWebGL();
    
    // キャンバスクリックイベントを登録
    const canvasEl = document.getElementById('canvas');
    if (canvasEl) {
        canvasEl.addEventListener('click', (e) => {
            console.log('🦴 キャンバスクリック - boneEditMode:', boneEditMode);
            if (!boneEditMode) return;
            
            // selectedLayerIdsから現在選択中のレイヤーを取得
            let layer = null;
            if (typeof selectedLayerIds !== 'undefined' && selectedLayerIds.length > 0 && typeof layers !== 'undefined') {
                layer = layers.find(l => l.id === selectedLayerIds[0]);
            }
            console.log('🦴 選択レイヤー:', layer ? layer.name : 'なし', layer ? layer.type : '');
            
            if (layer && layer.type === 'bone') {
                handleBoneCanvasClick(e, layer);
            }
        });
        
        // タッチ対応
        canvasEl.addEventListener('touchend', (e) => {
            if (!boneEditMode) return;
            
            let layer = null;
            if (typeof selectedLayerIds !== 'undefined' && selectedLayerIds.length > 0 && typeof layers !== 'undefined') {
                layer = layers.find(l => l.id === selectedLayerIds[0]);
            }
            
            if (layer && layer.type === 'bone') {
                if (e.changedTouches && e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const fakeEvent = {
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    };
                    handleBoneCanvasClick(fakeEvent, layer);
                }
            }
        });
        
        console.log('🦴 キャンバスクリックイベント登録完了');
    } else {
        console.error('🦴 キャンバスが見つかりません');
    }
    
    console.log('🦴 ボーンアニメーション機能を初期化しました');
});
