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

export const useClasses = (userId) => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, 'classes'), where('teacherUid', '==', userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 使用 localeCompare 進行自然語言排序 (如 601, 602...)
            data.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW', { numeric: true }));
            setClasses(data);
            setLoading(false);
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
        const q = query(collection(db, 'students'), where('classId', '==', classId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // 優先依座號排序，次之依姓名
            data.sort((a, b) => {
                const sA = String(a.seatNumber || "");
                const sB = String(b.seatNumber || "");
                if (sA !== sB) return sA.localeCompare(sB, 'zh-TW', { numeric: true });
                return a.name.localeCompare(b.name, 'zh-TW');
            });
            setStudents(data);
            setLoading(false);
        }, (error) => {
            console.error("Students snapshot error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [classId]);

    const addStudent = async (name, photoFile, seatNumber = "") => {
        let photoUrl = "";
        if (photoFile) {
            const storageRef = ref(storage, `students/${Date.now()}_${photoFile.name}`);
            await uploadBytes(storageRef, photoFile);
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
        const storageRef = ref(storage, `students/${Date.now()}_${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
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

export const useScores = (className) => {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let q = query(collection(db, 'scores'), orderBy('timestamp', 'desc'));
        if (className) {
            q = query(collection(db, 'scores'), where('className', '==', className), orderBy('timestamp', 'desc'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
