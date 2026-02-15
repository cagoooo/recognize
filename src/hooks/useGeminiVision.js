import { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const useGeminiVision = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [description, setDescription] = useState(null);

    const generateDescription = async (imageUrl) => {
        setLoading(true);
        setError(null);
        setDescription(null);

        // Check cache first
        const cacheKey = `gemini_desc_${imageUrl}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            setDescription(cached);
            setLoading(false);
            return cached;
        }

        try {
            // 1. Fetch the image and convert to base64
            // Note: This requires the image serve to support CORS or be a local file/blob
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
            const prompt = "請用繁體中文描述這位學生的外觀特徵（例如：戴眼鏡、長髮、笑臉），作為老師記憶學生的口訣。請用條列式，重點描述 3 個最明顯的特徵，總字數 50 字以內，語氣生動活潑。";

            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: blob.type || "image/jpeg",
                },
            };

            // 3. Generate content
            const result = await model.generateContent([prompt, imagePart]);
            const text = result.response.text();

            // Save to cache
            localStorage.setItem(cacheKey, text);

            setDescription(text);
            return text;

        } catch (err) {
            console.error("Gemini Vision Error:", err);
            // Handle missing API key specifically
            if (err.message?.includes("API key not valid")) {
                setError("API Key 無效或未設定，請檢查 .env 檔案");
            } else {
                setError("AI 分析失敗，請稍後再試");
            }
        } finally {
            setLoading(false);
        }
    };

    return { generateDescription, loading, error, description };
};
