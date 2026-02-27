import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Tag, Sparkles } from 'lucide-react';
import { useCachedPhoto } from '../hooks/useCachedPhoto';

/**
 * 快速預覽組件
 * @param {Object} student 學生資料
 * @param {boolean} isOpen 是否顯示
 */
const QuickPreview = ({ student, isOpen }) => {
    const photoSrc = useCachedPhoto(student?.id, student?.photoUrl);

    return (
        <AnimatePresence>
            {isOpen && student && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-indigo-950/40 backdrop-blur-md pointer-events-none"
                    style={{ WebkitBackdropFilter: 'blur(12px)' }}
                >
                    <motion.div
                        initial={{ scale: 0.8, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.8, y: 20, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="clay-card max-w-sm w-full bg-white/90 backdrop-blur-2xl border-4 border-white shadow-2xl overflow-hidden rounded-[48px]"
                    >
                        {/* 頂部縮放背景元件 */}
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent -z-10" />

                        {/* 照片區 */}
                        <div className="w-full aspect-square relative bg-slate-100">
                            {photoSrc ? (
                                <img
                                    src={photoSrc}
                                    className="w-full h-full object-cover"
                                    alt={student.name}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
                                    <User className="w-24 h-24 text-indigo-100" />
                                </div>
                            )}

                            {/* 座號膠囊 */}
                            {student.seatNumber && (
                                <div className="absolute bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-2xl font-black text-lg shadow-xl border-2 border-white/50">
                                    #{student.seatNumber}
                                </div>
                            )}
                        </div>

                        {/* 內容區 */}
                        <div className="p-8">
                            <h3 className="text-3xl font-black text-indigo-950 mb-4">{student.name}</h3>

                            {/* AI 記憶口訣 */}
                            {(student.description || student.aiHint) && (
                                <div className="bg-gradient-to-br from-indigo-50/50 to-white p-4 rounded-3xl border border-indigo-100/50 mb-5">
                                    <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-xs font-black uppercase tracking-widest">AI Memory Hint</span>
                                    </div>
                                    <p className="text-indigo-900/80 font-bold leading-relaxed">
                                        {student.description || student.aiHint}
                                    </p>
                                </div>
                            )}

                            {/* 標籤群 */}
                            {student.tags && student.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {student.tags.map(tag => (
                                        <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-black text-indigo-600 shadow-sm border border-indigo-50">
                                            <Tag className="w-3 h-3 text-indigo-300" />
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 提示：釋放以關閉 */}
                        <div className="bg-indigo-600/5 py-4 text-center">
                            <p className="text-indigo-400 font-bold text-xs animate-pulse">釋放按鍵以結束預覽</p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default QuickPreview;
