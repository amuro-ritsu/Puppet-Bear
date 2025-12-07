/**
 * ⭐ Starlit Puppet Editor v1.12.1
 * レイヤーリスト・フォルダ機能
 * - チェックボックスによる複数選択（タブレット対応）
 * - ZIP/PSD一括読み込み
 * - レイヤー種類変更機能
 * - フォルダ同士の親子関係表示対応
 */

// ===== レイヤー絞り込み =====
let layerFilterText = '';
let layerFilterType = '';

// 絞り込み条件に一致するかチェック（子孫も含めて再帰的にチェック）
function layerMatchesFilter(layer) {
    // 名前フィルター
    const nameMatch = !layerFilterText || layer.name.toLowerCase().includes(layerFilterText.toLowerCase());
    
    // 種類フィルター
    const typeMatch = !layerFilterType || layer.type === layerFilterType;
    
    // 自分が一致するか
    if (nameMatch && typeMatch) return true;
    
    // フォルダの場合、子が一致すれば表示
    if (layer.type === 'folder') {
        const children = layers.filter(l => l.parentLayerId === layer.id);
        for (const child of children) {
            if (layerMatchesFilter(child)) return true;
        }
    }
    
    return false;
}

// 絞り込み適用（種類選択時）
function applyLayerFilterType() {
    const typeSelect = document.getElementById('layer-filter-type');
    layerFilterType = typeSelect ? typeSelect.value : '';
    updateLayerList();
}

// 絞り込み適用（テキスト検索 - Enterキーまたはボタンで）
function applyLayerFilterText() {
    const textInput = document.getElementById('layer-filter-text');
    layerFilterText = textInput ? textInput.value : '';
    updateLayerList();
    
    // フォーカスを戻す
    setTimeout(() => {
        const newInput = document.getElementById('layer-filter-text');
        if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
    }, 10);
}

// Enterキーで検索
function handleFilterKeydown(e) {
    if (e.key === 'Enter') {
        applyLayerFilterText();
    }
}

// 絞り込み解除
function clearLayerFilter() {
    layerFilterText = '';
    layerFilterType = '';
    updateLayerList();
}

// ===== レイヤーリスト更新 =====
function updateLayerList() {
    layerList.innerHTML = '';
    
    // 固定部分のコンテナ
    const fixedContainer = document.createElement('div');
    fixedContainer.style.cssText = 'position: sticky; top: 0; z-index: 10; background: var(--chocolate-dark); padding-bottom: 8px;';
    
    // ヘッダー（リネームボタン付き）
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; background: var(--chocolate-medium); border-radius: 4px;';
    header.innerHTML = `
        <span style="flex: 1; font-weight: bold; color: var(--biscuit-light);">📚 レイヤー</span>
        <button onclick="selectAllLayers()" style="padding: 4px 8px; background: var(--chocolate-light); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px;" title="全選択">☑️</button>
        <button onclick="deselectAllLayers()" style="padding: 4px 8px; background: var(--chocolate-light); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px;" title="選択解除">☐</button>
        <button onclick="showRenameDialog()" style="padding: 4px 8px; background: var(--accent-orange); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">✏️ リネーム</button>
    `;
    fixedContainer.appendChild(header);
    
    // ===== 絞り込み検索 =====
    const filterContainer = document.createElement('div');
    filterContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px;';
    
    // 名前検索
    const filterRow1 = document.createElement('div');
    filterRow1.style.cssText = 'display: flex; gap: 4px; align-items: center;';
    filterRow1.innerHTML = `
        <span style="font-size: 11px; color: var(--biscuit);">🔍</span>
        <input type="text" id="layer-filter-text" placeholder="検索してEnter..." 
            value="${layerFilterText}"
            style="flex: 1; padding: 6px 8px; background: var(--chocolate-medium); color: var(--text-light); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px;"
            onkeydown="handleFilterKeydown(event)">
        <button onclick="applyLayerFilterText()" 
            style="padding: 6px 8px; background: var(--accent-gold); color: var(--chocolate-dark); border: none; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold;"
            title="検索">🔍</button>
    `;
    filterContainer.appendChild(filterRow1);
    
    // 種類フィルター + クリアボタン
    const filterRow2 = document.createElement('div');
    filterRow2.style.cssText = 'display: flex; gap: 4px; align-items: center;';
    filterRow2.innerHTML = `
        <select id="layer-filter-type" 
            style="flex: 1; padding: 6px; background: var(--chocolate-medium); color: var(--text-light); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px; cursor: pointer;"
            onchange="applyLayerFilterType()">
            <option value="">📋 すべての種類</option>
            <option value="image" ${layerFilterType === 'image' ? 'selected' : ''}>🖼️ 画像</option>
            <option value="folder" ${layerFilterType === 'folder' ? 'selected' : ''}>📁 フォルダ</option>
            <option value="lipsync" ${layerFilterType === 'lipsync' ? 'selected' : ''}>💬 口パク</option>
            <option value="blink" ${layerFilterType === 'blink' ? 'selected' : ''}>👀 まばたき</option>
            <option value="sequence" ${layerFilterType === 'sequence' ? 'selected' : ''}>🎞️ 連番アニメ</option>
            <option value="bounce" ${layerFilterType === 'bounce' ? 'selected' : ''}>🎈 弾みレイヤー</option>
            <option value="bone" ${layerFilterType === 'bone' ? 'selected' : ''}>🦴 ボーン</option>
            <option value="puppet" ${layerFilterType === 'puppet' ? 'selected' : ''}>🎭 パペット</option>
            <option value="audio" ${layerFilterType === 'audio' ? 'selected' : ''}>🎵 音声</option>
        </select>
        <button onclick="clearLayerFilter()" 
            style="padding: 6px 10px; background: var(--chocolate-light); color: var(--text-light); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 10px; white-space: nowrap;"
            title="絞り込み解除">✖ 解除</button>
    `;
    filterContainer.appendChild(filterRow2);
    
    // フィルター中の表示
    if (layerFilterText || layerFilterType) {
        const filterStatus = document.createElement('div');
        filterStatus.style.cssText = 'font-size: 10px; color: var(--accent-gold); padding: 4px; text-align: center;';
        const matchCount = layers.filter(l => layerMatchesFilter(l) && !l.parentLayerId).length;
        filterStatus.textContent = `🔎 絞り込み中: ${matchCount}件表示`;
        filterContainer.appendChild(filterStatus);
    }
    
    fixedContainer.appendChild(filterContainer);
    
    // ===== ボタン群（レイヤー一覧の上に配置） =====
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'layer-buttons-container';
    buttonContainer.style.cssText = 'display: flex !important; flex-direction: column; gap: 6px; margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.15); border-radius: 8px;';
    
    // フォルダ作成ボタン
    const folderBtn = document.createElement('button');
    folderBtn.textContent = '📁 フォルダ作成';
    folderBtn.className = 'create-folder-btn';
    folderBtn.style.cssText = 'width: 100%; padding: 8px; background: linear-gradient(135deg, var(--biscuit-dark), var(--biscuit-medium)); color: var(--chocolate-dark); border: 2px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: bold;';
    folderBtn.onclick = createFolderFromSelection;
    buttonContainer.appendChild(folderBtn);
    
    // 区切り線
    const separator = document.createElement('div');
    separator.style.cssText = 'height: 1px; background: var(--border-color); margin: 4px 0;';
    buttonContainer.appendChild(separator);
    
    // レイヤー追加（プルダウン + ボタン）
    const addLayerRow = document.createElement('div');
    addLayerRow.style.cssText = 'display: flex; gap: 6px; align-items: center;';
    
    const layerTypeSelect = document.createElement('select');
    layerTypeSelect.id = 'layer-type-select';
    layerTypeSelect.style.cssText = 'flex: 1; padding: 8px; background: var(--biscuit-dark); color: var(--chocolate-dark); border: 2px solid var(--border-color); border-radius: 6px; font-weight: bold; cursor: pointer;';
    layerTypeSelect.innerHTML = `
        <option value="image">📷 画像/ZIP/PSD</option>
        <option value="lipsync">💬 口パク</option>
        <option value="blink">👀 まばたき</option>
        <option value="sequence">🎞️ 連番アニメ</option>
        <option value="crosssection">🔞 断面図</option>
        <option value="bounce">🎈 弾みレイヤー</option>
        <option value="bone">🦴 ボーン</option>
        <option value="puppet">🎭 パペット</option>
        <option value="audio">🎵 音声</option>
    `;
    addLayerRow.appendChild(layerTypeSelect);
    
    const addLayerBtn = document.createElement('button');
    addLayerBtn.textContent = '➕ 追加';
    addLayerBtn.style.cssText = 'padding: 8px 16px; background: linear-gradient(135deg, var(--accent-gold), var(--accent-orange)); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; white-space: nowrap;';
    addLayerBtn.onclick = () => {
        const type = layerTypeSelect.value;
        switch(type) {
            case 'image':
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,.zip,.psd';
                input.multiple = true;
                input.onchange = (e) => handleImageFilesInput(e.target.files);
                input.click();
                break;
            case 'lipsync':
                createLipSyncLayer();
                break;
            case 'blink':
                createBlinkLayer();
                break;
            case 'sequence':
                createSequenceLayer();
                break;
            case 'crosssection':
                createCrossSectionLayer();
                break;
            case 'bounce':
                createBounceLayer();
                break;
            case 'bone':
                createBoneLayer();
                break;
            case 'puppet':
                createPuppetLayer();
                break;
            case 'audio':
                createAudioLayer();
                break;
        }
    };
    addLayerRow.appendChild(addLayerBtn);
    buttonContainer.appendChild(addLayerRow);
    
    fixedContainer.appendChild(buttonContainer);
    
    // 説明
    const info = document.createElement('div');
    info.style.cssText = 'font-size: 10px; color: var(--biscuit); padding: 4px 8px; margin-bottom: 8px; background: var(--chocolate-dark); border-radius: 4px;';
    info.innerHTML = '💡 上のレイヤーが前面 | Shift:範囲選択 | Ctrl:追加選択';
    fixedContainer.appendChild(info);
    
    layerList.appendChild(fixedContainer);
    
    // ルートレベルのレイヤーを表示（逆順：上にあるほど上に表示）
    const rootLayers = layers.filter(l => !l.parentLayerId);
    // 逆順で表示（フィルターを適用）
    for (let i = rootLayers.length - 1; i >= 0; i--) {
        const layer = rootLayers[i];
        // フィルターに一致するか、子が一致する場合のみ表示
        if (layerMatchesFilter(layer)) {
            renderLayerItem(layer, 0);
        }
    }
    
    // タイムラインを更新
    if (typeof updateTimeline === 'function') {
        updateTimeline();
    }
}

