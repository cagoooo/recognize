import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getPhotoBlob, savePhotoBlob, saveStudents } from './db';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * 匯出班級備份為 ZIP 檔
 * @param {string} classId 
 * @param {string} className 
 * @param {Array} students 
 */
export const exportClassBackup = async (classId, className, students) => {
    const zip = new JSZip();

    // 1. 準備 metadata
    const backupData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        classInfo: {
            id: classId,
            name: className
        },
        students: students.map(s => ({
            ...s,
            // 匯出時暫時移除 firebase 專有 timestamp 欄位，或轉化為可序列化的字串
            createdAt: s.createdAt?.toMillis ? s.createdAt.toMillis() : null,
            photoUrl: "" // 匯出檔不帶雲端網址，匯入時會重新上傳
        }))
    };

    zip.file('data.json', JSON.stringify(backupData, null, 2));

    // 2. 準備圖片 (從 IndexedDB 提取 Blob)
    const photosFolder = zip.folder('photos');
    let hasPhotos = false;

    for (const student of students) {
        if (!student.id) continue;
        const blob = await getPhotoBlob(student.id);
        if (blob) {
            // 決定副檔名，預設給 .jpg
            const ext = blob.type.split('/')[1] || 'jpg';
            photosFolder.file(`${student.id}.${ext}`, blob);
            hasPhotos = true;
        }
    }

    // 3. 產生 ZIP 檔並下載
    const content = await zip.generateAsync({ type: 'blob' });
    const safeClassName = className.replace(/[/\\?%*:|"<>]/g, '-');
    saveAs(content, `${safeClassName}_班級備份.zip`);
};

/**
 * 匯入班級備份 ZIP 檔
 * 解析並寫回 Firestore 與 IndexedDB
 * 
 * @param {File} zipFile 
 * @param {string} teacherUid 
 * @param {Function} onProgress (current, total, message)
 */
export const importClassBackup = async (zipFile, teacherUid, onProgress = () => { }) => {
    try {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(zipFile);

        // 1. 讀取 data.json
        const dataFile = loadedZip.file('data.json');
        if (!dataFile) {
            throw new Error('無效的備份檔，找不到 data.json');
        }
        const backupData = JSON.parse(await dataFile.async('text'));

        if (!backupData.classInfo || !backupData.students) {
            throw new Error('無效的備份檔結構');
        }

        const { name: className } = backupData.classInfo;
        const originalStudents = backupData.students;

        onProgress(0, originalStudents.length, '正在建立班級結構...');

        // 2. 建立新班級 (Firestore)
        const classRef = await addDoc(collection(db, 'classes'), {
            name: `${className} (匯入)`,
            teacherUid: teacherUid,
            createdAt: serverTimestamp()
        });
        const newClassId = classRef.id;

        // 3. 準備寫入學生
        // 因為涉及到 Storage 上傳，逐一處理比較穩，並能回報進度
        const batch = writeBatch(db);
        const newStudentsData = []; // 用於最後寫入 IndexedDB

        let currentCount = 0;
        for (const oldStudent of originalStudents) {
            currentCount++;
            onProgress(currentCount, originalStudents.length, `正在處理 ${oldStudent.name}...`);

            // 建立新的學生 DocRef
            const newStudentRef = doc(collection(db, 'students'));
            const newStudentId = newStudentRef.id;
            let newPhotoUrl = "";

            // 尋找對應的圖片檔
            let matchedFile = null;
            let fileExt = '';
            loadedZip.folder('photos').forEach((relativePath, file) => {
                if (relativePath.startsWith(oldStudent.id)) {
                    matchedFile = file;
                    fileExt = relativePath.split('.').pop();
                }
            });

            // 處理圖片還原
            if (matchedFile) {
                const blob = await matchedFile.async('blob');

                // 3a. 上傳至 Firebase Storage
                const storageRef = ref(storage, `students/${Date.now()}_${newStudentId}.${fileExt}`);
                await uploadBytes(storageRef, blob);
                newPhotoUrl = await getDownloadURL(storageRef);

                // 3b. 寫入本地 IndexedDB 快取
                await savePhotoBlob(newStudentId, blob);
            }

            // 建立新的學生資料物件
            const newStudentObj = {
                name: oldStudent.name,
                seatNumber: oldStudent.seatNumber || "",
                classId: newClassId,
                photoUrl: newPhotoUrl,
                wrongCount: oldStudent.wrongCount || 0,
                tags: oldStudent.tags || [],
                description: oldStudent.description || "",
                aiHint: oldStudent.aiHint || "",
                stats: oldStudent.stats || { totalAttempts: 0, correctAttempts: 0 },
                createdAt: serverTimestamp()
            };

            batch.set(newStudentRef, newStudentObj);
            newStudentsData.push({ id: newStudentId, ...newStudentObj });
        }

        onProgress(currentCount, originalStudents.length, '正在同步至雲端...');

        // 4. 執行 Batch 寫入 Firestore
        await batch.commit();

        // 5. 寫入 IndexedDB
        await saveStudents(newStudentsData);

        onProgress(currentCount, originalStudents.length, '匯入完成！');

        return newClassId; // 回傳新建立的班級 ID 供跳轉

    } catch (error) {
        console.error("Import backup failed:", error);
        throw error;
    }
};
