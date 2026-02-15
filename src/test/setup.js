import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('../firebase', () => ({
    auth: {
        currentUser: null,
        onAuthStateChanged: vi.fn(),
    },
    db: {},
    storage: {},
    googleProvider: {},
}));
