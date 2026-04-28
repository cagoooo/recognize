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
    orderBy,
    getDoc,
    arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../lib/imageUtils';
import { smartCropFace } from '../lib/faceCrop';
import { generateShareToken } from '../lib/shareToken';
import {
    getClasses,
    saveClasses,
    getStudentsByClass,
    saveStudents,
    savePhotoBlob,
    getPhotoBlob,
    getOriginalPhotoBlob
} from '../lib/db';

/**
 * 獨立工具：科任老師持分享連結加入班級
 * 不在 hook 內，方便 App boot 時直接呼叫（不需先 useClasses）
 */
export const joinClassByShareLink = async (classId, token, userId) => {
    if (!classId || !token) throw new Error('連結格式不正確');
    if (!userId) throw new Error('尚未登入');
    const ref = doc(db, 'classes', classId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('班級不存在或連結已失效');
    const data = snap.data();
    if (data.shareToken !== token) throw new Error('連結已失效');
    if (data.teacherUid === userId) {
        return { classId, name: data.name, alreadyOwner: true };
    }
    const existing = Array.isArray(data.sharedWith) ? data.sharedWith : [];
    if (existing.includes(userId)) {
        return { classId, name: data.name, alreadyJoined: true };
    }
    await updateDoc(ref, {
        sharedWith: [...existing, userId],
        shareToken: data.shareToken,
        name: data.name,
        teacherUid: data.teacherUid,
    });
    return { classId, name: data.name };
};

/**
 * 上傳流程共用：壓縮 → 人臉裁切 → 上傳裁切版到 Storage → 雙存到 IndexedDB
 * 返回 { photoUrl, cropMeta }
 */
const processAndUploadPhoto = async (photoFile) => {
    const compressed = await compressImage(photoFile);
    const compressedBlob = compressed instanceof Blob ? compressed : compressed; // File 也是 Blob

    let uploadBlob = compressedBlob;
    let cropMeta = { method: 'none', success: false, croppedAt: Date.now() };

    try {
        const cropResult = await smartCropFace(compressedBlob);
        uploadBlob = cropResult.blob;
        cropMeta = {
            method: cropResult.success ? 'face' : 'center',
            success: cropResult.success,
            croppedAt: Date.now(),
        };
        // Firestore 不接受 undefined，只有真的有 reason 時才塞欄位
        if (cropResult.reason) cropMeta.reason = cropResult.reason;
    } catch (err) {
        console.warn('Face crop pipeline failed, uploading compressed original:', err);
    }

    const fileName = `${Date.now()}_${compressed.name || 'photo.jpg'}`;
    const storageRef = ref(storage, `students/${fileName}`);
    await uploadBytes(storageRef, uploadBlob);
    const photoUrl = await getDownloadURL(storageRef);

    return { photoUrl, uploadBlob, originalBlob: compressedBlob, cropMeta };
};

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

        // 2. Firestore 雙 query：自己擁有的 + 共享進來的
        let ownedData = [];
        let sharedData = [];
        const merge = () => {
            // 以 id 去重（理論上不會重，防呆）
            const map = new Map();
            ownedData.forEach(c => map.set(c.id, { ...c, _isShared: false }));
            sharedData.forEach(c => {
                if (!map.has(c.id)) map.set(c.id, { ...c, _isShared: true });
            });
            const data = Array.from(map.values())
                .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }));
            setClasses(data);
            setLoading(false);
            saveClasses(data, userId).catch(e => console.error("Save classes cache failed:", e));
        };

        const ownedQ = query(collection(db, 'classes'), where('teacherUid', '==', userId));
        const sharedQ = query(collection(db, 'classes'), where('sharedWith', 'array-contains', userId));

        const unsubOwned = onSnapshot(ownedQ, (snap) => {
            ownedData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            merge();
        }, (error) => {
            console.error("Owned classes snapshot error:", error);
            setLoading(false);
        });
        const unsubShared = onSnapshot(sharedQ, (snap) => {
            sharedData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            merge();
        }, (error) => {
            console.error("Shared classes snapshot error:", error);
        });

        return () => { unsubOwned(); unsubShared(); };
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

    /**
     * 為班級產生（或重發）分享 token；同 token 多次呼叫會用新的覆蓋（撤銷舊連結）
     * 僅班導本人可呼叫
     */
    const ensureShareToken = async (classId) => {
        const ref = doc(db, 'classes', classId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('班級不存在');
        const existing = snap.data().shareToken;
        if (existing) return existing;
        const token = generateShareToken();
        await updateDoc(ref, { shareToken: token, sharedWith: snap.data().sharedWith || [] });
        return token;
    };

    /** 重新產生 token（撤銷既有連結） */
    const regenerateShareToken = async (classId) => {
        const token = generateShareToken();
        await updateDoc(doc(db, 'classes', classId), { shareToken: token });
        return token;
    };

    /** 班導從共享名單移除某老師 */
    const removeSharedTeacher = async (classId, uid) => {
        await updateDoc(doc(db, 'classes', classId), { sharedWith: arrayRemove(uid) });
    };

    const joinClassByToken = (classId, token) => joinClassByShareLink(classId, token, userId);

    return { classes, loading, addClass, deleteClass, ensureShareToken, regenerateShareToken, removeSharedTeacher, joinClassByToken };
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
        let cropMeta = null;
        let pendingPhotoCache = null;

        if (photoFile) {
            const result = await processAndUploadPhoto(photoFile);
            photoUrl = result.photoUrl;
            cropMeta = result.cropMeta;
            pendingPhotoCache = result;
        }

        const docRef = await addDoc(collection(db, 'students'), {
            name,
            seatNumber: String(seatNumber),
            classId,
            photoUrl,
            cropMeta,
            wrongCount: 0,
            tags: [],
            stats: { totalAttempts: 0, correctAttempts: 0 },
            createdAt: serverTimestamp()
        });

        // 同步寫進 IndexedDB（裁切版供顯示，原圖備存供日後重新裁切）
        if (pendingPhotoCache) {
            try {
                await savePhotoBlob(docRef.id, pendingPhotoCache.uploadBlob, {
                    originalBlob: pendingPhotoCache.originalBlob,
                    cropMeta: pendingPhotoCache.cropMeta,
                });
            } catch (e) {
                console.warn('Save photo cache after addStudent failed:', e);
            }
        }

        return docRef;
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
        const { photoUrl, uploadBlob, originalBlob, cropMeta } = await processAndUploadPhoto(photoFile);
        await updateDoc(doc(db, 'students', studentId), { photoUrl, cropMeta });
        try {
            await savePhotoBlob(studentId, uploadBlob, { originalBlob, cropMeta });
        } catch (e) {
            console.warn('Save photo cache after updateStudentPhoto failed:', e);
        }
        return photoUrl;
    };

    const deleteStudent = (id) => {
        return deleteDoc(doc(db, 'students', id));
    };

    /**
     * 重新對學生現有照片跑一次人臉裁切
     *  - 優先用 IndexedDB 的 originalBlob（v3.8+ 上傳保留的原圖）
     *  - 無原圖則 fallback 到當前 photoUrl（適用 v3.8 前的舊資料）
     */
    const recropStudentPhoto = async (studentId, currentPhotoUrl) => {
        let sourceBlob = await getOriginalPhotoBlob(studentId);
        if (!sourceBlob && currentPhotoUrl) {
            const resp = await fetch(currentPhotoUrl);
            sourceBlob = await resp.blob();
        }
        if (!sourceBlob) {
            throw new Error('找不到可用的原始照片，請重新上傳');
        }

        const cropResult = await smartCropFace(sourceBlob);
        const cropMeta = {
            method: cropResult.success ? 'face' : 'center',
            success: cropResult.success,
            croppedAt: Date.now(),
        };
        // Firestore 不接受 undefined
        if (cropResult.reason) cropMeta.reason = cropResult.reason;

        // 上傳新裁切版（蓋掉 photoUrl）
        const fileName = `${Date.now()}_recrop.jpg`;
        const storageRef = ref(storage, `students/${fileName}`);
        await uploadBytes(storageRef, cropResult.blob);
        const photoUrl = await getDownloadURL(storageRef);

        await updateDoc(doc(db, 'students', studentId), { photoUrl, cropMeta });
        await savePhotoBlob(studentId, cropResult.blob, { originalBlob: sourceBlob, cropMeta });

        return { photoUrl, cropMeta };
    };

    const updateStudentTags = async (studentId, tags) => {
        await updateDoc(doc(db, 'students', studentId), { tags });
    };

    const updateStudentDescription = async (studentId, description) => {
        await updateDoc(doc(db, 'students', studentId), { description });
    };

    return { students, loading, addStudent, batchAddStudents, updateStudentPhoto, deleteStudent, updateStudentTags, updateStudentDescription, recropStudentPhoto };
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
