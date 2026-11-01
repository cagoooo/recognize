/**
 * tasks.js — 識生學坊的 AI 任務定義
 *
 * 提示詞與模型都放在後端：前端只能指定「要做哪一項」並附上照片，
 * 不能傳任意提示詞或模型，所以這支 Function 不會變成萬用的 Gemini 入口。
 */

export const GEMINI_MODEL = 'gemini-2.5-flash-lite';

const MEMORY_ANCHOR_PROMPT = `
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

const DESCRIBE_PROMPT = `
                請扮演一位資深的特教觀察專家。請觀察這張照片，並回傳一個 JSON 物件，包含以下兩個欄位：
                1. "description": 用繁體中文描述這位學生的外觀特徵（例如：戴眼鏡、長髮、笑臉），作為老師記憶學生的口訣。請用條列式，重點描述 3 個最明顯的特徵，總字數 50 字以內，語氣生動活潑。
                2. "tags": 根據外觀特徵提取 3-5 個關鍵字標籤（Tag），例如 ["眼鏡", "長髮", "笑容", "藍色衣服"]。

                請務必只回傳純 JSON 格式，不要有 Markdown 標記 (如 \`\`\`json)。
            `;

const COMPARE_PROMPT = `角色：你是一位細心的特教觀察專家。
任務：比較這兩張學生照片，找出「最快幫助老師區分他們」的視覺特徵。

要求：
1. 一句話聚焦「最明顯的差異」（不超過 25 字）
2. 用「A 是 ___，B 是 ___」的對比格式
3. 聚焦：髮型、臉型、眼鏡、笑容、五官比例
4. 不要用「左邊/右邊」（順序會變），用「A」「B」代稱

範例：
- 「A 戴黑框眼鏡圓臉，B 是無框眼鏡瓜子臉」
- 「A 高馬尾活潑，B 短髮文靜」
- 「A 嘴角有酒窩，B 顴骨較高」

只回 JSON：{"distinguishingPoint": "..."}`;

export const TASKS = {
    memoryAnchor: { prompt: MEMORY_ANCHOR_PROMPT, imageCount: 1 },
    describe: { prompt: DESCRIBE_PROMPT, imageCount: 1 },
    compare: {
        prompt: COMPARE_PROMPT,
        imageCount: 2,
        generationConfig: {
            responseMimeType: 'application/json',
            // 只要求 JSON 時模型偶爾會在結尾多吐文字，導致前端解析失敗，所以把欄位也鎖死
            responseSchema: {
                type: 'OBJECT',
                properties: { distinguishingPoint: { type: 'STRING' } },
                required: ['distinguishingPoint'],
            },
        },
    },
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BASE64_LENGTH = 2_000_000; // 約 1.5MB；前端都先縮到 512px 以內
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * 檢查前端送來的任務與照片
 * @returns {string|null} 錯誤訊息；合法時回傳 null
 */
export function validateRequest(task, images) {
    const definition = Object.hasOwn(TASKS, task) ? TASKS[task] : null;
    if (!definition) return '不支援的 AI 任務';
    if (!Array.isArray(images) || images.length !== definition.imageCount) {
        return '照片數量不正確';
    }
    for (const image of images) {
        if (!ALLOWED_MIME_TYPES.has(image?.mimeType)) return '不支援的照片格式';
        if (typeof image.data !== 'string' || !image.data) return '照片資料是空的';
        if (image.data.length > MAX_IMAGE_BASE64_LENGTH) return '照片太大';
        if (!BASE64_PATTERN.test(image.data)) return '照片資料格式錯誤';
    }
    return null;
}

/** 組出送給 Gemini 的請求內容 */
export function buildGeminiRequest(task, images) {
    const { prompt, generationConfig } = TASKS[task];
    return {
        contents: [{
            role: 'user',
            parts: [
                { text: prompt },
                ...images.map(({ data, mimeType }) => ({ inlineData: { data, mimeType } })),
            ],
        }],
        generationConfig: {
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 0 },
            ...generationConfig,
        },
    };
}

/** 取出 Gemini 回傳的文字與結束原因 */
export function readGeminiResponse(body) {
    const candidate = body?.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    return { text, finishReason: candidate?.finishReason ?? body?.promptFeedback?.blockReason };
}