// ===== 全選択/選択解除 =====
function selectAllLayers() {
    selectedLayerIds = layers.map(l => l.id);
    updateLayerList();
    updatePropertiesPanel();
}

function deselectAllLayers() {
    selectedLayerIds = [];
    updateLayerList();
    updatePropertiesPanel();
}

// ===== 画像ファイル入力処理（ZIP/PSD/複数ファイル対応） =====
async function handleImageFilesInput(files) {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    
    // ZIPファイルがあるか確認
    const zipFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.zip'));
    const imageFiles = fileArray.filter(f => !f.name.toLowerCase().endsWith('.zip') && !f.name.toLowerCase().endsWith('.psd'));
    const psdFiles = fileArray.filter(f => f.name.toLowerCase().endsWith('.psd'));
    
    // ZIPファイルを処理
    for (const zipFile of zipFiles) {
        await loadImagesFromZip(zipFile);
    }
    
    // PSDファイルを処理
    for (const psdFile of psdFiles) {
        await loadImagesFromPSD(psdFile);
    }
    
    // 通常の画像ファイルを処理
    if (imageFiles.length > 0) {
        // 連番でソート
        const sortedFiles = sortFilesByNumber(imageFiles);
        for (const file of sortedFiles) {
            await loadImageWithOriginalName(file);
        }
    }
}

// ===== PSDから画像を一括読み込み（ag-psd使用） =====
async function loadImagesFromPSD(psdFile) {
    // ag-psdがグローバルに読み込まれているか確認
    if (typeof agPsd === 'undefined') {
        alert('ag-psdライブラリが読み込まれていません。');
        return;
    }
    
    try {
        console.log('📂 PSDファイル読み込み開始:', psdFile.name);
        
        // ArrayBufferとして読み込み
        const arrayBuffer = await psdFile.arrayBuffer();
        
        // ag-psdでPSDを読み込み
        const psd = agPsd.readPsd(new Uint8Array(arrayBuffer), {
            skipThumbnail: true
        });
        
        // PSDキャンバスサイズ
        const psdWidth = psd.width;
        const psdHeight = psd.height;
        const psdCenterX = psdWidth / 2;
        const psdCenterY = psdHeight / 2;
        
        // PSD情報をログ
        console.log('📐 PSDサイズ:', psdWidth, 'x', psdHeight);
        console.log('📍 PSD中心:', psdCenterX, ',', psdCenterY);
        console.log('📑 レイヤー数:', psd.children ? psd.children.length : 0);
        
        // レイヤー情報を収集（再帰的に処理）
        const layerInfos = [];
        
        function collectLayers(children, depth = 0) {
            if (!children) return;
            
            for (const child of children) {
                // グループ（フォルダ）の場合は子を再帰処理
                if (child.children) {
                    console.log('📁 グループ:', child.name);
                    collectLayers(child.children, depth + 1);
                    continue;
                }
                
                // canvasがあるレイヤーのみ処理
                if (child.canvas) {
                    // レイヤーの中心座標（PSD座標系）
                    const layerCenterX = (child.left || 0) + child.canvas.width / 2;
                    const layerCenterY = (child.top || 0) + child.canvas.height / 2;
                    
                    // PSD中心からの相対座標（Puppet Bear座標系）
                    const relativeX = layerCenterX - psdCenterX;
                    const relativeY = layerCenterY - psdCenterY;
                    
                    layerInfos.push({
                        name: child.name || 'Layer',
                        canvas: child.canvas,
                        x: relativeX,  // PSD中心基準の座標
                        y: relativeY,
                        width: child.canvas.width,
                        height: child.canvas.height,
                        opacity: child.opacity !== undefined ? child.opacity : 1,
                        hidden: child.hidden || false
                    });
                    
                    console.log('✅ レイヤー取得:', child.name, 
                        `(${child.canvas.width}x${child.canvas.height})`,
                        `PSD位置: (${child.left}, ${child.top})`,
                        `→ 相対位置: (${relativeX.toFixed(1)}, ${relativeY.toFixed(1)})`,
                        child.hidden ? '(非表示)' : '');
                } else {
                    console.log('⏭️ 空レイヤーをスキップ:', child.name);
                }
            }
        }
        
        collectLayers(psd.children);
        
        if (layerInfos.length === 0) {
            alert('PSDから読み込める画像レイヤーが見つかりませんでした。\n\nヒント: Photoshopで「ファイル互換性を優先」オプションを有効にして保存してください。');
            return;
        }
        
        // PSDの順序を逆にして追加（下のレイヤーが先に格納されているので）
        for (let i = layerInfos.length - 1; i >= 0; i--) {
            const info = layerInfos[i];
            
            // CanvasをDataURLに変換
            const dataUrl = info.canvas.toDataURL('image/png');
            
            // レイヤーとして追加（PSD中心基準の座標）
            await loadImageFromDataURLWithPosition(
                dataUrl, 
                info.name, 
                info.x,   // 既にPSD中心基準
                info.y, 
                info.opacity,
                !info.hidden  // visible
            );
        }
        
        console.log(`✅ PSDから ${layerInfos.length} 枚のレイヤーを読み込みました`);
        
    } catch (error) {
        console.error('❌ PSD読み込みエラー:', error);
        alert('PSDファイルの読み込みに失敗しました: ' + error.message + '\n\nヒント: Photoshopで「ファイル互換性を優先」オプションを有効にして保存し直してください。');
    }
}

