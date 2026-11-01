import { useState } from 'react';
import { askGemini, resizeImageForAi } from '../lib/geminiClient';

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
            // 1. Fetch the image and shrink it
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const image = await resizeImageForAi(blob);

            // 2. Generate content (retry is handled by the backend)
            const text = await askGemini('describe', [image]);

            // 3. Parse JSON
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
            if (err.code === 'functions/unauthenticated') {
                setError("登入狀態已過期，請重新登入後再試");
            } else if (err.code === 'functions/resource-exhausted') {
                setError(err.message);
            } else if (err.code === 'functions/unavailable') {
                setError("AI 伺服器目前負載過高，已自動重試但仍失敗，請稍候再試");
            } else {
                setError("AI 分析失敗，請稍後再試");
            }
        } finally {
            setLoading(false);
        }
    };

    return { generateDescription, loading, error, description, tags };
};
