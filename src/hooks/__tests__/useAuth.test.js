import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '../useAuth';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn(() => vi.fn()),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    getAuth: vi.fn(),
}));

vi.mock('../../firebase', () => ({
    auth: {},
    googleProvider: {},
}));

describe('useAuth Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('應初始化為 loading 狀態', () => {
        const { result } = renderHook(() => useAuth());
        expect(result.current.loading).toBe(true);
        expect(result.current.user).toBe(null);
    });

    it('應在登入成功後更新使用者狀態', async () => {
        const mockUser = { uid: '123', displayName: 'Test Teacher' };
        vi.mocked(signInWithPopup).mockResolvedValueOnce({ user: mockUser });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            const user = await result.current.login();
            expect(user).toEqual(mockUser);
        });
    });

    it('應在登出後清除使用者狀態', async () => {
        vi.mocked(signOut).mockResolvedValueOnce();
        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.logout();
        });

        expect(signOut).toHaveBeenCalled();
    });
});