// ===== DataURLから画像読み込み（位置情報付き・PSD用） =====
async function loadImageFromDataURLWithPosition(dataUrl, name, x = 0, y = 0, opacity = 1, visible = true) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // 座標はPSD中心基準で既に計算済み
            // Puppet Bearのキャンバス中心を基準に配置
            const canvasCenterX = canvas.width / 2;
            const canvasCenterY = canvas.height / 2;
            
            const layer = {
                id: Date.now() + Math.random(),
                name: name.replace(/\.[^/.]+$/, ''),
                type: 'image',
                img: img,
                x: canvasCenterX + x,  // キャンバス中心 + PSD中心からの相対位置
                y: canvasCenterY + y,
                width: img.width,
                height: img.height,
                rotation: 0,
                scale: 1,
                opacity: opacity,
                anchorX: 0.5,
                anchorY: 0.5,
                visible: visible,
                blendMode: 'source-over',
                keyframes: [],
                
                // 風揺れ機能（デフォルト無効）
                windSwayEnabled: false,
                windSwayParams: typeof getDefaultWindSwayParams === 'function' ? getDefaultWindSwayParams() : {
                    divisions: 30,
                    angle: 0,
                    period: 3,
                    phaseShift: 0.3,
                    center: 0.5,
                    topFixed: 0,
                    bottomFixed: 0.3,
                    randomPattern: 0,
                    seed: 0,
                    fromBottom: false,
                    randomSwing: false,
                    loop: false,
                    frequency: 1,
                    dampingTime: null
                },
                
                // Wiggle機能（デフォルト無効）
                wiggleEnabled: false,
                wiggleParams: typeof getDefaultWiggleParams === 'function' ? getDefaultWiggleParams() : {
                    amplitude: 5,
                    frequency: 3,
                    seed: 0
                }
            };
            
            layers.unshift(layer);
            selectedLayer = layer;
            updateLayerList();
            updateTimeline();
            render();
            resolve(layer);
        };
        img.onerror = () => {
            console.error('画像の読み込みに失敗:', name);
            resolve(null);
        };
        img.src = dataUrl;
    });
}

// ===== ZIPから画像を一括読み込み =====
async function loadImagesFromZip(zipFile) {
    if (typeof JSZip === 'undefined') {
        alert('JSZipライブラリが読み込まれていません。');
        return;
    }
    
    try {
        const zip = await JSZip.loadAsync(zipFile);
        const imageEntries = [];
        
        // 画像ファイルを抽出
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                const lowerName = relativePath.toLowerCase();
                if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || 
                    lowerName.endsWith('.jpeg') || lowerName.endsWith('.gif') ||
                    lowerName.endsWith('.webp')) {
                    imageEntries.push({
                        path: relativePath,
                        entry: zipEntry,
                        // ファイル名のみ取得
                        name: relativePath.split('/').pop()
                    });
                }
            }
        });
        
        // 連番でソート
        imageEntries.sort((a, b) => {
            return compareFileNames(a.name, b.name);
        });
        
        // 画像を読み込み（逆順で追加して、若い番号が上に来るようにする）
        for (let i = imageEntries.length - 1; i >= 0; i--) {
            const entry = imageEntries[i];
            const blob = await entry.entry.async('blob');
            const dataUrl = await blobToDataURL(blob);
            await loadImageFromDataURL(dataUrl, entry.name);
        }
        
        console.log(`✅ ZIPから ${imageEntries.length} 枚の画像を読み込みました`);
        
    } catch (error) {
        console.error('❌ ZIP読み込みエラー:', error);
        alert('ZIPファイルの読み込みに失敗しました: ' + error.message);
    }
}

// ===== ファイル名を連番でソート =====
function sortFilesByNumber(files) {
    return files.slice().sort((a, b) => {
        return compareFileNames(a.name, b.name);
    });
}

// ===== ファイル名比較（連番対応） =====
function compareFileNames(nameA, nameB) {
    // 数字を抽出して比較
    const numA = extractNumber(nameA);
    const numB = extractNumber(nameB);
    
    if (numA !== null && numB !== null) {
        return numA - numB;
    }
    
    // 数字がない場合は文字列比較
    return nameA.localeCompare(nameB);
}

// ===== ファイル名から数字を抽出（先頭の連番優先） =====
function extractNumber(filename) {
    // ファイル名から数字部分を抽出
    const match = filename.match(/(\d+)/g);
    if (match && match.length > 0) {
        // 先頭の数字を使用（001_ひも.png のようなパターンに対応）
        return parseInt(match[0], 10);
    }
    return null;
}

// ===== BlobをDataURLに変換 =====
function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ===== DataURLから画像を読み込み =====
function loadImageFromDataURL(dataUrl, filename) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const layer = createImageLayer(img, filename);
            layers.push(layer);
            updateLayerList();
            render();
            resolve(layer);
        };
        img.onerror = () => {
            console.error('画像読み込みエラー:', filename);
            resolve(null);
        };
        img.src = dataUrl;
    });
}

