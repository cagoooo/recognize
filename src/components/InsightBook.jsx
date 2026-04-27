/**
 * InsightBook — 班級攻略本 Modal
 *  - 顯示高混淆 pair + AI 區分點 + 掌握度切換
 *  - 提供「產生 / 重新產生」按鈕（含進度條）
 *  - 顯示本月配額剩餘
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, Sparkles, CheckCircle2, AlertTriangle, Target, RefreshCw } from 'lucide-react';
import { useInsight } from '../hooks/useInsight';
import { getQuotaStatus, INSIGHT_CONFIG } from '../lib/insight';
import { useCachedPhoto } from '../hooks/useCachedPhoto';

const PairRow = ({ pair, students, onToggle }) => {
    const a = students.find(s => s.id === pair.aId);
    const b = students.find(s => s.id === pair.bId);
    const photoA = useCachedPhoto(pair.aId, a?.photoUrl);
    const photoB = useCachedPhoto(pair.bId, b?.photoUrl);

    const simPct = Math.round(pair.similarity * 100);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative rounded-3xl border-2 p-4 md:p-5 flex items-center gap-3 md:gap-4 transition-all ${pair.mastered
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-white border-rose-100 hover:border-rose-200'
                }`}
        >
            {/* 學生 A */}
            <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-100">
                    {photoA ? (
                        <img src={photoA} alt={pair.aName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-indigo-100" />
                    )}
                </div>
                <span className="text-xs font-black text-indigo-900 mt-1 truncate max-w-[80px]">{pair.aName}</span>
            </div>

            {/* 中央 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black tracking-wider">
                        相似度 {simPct}%
                    </span>
                    {pair.mastered && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 已掌握
                        </span>
                    )}
                </div>
                <p className="text-sm md:text-base font-bold text-slate-800 leading-snug line-clamp-3">
                    {pair.distinguishingPoint}
                </p>
            </div>

            {/* 學生 B */}
            <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-100">
                    {photoB ? (
                        <img src={photoB} alt={pair.bName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-indigo-100" />
                    )}
                </div>
                <span className="text-xs font-black text-indigo-900 mt-1 truncate max-w-[80px]">{pair.bName}</span>
            </div>

            {/* 掌握 toggle */}
            <button
                onClick={() => onToggle(pair.aId, pair.bId)}
                className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${pair.mastered
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-200'
                    : 'bg-white text-slate-300 border-slate-200 hover:text-emerald-500 hover:border-emerald-200'
                    }`}
                title={pair.mastered ? '取消掌握' : '標記為已掌握'}
            >
                <CheckCircle2 className="w-7 h-7" />
            </button>
        </motion.div>
    );
};

const InsightBook = ({ classId, teacherUid, students, onClose }) => {
    const { insight, loading, generating, progress, generateAndSave, toggleMastery } = useInsight(classId, teacherUid);
    const [error, setError] = useState(null);
    const [filterMode, setFilterMode] = useState('pending'); // pending | all | mastered

    const quota = getQuotaStatus();
    const quotaPct = Math.round((quota.used / quota.limit) * 100);

    const handleGenerate = async () => {
        setError(null);
        try {
            const result = await generateAndSave(students);
            if (result.reason && result.pairs.length === 0) {
                setError(result.reason);
            }
        } catch (err) {
            setError(err.message || '產生失敗');
        }
    };

    const filteredPairs = (insight?.pairs || []).filter(p => {
        if (filterMode === 'pending') return !p.mastered;
        if (filterMode === 'mastered') return p.mastered;
        return true;
    });

    const masteredCount = insight?.pairs?.filter(p => p.mastered).length || 0;
    const totalCount = insight?.pairs?.length || 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="clay-card p-0 max-w-4xl w-full relative flex flex-col overflow-hidden shadow-2xl h-[90vh] md:h-[85vh] md:max-h-[800px]"
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white px-6 py-5 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
                        <XCircle className="w-7 h-7" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black tracking-tight">班級攻略本</h2>
                            <p className="text-xs text-white/80 font-bold">高混淆 Pair × AI 區分點</p>
                        </div>
                    </div>

                    {totalCount > 0 && (
                        <div className="flex items-center gap-3 mt-3">
                            <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-emerald-400 transition-all"
                                    style={{ width: `${(masteredCount / totalCount) * 100}%` }}
                                />
                            </div>
                            <span className="text-xs font-black text-white">
                                {masteredCount}/{totalCount} 掌握
                            </span>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 bg-slate-50/50">
                    {loading && (
                        <div className="flex items-center justify-center py-20 text-indigo-400">
                            <div className="w-8 h-8 border-3 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    )}

                    {!loading && !insight && !generating && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Sparkles className="w-14 h-14 text-amber-400 mb-4" />
                            <h3 className="text-lg font-black text-indigo-950 mb-2">尚未產生攻略本</h3>
                            <p className="text-sm text-slate-500 font-bold mb-6 max-w-md">
                                AI 會自動兩兩比對學生，找出最容易搞混的組合與區分點。
                                <br />
                                <span className="text-xs text-slate-400">學生數：{students.length}　預估呼叫上限 {INSIGHT_CONFIG.MAX_PAIRS_PER_CLASS} 對</span>
                            </p>
                            <button
                                onClick={handleGenerate}
                                disabled={students.length < 2 || quota.used >= quota.limit}
                                className="btn-clay btn-clay-orange px-6 py-3 text-base flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles className="w-5 h-5" />
                                產生攻略本
                            </button>
                        </div>
                    )}

                    {generating && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                            <h3 className="text-lg font-black text-indigo-950 mb-1">
                                {progress?.phase === 'screening' && '前端粗篩中...'}
                                {progress?.phase === 'comparing' && `AI 比對中 ${progress.current}/${progress.total}`}
                                {progress?.phase === 'done' && '完成'}
                            </h3>
                            <p className="text-xs text-slate-500 font-bold">
                                {progress?.phase === 'screening' && '計算學生間視覺相似度...'}
                                {progress?.phase === 'comparing' && '請稍候，每對約 2-3 秒'}
                            </p>
                        </div>
                    )}

                    {!loading && insight && !generating && (
                        <>
                            {/* Filter */}
                            <div className="flex items-center gap-2 mb-4 sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md py-2 -mx-2 px-2 rounded-2xl">
                                {[
                                    { key: 'pending', label: '待掌握', count: totalCount - masteredCount },
                                    { key: 'mastered', label: '已掌握', count: masteredCount },
                                    { key: 'all', label: '全部', count: totalCount },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setFilterMode(opt.key)}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filterMode === opt.key
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-white text-indigo-600 border-2 border-indigo-100'
                                            }`}
                                    >
                                        {opt.label} ({opt.count})
                                    </button>
                                ))}
                                <div className="flex-1" />
                                <button
                                    onClick={handleGenerate}
                                    className="px-3 py-2 rounded-xl text-xs font-black bg-amber-500 text-white shadow-md flex items-center gap-1 hover:bg-amber-600"
                                    title="重新產生攻略本"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" /> 重新產生
                                </button>
                            </div>

                            {filteredPairs.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-sm font-bold">
                                    {filterMode === 'pending' && '🎉 全部已掌握！'}
                                    {filterMode === 'mastered' && '尚未標記任何已掌握'}
                                    {filterMode === 'all' && '本班無高混淆 pair'}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <AnimatePresence>
                                        {filteredPairs.map(p => (
                                            <PairRow
                                                key={`${p.aId}-${p.bId}`}
                                                pair={p}
                                                students={students}
                                                onToggle={toggleMastery}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}

                            {insight.skipped > 0 && (
                                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-bold flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>本月配額不足，省略 {insight.skipped} 對較低相似度的 pair。下月配額重置後可重新產生。</span>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-bold flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer: 配額顯示 */}
                <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-bold">本月 Gemini 配額</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-full transition-all ${quotaPct >= 90 ? 'bg-rose-500' : quotaPct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(quotaPct, 100)}%` }}
                        />
                    </div>
                    <span className={`font-black ${quotaPct >= 90 ? 'text-rose-600' : 'text-indigo-600'}`}>
                        {quota.used}/{quota.limit}
                    </span>
                </div>
            </motion.div>
        </div>
    );
};

export default InsightBook;
