/**
 * 過濾學生名單
 * @param {Array} students 學生陣列
 * @param {string} query 搜尋字串 (姓名或座號)
 * @returns {Array} 過濾後的學生陣列
 */
export const filterStudents = (students, query) => {
    if (!query) return students;

    const lowerQuery = query.toLowerCase().trim();

    return students.filter(student => {
        const nameMatch = student.name?.toLowerCase().includes(lowerQuery);
        const seatMatch = String(student.seatNumber || "").toLowerCase().includes(lowerQuery);

        return nameMatch || seatMatch;
    });
};
