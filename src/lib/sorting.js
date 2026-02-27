/**
 * 自然排序工具 (Natural Sort Utilities)
 */

/**
 * 自然排序比較器
 * 適用於混合數字與文字的字串，例如 IMG_1.jpg, IMG_2.jpg, IMG_10.jpg
 * 以及帶有括號或後綴的情況：IMG_8865-1, IMG_8865-2
 * 
 * @param {string} a 
 * @param {string} b 
 * @returns {number}
 */
export const naturalSortComparator = (a, b) => {
    return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: 'base'
    });
};

/**
 * 對檔案對象陣列進行排序 (基於檔名)
 * @param {Array<File|Object>} files 包含 name 屬性的物件陣列
 * @returns {Array} 排序後的陣列
 */
export const sortFilesByNatural = (files) => {
    return [...files].sort((a, b) => naturalSortComparator(a.name, b.name));
};
