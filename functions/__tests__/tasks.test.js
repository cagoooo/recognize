import { describe, expect, it } from 'vitest';
import { buildGeminiRequest, readGeminiResponse, validateRequest } from '../tasks.js';

const image = { data: 'aGVsbG8=', mimeType: 'image/jpeg' };

describe('validateRequest', () => {
    it('接受合法的單圖與雙圖任務', () => {
        expect(validateRequest('memoryAnchor', [image])).toBeNull();
        expect(validateRequest('describe', [image])).toBeNull();
        expect(validateRequest('compare', [image, image])).toBeNull();
    });

    it('拒絕不存在的任務，包含物件原型上的名稱', () => {
        expect(validateRequest('freeform', [image])).toBe('不支援的 AI 任務');
        expect(validateRequest('constructor', [image])).toBe('不支援的 AI 任務');
    });

    it('拒絕照片數量不符', () => {
        expect(validateRequest('compare', [image])).toBe('照片數量不正確');
        expect(validateRequest('describe', undefined)).toBe('照片數量不正確');
    });

    it('拒絕非圖片格式與過大的資料', () => {
        expect(validateRequest('describe', [{ ...image, mimeType: 'text/plain' }])).toBe('不支援的照片格式');
        expect(validateRequest('describe', [{ ...image, data: 'A'.repeat(2_000_001) }])).toBe('照片太大');
        expect(validateRequest('describe', [{ ...image, data: 'not base64!' }])).toBe('照片資料格式錯誤');
    });
});

describe('buildGeminiRequest', () => {
    it('提示詞在前、照片在後，比對任務要求 JSON', () => {
        const request = buildGeminiRequest('compare', [image, image]);
        expect(request.contents[0].parts[0].text).toContain('比較這兩張學生照片');
        expect(request.contents[0].parts).toHaveLength(3);
        expect(request.generationConfig.responseMimeType).toBe('application/json');
    });
});

describe('readGeminiResponse', () => {
    it('取出文字與結束原因', () => {
        const body = { candidates: [{ content: { parts: [{ text: ' 高馬尾 ' }] }, finishReason: 'STOP' }] };
        expect(readGeminiResponse(body)).toEqual({ text: '高馬尾', finishReason: 'STOP' });
    });

    it('被安全機制擋下時回傳空文字與原因', () => {
        const body = { promptFeedback: { blockReason: 'SAFETY' } };
        expect(readGeminiResponse(body)).toEqual({ text: '', finishReason: 'SAFETY' });
    });
});
