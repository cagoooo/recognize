import { describe, it, expect } from 'vitest';
import { filterStudents } from '../search';

describe('filterStudents', () => {
    const mockStudents = [
        { id: '1', name: '潘宥睿', seatNumber: '01' },
        { id: '2', name: '張小明', seatNumber: '02' },
        { id: '3', name: '李大華', seatNumber: '10' },
    ];

    it('應回傳所有學生當查詢字串為空時', () => {
        expect(filterStudents(mockStudents, '')).toEqual(mockStudents);
    });

    it('應能透過姓名搜尋', () => {
        const result = filterStudents(mockStudents, '潘');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('潘宥睿');
    });

    it('應能透過座號搜尋', () => {
        const result = filterStudents(mockStudents, '02');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('張小明');
    });

    it('應能進行不分大小寫與修正空白的搜尋', () => {
        const result = filterStudents(mockStudents, '  02  ');
        expect(result).toHaveLength(1);
        expect(result[0].seatNumber).toBe('02');
    });

    it('未找到匹配時應回傳空陣列', () => {
        expect(filterStudents(mockStudents, '不存在的學生')).toHaveLength(0);
    });
});
