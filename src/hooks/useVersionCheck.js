/**
 * useVersionCheck — PWA 版本守門
 *  - bundled 版本來自 vite.define 的 __APP_VERSION__ / __APP_COMMIT__ / __APP_BUILD_TIME__
 *  - 開機 + 每 5 分鐘 fetch /version.json（network-only，由 SW runtimeCaching 保證）
 *  - 偵測到 commit 不同 → 標記 hasUpdate=true，UI 顯示 banner
 *  - 使用者按「立刻更新」→ 清所有 caches + 註銷 SW + reload
 */

import { useEffect, useState, useCallback, useRef } from 'react';

// 由 vite.config.js define 注入
/* global __APP_VERSION__, __APP_COMMIT__, __APP_BUILD_TIME__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
export const APP_COMMIT = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'dev';
export const APP_BUILD_TIME = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘

// base 路徑（vite.config.js 設定 /recognize/）
const VERSION_URL = `${import.meta.env.BASE_URL}version.json?t=`;

export function useVersionCheck() {
    const [remote, setRemote] = useState(null);
    const [hasUpdate, setHasUpdate] = useState(false);
    const [updating, setUpdating] = useState(false);
    const timerRef = useRef(null);

    const check = useCallback(async () => {
        try {
            // 加 timestamp 防中間層快取
            const r = await fetch(VERSION_URL + Date.now(), { cache: 'no-store' });
            if (!r.ok) return;
            const data = await r.json();
            setRemote(data);
            // 比 commit 比 version 都不對就算有新版
            if (data.commit && data.commit !== APP_COMMIT) {
                setHasUpdate(true);
            } else if (data.version && data.version !== APP_VERSION) {
                setHasUpdate(true);
            }
        } catch (err) {
            // 離線就略過
            console.debug('[version-check] 取版本檔失敗（可能離線）:', err.message);
        }
    }, []);

    useEffect(() => {
        check();
        timerRef.current = setInterval(check, POLL_INTERVAL_MS);
        // 切回 tab 時也檢查一次
        const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(timerRef.current);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [check]);

    const applyUpdate = useCallback(async () => {
        setUpdating(true);
        try {
            // 1. 清掉所有 cache
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(n => caches.delete(n)));
            }
            // 2. 註銷所有 SW（下次載入會註冊新版）
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }
            // 3. 強制 hard reload
            window.location.reload();
        } catch (err) {
            console.error('[version-check] 套用更新失敗:', err);
            setUpdating(false);
        }
    }, []);

    return {
        local: { version: APP_VERSION, commit: APP_COMMIT, buildTime: APP_BUILD_TIME },
        remote,
        hasUpdate,
        updating,
        applyUpdate,
        recheck: check,
    };
}
