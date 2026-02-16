import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const useGeminiVision = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [description, setDescription] = useState(null);
    const [tags, setTags] = useState([]);

    const generateDescription = async (imageUrl) => {
        setLoading(true);
        setError(null);
        setDescription(null);
        setTags([]);

        // Check cache first
        const cacheKey = `gemini_desc_v2_${imageUrl}`; // Version 2 for JSON structure
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setDescription(parsed.description);
                setTags(parsed.tags || []);
                setLoading(false);
                return parsed;
            } catch (e) {
                // If cache is old format (string), ignore and re-generate or handle legacy
                localStorage.removeItem(cacheKey);
            }
        }

        try {
            // 1. Fetch the image and convert to base64
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
            });

            // 2. Prepare the model and prompt
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `
                請扮演一位資深的特教觀察專家。請觀察這張照片，並回傳一個 JSON 物件，包含以下兩個欄位：
                1. "description": 用繁體中文描述這位學生的外觀特徵（例如：戴眼鏡、長髮、笑臉），作為老師記憶學生的口訣。請用條列式，重點描述 3 個最明顯的特徵，總字數 50 字以內，語氣生動活潑。
                2. "tags": 根據外觀特徵提取 3-5 個關鍵字標籤（Tag），例如 ["眼鏡", "長髮", "笑容", "藍色衣服"]。

                請務必只回傳純 JSON 格式，不要有 Markdown 標記 (如 \`\`\`json)。
            `;

            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: blob.type || "image/jpeg",
                },
            };

            // 3. Generate content
            const result = await model.generateContent([prompt, imagePart]);
            const text = result.response.text();

            // 4. Parse JSON
            let parsedResult;
            try {
                // Clean input for simple JSON parsing
                const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                parsedResult = JSON.parse(cleanedText);
            } catch (e) {
                console.warn("Gemini returned non-JSON:", text);
                // Fallback for non-JSON response
                parsedResult = { description: text, tags: [] };
            }

            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify(parsedResult));

            setDescription(parsedResult.description);
            setTags(parsedResult.tags || []);
            return parsedResult;

        } catch (err) {
            console.error("Gemini Vision Error:", err);
            if (err.message?.includes("API key not valid")) {
                setError("API Key 無效或未設定，請檢查 .env 檔案");
            } else {
                setError("AI 分析失敗，請稍後再試");
            }
        } finally {
            setLoading(false);
        }
    };

    return { generateDescription, loading, error, description, tags };
};