// ===== オリジナルファイル名で画像を読み込み（タブレット対応強化） =====
function loadImageWithOriginalName(file) {
    return new Promise((resolve) => {
        // ファイル名を確実に取得（タブレット対応強化）
        let filename = '';
        
        // 1. まずwebkitRelativePathを確認（フォルダ選択時）
        if (file.webkitRelativePath && file.webkitRelativePath.length > 0) {
            filename = file.webkitRelativePath.split('/').pop();
        }
        
        // 2. webkitRelativePathがない場合はnameを使用
        if (!filename) {
            filename = file.name;
        }
        
        // 3. タブレットで数字のみになる問題に対応
        // ファイル名が数字のみ、または拡張子がない場合
        if (/^\d+$/.test(filename) || !filename.includes('.')) {
            // MIMEタイプから拡張子を推定
            let ext = '.png';
            if (file.type) {
                if (file.type.includes('jpeg') || file.type.includes('jpg')) ext = '.jpg';
                else if (file.type.includes('gif')) ext = '.gif';
                else if (file.type.includes('webp')) ext = '.webp';
            }
            
            // 元のnameに拡張子がある場合はそれを使用
            if (file.name && file.name.includes('.')) {
                filename = file.name;
            } else {
                // タイムスタンプベースの名前を生成（最後の手段）
                filename = `image_${Date.now()}${ext}`;
            }
        }
        
        // 4. 最終チェック：空の場合はデフォルト名
        if (!filename || filename.trim() === '') {
            filename = `image_${Date.now()}.png`;
        }
        
        console.log(`📷 読み込み: ${filename} (元: ${file.name})`);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const layer = createImageLayer(img, filename);
                layers.push(layer);
                updateLayerList();
                selectLayer(layer.id, false);
                render();
                
                if (typeof saveHistory === 'function') {
                    saveHistory();
                }
                resolve(layer);
            };
            img.onerror = () => {
                console.error('画像読み込みエラー:', filename);
                resolve(null);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ===== 画像レイヤー作成（共通処理） =====
function createImageLayer(img, filename) {
    return {
        id: nextLayerId++,
        type: 'image',
        name: filename,
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
}

// ===== レイヤーアイテムを再帰的に描画（チェックボックス付き） =====
function renderLayerItem(layer, depth) {
    const isSelected = selectedLayerIds.includes(layer.id);
    
    // 選択中の場合、レイヤー名ラベルを上に表示
    if (isSelected) {
        const nameLabel = document.createElement('div');
        nameLabel.className = 'layer-name-label';
        nameLabel.style.cssText = `
            padding: 8px 8px 12px ${depth * 20 + 8}px;
            margin-bottom: 4px;
            font-size: 12px;
            color: var(--accent-gold);
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.6;
            background: rgba(139, 90, 43, 0.3);
            border-radius: 6px;
            border-left: 3px solid var(--accent-gold);
        `;
        nameLabel.textContent = `▽ ${layer.name}`;
        layerList.appendChild(nameLabel);
    }
    
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.style.paddingLeft = `${depth * 20 + 8}px`;
    item.draggable = true;
    item.dataset.layerId = layer.id;
    
    // 選択状態
    if (selectedLayerIds.includes(layer.id)) {
        item.classList.add('selected');
    }
    
    // タッチデバイスでの長押しによるコンテキストメニュー防止
    item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // ドラッグイベント
    item.addEventListener('dragstart', (e) => handleDragStart(e, layer.id));
    item.addEventListener('dragover', (e) => handleDragOver(e, layer.id));
    item.addEventListener('dragleave', (e) => handleDragLeave(e));
    item.addEventListener('drop', (e) => handleDrop(e, layer.id));
    item.addEventListener('dragend', (e) => handleDragEnd(e));
    
    // チェックボックス
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'layer-checkbox';
    checkbox.checked = selectedLayerIds.includes(layer.id);
    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleLayerSelection(layer.id, checkbox.checked);
    };
    
    // レイヤータイプに応じたアイコン
    const typeIcon = getLayerTypeIcon(layer.type);
    
    // 風揺れアイコン
    const windIcon = layer.windSwayEnabled ? '💨' : '';
    
    // 歩行アイコン（フォルダのみ）
    const walkIcon = (layer.type === 'folder' && layer.walkingEnabled) ? '🚶' : '';
    
    // 親レイヤーがある場合のインジケータ
    const hasParent = layer.parentLayerId != null;
    const parentIndicator = hasParent ? '🔗' : '';
    
    // 子レイヤーの有無
    const hasChildren = layers.some(l => l.parentLayerId === layer.id);
    const childIndicator = hasChildren ? '📎' : '';
    
    // フォルダの場合
    if (layer.type === 'folder') {
        const expanded = layer.expanded !== false;
        const isChecked = selectedLayerIds.includes(layer.id) ? 'checked' : '';
        // ジャンプ機能有効時はアイコンを変更
        const jumpIcon = layer.jumpParams ? '🦘' : '';
        
        item.innerHTML = `
            <div class="layer-row-top">
                <input type="checkbox" class="layer-checkbox" ${isChecked} onclick="event.stopPropagation(); toggleLayerSelection(${layer.id}, this.checked)">
                <span class="folder-toggle" onclick="toggleFolder(${layer.id}, event)">${expanded ? '▼' : '▶'}</span>
                <span class="layer-name">${windIcon}${walkIcon}${jumpIcon}${parentIndicator}${typeIcon} ${layer.name}</span>
            </div>
            <div class="layer-row-bottom">
                <button class="layer-move-btn" onclick="event.stopPropagation(); event.preventDefault(); moveLayerUp(${layer.id}, event)" title="上に移動">⬆</button>
                <button class="layer-move-btn" onclick="event.stopPropagation(); event.preventDefault(); moveLayerDown(${layer.id}, event)" title="下に移動">⬇</button>
                <button class="layer-visibility-btn" onclick="toggleLayerVisibility(${layer.id}, event)" title="表示切替">
                    <img src="${layer.visible !== false ? 'bear-eye-open.png' : 'bear-eye-close.png'}" alt="visibility">
                </button>
                <button class="layer-delete-btn" onclick="deleteLayer(${layer.id}, event)" title="削除">
                    <img src="icon-delete.png" alt="delete">
                </button>
            </div>
        `;
        
        // ジャンプ機能有効時は緑系の背景
        if (layer.jumpParams) {
            item.style.background = 'linear-gradient(135deg, #1a4d1a, #2d6a2d)';
            item.style.borderColor = '#32cd32';
            item.style.color = '#ffffff';
        }
        
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('folder-toggle') && e.target.type !== 'checkbox') {
                selectLayer(layer.id, e.shiftKey, e.ctrlKey || e.metaKey);
            }
        });
        layerList.appendChild(item);
        
        // 子レイヤーを表示（展開時のみ）
        if (expanded) {
            const children = layers.filter(l => l.parentLayerId === layer.id);
            for (let i = children.length - 1; i >= 0; i--) {
                // フィルターに一致する子のみ表示
                if (layerMatchesFilter(children[i])) {
                    renderLayerItem(children[i], depth + 1);
                }
            }
        }
    }
    // 音声レイヤーの場合
    else if (layer.type === 'audio') {
        const clipCount = layer.audioClips ? layer.audioClips.length : 0;
        const isChecked = selectedLayerIds.includes(layer.id) ? 'checked' : '';
        
        item.innerHTML = `
            <div class="layer-row-top">
                <input type="checkbox" class="layer-checkbox" ${isChecked} onclick="event.stopPropagation(); toggleLayerSelection(${layer.id}, this.checked)">
                <span class="layer-name">${typeIcon} ${layer.name} <span style="font-size: 10px; color: #1db954;">(${clipCount}クリップ)</span></span>
            </div>
            <div class="layer-row-bottom">
                <button class="layer-move-btn" onclick="event.stopPropagation(); event.preventDefault(); moveLayerUp(${layer.id}, event)" title="上に移動">⬆</button>
                <button class="layer-move-btn" onclick="event.stopPropagation(); event.preventDefault(); moveLayerDown(${layer.id}, event)" title="下に移動">⬇</button>
                <button class="layer-visibility-btn" onclick="toggleLayerVisibility(${layer.id}, event)" title="表示切替">
                    <img src="${layer.visible !== false ? 'bear-eye-open.png' : 'bear-eye-close.png'}" alt="visibility">
                </button>
                <button class="layer-delete-btn" onclick="deleteLayer(${layer.id}, event)" title="削除">
                    <img src="icon-delete.png" alt="delete">
                </button>
            </div>
        `;
        
        item.style.background = 'linear-gradient(135deg, #1a3d1a, #2d5a2d)';
        item.style.borderColor = '#1db954';
        
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') selectLayer(layer.id, e.shiftKey, e.ctrlKey || e.metaKey);
        });
        layerList.appendChild(item);
    }
    // その他のレイヤー（画像、口パク、まばたき、パペット、バウンス）
    else {
        const isChecked = selectedLayerIds.includes(layer.id) ? 'checked' : '';
        
        item.innerHTML = `
            <div class="layer-row-top">
                <input type="checkbox" class="layer-checkbox" ${isChecked} onclick="event.stopPropagation(); toggleLayerSelection(${layer.id}, this.checked)">
                <span class="layer-name">${windIcon}${childIndicator}${parentIndicator}${typeIcon} ${layer.name}</span>
            </div>
            <div class="layer-row-bottom">
                <button class="layer-move-btn" onclick="event.stopPropagation(); event.preventDefault(); moveLayerUp(${layer.id}, event)" title="上に移動">⬆</button>
                <button class="layer-move-btn" onclick="event.stopPropagation(); event.preventDefault(); moveLayerDown(${layer.id}, event)" title="下に移動">⬇</button>
                <button class="layer-visibility-btn" onclick="toggleLayerVisibility(${layer.id}, event)" title="表示切替">
                    <img src="${layer.visible !== false ? 'bear-eye-open.png' : 'bear-eye-close.png'}" alt="visibility">
                </button>
                <button class="layer-delete-btn" onclick="deleteLayer(${layer.id}, event)" title="削除">
                    <img src="icon-delete.png" alt="delete">
                </button>
            </div>
        `;
        
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') selectLayer(layer.id, e.shiftKey, e.ctrlKey || e.metaKey);
        });
        layerList.appendChild(item);
        
        // 子レイヤーを表示（フィルターを適用）
        const children = layers.filter(l => l.parentLayerId === layer.id);
        for (let i = children.length - 1; i >= 0; i--) {
            if (layerMatchesFilter(children[i])) {
                renderLayerItem(children[i], depth + 1);
            }
        }
    }
}

// ===== レイヤータイプアイコン取得 =====
function getLayerTypeIcon(type) {
    switch (type) {
        case 'folder': return '📁';
        case 'lipsync': return '💬';
        case 'blink': return '👀';
        case 'sequence': return '🎞️';
        case 'crosssection': return '🔞';
        case 'puppet': return '🎭';
        case 'bounce': return '🎈';
        case 'bone': return '🦴';
        case 'audio': return '🎵';
        case 'image':
        default: return '🖼️';
    }
}

// ===== チェックボックスによる選択切り替え =====
function toggleLayerSelection(layerId, checked) {
    if (checked) {
        if (!selectedLayerIds.includes(layerId)) {
            selectedLayerIds.push(layerId);
        }
    } else {
        const index = selectedLayerIds.indexOf(layerId);
        if (index > -1) {
            selectedLayerIds.splice(index, 1);
        }
    }
    updateLayerList();
    updatePropertiesPanel();
}

// ===== レイヤー選択（render()を呼ばない） =====
// 最後に選択したレイヤーのID（範囲選択用）
let lastSelectedLayerId = null;

