import { db } from '../firebase';
import { addDoc, collection, serverTimestamp, writeBatch, doc, increment } from 'firebase/firestore';

export const useRecognitionStats = () => {
    /**
     * 記錄遊戲結果到 Firestore 並更新個別學生數據
     * @param {string} className 班級名稱
     * @param {number} score 總分
     * @param {number} totalQuestions 總問題數
     * @param {Array} detailedResults 詳細答題紀錄 [{ studentId, isCorrect, timeTaken }]
     */
    const recordGameResult = async (className, score, totalQuestions = 10, detailedResults = []) => {
        const accuracy = Math.min(100, (score / (totalQuestions * 100)) * 100);

        try {
            // 1. 寫入遊戲總分紀錄
            const gameDocRef = await addDoc(collection(db, 'scores'), {
                className,
                score,
                accuracy,
                timeSpent: 60, // 暫時固定，未來可傳入實際時間
                timestamp: serverTimestamp(),
                details: detailedResults // 儲存詳細紀錄以供未來分析
            });

            // 2. 批次更新個別學生數據
            if (detailedResults.length > 0) {
                // 注意：Firestore batch 最多 500 個寫入，若一場遊戲 10 題，遠不會超過
                const batch = writeBatch(db);

                detailedResults.forEach(result => {
                    const studentRef = doc(db, 'students', result.studentId);

                    // 使用 increment 原子操作確保並發安全
                    // 注意：需先確認資料結構。若 stats 欄位不存在，update 可能會失敗，
                    // 因此這裡建議使用 set({ stats: ... }, { merge: true }) 或確保 addStudent 時已初始化
                    // 為了安全，這裡使用 set set merge
                    batch.set(studentRef, {
                        stats: {
                            totalAttempts: increment(1),
                            correctAttempts: increment(result.isCorrect ? 1 : 0),
                            lastSeen: serverTimestamp()
                        }
                    }, { merge: true });
                });

                await batch.commit();
            }

            return gameDocRef.id;

        } catch (error) {
            console.error("Failed to record game result:", error);
            throw error;
        }
    };

    return { recordGameResult };
};
