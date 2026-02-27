import { describe, it, expect } from 'vitest';
import { naturalSortComparator, sortFilesByNatural } from '../sorting';

describe('naturalSortComparator', () => {
    it('應正確排序基本數字檔名', () => {
        const files = ['IMG_10.jpg', 'IMG_1.jpg', 'IMG_2.jpg'];
        const sorted = [...files].sort(naturalSortComparator);
        expect(sorted).toEqual(['IMG_1.jpg', 'IMG_2.jpg', 'IMG_10.jpg']);
    });

    it('應正確處理帶有連字號或後綴的流水號', () => {
        const files = ['IMG_8865-2.JPG', 'IMG_8865-1.JPG', 'IMG_8865-10.JPG'];
        const sorted = [...files].sort(naturalSortComparator);
        expect(sorted).toEqual(['IMG_8865-1.JPG', 'IMG_8865-2.JPG', 'IMG_8865-10.JPG']);
    });

    it('應正確排序複雜格式', () => {
        const files = ['a10', 'a1', 'a2', 'b1', 'a11'];
        const sorted = [...files].sort(naturalSortComparator);
        expect(sorted).toEqual(['a1', 'a2', 'a10', 'a11', 'b1']);
    });

    it('不應區分大小寫', () => {
        const files = ['img_1.jpg', 'IMG_1.jpg'];
        // 在 base sensitivity 下判定為相同，維持原順序或依實作而定
        // 這裡主要驗證不會因為大小寫導致排序混亂
        const sorted = ['b.jpg', 'A.jpg'].sort(naturalSortComparator);
        expect(sorted[0].toLowerCase()).toBe('a.jpg');
    });
});

describe('sortFilesByNatural', () => {
    it('應針對 File 物件陣列進行排序', () => {
        const mockFiles = [
            { name: 'IMG_8865-2.jpg' },
            { name: 'IMG_8865-1.jpg' },
            { name: 'IMG_8865-10.jpg' }
        ];
        const sorted = sortFilesByNatural(mockFiles);
        expect(sorted[0].name).toBe('IMG_8865-1.jpg');
        expect(sorted[1].name).toBe('IMG_8865-2.jpg');
        expect(sorted[2].name).toBe('IMG_8865-10.jpg');
    });
});
