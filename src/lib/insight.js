/**
 * insight.js — 班級攻略本核心邏輯
 *
 * 兩階段流程：
 *   1. 前端粗篩（free）：用 64x64 灰階 fingerprint 算餘弦相似度，留下 top-K 對
 *   2. Gemini 精選（paid）：對 top-K 對用 Vision API 比對，產生「區分點」
 *
 * 成本控制：
 *   - 粗篩篩選率 ~85%：30 人班 435 對 → 留 30-50 對給 Gemini
 *   - 月度配額：localStorage 計數，超過 1000 次直接擋下
 *   - 後端速率限制：functions/index.js 依帳號與全站次數把關（真正擋得住的那一道）
 *   - 每對成本約 NT$0.005-0.01（gemini-2.5-flash-lite 雙圖輸入）
 */

import { extractFaceFingerprint, cosineSimilarity } from './faceCrop';
import { askGemini } from './geminiClient';

const MONTHLY_QUOTA = 1000;
const SIMILARITY_THRESHOLD = 0.6;  // 粗篩門檻：餘弦 > 0.6 才送 Gemini
const MAX_PAIRS_PER_CLASS = 50;     // Gemini call 上限（守住單班成本）

// ---- 月度配額守門 ----
const QUOTA_KEY = 'gemini_monthly_count';
const QUOTA_MONTH_KEY = 'gemini_monthly_key';

function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getQuotaStatus() {
    const monthKey = currentMonthKey();
    const storedKey = localStorage.getItem(QUOTA_MONTH_KEY);
    if (storedKey !== monthKey) {
        localStorage.setItem(QUOTA_MONTH_KEY, monthKey);
        localStorage.setItem(QUOTA_KEY, '0');
        return { used: 0, limit: MONTHLY_QUOTA, monthKey };
    }
    return {
        used: parseInt(localStorage.getItem(QUOTA_KEY) || '0', 10),
        limit: MONTHLY_QUOTA,
        monthKey,
    };
}

function incrementQuota(by = 1) {
    const { used } = getQuotaStatus();
    localStorage.setItem(QUOTA_KEY, String(used + by));
}

// ---- 圖片轉 base64（給 Gemini） ----
async function blobToBase64(blob, maxWidth = 256) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = img.width > maxWidth ? maxWidth / img.width : 1;
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            resolve(dataUrl.split(',')[1]);
        };
        img.src = url;
    });
}

// ---- 粗篩：算所有 pair 的相似度，回傳排序後的候選 ----

/**
 * @param {Array<{id, name, photoUrl, blob?}>} students
 *   blob 為已裁切的人臉 Blob；若為 null 則 fetch photoUrl
 * @returns {Promise<Array<{aId, bId, aName, bName, similarity}>>}
 *   依 similarity 由高至低排序，已過濾 < SIMILARITY_THRESHOLD
 */
export async function coarsePairwiseScreen(students) {
    // 1. 抽取所有人指紋
    const fingerprints = new Map();
    for (const s of students) {
        if (!s.blob && !s.photoUrl) continue;
        try {
            const blob = s.blob || await fetch(s.photoUrl).then(r => r.blob());
            const fp = await extractFaceFingerprint(blob);
            fingerprints.set(s.id, { fp, name: s.name });
        } catch (err) {
            console.warn(`Fingerprint failed for ${s.name}:`, err);
        }
    }

    // 2. 兩兩比對
    const ids = Array.from(fingerprints.keys());
    const pairs = [];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = fingerprints.get(ids[i]);
            const b = fingerprints.get(ids[j]);
            const sim = cosineSimilarity(a.fp, b.fp);
            if (sim >= SIMILARITY_THRESHOLD) {
                pairs.push({
                    aId: ids[i],
                    bId: ids[j],
                    aName: a.name,
                    bName: b.name,
                    similarity: sim,
                });
            }
        }
    }

    pairs.sort((x, y) => y.similarity - x.similarity);
    return pairs.slice(0, MAX_PAIRS_PER_CLASS);
}

