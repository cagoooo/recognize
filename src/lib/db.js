const DB_NAME = 'recognize_db';
const DB_VERSION = 3;

/**
 * 初始化 IndexedDB
 */
export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 建立班級 Store
            let classStore;
            if (!db.objectStoreNames.contains('classes')) {
                classStore = db.createObjectStore('classes', { keyPath: 'id' });
            } else {
                classStore = event.target.transaction.objectStore('classes');
            }

            if (!classStore.indexNames.contains('teacherUid')) {
                classStore.createIndex('teacherUid', 'teacherUid', { unique: false });
            }

            // 建立學生 Store
            if (!db.objectStoreNames.contains('students')) {
                const studentStore = db.createObjectStore('students', { keyPath: 'id' });
                studentStore.createIndex('classId', 'classId', { unique: false });
            }

            // 建立照片 Store (存儲 Blob)
            if (!db.objectStoreNames.contains('photos')) {
                db.createObjectStore('photos', { keyPath: 'studentId' });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

/**
 * 汎用存儲操作
 */
const performAction = async (storeName, mode, action) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = action(store);

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

// --- Classes ---
export const saveClasses = async (classes, userId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('classes', 'readwrite');
        const store = transaction.objectStore('classes');

        // 1. 清除已不存在於列表中的該使用者舊快取
        if (userId) {
            const index = store.index('teacherUid');
            const request = index.getAll(userId);
            request.onsuccess = (e) => {
                const existing = e.target.result;
                const newIds = new Set(classes.map(c => c.id));
                existing.forEach(oldCls => {
                    if (!newIds.has(oldCls.id)) {
                        store.delete(oldCls.id);
                    }
                });

                // 2. 寫入新資料
                classes.forEach(cls => store.put(cls));
            };
        } else {
            // 退回機制：若無 userId 則僅執行 put
            classes.forEach(cls => store.put(cls));
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getClasses = () => performAction('classes', 'readonly', store => store.getAll());

// --- Students ---
export const saveStudents = async (students, classId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('students', 'readwrite');
        const store = transaction.objectStore('students');

        // 1. 清除已不存在於列表中的該班級舊快取
        if (classId) {
            const index = store.index('classId');
            const request = index.getAll(classId);
            request.onsuccess = (e) => {
                const existing = e.target.result;
                const newIds = new Set(students.map(s => s.id));
                existing.forEach(oldStd => {
                    if (!newIds.has(oldStd.id)) {
                        store.delete(oldStd.id);
                    }
                });

                // 2. 寫入新資料
                students.forEach(std => store.put(std));
            };
        } else {
            students.forEach(std => store.put(std));
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getStudentsByClass = async (classId) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('students', 'readonly');
        const store = transaction.objectStore('students');
        const index = store.index('classId');
        const request = index.getAll(classId);

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

// --- Photos (Blob) ---
/**
 * v3 schema: { studentId, blob (顯示用，預設為裁切後), originalBlob (原圖備份), cropMeta, timestamp }
 *  - 舊資料 (v2) 沒有 originalBlob / cropMeta，讀取時會是 undefined
 *  - 為相容 backup.js 等只傳一個 blob 的呼叫端，第二參數可以是 Blob 或物件
 */
export const savePhotoBlob = async (studentId, blob, extras = {}) => {
    const { originalBlob, cropMeta } = extras;
    const record = {
        studentId,
        blob,
        timestamp: Date.now(),
    };
    if (originalBlob) record.originalBlob = originalBlob;
    if (cropMeta) record.cropMeta = cropMeta; // { method: 'face'|'center'|'none', success, croppedAt }
    return performAction('photos', 'readwrite', store => store.put(record));
};

export const getPhotoBlob = async (studentId) => {
    const result = await performAction('photos', 'readonly', store => store.get(studentId));
    return result ? result.blob : null;
};

export const getPhotoRecord = async (studentId) => {
    return performAction('photos', 'readonly', store => store.get(studentId));
};

export const getOriginalPhotoBlob = async (studentId) => {
    const result = await performAction('photos', 'readonly', store => store.get(studentId));
    return result ? (result.originalBlob || result.blob) : null;
};

export const updateCroppedBlob = async (studentId, croppedBlob, cropMeta) => {
    const existing = await performAction('photos', 'readonly', store => store.get(studentId));
    if (!existing) {
        // 沒有原圖快取就無從更新
        return false;
    }
    const updated = {
        ...existing,
        blob: croppedBlob,
        cropMeta: cropMeta || existing.cropMeta,
        timestamp: Date.now(),
    };
    await performAction('photos', 'readwrite', store => store.put(updated));
    return true;
};

export const clearPhotoCache = () => performAction('photos', 'readwrite', store => store.clear());

/** 刪除單一學生的照片快取（IndexedDB photo store） */
export const deletePhotoBlob = (studentId) =>
    performAction('photos', 'readwrite', store => store.delete(studentId));
