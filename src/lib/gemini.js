import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const CACHE_KEY_PREFIX = 'gemini_memory_anchor_';

/**
 * 根據學生照片 URL 生成記憶錨點
 * @param {string} photoUrl 學生照片的 URL
 * @returns {Promise<string>} AI 生成的記憶提示
 */
export const generateMemoryAnchor = async (photoUrl) => {
    if (!API_KEY) {
        console.warn("Gemini API Key 尚未設定，將跳過 AI 記憶輔助功能。");
        return null;
    }

    // 1. 檢查快取
    const cacheKey = CACHE_KEY_PREFIX + photoUrl;
    const cachedResult = localStorage.getItem(cacheKey);
    if (cachedResult) {
        // console.log("使用快取記憶口訣:", cachedResult);
        return cachedResult;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 取得圖片資料
        const response = await fetch(photoUrl);
        const blob = await response.blob();

        const imageData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });

        const prompt = `
      角色設定：你是一位資深的特教觀察專家，擅長用「正向、具體、好記」的特徵來幫助老師記住學生。
      任務：請觀察這張學生照片，產出一句「超級簡短」的記憶口訣（15 字以內）。
      
      要求：
      1. 聚焦於：髮型、眼鏡、笑容、臉型或顯眼配件。
      2. 風格：溫暖、生動、稍微帶點幽默感。
      3. 格式：直接給出口訣，不要有任何前言後語。
      
      範例：
      - 「招牌瞇瞇眼，笑起來像暖陽。」
      - 「黑框眼鏡小博士，眼神超專注。」
      - 「綁著高馬尾，活力滿滿的運動員。」
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageData,
                    mimeType: blob.type
                }
            }
        ]);

        const text = result.response.text().trim();

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
