const DB_NAME = 'recognize_db';
const DB_VERSION = 1;

/**
 * 初始化 IndexedDB
 */
export const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 建立班級 Store
            if (!db.objectStoreNames.contains('classes')) {
                db.createObjectStore('classes', { keyPath: 'id' });
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
export const saveClasses = async (classes) => {
    const db = await initDB();
    const transaction = db.transaction('classes', 'readwrite');
    const store = transaction.objectStore('classes');
    classes.forEach(cls => store.put(cls));
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getClasses = () => performAction('classes', 'readonly', store => store.getAll());

// --- Students ---
export const saveStudents = async (students) => {
    const db = await initDB();
    const transaction = db.transaction('students', 'readwrite');
    const store = transaction.objectStore('students');
    students.forEach(std => store.put(std));
    return new Promise((resolve, reject) => {
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
export const savePhotoBlob = async (studentId, blob) => {
    return performAction('photos', 'readwrite', store => store.put({ studentId, blob, timestamp: Date.now() }));
};

export const getPhotoBlob = async (studentId) => {
    const result = await performAction('photos', 'readonly', store => store.get(studentId));
    return result ? result.blob : null;
};

export const clearPhotoCache = () => performAction('photos', 'readwrite', store => store.clear());