// ---- 精選：呼叫 Gemini 對單對學生比對 ----

async function compareWithGemini(blobA, blobB) {
    const [b64A, b64B] = await Promise.all([
        blobToBase64(blobA),
        blobToBase64(blobB),
    ]);

    const text = await askGemini('compare', [
        { data: b64A, mimeType: 'image/jpeg' },
        { data: b64B, mimeType: 'image/jpeg' },
    ]);

    try {
        const parsed = JSON.parse(text);
        return parsed.distinguishingPoint || '無法產生區分點';
    } catch {
        // 即便 JSON 解析失敗也回傳原始文字（fallback）
        return text.slice(0, 80);
    }
}

// ---- 公開入口：產生整本攻略本 ----

/**
 * @param {Array<{id, name, photoUrl, blob?}>} students
 * @param {(progress: {phase, current, total}) => void} onProgress
 * @returns {Promise<{
 *   pairs: Array<{aId, bId, aName, bName, similarity, distinguishingPoint, mastered}>,
 *   geminiCalls: number,
 *   skipped: number,
 *   reason?: string,
 * }>}
 */
export async function generateClassInsight(students, onProgress = () => { }) {
    if (students.length < 2) {
        return { pairs: [], geminiCalls: 0, skipped: 0, reason: '學生數不足' };
    }

    // 1. 配額檢查
    const quota = getQuotaStatus();
    const remaining = quota.limit - quota.used;
    if (remaining <= 0) {
        return {
            pairs: [],
            geminiCalls: 0,
            skipped: 0,
            reason: `本月 Gemini 配額已用完（${quota.used}/${quota.limit}），下個月 1 號自動重置`,
        };
    }

    // 2. 粗篩
    onProgress({ phase: 'screening', current: 0, total: students.length });
    const candidates = await coarsePairwiseScreen(students);

    if (candidates.length === 0) {
        return {
            pairs: [],
            geminiCalls: 0,
            skipped: 0,
            reason: '本班學生外觀差異明顯，無高混淆 pair',
        };
    }

    // 3. 配額限制（如果剩餘配額少於候選數，截斷）
    const toProcess = candidates.slice(0, Math.min(candidates.length, remaining));
    const skipped = candidates.length - toProcess.length;

    // 4. 精選：批次呼叫 Gemini
    const blobCache = new Map();
    const getBlob = async (studentId) => {
        if (blobCache.has(studentId)) return blobCache.get(studentId);
        const s = students.find(x => x.id === studentId);
        const blob = s?.blob || (s?.photoUrl ? await fetch(s.photoUrl).then(r => r.blob()) : null);
        blobCache.set(studentId, blob);
        return blob;
    };

    const results = [];
    let reason;
    for (let i = 0; i < toProcess.length; i++) {
        const pair = toProcess[i];
        onProgress({ phase: 'comparing', current: i + 1, total: toProcess.length });
        try {
            const [blobA, blobB] = await Promise.all([getBlob(pair.aId), getBlob(pair.bId)]);
            if (!blobA || !blobB) continue;
            const distinguishingPoint = await compareWithGemini(blobA, blobB);
            results.push({
                ...pair,
                distinguishingPoint,
                mastered: false,
            });
            incrementQuota(1);
        } catch (err) {
            console.warn(`Compare failed for ${pair.aName} vs ${pair.bName}:`, err);
            // 次數用完時後面每一對都會失敗，直接停止；其他單對失敗不阻斷整體
            if (err.code === 'functions/resource-exhausted') {
                reason = err.message;
                break;
            }
        }
    }

    onProgress({ phase: 'done', current: toProcess.length, total: toProcess.length });

    return {
        pairs: results,
        geminiCalls: results.length,
        skipped,
        reason,
    };
}

export const INSIGHT_CONFIG = {
    SIMILARITY_THRESHOLD,
    MAX_PAIRS_PER_CLASS,
    MONTHLY_QUOTA,
};
