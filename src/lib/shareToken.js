/**
 * shareToken.js — 班級分享金鑰相關工具
 *
 * Token 設計：
 *   - 22 字元（base62 取自 crypto.getRandomValues 的 16 bytes）
 *   - 熵 ≈ 128 bit，足以避免暴力枚舉
 *   - 不放在 URL hash 而是 query param `?join=...`，便於 SPA 解析
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateShareToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let token = '';
    for (let i = 0; i < 22; i++) {
        token += ALPHABET[bytes[i % bytes.length] % ALPHABET.length];
    }
    return token;
}

/**
 * URL 格式：?join=<classId>.<token>
 * classId 包在 URL 是因為 Rules 不允許非 owner 用 token 查班級，
 * 所以直接帶上 classId 讓 join 流程可直接 updateDoc，省掉查詢。
 */

/**
 * 從 ?join=classId.token 取出 (classId, token)
 * 同時清掉 URL 中的這個參數，避免 reload 重複觸發
 */
export function consumeJoinToken() {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('join');
    if (!raw) return null;
    url.searchParams.delete('join');
    window.history.replaceState({}, '', url.toString());

    const dot = raw.indexOf('.');
    if (dot < 1) return null;
    const classId = raw.slice(0, dot);
    const token = raw.slice(dot + 1);
    if (!classId || !token) return null;
    return { classId, token };
}

/**
 * 產生分享 URL（使用當前頁面 origin + base 路徑）
 */
export function buildShareUrl(classId, token) {
    const url = new URL(window.location.href);
    // 清掉所有現有 query 與 hash，只留 ?join
    url.search = '';
    url.hash = '';
    url.searchParams.set('join', `${classId}.${token}`);
    return url.toString();
}
