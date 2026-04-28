import { useState, useEffect } from 'react';
import { getPhotoBlob } from '../lib/db';

/**
 * 優先從 IndexedDB 載入照片的 Hook
 * @param {string} studentId 學生 ID
 * @param {string} remoteUrl 原始遠端 URL
 * @returns {string} 最終可用的 URL (Blob URL 或 Remote URL)
 */
export const useCachedPhoto = (studentId, remoteUrl) => {
    const [localUrl, setLocalUrl] = useState(null);

    useEffect(() => {
        let objectUrl = null;

        const loadFromCache = async () => {
            if (!studentId) return;

            try {
                const blob = await getPhotoBlob(studentId);
                if (blob) {
                    objectUrl = URL.createObjectURL(blob);
                    setLocalUrl(objectUrl);
                } else {
                    // 如果沒有快取，且有遠端 URL，則回退到遠端 URL
                    // 這裡不設定 localUrl，讓外部直接使用傳入的 remoteUrl
                    setLocalUrl(null);
                }
            } catch (err) {
                console.warn(`Load cached photo failed for ${studentId}:`, err);
                setLocalUrl(null);
            }
        };

        loadFromCache();

        // 清理記憶體
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
        // 加入 remoteUrl 依賴：上傳新照片後 photoUrl 變動會觸發重抓 IndexedDB
        // 取得新存進去的 blob 並 createObjectURL
    }, [studentId, remoteUrl]);

    return localUrl || remoteUrl;
};