function selectLayer(layerId, shiftKey = false, ctrlKey = false) {
    if (shiftKey && lastSelectedLayerId !== null) {
        // Shift+クリック：範囲選択
        // レイヤーリストの表示順でインデックスを取得
        const displayOrder = getDisplayOrderLayerIds();
        const lastIndex = displayOrder.indexOf(lastSelectedLayerId);
        const currentIndex = displayOrder.indexOf(layerId);
        
        if (lastIndex !== -1 && currentIndex !== -1) {
            // 範囲内のすべてのレイヤーを選択
            const startIndex = Math.min(lastIndex, currentIndex);
            const endIndex = Math.max(lastIndex, currentIndex);
            
            // 既存の選択をクリアして範囲選択
            selectedLayerIds = [];
            for (let i = startIndex; i <= endIndex; i++) {
                if (!selectedLayerIds.includes(displayOrder[i])) {
                    selectedLayerIds.push(displayOrder[i]);
                }
            }
        }
    } else if (ctrlKey) {
        // Ctrl+クリック：トグル選択（追加/解除）
        const index = selectedLayerIds.indexOf(layerId);
        if (index > -1) {
            selectedLayerIds.splice(index, 1);
        } else {
            selectedLayerIds.push(layerId);
        }
        lastSelectedLayerId = layerId;
    } else {
        // 通常クリック：単一選択
        selectedLayerIds = [layerId];
        lastSelectedLayerId = layerId;
    }
    
    // レイヤー切り替え時に風揺れピン追加モードをオフにする
    if (typeof pinMode !== 'undefined' && pinMode) {
        pinMode = false;
        if (typeof updatePinModeUI === 'function') {
            updatePinModeUI();
        }
    }
    
    // レイヤー切り替え時にパペットモードをオフにする
    if (typeof puppetHandleMode !== 'undefined' && puppetHandleMode) {
        puppetHandleMode = false;
        canvas.style.cursor = 'default';
        if (typeof updatePuppetModeUI === 'function') {
            updatePuppetModeUI();
        }
    }
    if (typeof puppetIntermediatePinMode !== 'undefined' && puppetIntermediatePinMode) {
        puppetIntermediatePinMode = false;
        canvas.style.cursor = 'default';
        if (typeof updatePuppetModeUI === 'function') {
            updatePuppetModeUI();
        }
    }
    
    // 前のレイヤーのパペットアンカー要素をクリア
    if (typeof clearPuppetAnchorElements === 'function') {
        clearPuppetAnchorElements();
    }
    
    updateLayerList();
    updatePropertiesPanel();
    // render()は呼ばない - チカチカ防止
}

// レイヤーリストの表示順でIDを取得
function getDisplayOrderLayerIds() {
    const result = [];
    
    function addLayerAndChildren(layerId) {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;
        
        result.push(layerId);
        
        // 子レイヤーを追加
        const children = layers.filter(l => l.parentLayerId === layerId);
        children.forEach(child => addLayerAndChildren(child.id));
    }
    
    // ルートレイヤー（親がないもの）から開始
    const rootLayers = layers.filter(l => !l.parentLayerId);
    rootLayers.forEach(layer => addLayerAndChildren(layer.id));
    
    return result;
}

// ===== レイヤー表示切り替え =====
function toggleLayerVisibility(layerId, event) {
    event.stopPropagation();
    const layer = layers.find(l => l.id === layerId);
    if (layer) {
        layer.visible = !layer.visible;
        updateLayerList();
        render();
        
        // 風揺れピン表示を更新（現在選択中のレイヤーの場合）
        if (selectedLayerIds.includes(layerId)) {
            if (pinMode && layer.visible) {
                updatePinElements();
            } else {
                clearPinElements();
            }
        }
    }
}

// ===== レイヤー削除 =====
function deleteLayer(layerId, event) {
    const isTopLevel = event !== null;
    if (event) event.stopPropagation();
    
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    // フォルダの場合、子レイヤーも削除
    if (layer.type === 'folder') {
        const children = layers.filter(l => l.parentLayerId === layerId);
        children.forEach(child => {
            deleteLayer(child.id, null);
        });
    }
    
    // レイヤーを削除
    const index = layers.findIndex(l => l.id === layerId);
    if (index !== -1) {
        layers.splice(index, 1);
    }
    
    // 選択から削除
    const selectedIndex = selectedLayerIds.indexOf(layerId);
    if (selectedIndex > -1) {
        selectedLayerIds.splice(selectedIndex, 1);
    }
    
    updateLayerList();
    updatePropertiesPanel();
    render();
    
    // 最上位の削除操作の場合のみ履歴保存
    if (isTopLevel && typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== フォルダの開閉 =====
function toggleFolder(folderId, event) {
    event.stopPropagation();
    const folder = layers.find(l => l.id === folderId);
    if (folder && (folder.type === 'folder')) {
        folder.expanded = !folder.expanded;
        updateLayerList();
    }
}

// ===== フォルダ作成 =====
function createFolderFromSelection() {
    if (selectedLayerIds.length === 0) {
        alert('レイヤーを選択してください（Shift+クリックで範囲選択、Ctrl+クリックで追加選択）');
        return;
    }
    
    // 選択されたレイヤーを取得（親があるレイヤーも含む）
    const layersToMove = [];
    selectedLayerIds.forEach(layerId => {
        const layer = layers.find(l => l.id === layerId);
        if (layer) {
            layersToMove.push(layer);
        }
    });
    
    if (layersToMove.length === 0) {
        alert('レイヤーを選択してください');
        return;
    }
    
    // 選択されたレイヤーの共通の親を取得（新しいフォルダの親になる）
    const commonParent = layersToMove[0].parentLayerId;
    const allSameParent = layersToMove.every(l => l.parentLayerId === commonParent);
    
    // 共通の親がない場合、新しいフォルダは親なしになる
    const newFolderParent = allSameParent ? commonParent : null;
    
    // 選択されたレイヤーの中心位置を計算
    let sumX = 0, sumY = 0;
    layersToMove.forEach(layer => {
        sumX += layer.x || 0;
        sumY += layer.y || 0;
    });
    const centerX = sumX / layersToMove.length;
    const centerY = sumY / layersToMove.length;
    
    // フォルダ作成（選択レイヤーの中心に配置）
    const folder = {
        id: nextLayerId++,
        type: 'folder',
        name: '新規フォルダ',
        expanded: true,
        visible: true,
        parentLayerId: newFolderParent, // 共通の親を継承
        
        // トランスフォーム（選択レイヤーの中心に配置）
        x: centerX,
        y: centerY,
        rotation: 0,
        scale: 1,
        opacity: 1.0,
        anchorX: 0.5,
        anchorY: 0.5,
        // フォルダ専用アンカーオフセット（ピクセル単位）
        anchorOffsetX: 0,
        anchorOffsetY: 0,
        blendMode: 'source-over',
        
        // フォルダーにも風揺れ機能を追加
        windSwayEnabled: false,
        windSwayParams: getDefaultWindSwayParams(),
        
        // デフォルトキーフレーム（フレーム0に初期位置を設定）
        keyframes: [{
            frame: 0,
            x: centerX,
            y: centerY,
            rotation: 0,
            scale: 1,
            opacity: 1.0
        }]
    };
    
    layers.push(folder);
    
    // 各レイヤーをフォルダからの相対座標に変換
    layersToMove.forEach(layer => {
        // 現在の絶対座標を保存
        const worldX = layer.x || 0;
        const worldY = layer.y || 0;
        
        // フォルダからの相対座標に変換
        layer.x = worldX - centerX;
        layer.y = worldY - centerY;
        
        // キーフレームも相対座標に変換
        if (layer.keyframes && layer.keyframes.length > 0) {
            layer.keyframes.forEach(kf => {
                if (kf.x !== undefined) kf.x = kf.x - centerX;
                if (kf.y !== undefined) kf.y = kf.y - centerY;
            });
        }
        
        // フォルダを親に設定
        layer.parentLayerId = folder.id;
    });
    
    // ★ 配列順序を変更：選択したレイヤーをフォルダの直後に移動 ★
    // まず選択したレイヤーを配列から削除
    layersToMove.forEach(layer => {
        const index = layers.indexOf(layer);
        if (index > -1) {
            layers.splice(index, 1);
        }
    });
    
    // フォルダの直後に選択したレイヤーを挿入（元の順序を維持）
    const folderIndex = layers.indexOf(folder);
    layersToMove.forEach((layer, i) => {
        layers.splice(folderIndex + 1 + i, 0, layer);
    });
    
    // フォルダを選択
    selectedLayerIds = [folder.id];
    
    updateLayerList();
    updatePropertiesPanel();
    render();
    
    // 履歴を保存
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== 口パクレイヤー作成 =====
function createLipSyncLayer() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true; // フォルダ選択
    input.onchange = (e) => {
        const files = Array.from(e.target.files).filter(file => 
            file.type.startsWith('image/')
        );
        
        if (files.length < 2) {
            alert('口パクレイヤーには少なくとも2枚の画像が必要です\n（1枚目: 閉じた口、2枚目以降: 口パクアニメーション）');
            return;
        }
        
        loadSequenceImages(files, (images) => {
            const layer = {
                id: nextLayerId++,
                type: 'lipsync',
                name: '口パク',
                sequenceImages: images,
                keyframes: [], // {frame: number, type: 'start'/'end'}
                x: canvas.width / 2,
                y: canvas.height / 2,
                rotation: 0,
                scale: 1,
                opacity: 1.0,
                anchorX: 0.5,
                anchorY: 0.5,
                visible: true,
                blendMode: 'source-over',
                fps: 24, // ループ再生FPS
                
                // パペット機能
                parentLayerId: null,
                
                // 風揺れ機能（現在は非対応）
                windSwayEnabled: false,
                windSwayParams: getDefaultWindSwayParams(),
                
                // 色抜きクリッピング
                colorClipping: {
                    enabled: false,
                    referenceLayerId: null,
                    color: { r: 0, g: 255, b: 0 },
                    tolerance: 30,
                    invertClipping: false
                }
            };
            
            layers.push(layer);
            updateLayerList();
            selectLayer(layer.id, false);
            render();
            
            // 履歴を保存
            if (typeof saveHistory === 'function') {
                saveHistory();
            }
        });
    };
    input.click();
}

// ===== まばたきレイヤー作成 =====
function createBlinkLayer() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true; // フォルダ選択
    input.onchange = (e) => {
        const files = Array.from(e.target.files).filter(file => 
            file.type.startsWith('image/')
        );
        
        if (files.length < 2) {
            alert('まばたきレイヤーには少なくとも2枚の画像が必要です\n（1枚目: 開いた目、2枚目以降: まばたきアニメーション）');
            return;
        }
        
        loadSequenceImages(files, (images) => {
            const layer = {
                id: nextLayerId++,
                type: 'blink',
                name: 'まばたき',
                sequenceImages: images,
                keyframes: [], // {frame: number}
                x: canvas.width / 2,
                y: canvas.height / 2,
                rotation: 0,
                scale: 1,
                opacity: 1.0,
                anchorX: 0.5,
                anchorY: 0.5,
                visible: true,
                blendMode: 'source-over',
                fps: 24, // アニメーション再生FPS
                
                // パペット機能
                parentLayerId: null,
                
                // 風揺れ機能（現在は非対応）
                windSwayEnabled: false,
                windSwayParams: getDefaultWindSwayParams(),
                
                // 色抜きクリッピング
                colorClipping: {
                    enabled: false,
                    referenceLayerId: null,
                    color: { r: 0, g: 255, b: 0 },
                    tolerance: 30,
                    invertClipping: false
                }
            };
            
            layers.push(layer);
            updateLayerList();
            selectLayer(layer.id, false);
            render();
            
            // 履歴を保存
            if (typeof saveHistory === 'function') {
                saveHistory();
            }
        });
    };
    input.click();
}

// ===== 連番アニメレイヤー作成 =====
function createSequenceLayer() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true; // フォルダ選択
    input.onchange = (e) => {
        const files = Array.from(e.target.files).filter(file => 
            file.type.startsWith('image/')
        );
        
        if (files.length < 2) {
            alert('連番アニメレイヤーには少なくとも2枚の画像が必要です');
            return;
        }
        
        loadSequenceImages(files, (images) => {
            const layer = {
                id: nextLayerId++,
                type: 'sequence',
                name: '連番アニメ',
                sequenceImages: images,
                x: canvas.width / 2,
                y: canvas.height / 2,
                rotation: 0,
                scale: 1,
                opacity: 1.0,
                anchorX: 0.5,
                anchorY: 0.5,
                visible: true,
                blendMode: 'source-over',
                fps: 24, // ループ再生FPS
                frameSkip: 0, // コマ落とし（0=スキップなし）
                
                // パペット機能
                parentLayerId: null,
                
                // 風揺れ機能（現在は非対応）
                windSwayEnabled: false,
                windSwayParams: getDefaultWindSwayParams(),
                
                // 色抜きクリッピング
                colorClipping: {
                    enabled: false,
                    referenceLayerId: null,
                    color: { r: 0, g: 255, b: 0 },
                    tolerance: 30,
                    invertClipping: false
                }
            };
            
            layers.push(layer);
            updateLayerList();
            selectLayer(layer.id, false);
            render();
            
            // 履歴を保存
            if (typeof saveHistory === 'function') {
                saveHistory();
            }
        });
    };
    input.click();
}

