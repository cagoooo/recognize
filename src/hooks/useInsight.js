/**
 * useInsight — 班級攻略本 Firestore CRUD
 *  - 文件 id = classId（一班一份）
 *  - 內含 pairs[]、generatedAt、teacherUid
 *  - 提供 generateAndSave / toggleMastery / refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateClassInsight } from '../lib/insight';
import { getPhotoBlob } from '../lib/db';

export const useInsight = (classId, teacherUid) => {
    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        if (!classId) return;
        setLoading(true);
        try {
            const snap = await getDoc(doc(db, 'class_insights', classId));
            setInsight(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        } catch (err) {
            console.error('Load insight failed:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [classId]);

    useEffect(() => { refresh(); }, [refresh]);

    /**
     * 對學生集合產生攻略本並儲存
     * @param {Array<{id, name, photoUrl}>} students
     */
    const generateAndSave = useCallback(async (students) => {
        if (!classId || !teacherUid) throw new Error('缺少 classId / teacherUid');
        setGenerating(true);
        setError(null);
        setProgress({ phase: 'init', current: 0, total: students.length });

        try {
            // 帶上 IndexedDB 內的裁切後 blob（faceCrop 已產生），減少網路請求
            const enriched = await Promise.all(students.map(async (s) => ({
                ...s,
                blob: await getPhotoBlob(s.id),
            })));

            const result = await generateClassInsight(enriched, setProgress);

            const docData = {
                classId,
                teacherUid,
                pairs: result.pairs,
                geminiCalls: result.geminiCalls,
                skipped: result.skipped,
                reason: result.reason || null,
                generatedAt: serverTimestamp(),
                masteredCount: 0,
            };

            await setDoc(doc(db, 'class_insights', classId), docData);
            await refresh();
            return result;
        } catch (err) {
            console.error('Generate insight failed:', err);
            setError(err);
            throw err;
        } finally {
            setGenerating(false);
            setProgress(null);
        }
    }, [classId, teacherUid, refresh]);

    /**
     * 切換某對的「已掌握」狀態
     */
    const toggleMastery = useCallback(async (aId, bId) => {
        if (!insight) return;
        const updatedPairs = insight.pairs.map(p =>
            (p.aId === aId && p.bId === bId)
                ? { ...p, mastered: !p.mastered }
                : p
        );
        const masteredCount = updatedPairs.filter(p => p.mastered).length;
        await updateDoc(doc(db, 'class_insights', classId), {
            pairs: updatedPairs,
            masteredCount,
        });
        setInsight({ ...insight, pairs: updatedPairs, masteredCount });
    }, [insight, classId]);

    return { insight, loading, generating, progress, error, generateAndSave, toggleMastery, refresh };
};
