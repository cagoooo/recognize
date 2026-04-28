/**
 * ShareClassModal — 班級分享連結 Modal
 *  - 班導點班級頁的「🔗 分享」按鈕開啟
 *  - 顯示分享 URL（一鍵複製）
 *  - 顯示已加入的科任老師清單 + 移除按鈕
 *  - 重新產生 token（使舊連結失效）
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, RefreshCw, UserMinus, Link as LinkIcon, XCircle, Check, AlertTriangle } from 'lucide-react';
import { buildShareUrl } from '../lib/shareToken';

const ShareClassModal = ({ classData, onClose, onEnsureToken, onRegenerate, onRemoveTeacher }) => {
    const [token, setToken] = useState(classData?.shareToken || '');
    const [loading, setLoading] = useState(!classData?.shareToken);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const sharedWith = Array.isArray(classData?.sharedWith) ? classData.sharedWith : [];

    // Modal 開啟時若無 token 自動產一個
    useEffect(() => {
        if (token) return;
        let cancelled = false;
        (async () => {
            try {
                const t = await onEnsureToken();
                if (!cancelled) setToken(t);
            } catch (err) {
                if (!cancelled) setError(err.message || '產生分享連結失敗');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [token, onEnsureToken]);

    const shareUrl = token ? buildShareUrl(classData.id, token) : '';

    const handleCopy = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('複製失敗，請手動選取');
        }
    };

    const handleRegenerate = async () => {
        if (busy) return;
        if (!confirm('重新產生連結會讓舊連結失效。已加入的科任老師不受影響，但他們不能再用舊連結重新加入。確定？')) return;
        setBusy(true);
        setError(null);
        try {
            const t = await onRegenerate();
            setToken(t);
        } catch (err) {
            setError(err.message || '重新產生失敗');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (uid) => {
        if (busy) return;
        if (!confirm('要把這位老師從共享名單移除嗎？他將立即失去此班級存取權。')) return;
        setBusy(true);
        setError(null);
        try {
            await onRemoveTeacher(uid);
        } catch (err) {
            setError(err.message || '移除失敗');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="clay-card p-0 max-w-lg w-full relative flex flex-col overflow-hidden shadow-2xl"
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white px-6 py-5 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
                        <XCircle className="w-7 h-7" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                            <LinkIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">分享給科任老師</h2>
                            <p className="text-xs text-white/80 font-bold">
                                {classData?.name}　·　已分享給 {sharedWith.length} 位老師
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 bg-slate-50/60 flex flex-col gap-5">
                    {/* 分享連結區 */}
                    <div>
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">分享連結</p>
                        {loading ? (
                            <div className="h-12 rounded-xl bg-slate-200 animate-pulse" />
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={shareUrl}
                                    onClick={(e) => e.target.select()}
                                    className="flex-1 px-3 py-3 rounded-xl border-2 border-emerald-200 bg-white text-xs text-slate-700 font-mono tracking-tight"
                                />
                                <button
                                    onClick={handleCopy}
                                    className={`px-4 rounded-xl font-black text-sm flex items-center gap-1.5 transition-all flex-shrink-0 ${copied
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                        }`}
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? '已複製' : '複製'}
                                </button>
                            </div>
                        )}
                        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                            把連結傳給科任老師（LINE / Email 都行）。<br />
                            他們點擊後登入即可加入，能看學生資料 + 玩練習，但 <strong>無法編輯名單</strong>，戰績各自獨立。
                        </p>
                    </div>

                    {/* 已加入老師清單 */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">已加入的科任老師</p>
                            <span className="text-xs text-emerald-600 font-black">{sharedWith.length} 位</span>
                        </div>
                        {sharedWith.length === 0 ? (
                            <div className="rounded-xl bg-slate-100/60 border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-slate-400 font-bold">
                                尚未有科任老師加入
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {sharedWith.map(uid => (
                                    <li key={uid} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-200">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                                            {uid.slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className="flex-1 text-xs text-slate-700 font-mono truncate" title={uid}>
                                            {uid}
                                        </span>
                                        <button
                                            onClick={() => handleRemove(uid)}
                                            disabled={busy}
                                            className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 text-[11px] font-black hover:bg-rose-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <UserMinus className="w-3.5 h-3.5" />
                                            移除
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* 重新產生 */}
                    <div className="pt-2 border-t border-slate-200/70">
                        <button
                            onClick={handleRegenerate}
                            disabled={busy || loading}
                            className="w-full px-4 py-3 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-black flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className="w-4 h-4" />
                            重新產生連結（讓舊連結失效）
                        </button>
                    </div>

                    {/* 錯誤訊息 */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 flex items-start gap-2 text-xs text-rose-600 font-bold"
                            >
                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default ShareClassModal;