// ===== 連番再読み込み（連番アニメ用） =====
function reloadSequenceSequence(layerId) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.type !== 'sequence') return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.onchange = (e) => {
        const files = Array.from(e.target.files).filter(file => 
            file.type.startsWith('image/')
        );
        
        if (files.length < 2) {
            alert('連番アニメには少なくとも2枚の画像が必要です');
            return;
        }
        
        loadSequenceImages(files, (images) => {
            layer.sequenceImages = images;
            updatePropertiesPanel();
            render();
            
            if (typeof saveHistory === 'function') {
                saveHistory();
            }
        });
    };
    input.click();
}

// ===== 断面図プリセット管理 =====
let crossSectionPresets = [];
let crossSectionManifestLoaded = false;

// 断面図マニフェスト読み込み
async function loadCrossSectionManifest() {
    if (crossSectionManifestLoaded) return crossSectionPresets;
    
    try {
        const response = await fetch('./png_anime/manifest.json');
        if (!response.ok) throw new Error('マニフェストファイルが見つかりません');
        
        const data = await response.json();
        crossSectionPresets = data.presets || [];
        crossSectionManifestLoaded = true;
        console.log('🔞 断面図プリセット読み込み完了:', crossSectionPresets.length, '件');
        return crossSectionPresets;
    } catch (error) {
        console.error('❌ 断面図マニフェスト読み込みエラー:', error);
        return [];
    }
}

// 断面図プリセット画像読み込み（パターン自動検出方式）
async function loadCrossSectionImages(presetId) {
    const presets = await loadCrossSectionManifest();
    const preset = presets.find(p => p.id === presetId);
    
    if (!preset) {
        console.error('❌ プリセットが見つかりません:', presetId);
        return [];
    }
    
    const images = [];
    const basePath = `./png_anime/${preset.folder}/`;
    const prefix = preset.prefix || 'frame_';
    const digits = preset.digits || 3;
    const extension = preset.extension || '.png';
    
    // 連番を0から順に読み込み、失敗したら終了
    let index = 0;
    let consecutiveErrors = 0;
    const maxErrors = 3; // 連続3回失敗で終了（欠番対応）
    
    while (consecutiveErrors < maxErrors) {
        const numStr = String(index).padStart(digits, '0');
        const filename = `${prefix}${numStr}${extension}`;
        
        try {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = basePath + filename;
            });
            images.push(img);
            consecutiveErrors = 0; // 成功したらリセット
        } catch (error) {
            consecutiveErrors++;
        }
        index++;
        
        // 安全のため上限を設定（999枚まで）
        if (index > 999) break;
    }
    
    console.log(`🔞 断面図画像読み込み完了: ${preset.name} (${images.length}枚)`);
    return images;
}

