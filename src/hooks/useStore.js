import { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch,
    orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../lib/imageUtils';
import {
    getClasses,
    saveClasses,
    getStudentsByClass,
    saveStudents,
    savePhotoBlob,
    getPhotoBlob
} from '../lib/db';

/**
 * 背景照片快取機制
 */
const cachePhotos = async (students) => {
    for (const student of students) {
        if (!student.photoUrl) continue;
        try {
            const existing = await getPhotoBlob(student.id);
            if (!existing) {
                const response = await fetch(student.photoUrl);
                const blob = await response.blob();
                await savePhotoBlob(student.id, blob);
            }
        } catch (err) {
            console.warn(`Cache photo failed for ${student.id}:`, err);
        }
    }
};

export const useClasses = (userId) => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        // 1. SWR: 優先從 IndexedDB 載入快取
        const loadCache = async () => {
            try {
                const cached = await getClasses();
                if (cached && cached.length > 0) {
                    cached.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }));
                    setClasses(cached);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Load classes cache failed:", err);
            }
        };
        loadCache();

        // 2. Start Firestore Snapshot for real-time updates
        const q = query(collection(db, 'classes'), where('teacherUid', '==', userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }));

            setClasses(data);
            setLoading(false);

            // 3. 同步回 IndexedDB
            saveClasses(data, userId).catch(e => console.error("Save classes cache failed:", e));
        }, (error) => {
            console.error("Classes snapshot error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userId]);

    const addClass = (name) => {
        return addDoc(collection(db, 'classes'), {
            name,
            teacherUid: userId,
            createdAt: serverTimestamp()
        });
    };

    const deleteClass = (id) => {
        return deleteDoc(doc(db, 'classes', id));
    };

    return { classes, loading, addClass, deleteClass };
};

export const useStudents = (classId) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!classId) return;

        // 1. SWR: 優先從 IndexedDB 載入快生快取
        const loadCache = async () => {
            try {
                const cached = await getStudentsByClass(classId);
                if (cached && cached.length > 0) {
                    cached.sort((a, b) => {
                        const sA = String(a.seatNumber || "");
                        const sB = String(b.seatNumber || "");
                        if (sA !== sB) return sA.localeCompare(sB, 'zh-TW', { numeric: true });
                        return a.name.localeCompare(b.name, 'zh-TW');
                    });
                    setStudents(cached);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Load students cache failed:", err);
            }
        };
        loadCache();

        // 2. Start Firestore Snapshot
        const q = query(collection(db, 'students'), where('classId', '==', classId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => {
                const sA = String(a.seatNumber || "");
                const sB = String(b.seatNumber || "");
                if (sA !== sB) return sA.localeCompare(sB, 'zh-TW', { numeric: true });
                return a.name.localeCompare(b.name, 'zh-TW');
            });

            setStudents(data);
            setLoading(false);

            // 3. 同步回 IndexedDB 並啟動照片快取
            saveStudents(data, classId).catch(e => console.error("Save students cache failed:", e));
            cachePhotos(data);
        }, (error) => {
            console.error("Students snapshot error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [classId]);

    const addStudent = async (name, photoFile, seatNumber = "") => {
        let photoUrl = "";
        if (photoFile) {
            // 上傳前先壓縮圖片（最大 800px 長邊 + 修正 EXIF 旋轉）
            const compressedFile = await compressImage(photoFile);
            const storageRef = ref(storage, `students/${Date.now()}_${compressedFile.name}`);
            await uploadBytes(storageRef, compressedFile);
            photoUrl = await getDownloadURL(storageRef);
        }

        return addDoc(collection(db, 'students'), {
            name,
            seatNumber: String(seatNumber),
            classId,
            photoUrl,
            wrongCount: 0,
            tags: [],
            stats: { totalAttempts: 0, correctAttempts: 0 },
            createdAt: serverTimestamp()
        });
    };

    const batchAddStudents = async (studentList) => {
        const batch = writeBatch(db);
        studentList.forEach((std) => {
            const newDocRef = doc(collection(db, 'students'));
            batch.set(newDocRef, {
                name: std.name,
                seatNumber: std.seatNumber || "",
                classId,
                photoUrl: "",
                wrongCount: 0,
                tags: [],
                stats: { totalAttempts: 0, correctAttempts: 0 },
                createdAt: serverTimestamp()
            });
        });
        await batch.commit();
    };

    const updateStudentPhoto = async (studentId, photoFile) => {
        // 上傳前先壓縮圖片（最大 800px 長邊 + 修正 EXIF 旋轉）
        const compressedFile = await compressImage(photoFile);
        const storageRef = ref(storage, `students/${Date.now()}_${compressedFile.name}`);
        await uploadBytes(storageRef, compressedFile);
        const photoUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'students', studentId), { photoUrl });
        return photoUrl;
    };

    const deleteStudent = (id) => {
        return deleteDoc(doc(db, 'students', id));
    };

    const updateStudentTags = async (studentId, tags) => {
        await updateDoc(doc(db, 'students', studentId), { tags });
    };

    const updateStudentDescription = async (studentId, description) => {
        await updateDoc(doc(db, 'students', studentId), { description });
    };

    return { students, loading, addStudent, batchAddStudents, updateStudentPhoto, deleteStudent, updateStudentTags, updateStudentDescription };
};

export const updateStudentAiHint = async (studentId, aiHint) => {
    await updateDoc(doc(db, 'students', studentId), { aiHint });
};

export const useScores = (className) => {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 只用 orderBy timestamp，不加 where，避免需要 Firestore 複合索引
        const q = query(collection(db, 'scores'), orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 若有指定班級則在 client-side 過濾，省去複合索引
            if (className) {
                data = data.filter(s => s.className === className);
            }
            setScores(data);
            setLoading(false);
        }, (error) => {
            console.error("Scores snapshot error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [className]);

    return { scores, loading };
};
