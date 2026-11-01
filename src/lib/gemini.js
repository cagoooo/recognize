import { askGemini, resizeImageForAi } from './geminiClient';

const CACHE_KEY_PREFIX = 'gemini_memory_anchor_';

/**
 * 根據學生照片 URL 生成記憶錨點
 * @param {string} photoUrl 學生照片的 URL
 * @param {string} existingHint 已有的口訣 (可選，若有則跳過 AI)
 * @returns {Promise<string>} AI 生成的記憶提示
 */
export const generateMemoryAnchor = async (photoUrl, existingHint = null) => {
    if (existingHint) return existingHint;

    // 1. 檢查快取
    const cacheKey = CACHE_KEY_PREFIX + photoUrl;
    const cachedResult = localStorage.getItem(cacheKey);
    if (cachedResult) {
        // console.log("使用快取記憶口訣:", cachedResult);
        return cachedResult;
    }

    try {
        // 取得圖片資料並縮放
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        const image = await resizeImageForAi(blob);

        const text = await askGemini('memoryAnchor', [image]);

        // 2. 寫入快取 (成功才寫入)
        if (text) {
            localStorage.setItem(cacheKey, text);
        }

        return text;
    } catch (error) {
        console.error("Gemini AI 分析失敗:", error);
        return "AI 正在觀察中，請稍候再試...";
    }
};
