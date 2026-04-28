/**
 * VersionBadge — 右下角版本徽章 + 新版可用 banner
 *  - 平時：顯示當前 build 版本（hover 看 commit / buildTime）
 *  - 偵測到新版：彈出底部 banner 邀請使用者更新
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useVersionCheck } from '../hooks/useVersionCheck';

const formatTime = (iso) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '-');
    } catch {
        return iso;
    }
};

const VersionBadge = () => {
    const { local, remote, hasUpdate, updating, applyUpdate } = useVersionCheck();

    return (
        <>
            {/* 右下角版本徽章 */}
            <div
                className="fixed bottom-3 right-3 z-[9999] select-none pointer-events-auto"
                title={
                    `當前版本：v${local.version} (${local.commit})\n` +
                    `Build：${formatTime(local.buildTime)}\n` +
                    (remote ? `伺服器：v${remote.version} (${remote.commit})` : '尚未取到伺服器版本')
                }
            >
                <div
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider backdrop-blur-md border shadow-md transition-all ${hasUpdate
                        ? 'bg-amber-500/90 text-white border-amber-300 animate-pulse'
                        : 'bg-white/70 text-indigo-600 border-indigo-100 hover:bg-white'
                        }`}
                >
                    v{local.version}
                    <span className="opacity-50 ml-1">·{local.commit}</span>
                </div>
            </div>

            {/* 新版 banner */}
            <AnimatePresence>
                {hasUpdate && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                        className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[90%]"
                    >
                        <div className="rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-amber-200 px-5 py-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-indigo-950 text-sm">有新版可用</p>
                                <p className="text-xs text-slate-500 font-bold truncate">
                                    {remote ? `v${remote.version} · ${remote.commit}` : ''}
                                </p>
                            </div>
                            <button
                                onClick={applyUpdate}
                                disabled={updating}
                                className="flex-shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black shadow-md hover:scale-105 transition-transform disabled:opacity-60 flex items-center gap-1.5"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} />
                                {updating ? '更新中...' : '立刻更新'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default VersionBadge;