// ===== 断面図レイヤー作成 =====
async function createCrossSectionLayer() {
    // マニフェスト読み込み
    const presets = await loadCrossSectionManifest();
    
    if (presets.length === 0) {
        alert('断面図プリセットが見つかりません。\npng_anime/manifest.json を確認してください。');
        return;
    }
    
    // デフォルトは最初のプリセット
    const defaultPreset = presets[0];
    const images = await loadCrossSectionImages(defaultPreset.id);
    
    if (images.length === 0) {
        alert('断面図画像の読み込みに失敗しました。\n画像ファイルを確認してください。');
        return;
    }
    
    const layer = {
        id: nextLayerId++,
        type: 'crosssection',
        name: '断面図',
        sequenceImages: images,
        presetId: defaultPreset.id,
        x: canvas.width / 2,
        y: canvas.height / 2,
        rotation: 0,
        scale: 1,
        opacity: 1.0,
        anchorX: 0.5,
        anchorY: 0.5,
        visible: true,
        blendMode: 'source-over',
        fps: 24,
        frameSkip: 0,
        
        // パペット機能
        parentLayerId: null,
        
        // 風揺れ機能（非対応）
        windSwayEnabled: false,
        windSwayParams: getDefaultWindSwayParams(),
        
        // 色抜きクリッピング
        colorClipping: {
            enabled: false,
            referenceLayerId: null,
            color: { r: 0, g: 255, b: 0 },
            tolerance: 30,
            invertClipping: false
        }
    };
    
    layers.push(layer);
    updateLayerList();
    selectLayer(layer.id, false);
    render();
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== 断面図プリセット変更 =====
async function changeCrossSectionPreset(layerId, presetId) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || layer.type !== 'crosssection') return;
    
    const images = await loadCrossSectionImages(presetId);
    
    if (images.length === 0) {
        alert('画像の読み込みに失敗しました。');
        return;
    }
    
    layer.sequenceImages = images;
    layer.presetId = presetId;
    
    updatePropertiesPanel();
    render();
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== リネームダイアログ表示 =====
function showRenameDialog() {
    if (selectedLayerIds.length !== 1) {
        alert('リネームするレイヤーを1つ選択してください');
        return;
    }
    
    const layer = layers.find(l => l.id === selectedLayerIds[0]);
    if (!layer) return;
    
    const newName = prompt('新しい名前を入力してください:', layer.name);
    if (newName && newName.trim()) {
        layer.name = newName.trim();
        updateLayerList();
    }
}

// ===== ドラッグ&ドロップ処理 =====
function handleDragStart(e, layerId) {
    draggedLayerId = layerId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
    e.target.style.opacity = '0.4';
}

function handleDragOver(e, layerId) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    dragOverLayerId = layerId;
    
    // ドロップ位置の視覚的フィードバック
    const targetElement = e.currentTarget;
    const targetLayer = layers.find(l => l.id === layerId);
    
    if (draggedLayerId !== layerId) {
        // ターゲットがフォルダまたはジャンプフォルダーの場合は特別なハイライト
        if (targetLayer && (targetLayer.type === 'folder')) {
            targetElement.style.borderTop = '';
            targetElement.style.background = 'rgba(218, 165, 32, 0.3)';
            targetElement.style.outline = '2px solid var(--accent-gold)';
        } else {
            targetElement.style.borderTop = '2px solid var(--accent-gold)';
            targetElement.style.background = '';
            targetElement.style.outline = '';
        }
    }
    
    return false;
}

function handleDragLeave(e) {
    e.currentTarget.style.borderTop = '';
    e.currentTarget.style.background = '';
    e.currentTarget.style.outline = '';
}

function handleDrop(e, targetLayerId) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.currentTarget.style.borderTop = '';
    e.currentTarget.style.background = '';
    e.currentTarget.style.outline = '';
    
    if (draggedLayerId === targetLayerId) return false;
    
    const draggedLayer = layers.find(l => l.id === draggedLayerId);
    const targetLayer = layers.find(l => l.id === targetLayerId);
    
    if (!draggedLayer || !targetLayer) return false;
    
    // ターゲットがフォルダまたはジャンプフォルダーの場合：フォルダ内に追加
    if (targetLayer.type === 'folder') {
        // 循環参照チェック（ドラッグしたレイヤーがフォルダの場合）
        if (draggedLayer.type === 'folder') {
            // ターゲットフォルダがドラッグしたフォルダの子孫でないかチェック
            let checkParent = targetLayer;
            while (checkParent) {
                if (checkParent.parentLayerId === draggedLayerId) {
                    alert('循環参照になるため、この操作はできません');
                    return false;
                }
                checkParent = layers.find(l => l.id === checkParent.parentLayerId);
            }
        }
        
        // ドラッグしたレイヤーに親が設定されていない場合のみ親を設定
        // （既に親がある場合は順序変更のみ）
        if (!draggedLayer.parentLayerId) {
            // フォルダからの相対座標に変換
            const dx = draggedLayer.x - targetLayer.x;
            const dy = draggedLayer.y - targetLayer.y;
            draggedLayer.x = dx;
            draggedLayer.y = dy;
            
            // キーフレームの座標も相対座標に変換
            if (draggedLayer.keyframes && draggedLayer.keyframes.length > 0) {
                draggedLayer.keyframes.forEach(kf => {
                    if (kf.x !== undefined) kf.x = kf.x - targetLayer.x;
                    if (kf.y !== undefined) kf.y = kf.y - targetLayer.y;
                });
                console.log(`📐 キーフレーム座標を相対座標に変換しました`);
            }
            
            // 親をフォルダに設定
            draggedLayer.parentLayerId = targetLayerId;
            
            console.log(`📁 レイヤー "${draggedLayer.name}" をフォルダ "${targetLayer.name}" に追加しました`);
        }
        
        // 配列内の位置を調整（フォルダの直後に移動）
        const draggedIndex = layers.indexOf(draggedLayer);
        layers.splice(draggedIndex, 1);
        
        const targetIndex = layers.indexOf(targetLayer);
        layers.splice(targetIndex + 1, 0, draggedLayer);
    } else {
        // 通常のレイヤー順序変更
        const draggedIndex = layers.indexOf(draggedLayer);
        layers.splice(draggedIndex, 1);
        
        const targetIndex = layers.indexOf(targetLayer);
        layers.splice(targetIndex, 0, draggedLayer);
    }
    
    updateLayerList();
    render();
    
    // 履歴を保存
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
    
    return false;
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    
    // すべてのスタイルをクリア
    const items = document.querySelectorAll('.layer-item');
    items.forEach(item => {
        item.style.borderTop = '';
        item.style.background = '';
        item.style.outline = '';
    });
    
    draggedLayerId = null;
    dragOverLayerId = null;
}

