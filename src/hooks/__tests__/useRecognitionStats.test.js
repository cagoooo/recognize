import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRecognitionStats } from '../useRecognitionStats';
import { addDoc } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
    addDoc: vi.fn(),
    collection: vi.fn(),
    serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
}));

vi.mock('../../firebase', () => ({
    db: {},
}));

describe('useRecognitionStats Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('應正確錄製遊戲結果並計算正確率', async () => {
        vi.mocked(addDoc).mockResolvedValueOnce({ id: 'MOCK_ID' });

        const { result } = renderHook(() => useRecognitionStats());

        const gameId = await result.current.recordGameResult('3年2班', 850);

        expect(addDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({
            className: '3年2班',
            score: 850,
            accuracy: 85,
            timestamp: 'MOCK_TIMESTAMP'
        }));
        expect(gameId).toBe('MOCK_ID');
    });

    it('錄製失敗時應拋出錯誤', async () => {
        vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore error'));

        const { result } = renderHook(() => useRecognitionStats());

        await expect(result.current.recordGameResult('3年2班', 850))
            .rejects.toThrow('Firestore error');
    });
});
