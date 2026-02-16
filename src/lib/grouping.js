/**
 * 智慧分組演算法 (Smart Grouping Algorithms)
 */

/**
 * 隨機分組 (Random Grouping)
 * @param {Array} students 學生列表
 * @param {number} groupSize 每組人數
 * @returns {Array} 分組結果 [[s1, s2], [s3, s4], ...]
 */
export const groupRandomly = (students, groupSize) => {
    const shuffled = [...students].sort(() => 0.5 - Math.random());
    const groups = [];
    for (let i = 0; i < shuffled.length; i += groupSize) {
        groups.push(shuffled.slice(i, i + groupSize));
    }
    return groups;
};

/**
 * 異質分組 (Heterogeneous Grouping) - S型排列
 * 依據 familiarScore (熟悉度) 高低排序，將強弱混合。
 * @param {Array} students 學生列表 (需包含 familiarScore 屬性)
 * @param {number} groupSize 每組人數
 */
export const groupHeterogeneously = (students, groupSize) => {
    // 依分數由高到低排序
    // 假設 familiarScore 為 0-100，若無則視為 0
    const sorted = [...students].sort((a, b) => (b.familiarScore || 0) - (a.familiarScore || 0));

    const numberOfGroups = Math.ceil(sorted.length / groupSize);
    const groups = Array.from({ length: numberOfGroups }, () => []);

    // S型分發 (Serpentine / Snake Distribution)
    // 讓每組的平均戰力平衡
    sorted.forEach((student, index) => {
        const round = Math.floor(index / numberOfGroups);
        const isEvenRound = round % 2 === 0;

        let targetGroupIndex;
        if (isEvenRound) {
            // 偶數輪：正向 (0 -> N)
            targetGroupIndex = index % numberOfGroups;
        } else {
            // 奇數輪：逆向 (N -> 0)
            targetGroupIndex = numberOfGroups - 1 - (index % numberOfGroups);
        }

        groups[targetGroupIndex].push(student);
    });

    return groups;
};

/**
 * 興趣分組 (Interest-based Grouping) - 同質性
 * 嘗試將有相同標籤 (Tags) 的人分在一起。
 * @param {Array} students 學生列表 (需包含 tags Array)
 * @param {number} groupSize 每組人數
 */
export const groupByInterest = (students, groupSize) => {
    // 1. 計算所有標籤的出現頻率
    const tagCounts = {};
    students.forEach(s => {
        (s.tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // 2. 定義學生與標籤的親和力 (Affinity)
    // 這裡使用簡單策略：優先處理擁有「稀有標籤」的學生，將其聚合
    // 或是簡化版：將學生依據「主標籤」分類，然後填入組別

    // 實作簡化版：依照「擁有最多共同標籤」的邏輯貪婪分組
    // 但為了效能與穩定性，我們先採用「標籤聚類」的近似解：
    // 將學生依「第一個標籤」排序 (字串排序)，然後依序分組
    // 這能讓有相同標籤的人盡量在相鄰位置

    const sorted = [...students].sort((a, b) => {
        const tagA = (a.tags && a.tags[0]) || 'zzzz'; // 無標籤排最後
        const tagB = (b.tags && b.tags[0]) || 'zzzz';
        return tagA.localeCompare(tagB, 'zh-Hant');
    });

    // 接著直接切分 (雖然不是最佳解，但在 UI 上會有不錯的視覺效果：同標籤的人在一起)
    const groups = [];
    for (let i = 0; i < sorted.length; i += groupSize) {
        groups.push(sorted.slice(i, i + groupSize));
    }
    return groups;
};