// ===== 揺れモーションレイヤー作成 =====
function createBounceLayer() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const layer = {
                    id: nextLayerId++,
                    type: 'bounce',
                    name: '弾みレイヤー',
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
                    
                    // パペット機能
                    parentLayerId: null,
                    
                    // 揺れモーション機能
                    bounceParams: getDefaultBounceParams(),
                    
                    // 風揺れ機能は無効
                    windSwayEnabled: false,
                    windSwayParams: getDefaultWindSwayParams(),
                    
                    // デフォルトキーフレーム
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
                
                // 初期キーフレームを適用
                if (typeof applyKeyframeInterpolation === 'function') {
                    applyKeyframeInterpolation();
                }
                
                render();
                
                // 履歴を保存
                if (typeof saveHistory === 'function') {
                    saveHistory();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ===== レイヤーを上に移動（表示順で前面に） =====
function moveLayerUp(layerId, event) {
    console.log('⬆️ moveLayerUp呼び出し layerId:', layerId);
    if (event) event.stopPropagation();
    
    const layer = layers.find(l => l.id === layerId);
    if (!layer) {
        console.log('⬆️ レイヤーが見つかりません');
        return;
    }
    console.log('⬆️ 対象レイヤー:', layer.name, 'type:', layer.type);
    
    // 同じ親を持つレイヤー内での順序を変更（フィルターを考慮）
    const allSiblings = layers.filter(l => l.parentLayerId === layer.parentLayerId);
    // フィルターがある場合は表示されているレイヤーのみを対象に
    const siblings = layerFilterType || layerFilterText 
        ? allSiblings.filter(l => layerMatchesFilter(l))
        : allSiblings;
    const currentIndex = siblings.indexOf(layer);
    console.log('⬆️ 兄弟数:', siblings.length, '現在インデックス:', currentIndex, 'フィルター:', layerFilterType || 'なし');
    
    // 既に兄弟内で最上位の場合
    if (currentIndex >= siblings.length - 1) {
        // 親がある場合は親の上に移動（親と同じ階層に）
        if (layer.parentLayerId) {
            const parent = layers.find(l => l.id === layer.parentLayerId);
            if (parent) {
                // 位置補正: 見た目の位置が変わらないように調整（静的座標を使用）
                if (typeof getStaticParentTransform === 'function') {
                    const oldTransform = getStaticParentTransform(layer.parentLayerId);
                    const oldWorldX = layer.x + oldTransform.x;
                    const oldWorldY = layer.y + oldTransform.y;
                    const newTransform = getStaticParentTransform(parent.parentLayerId);
                    layer.x = oldWorldX - newTransform.x;
                    layer.y = oldWorldY - newTransform.y;
                }
                
                // 親の親を自分の親にする（親の外に出る）
                layer.parentLayerId = parent.parentLayerId;
                
                // 配列内で親の直後に移動
                const layerGlobalIndex = layers.indexOf(layer);
                const parentGlobalIndex = layers.indexOf(parent);
                layers.splice(layerGlobalIndex, 1);
                layers.splice(parentGlobalIndex + 1, 0, layer);
            }
        }
    } else {
        // 上のレイヤー（表示順で次）を取得
        const targetLayer = siblings[currentIndex + 1];
        
        if (targetLayer.type === 'folder') {
            // 位置補正: 見た目の位置が変わらないように調整（静的座標を使用）
            if (typeof getStaticParentTransform === 'function') {
                const oldTransform = getStaticParentTransform(layer.parentLayerId);
                const oldWorldX = layer.x + oldTransform.x;
                const oldWorldY = layer.y + oldTransform.y;
                const newTransform = getStaticParentTransform(targetLayer.id);
                layer.x = oldWorldX - newTransform.x;
                layer.y = oldWorldY - newTransform.y;
            }
            
            // フォルダの中に入る
            layer.parentLayerId = targetLayer.id;
            
            // 配列内での位置を調整（フォルダの子の最後尾 = 最前面に配置）
            const layerGlobalIndex = layers.indexOf(layer);
            layers.splice(layerGlobalIndex, 1);
            
            // フォルダの子レイヤーを全て取得して、その最後の子の次に配置
            const folderChildren = layers.filter(l => l.parentLayerId === targetLayer.id);
            if (folderChildren.length > 0) {
                const lastChild = folderChildren[folderChildren.length - 1];
                const lastChildIndex = layers.indexOf(lastChild);
                layers.splice(lastChildIndex + 1, 0, layer);
            } else {
                // 子がない場合はフォルダの直後
                const targetGlobalIndex = layers.indexOf(targetLayer);
                layers.splice(targetGlobalIndex + 1, 0, layer);
            }
        } else {
            // 通常の入れ替え（実際のlayers配列での位置で入れ替え）
            const globalIndex = layers.indexOf(layer);
            const targetGlobalIndex = layers.indexOf(targetLayer);
            
            layers.splice(globalIndex, 1);
            layers.splice(targetGlobalIndex, 0, layer);
        }
    }
    
    updateLayerList();
    render();
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== レイヤーを下に移動（表示順で背面に） =====
function moveLayerDown(layerId, event) {
    console.log('⬇️ moveLayerDown呼び出し layerId:', layerId);
    if (event) event.stopPropagation();
    
    const layer = layers.find(l => l.id === layerId);
    if (!layer) {
        console.log('⬇️ レイヤーが見つかりません');
        return;
    }
    console.log('⬇️ 対象レイヤー:', layer.name, 'type:', layer.type);
    
    // 同じ親を持つレイヤー内での順序を変更（フィルターを考慮）
    const allSiblings = layers.filter(l => l.parentLayerId === layer.parentLayerId);
    // フィルターがある場合は表示されているレイヤーのみを対象に
    const siblings = layerFilterType || layerFilterText 
        ? allSiblings.filter(l => layerMatchesFilter(l))
        : allSiblings;
    const currentIndex = siblings.indexOf(layer);
    console.log('⬇️ 兄弟数:', siblings.length, '現在インデックス:', currentIndex, 'フィルター:', layerFilterType || 'なし');
    
    // 既に兄弟内で最下位の場合
    if (currentIndex <= 0) {
        // 親がある場合は親の下に移動（親と同じ階層に）
        if (layer.parentLayerId) {
            const parent = layers.find(l => l.id === layer.parentLayerId);
            if (parent) {
                // 位置補正: 見た目の位置が変わらないように調整（静的座標を使用）
                if (typeof getStaticParentTransform === 'function') {
                    const oldTransform = getStaticParentTransform(layer.parentLayerId);
                    const oldWorldX = layer.x + oldTransform.x;
                    const oldWorldY = layer.y + oldTransform.y;
                    const newTransform = getStaticParentTransform(parent.parentLayerId);
                    layer.x = oldWorldX - newTransform.x;
                    layer.y = oldWorldY - newTransform.y;
                }
                
                // 親の親を自分の親にする（親の外に出る）
                layer.parentLayerId = parent.parentLayerId;
                
                // 配列内で親の直前に移動
                const layerGlobalIndex = layers.indexOf(layer);
                const parentGlobalIndex = layers.indexOf(parent);
                layers.splice(layerGlobalIndex, 1);
                // 削除後のインデックスを調整
                const adjustedParentIndex = layerGlobalIndex < parentGlobalIndex ? parentGlobalIndex - 1 : parentGlobalIndex;
                layers.splice(adjustedParentIndex, 0, layer);
            }
        }
    } else {
        // 下のレイヤー（表示順で前）を取得
        const targetLayer = siblings[currentIndex - 1];
        
        if (targetLayer.type === 'folder') {
            // 位置補正: 見た目の位置が変わらないように調整（静的座標を使用）
            if (typeof getStaticParentTransform === 'function') {
                const oldTransform = getStaticParentTransform(layer.parentLayerId);
                const oldWorldX = layer.x + oldTransform.x;
                const oldWorldY = layer.y + oldTransform.y;
                const newTransform = getStaticParentTransform(targetLayer.id);
                layer.x = oldWorldX - newTransform.x;
                layer.y = oldWorldY - newTransform.y;
            }
            
            // フォルダの中に入る
            layer.parentLayerId = targetLayer.id;
            
            // 配列内での位置を調整（フォルダの子の先頭 = 最背面に配置）
            const layerGlobalIndex = layers.indexOf(layer);
            layers.splice(layerGlobalIndex, 1);
            
            // フォルダの直後に配置（子の先頭 = 最背面）
            const targetGlobalIndex = layers.indexOf(targetLayer);
            layers.splice(targetGlobalIndex + 1, 0, layer);
        } else {
            // 通常の入れ替え（実際のlayers配列での位置で入れ替え）
            const globalIndex = layers.indexOf(layer);
            const targetGlobalIndex = layers.indexOf(targetLayer);
            
            layers.splice(globalIndex, 1);
            layers.splice(targetGlobalIndex, 0, layer);
        }
    }
    
    updateLayerList();
    render();
    
    if (typeof saveHistory === 'function') {
        saveHistory();
    }
}

// ===== ジャンプパラメータのデフォルト値 =====
function getDefaultJumpParams() {
    return {
        amplitude: 50,      // ジャンプの高さ（ピクセル）
        frequency: 3,       // 揺れる回数
        dampingTime: 1.0,   // 減衰時間（秒）
        loop: false,        // ループ再生
        loopPeriod: 1.0,    // ループ周期（秒）
        keyframes: []       // アニメーションキーフレーム { frame: number }
    };
}

// ===== ボーンレイヤー作成 =====
function createBoneLayer() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const layer = {
                    id: nextLayerId++,
                    type: 'bone',
                    name: 'ボーンレイヤー',
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
                    
                    // 親子関係
                    parentLayerId: null,
                    
                    // ボーン機能
                    boneParams: typeof getDefaultBoneParams === 'function' ? getDefaultBoneParams() : {
                        bones: [],
                        divisions: 30,
                        influenceRadius: 0.3,
                        boneKeyframes: []
                    },
                    
                    // 風揺れ機能（デフォルト無効）
                    windSwayEnabled: false,
                    windSwayParams: typeof getDefaultWindSwayParams === 'function' ? getDefaultWindSwayParams() : {
                        divisions: 30,
                        angle: 0,
                        period: 3,
                        phaseShift: 0.3,
                        center: 0.5,
                        topFixed: 0,
                        bottomFixed: 0.3,
                        randomPattern: 0,
                        seed: 0,
                        fromBottom: false,
                        randomSwing: false,
                        loop: false,
                        frequency: 1,
                        dampingTime: null
                    },
                    
                    // Wiggle機能（デフォルト無効）
                    wiggleEnabled: false,
                    wiggleParams: typeof getDefaultWiggleParams === 'function' ? getDefaultWiggleParams() : {
                        amplitude: 5,
                        frequency: 3,
                        seed: 0
                    },
                    
                    // デフォルトキーフレーム
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
                
                // 初期キーフレームを適用
                if (typeof applyKeyframeInterpolation === 'function') {
                    applyKeyframeInterpolation();
                }
                
                render();
                
                // 履歴を保存
                if (typeof saveHistory === 'function') {
                    saveHistory();
                }
                
                console.log('🦴 ボーンレイヤーを作成しました:', layer.name);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}
