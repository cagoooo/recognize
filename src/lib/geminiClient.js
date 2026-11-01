import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const callGemini = httpsCallable(functions, 'recognizeCallGemini', { timeout: 60000 });

/**
 * 請後端呼叫 Gemini（金鑰、提示詞與模型都只留在後端）
 * @param {'memoryAnchor'|'describe'|'compare'} task AI 任務
 * @param {Array<{data: string, mimeType: string}>} images base64 照片
 * @returns {Promise<string>} Gemini 回傳的文字
 */
export const askGemini = async (task, images) => {
    const { data } = await callGemini({ task, images });
    return data.text;
};

/**
 * 將圖片縮放至指定寬度以節省 Token
 * @param {Blob} blob 圖片 Blob
 * @param {number} maxWidth 最大寬度
 * @returns {Promise<{data: string, mimeType: string}>}
 */
export const resizeImageForAi = async (blob, maxWidth = 512) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // 瀏覽器不支援 blob.type 時會改輸出 PNG，所以格式以實際結果為準
            const dataUrl = canvas.toDataURL(blob.type, 0.7);
            URL.revokeObjectURL(url);
            resolve({
                data: dataUrl.split(',')[1],
                mimeType: dataUrl.slice(5, dataUrl.indexOf(';'))
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('照片讀取失敗'));
        };
        img.src = url;
    });
};
