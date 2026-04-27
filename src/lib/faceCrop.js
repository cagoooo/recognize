/**
 * faceCrop.js — 自動人臉對齊與智慧裁切
 *
 * 流程：
 *   1. 用 MediaPipe Face Detector 偵測 bounding box
 *   2. 以「頭頂留 15% padding、肩膀向下延伸」邏輯換算 1:1 方形裁切框
 *   3. Canvas 輸出 JPEG Blob（800px 邊長，與 imageUtils 一致）
 *   4. 失敗 fallback：回傳 success=false，由呼叫端決定是否走中央裁切
 *
 * 注意：
 *   - MediaPipe model 約 230KB，首次呼叫會從 CDN 下載並快取
 *   - 偵測在 WebAssembly 端執行，不阻塞 UI
 *   - module-level singleton 避免重複初始化
 */

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.task';
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';

const OUTPUT_SIZE = 800;
const TOP_PADDING_RATIO = 0.5;
const BOTTOM_EXTEND_RATIO = 1.4;
const SIDE_PADDING_RATIO = 0.35;
const JPEG_QUALITY = 0.85;

let detectorPromise = null;

async function getDetector() {
    if (detectorPromise) return detectorPromise;

    detectorPromise = (async () => {
        const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        return FaceDetector.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL },
            runningMode: 'IMAGE',
            minDetectionConfidence: 0.5,
        });
    })().catch((err) => {
        // 下次重試
        detectorPromise = null;
        throw err;
    });

    return detectorPromise;
}

function blobToImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image decode failed'));
        };
        img.src = url;
    });
}

function pickPrimaryFace(detections, imgW, imgH) {
    if (!detections?.length) return null;
    // 取面積最大且偏中央者（畢業照常見：主體最大、背景人臉小且邊緣）
    const cx = imgW / 2;
    const cy = imgH / 2;
    return detections
        .map((d) => {
            const { originX, originY, width, height } = d.boundingBox;
            const fx = originX + width / 2;
            const fy = originY + height / 2;
            const dist = Math.hypot(fx - cx, fy - cy) / Math.hypot(cx, cy);
            const areaRatio = (width * height) / (imgW * imgH);
            return { box: d.boundingBox, score: areaRatio - dist * 0.3 };
        })
        .sort((a, b) => b.score - a.score)[0].box;
}

function computeCropRect(box, imgW, imgH) {
    const { originX, originY, width: faceW, height: faceH } = box;

    const cx = originX + faceW / 2;
    const topPad = faceH * TOP_PADDING_RATIO;
    const bottomPad = faceH * BOTTOM_EXTEND_RATIO;
    const sidePad = faceW * SIDE_PADDING_RATIO;

    let top = originY - topPad;
    let bottom = originY + faceH + bottomPad;
    let left = cx - faceW / 2 - sidePad;
    let right = cx + faceW / 2 + sidePad;

    // 換成方形（取較長邊）
    const targetSide = Math.max(right - left, bottom - top);
    const cropCx = (left + right) / 2;
    const cropCy = (top + bottom) / 2;

    let sx = cropCx - targetSide / 2;
    let sy = cropCy - targetSide / 2;
    let side = targetSide;

    // 邊界鉗制
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx + side > imgW) side = imgW - sx;
    if (sy + side > imgH) side = imgH - sy;
    side = Math.min(side, imgW, imgH);

    return { sx, sy, side };
}

function renderToBlob(img, sx, sy, side) {
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
            'image/jpeg',
            JPEG_QUALITY,
        );
    });
}

/**
 * 中央方形 fallback（偵測失敗時用）
 */
async function centerCropFallback(blob) {
    const img = await blobToImage(blob);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    return renderToBlob(img, sx, sy, side);
}

/**
 * 主入口：對 Blob 做人臉偵測 + 智慧裁切
 *
 * @param {Blob} blob - 來源圖片（建議先過 compressImage）
 * @returns {Promise<{
 *   blob: Blob,
 *   success: boolean,    // true = 偵測到人臉並裁切；false = 偵測失敗（已用中央裁切兜底）
 *   reason?: string,     // 失敗原因（debug 用）
 * }>}
 */
export async function smartCropFace(blob) {
    try {
        const detector = await getDetector();
        const img = await blobToImage(blob);

        // MediaPipe 接受 ImageBitmap / HTMLImageElement
        const result = detector.detect(img);
        const primary = pickPrimaryFace(result.detections, img.naturalWidth, img.naturalHeight);

        if (!primary) {
            const fallback = await centerCropFallback(blob);
            return { blob: fallback, success: false, reason: 'no-face-detected' };
        }

        const { sx, sy, side } = computeCropRect(primary, img.naturalWidth, img.naturalHeight);
        const cropped = await renderToBlob(img, sx, sy, side);
        return { blob: cropped, success: true };
    } catch (err) {
        console.warn('Face detection failed, falling back to center crop:', err);
        try {
            const fallback = await centerCropFallback(blob);
            return { blob: fallback, success: false, reason: err.message || 'detector-error' };
        } catch {
            // 連 fallback 都失敗 → 回傳原圖
            return { blob, success: false, reason: 'fallback-failed' };
        }
    }
}

/**
 * File 版便利封裝（搭配 compressImage 後使用）
 * @param {File} file
 * @returns {Promise<{ file: File, success: boolean, reason?: string }>}
 */
export async function smartCropFile(file) {
    const result = await smartCropFace(file);
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newFile = new File([result.blob], `${baseName}_cropped.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
    });
    return { file: newFile, success: result.success, reason: result.reason };
}
