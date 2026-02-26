/**
 * imageUtils.js
 * 圖片壓縮 & EXIF 旋轉修正工具
 *
 * 策略：
 * - 最大長邊：800px（學生卡片 / 遊戲模式使用場景）
 * - 輸出格式：JPEG，品質 0.82
 * - 自動修正手機拍攝的 EXIF Orientation（直式照片不再歪斜）
 *
 * 使用方式：
 *   const blob = await compressImage(file);
 *   // 取得壓縮後的 Blob，再傳給 Firebase Storage 上傳
 */

const MAX_LONG_SIDE = 800;  // px
const JPEG_QUALITY = 0.82;

/**
 * 從 ArrayBuffer 讀取 JPEG EXIF 中的 Orientation 值
 * 返回 1~8，若無 EXIF 則返回 1（無旋轉）
 */
function getExifOrientation(buffer) {
    const view = new DataView(buffer);

    // 確認是 JPEG (FF D8)
    if (view.getUint16(0) !== 0xFFD8) return 1;

    let offset = 2;
    const length = buffer.byteLength;

    while (offset < length) {
        if (view.getUint16(offset) === 0xFFE1) {
            // APP1 marker
            const exifLength = view.getUint16(offset + 2);
            const exifOffset = offset + 4;

            // 確認 Exif Header
            if (view.getUint32(exifOffset) !== 0x45786966 ||
                view.getUint16(exifOffset + 4) !== 0x0000) {
                return 1;
            }

            const tiffOffset = exifOffset + 6;
            let littleEndian = false;
            const byteOrder = view.getUint16(tiffOffset);
            if (byteOrder === 0x4949) {
                littleEndian = true;
            } else if (byteOrder !== 0x4D4D) {
                return 1;
            }

            const ifdOffset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
            const ifdCount = view.getUint16(ifdOffset, littleEndian);

            for (let i = 0; i < ifdCount; i++) {
                const entryOffset = ifdOffset + 2 + i * 12;
                const tag = view.getUint16(entryOffset, littleEndian);
                if (tag === 0x0112) {
                    // Orientation tag
                    return view.getUint16(entryOffset + 8, littleEndian);
                }
            }
            break;
        } else if ((view.getUint16(offset) & 0xFF00) !== 0xFF00) {
            break;
        } else {
            offset += 2 + view.getUint16(offset + 2);
        }
    }
    return 1;
}

/**
 * 依 EXIF Orientation 數值，在 Canvas 上套用對應的旋轉/翻轉變換
 */
function applyOrientationToCanvas(ctx, orientation, width, height) {
    switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, height, width); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
        default: break; // orientation 1: 不需要變換
    }
}

/**
 * 壓縮並修正 EXIF 旋轉的主函數
 * @param {File} file - 原始圖片 File 物件
 * @param {Object} options
 * @param {number} options.maxLongSide - 最大長邊 px（預設 800）
 * @param {number} options.quality - JPEG 品質 0~1（預設 0.82）
 * @returns {Promise<File>} - 壓縮後的 File 物件（與原始 file 同名，type: image/jpeg）
 */
export async function compressImage(file, {
    maxLongSide = MAX_LONG_SIDE,
    quality = JPEG_QUALITY,
} = {}) {
    // 非圖片或 GIF/WebP 動圖直接略過（不壓縮）
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.onload = (evt) => {
            const buffer = evt.target.result;

            // 讀取 EXIF 旋轉資訊（僅 JPEG）
            let orientation = 1;
            if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                try { orientation = getExifOrientation(buffer); } catch (_) { }
            }

            const img = new Image();
            img.onerror = () => reject(new Error('Image load error'));
            img.onload = () => {
                const originalW = img.naturalWidth;
                const originalH = img.naturalHeight;

                // 依 orientation 判斷實際寬高（旋轉 90/270 度時寬高互換）
                const isRotated90or270 = [5, 6, 7, 8].includes(orientation);
                const logicalW = isRotated90or270 ? originalH : originalW;
                const logicalH = isRotated90or270 ? originalW : originalH;

                // 計算縮放比例（最大長邊限制）
                const longSide = Math.max(logicalW, logicalH);
                const scale = longSide > maxLongSide ? maxLongSide / longSide : 1;
                const outW = Math.round(logicalW * scale);
                const outH = Math.round(logicalH * scale);

                const canvas = document.createElement('canvas');
                canvas.width = outW;
                canvas.height = outH;
                const ctx = canvas.getContext('2d');

                // 套用 EXIF 旋轉修正
                ctx.save();
                if (isRotated90or270) {
                    // 旋轉後寬高已互換，需重設 Canvas 尺寸
                    canvas.width = outW;
                    canvas.height = outH;
                }
                // 縮放
                const drawW = isRotated90or270 ? originalW * scale : originalW * scale;
                const drawH = isRotated90or270 ? originalH * scale : originalH * scale;

                // 移動到中心再旋轉
                ctx.translate(outW / 2, outH / 2);
                applyOrientationToCanvas(ctx, orientation,
                    drawW, drawH
                );
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();

                canvas.toBlob((blob) => {
                    if (!blob) return reject(new Error('Canvas toBlob failed'));
                    // 保留原始檔名，強制輸出 JPEG
                    const baseName = file.name.replace(/\.[^.]+$/, '');
                    const compressed = new File([blob], `${baseName}.jpg`, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(compressed);
                }, 'image/jpeg', quality);
            };
            // 用 blob URL 載入圖片（比 base64 快）
            img.src = URL.createObjectURL(new Blob([buffer], { type: file.type }));
        };
        reader.readAsArrayBuffer(file);
    });
}
