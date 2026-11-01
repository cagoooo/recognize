import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
    GEMINI_MODEL,
    buildGeminiRequest,
    readGeminiResponse,
    validateRequest,
} from './tasks.js';

initializeApp();

// face-2fa85 與「學生肖像權使用授權」共用，名稱一律加 recognize 前綴
const GEMINI_API_KEY = defineSecret('RECOGNIZE_GEMINI_API_KEY');
const USAGE_COLLECTION = 'recognize_gemini_usage';

const HOURLY_LIMIT_PER_USER = 200; // 攻略本單班上限 50 對，再留給遊戲口訣與 AI 記憶特徵
const DAILY_LIMIT_GLOBAL = 2000;   // 全站保險絲：就算有人開很多帳號，一天的花費也有上限

const MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

const taiwanDateKey = (now) => new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** 每呼叫一次就記一筆，超過上限時擋下 */
async function enforceRateLimit(uid) {
    const db = getFirestore();
    const now = Date.now();
    const hourKey = Math.floor(now / (60 * 60 * 1000));
    const userRef = db.collection(USAGE_COLLECTION).doc(`user_${uid}`);
    const globalRef = db.collection(USAGE_COLLECTION).doc(`global_${taiwanDateKey(now)}`);

    await db.runTransaction(async (tx) => {
        const [userSnap, globalSnap] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
        const userCount = userSnap.get('hourKey') === hourKey ? userSnap.get('count') : 0;
        const globalCount = globalSnap.get('count') ?? 0;

        if (userCount >= HOURLY_LIMIT_PER_USER) {
            throw new HttpsError('resource-exhausted', '這一小時的 AI 使用次數已達上限，請稍後再試');
        }
        if (globalCount >= DAILY_LIMIT_GLOBAL) {
            throw new HttpsError('resource-exhausted', '今天全站的 AI 使用次數已達上限，請明天再試');
        }

        const updatedAt = FieldValue.serverTimestamp();
        tx.set(userRef, { hourKey, count: userCount + 1, updatedAt });
        tx.set(globalRef, { count: globalCount + 1, updatedAt });
    });
}

/** 呼叫 Gemini；伺服器忙碌（5xx 或 finishReason OTHER）時自動重試 */
async function generateText(task, images, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    for (let attempt = 1; ; attempt++) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(buildGeminiRequest(task, images)),
        });
        const body = await response.json().catch(() => null);
        const { text, finishReason } = readGeminiResponse(body);

        if (response.ok && text) {
            return { text, finishReason, usage: body.usageMetadata };
        }

        const isBusy = response.status >= 500 || finishReason === 'OTHER';
        if (isBusy && attempt < MAX_ATTEMPTS) {
            const delay = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
            logger.warn('Gemini 忙碌，準備重試', { task, attempt, status: response.status, finishReason });
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
        }

        logger.error('Gemini 呼叫失敗', {
            task,
            status: response.status,
            finishReason,
            error: body?.error?.message,
        });
        if (response.status === 429) {
            throw new HttpsError('resource-exhausted', 'AI 額度暫時用完，請稍後再試');
        }
        throw new HttpsError(isBusy ? 'unavailable' : 'internal', 'AI 分析失敗，請稍後再試');
    }
}

export const recognizeCallGemini = onCall(
    {
        region: 'asia-east1',
        secrets: [GEMINI_API_KEY],
        cors: ['https://cagoooo.github.io', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],
        memory: '256MiB',
        timeoutSeconds: 60,
        maxInstances: 5,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', '請先登入');
        }

        const { task, images } = request.data ?? {};
        const invalidReason = validateRequest(task, images);
        if (invalidReason) {
            throw new HttpsError('invalid-argument', invalidReason);
        }

        await enforceRateLimit(request.auth.uid);

        const { text, finishReason, usage } = await generateText(task, images, GEMINI_API_KEY.value());
        // 只記任務與用量，學生照片與 AI 內容一律不進 log
        logger.info('Gemini 呼叫成功', {
            task,
            model: GEMINI_MODEL,
            finishReason,
            totalTokens: usage?.totalTokenCount,
        });
        return { text };
    },
);
