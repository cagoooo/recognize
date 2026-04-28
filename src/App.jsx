import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { auth, db, googleProvider } from './firebase';
import { useAuth } from './hooks/useAuth';
import { filterStudents } from './lib/search';
import { groupRandomly, groupHeterogeneously, groupByInterest } from './lib/grouping';
import { sortFilesByNatural } from './lib/sorting';
import { exportClassBackup, importClassBackup } from './lib/backup';
import {
    Users,
    Play,
    Trophy,
    LogOut,
    LogIn,
    GraduationCap,
    Sparkles,
    ChevronRight,
    Plus,
    ArrowLeft,
    Camera,
    UserPlus,
    Gamepad2,
    Heart,
    Target,
    Trash2,
    Search,
    Tag,
    FileSpreadsheet,
    Images,
    User,
    Hash,
    Zap,
    ArrowRight,
    Upload,
    Download,
    Info,
    RotateCcw,
    XCircle,
    AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClasses, useStudents, joinClassByShareLink } from './hooks/useStore';
import { consumeJoinToken } from './lib/shareToken';
import { useGeminiVision } from './hooks/useGeminiVision';
import { useCachedPhoto } from './hooks/useCachedPhoto';
import { useLongPress } from './hooks/useLongPress';
import QuickPreview from './components/QuickPreview';
import GameMode from './components/GameMode';
import StatsView from './components/StatsView';
import InsightBook from './components/InsightBook';
import VersionBadge from './components/VersionBadge';
import ShareClassModal from './components/ShareClassModal';

const App = () => {
    const { user, loading, login, logout } = useAuth();
    const [activeView, setActiveView] = useState('home');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [gameState, setGameState] = useState({ active: false, classId: null, className: '', targetStudents: [], allStudents: [] });
    const [joinNotice, setJoinNotice] = useState(null); // { type: 'success'|'error', message }
    const pendingJoinRef = useRef(null);

    // --- Header Idle Logic ---
    const [isHeaderActive, setIsHeaderActive] = useState(true);
    const headerTimeoutRef = useRef(null);

    const resetHeaderTimer = () => {
        setIsHeaderActive(true);
        if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current);
        headerTimeoutRef.current = setTimeout(() => {
            setIsHeaderActive(false);
        }, 3000); // 3 seconds idle
    };

    useEffect(() => {
        resetHeaderTimer();
        return () => {
            if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 開機時消化 ?join=classId.token —— 暫存到 ref，等 user 登入後執行
    useEffect(() => {
        const parsed = consumeJoinToken();
        if (parsed) pendingJoinRef.current = parsed;
    }, []);

    // 一旦 user 出現 + 有 pending join，自動加入該班級
    useEffect(() => {
        if (!user || !pendingJoinRef.current) return;
        const { classId, token } = pendingJoinRef.current;
        pendingJoinRef.current = null;
        (async () => {
            try {
                const result = await joinClassByShareLink(classId, token, user.uid);
                if (result.alreadyOwner) {
                    setJoinNotice({ type: 'info', message: `「${result.name}」是你自己建立的班級` });
                } else if (result.alreadyJoined) {
                    setJoinNotice({ type: 'info', message: `已經加入過「${result.name}」` });
                } else {
                    setJoinNotice({ type: 'success', message: `已加入「${result.name}」班級！` });
                }
                setActiveView('manage');
            } catch (err) {
                console.error('Join failed:', err);
                setJoinNotice({ type: 'error', message: err.message || '加入失敗' });
            }
        })();
    }, [user]);

    // joinNotice 5 秒後自動消失
    useEffect(() => {
        if (!joinNotice) return;
        const t = setTimeout(() => setJoinNotice(null), 5000);
        return () => clearTimeout(t);
    }, [joinNotice]);

    const handleLogin = async () => {
        try {
            await login();
            setIsDropdownOpen(false);
        } catch (error) {
            // Error handled in hook or can add global toast here
        }
    };

    const handleLogout = () => {
        logout();
        setIsDropdownOpen(false);
        setActiveView('home');
    };

    const startTraining = (cls, targetStudents, allStudents = null, gameMode = 'classic') => {
        if (targetStudents.length < 1) {
            alert("該班級學生人數不足，無法開始練習");
            return;
        }
        setGameState({
            view: 'game',
            currentClass: cls,
            targetStudents: targetStudents,
            allStudents: allStudents || targetStudents,
            gameMode: gameMode
        });
        setActiveView('game');
    };

    const handleImportBackup = async (e) => {
        if (!user) return;
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Need a way to show progress globally, could reuse uploadProgress
            setUploadProgress({ current: 0, total: 100, filename: '解壓並還原資料中...' });
            setIsUploading(true);
            await importClassBackup(file, user.uid, (current, total, msg) => {
                setUploadProgress({ current, total, filename: msg });
            });
            alert('班級備份匯入成功！請重新整理或按回上一頁查看新班級。');
        } catch (error) {
            console.error("Import backup error:", error);
            alert(`匯入失敗: ${error.message}`);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <Sparkles className="w-16 h-16 text-indigo-500" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden flex flex-col items-center pb-20 overflow-x-hidden">
            <div className="aurora-bg">
                <div className="aurora-blob blob-1" />
                <div className="aurora-blob blob-2" />
                <div className="aurora-blob blob-3" />
                <div className="aurora-blob blob-4" />
            </div>

            <header
                className="fixed top-6 left-0 right-0 w-full px-4 flex justify-center pointer-events-none transition-all duration-1000"
                style={{
                    zIndex: 99999,
                    opacity: isHeaderActive ? 1 : 0.2,
                    transform: isHeaderActive ? 'translateY(0)' : 'translateY(-5px) scale(0.98)',
                    filter: isHeaderActive ? 'none' : 'blur(2px)'
                }}
                onMouseEnter={() => setIsHeaderActive(true)}
                onMouseLeave={resetHeaderTimer}
            >
                <div className="nav-capsule pointer-events-auto relative shadow-2xl" style={{ zIndex: 100000 }}>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="brand-section cursor-pointer relative z-[10002]"
                        onClick={() => {
                            setActiveView('home');
                            setIsHeaderActive(true);
                        }}
                    >
                        <div className="brand-logo-clay relative overflow-hidden group">
                            <GraduationCap className="text-white w-6 h-6 relative z-10" />
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex flex-col items-start leading-none">
                            <h1 className="text-xl font-black text-indigo-950 tracking-tight">識生學坊</h1>
                            <span className="text-[9px] uppercase tracking-[0.2em] text-indigo-500 font-bold opacity-80">Teacher Intelligence</span>
                        </div>
                    </motion.div>

                    {user && (
                        <>
                            <div className="w-[1px] h-8 bg-indigo-200/50 mx-2 hidden sm:block" />
                            <div className="relative" ref={dropdownRef}>
                                <motion.img
                                    whileTap={{ scale: 0.9 }}
                                    src={user.photoURL}
                                    alt="Avatar"
                                    className="user-avatar-trigger"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                />

                                <AnimatePresence>
                                    {isDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: 15, rotateX: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 15 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            className="user-dropdown-card"
                                        >
                                            {/* Dropdown Header */}
                                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-500 to-purple-600" />

                                            <div className="relative z-10 flex flex-col items-center gap-3 mb-6 mt-4">
                                                <div className="p-1 bg-white rounded-[36px] shadow-lg">
                                                    <img src={user.photoURL} className="w-20 h-20 rounded-[32px] object-cover border-4 border-indigo-50" alt="" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="font-black text-indigo-950 text-xl">{user.displayName}</p>
                                                    <div className="flex items-center justify-center gap-2 mt-1 px-3 py-1 bg-green-50 rounded-full w-fit mx-auto border border-green-100">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                                        <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Active Now</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 relative z-10 px-1">
                                                <button onClick={() => { setActiveView('stats'); setIsDropdownOpen(false); }} className="btn-clay-dropdown btn-clay-dropdown-indigo group">
                                                    <div className="dropdown-icon-box">
                                                        <Trophy className="w-5 h-5 text-indigo-600" />
                                                    </div>
                                                    <span className="text-lg tracking-wide">成長數據</span>
                                                </button>
                                                <button onClick={handleLogout} className="btn-clay-dropdown btn-clay-dropdown-rose group">
                                                    <div className="dropdown-icon-box">
                                                        <LogOut className="w-5 h-5 text-rose-600" />
                                                    </div>
                                                    <span className="text-lg tracking-wide">登出系統</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    )}

                    {!user && (
                        <button onClick={handleLogin} className="btn-clay btn-clay-primary py-3 px-8 text-sm font-black rounded-full ml-4 shadow-lg hover:shadow-xl transition-all">
                            登入
                        </button>
                    )}
                </div>
            </header>

            <main className="w-full max-w-5xl px-4 flex flex-col items-stretch relative z-10 pt-28 md:pt-32 pb-20 min-h-screen">
                {/* Spacer for Fixed Header (mobile only) */}
                <div className="w-full h-8 md:hidden" />
                {/* 撐滿剩餘視窗 + 垂直置中內容 */}
                <div className="flex-1 w-full flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">
                        {!user ? (
                            <HeroSection onLogin={handleLogin} key="hero" />
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full flex flex-col items-center"
                            >
                                {activeView === 'home' && <Dashboard onNavigate={setActiveView} key="dash" />}
                                {activeView === 'play' && <ClassManager userId={user.uid} mode="play" onBack={() => setActiveView('home')} onNavigate={setActiveView} onStartGame={startTraining} key="play" />}
                                {activeView === 'manage' && <ClassManager userId={user.uid} mode="manage" onBack={() => setActiveView('home')} onNavigate={setActiveView} onStartGame={startTraining} key="manage" />}
                                {activeView === 'game' && <GameMode targetStudents={gameState.targetStudents} allStudents={gameState.allStudents || []} className={gameState.currentClass ? gameState.currentClass.name : ''} gameMode={gameState.gameMode} onBack={() => setActiveView('home')} key="game" />}
                                {activeView === 'stats' && <StatsView userId={user.uid} onBack={() => setActiveView('home')} key="stats" />}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            <VersionBadge />

            {/* 班級加入結果 toast */}
            <AnimatePresence>
                {joinNotice && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[90%] pointer-events-none"
                    >
                        <div className={`px-5 py-3 rounded-2xl shadow-xl border-2 backdrop-blur-xl flex items-center gap-3 ${joinNotice.type === 'success' ? 'bg-emerald-500/95 border-emerald-300 text-white' :
                            joinNotice.type === 'error' ? 'bg-rose-500/95 border-rose-300 text-white' :
                                'bg-indigo-500/95 border-indigo-300 text-white'
                            }`}>
                            <span className="text-2xl">
                                {joinNotice.type === 'success' ? '🎉' : joinNotice.type === 'error' ? '⚠️' : 'ℹ️'}
                            </span>
                            <p className="font-black text-sm flex-1">{joinNotice.message}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const HeroSection = ({ onLogin }) => (
    <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative flex flex-col items-center text-center max-w-4xl mx-auto overflow-hidden md:overflow-visible px-4"
    >
        {/* Aurora Background Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none z-0">
            <div className="blob-shape bg-indigo-500 w-64 h-64 md:w-96 md:h-96 top-0 -left-10 md:-left-20 animate-blob mix-blend-multiply opacity-40" />
            <div className="blob-shape bg-rose-500 w-64 h-64 md:w-96 md:h-96 top-20 -right-10 md:-right-20 animate-blob animation-delay-2000 mix-blend-multiply opacity-40" />
            <div className="blob-shape bg-cyan-500 w-56 h-56 md:w-80 md:h-80 -bottom-20 left-10 md:left-20 animate-blob animation-delay-4000 mix-blend-multiply opacity-40" />
        </div>

        <div className="relative z-10 mb-12 md:mb-20 animate-bounce-slow">
            <div className="glass-hero-card w-40 h-40 md:w-56 md:h-56 flex items-center justify-center p-6 md:p-8 glow-primary transform hover:scale-105 transition-transform duration-500">
                <Users className="w-full h-full text-indigo-600 drop-shadow-lg" />
                <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-4 -right-4 md:-top-6 md:-right-6 w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-orange-400 to-rose-500 rounded-[20px] md:rounded-[24px] shadow-xl flex items-center justify-center text-white border-4 border-white"
                >
                    <Sparkles className="w-7 h-7 md:w-10 md:h-10" />
                </motion.div>
            </div>
        </div>

        <h2 className="relative z-10 text-[clamp(2.5rem,8vw,5rem)] font-black text-indigo-950 mb-6 md:mb-8 leading-[1.1] tracking-tight">
            <span className="text-gradient-aurora drop-shadow-sm">識生</span>，不僅是記憶<br className="hidden md:block" />
            <span className="block md:inline text-[clamp(1.5rem,4vw,2.5rem)] text-slate-700 mt-2 md:mt-0">更是感知的藝術</span>
        </h2>

        <p className="relative z-10 text-slate-500 text-[clamp(1rem,4vw,1.25rem)] font-bold mb-10 md:mb-14 max-w-2xl px-4 md:px-6 leading-relaxed backdrop-blur-sm rounded-2xl py-2">
            打破傳統名單的枯燥，融合 <span className="text-indigo-600">Claymorphism 3.0</span> 與<span className="text-rose-500">動態極光視覺</span>，為您的教職生涯注入充滿驚喜的互動靈魂。
        </p>

        <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -10px rgba(99, 102, 241, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogin}
            className="relative z-10 btn-clay btn-clay-primary text-xl md:text-2xl px-10 md:px-16 py-6 md:py-8 shadow-indigo-300 group overflow-hidden"
        >
            <span className="relative z-10 flex items-center">
                <Zap className="w-6 h-6 md:w-8 md:h-8 fill-white mr-2 md:mr-3 animate-pulse" /> 開始奇幻特訓
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute -top-3 -right-3 bg-rose-500 text-white text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full font-black animate-bounce shadow-lg border-2 border-white">
                PRO MAX
            </div>
        </motion.button>
    </motion.div>
);

const Dashboard = ({ onNavigate }) => (
    <div className="flex flex-col items-center gap-10 md:gap-14 w-full">
        <motion.div
            whileHover={{ y: -12, scale: 1.01 }}
            onClick={() => onNavigate('play')}
            className="clay-card clay-card-challenge border-none flex flex-col items-center cursor-pointer group max-w-md w-full mx-auto relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center w-full">
                <div className="card-icon-box bg-white/20 backdrop-blur-md border-4 border-white/20 shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                    <Target className="text-white w-12 h-12 drop-shadow-md" />
                </div>
                <h3 className="text-5xl font-black text-white mb-2 drop-shadow-lg tracking-tight">挑戰辨認</h3>
                <div className="h-1 w-24 bg-white/30 rounded-full mb-4 group-hover:w-32 transition-all duration-500" />
                <p className="text-indigo-100 font-bold mb-10 text-lg opacity-90 tracking-wider">高強度視覺訓練</p>

                <button className="bg-white text-indigo-700 px-14 py-6 rounded-[32px] font-black text-xl shadow-2xl flex items-center gap-3 group-hover:bg-indigo-50 transition-all group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] relative overflow-hidden">
                    <span className="relative z-10 flex items-center gap-2">
                        立即啟動 <ChevronRight className="w-6 h-6 animate-bounce-x" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
            </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 w-full max-w-3xl">
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => onNavigate('manage')}
                className="clay-card clay-card-emerald p-12 flex flex-col items-center cursor-pointer group glow-emerald max-w-sm w-full mx-auto"
            >
                <div className="card-icon-box bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white border-4 border-emerald-50">
                    <Users className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-indigo-950">班級編制</h3>
                <p className="text-slate-400 text-sm font-bold mt-3">建立您的黃金名單</p>
            </motion.div>

            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => onNavigate('stats')}
                className="clay-card clay-card-orange p-12 flex flex-col items-center cursor-pointer group glow-orange max-w-sm w-full mx-auto"
            >
                <div className="card-icon-box bg-orange-50 text-orange-500 group-hover:bg-orange-500 group-hover:text-white border-4 border-orange-50">
                    <Trophy className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-indigo-950">成長戰績</h3>
                <p className="text-slate-400 text-sm font-bold mt-3">追蹤進步曲線</p>
            </motion.div>
        </div>
    </div>
);

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "確定", cancelText = "取消", type = "danger" }) => (
    <AnimatePresence>
        {isOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onCancel}
                    className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="clay-card !p-8 max-w-sm w-full bg-white relative z-10 border-4 border-white shadow-2xl flex flex-col items-center text-center"
                >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
                        {type === 'danger' ? <Trash2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                    </div>

                    <h3 className="text-2xl font-black text-indigo-950 mb-2">{title}</h3>
                    <p className="text-slate-500 font-bold mb-8 leading-relaxed">{message}</p>

                    <div className="flex gap-4 w-full">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-100 transition-colors shadow-sm"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-4 rounded-2xl font-black text-sm text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-200'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);

const ClassManager = ({ userId, onBack, onStartGame, onNavigate, mode = 'manage' }) => {
    const { classes, addClass, deleteClass, ensureShareToken, regenerateShareToken, removeSharedTeacher } = useClasses(userId);
    const [shareModalClass, setShareModalClass] = useState(null);
    const [newClassName, setNewClassName] = useState('');
    const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const handleDeleteClass = (e, id, name) => {
        e.stopPropagation();
        setConfirmConfig({
            isOpen: true,
            title: '確定刪除班級？',
            message: `您即將刪除「${name}」班級，這將會移除該班級所有的學生資料與特訓紀錄，此動作不可復原。`,
            onConfirm: async () => {
                try {
                    await deleteClass(id);
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                } catch (err) {
                    console.error("Delete class failed:", err);
                    alert("刪除失敗，請稍後再試。");
                }
            }
        });
    };
    const [selectedClass, setSelectedClass] = useState(null);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, filename: '' });
    const [isUploading, setIsUploading] = useState(false);

    const handleImportBackup = async (e) => {
        if (!userId) return;
        const file = e.target.files[0];
        if (!file) return;

        try {
            setUploadProgress({ current: 0, total: 100, filename: '解壓並還原資料中...' });
            setIsUploading(true);
            const newClassId = await importClassBackup(file, userId, (current, total, msg) => {
                setUploadProgress({ current, total, filename: msg });
            });
            alert('班級備份匯入成功！系統將自動整理資料。');
        } catch (error) {
            console.error("Import backup error:", error);
            alert(`匯入失敗: ${error.message}`);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    if (selectedClass) {
        if (mode === 'play') {
            return (
                <QuickStart
                    cls={selectedClass}
                    onBack={() => setSelectedClass(null)}
                    onStartGame={(target, all, gameMode) => onStartGame(selectedClass, target, all, gameMode)}
                    onNavigate={onNavigate}
                />
            );
        }
        return (
            <StudentManager cls={selectedClass} userId={userId} onBack={() => setSelectedClass(null)} onStartGame={(target, all, gameMode) => onStartGame(selectedClass, target, all, gameMode)} uploadProps={{ isUploading, setIsUploading, uploadProgress, setUploadProgress }} />
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-7xl px-4 mx-auto">
            {/* Header Area */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="btn-icon-back !w-12 !h-12 !rounded-2xl shadow-sm">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-3xl font-black text-indigo-950 flex items-center gap-3">
                    <Users className="w-8 h-8 text-indigo-500" />
                    班級編制中心
                </h2>
                <div className="w-12" /> {/* Spacer */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                {/* Left Sidebar: Create & Import */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="clay-card clay-card-indigo p-6 text-white border-white/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <Sparkles className="w-6 h-6 text-yellow-300" />
                                <h3 className="text-xl font-black">建立班級</h3>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); if (newClassName.trim()) { addClass(newClassName); setNewClassName(''); } }} className="space-y-4">
                                <div className="relative">
                                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-400" />
                                    <input
                                        type="text"
                                        placeholder="例如：3年2班"
                                        className="w-full bg-white/10 border-2 border-white/20 rounded-2xl py-3 pl-12 pr-4 text-white font-bold placeholder:text-indigo-200 outline-none focus:border-white/50 transition-all text-sm"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                    />
                                </div>
                                <button type="submit" className="w-full py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 group">
                                    <Zap className="w-4 h-4" /> 快速建立
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="clay-card p-6 bg-indigo-50/50 border-2 border-indigo-100 flex flex-col gap-4">
                        <h4 className="font-black text-indigo-900 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-indigo-500" />
                            資料還原
                        </h4>
                        <p className="text-xs text-slate-400 font-bold leading-relaxed">
                            從 ZIP 備份檔恢復班級名單與學生照片資料。
                        </p>
                        <label className="btn-clay btn-clay-primary !py-3 !px-4 !rounded-2xl !text-xs w-full cursor-pointer text-center">
                            從 ZIP 匯入備份
                            <input type="file" className="hidden" accept=".zip" onChange={handleImportBackup} />
                        </label>
                    </div>
                </div>

                {/* Right Area: Class Grid */}
                <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">
                            現有班級列表 ({classes.length})
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {classes.map((cls, index) => (
                            <motion.div
                                key={cls.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ y: -5 }}
                                onClick={() => setSelectedClass(cls)}
                                className="clay-card p-6 flex flex-col items-center cursor-pointer w-full relative group transition-all border-4 border-white hover:border-indigo-100 shadow-sm"
                            >
                                {/* 共享進來的班級不顯示刪除按鈕 + 顯示共享徽章 */}
                                {cls._isShared ? (
                                    <span
                                        className="absolute top-3 right-3 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-[9px] font-black tracking-wider z-20 border border-emerald-300/50"
                                        title="此班級由其他老師分享給你（唯讀）"
                                    >
                                        🔗 共享
                                    </span>
                                ) : (
                                    <>
                                        <button
                                            onClick={(e) => handleDeleteClass(e, cls.id, cls.name)}
                                            className="absolute top-3 right-3 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-xl text-rose-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 shadow-sm"
                                            title="刪除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShareModalClass(cls); }}
                                            className="absolute top-3 left-3 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-xl text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 shadow-sm"
                                            title="分享給科任老師"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                        </button>
                                    </>
                                )}

                                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform duration-300 relative z-10 border-2 border-white">
                                    <GraduationCap className="text-indigo-500 w-8 h-8" />
                                </div>

                                <h3 className="text-xl font-black text-indigo-950 relative z-10">{cls.name}</h3>
                                {Array.isArray(cls.sharedWith) && cls.sharedWith.length > 0 && !cls._isShared && (
                                    <p className="text-[10px] text-emerald-600 font-bold mt-1 z-10 relative">
                                        已分享給 {cls.sharedWith.length} 位老師
                                    </p>
                                )}

                                <div className="mt-4 flex items-center gap-2 relative z-10 opacity-30 group-hover:opacity-100 transition-opacity">
                                    <span className="text-indigo-400 font-bold text-[10px] uppercase tracking-widest">Open Manager</span>
                                    <ArrowRight className="w-3 h-3 text-indigo-400" />
                                </div>
                            </motion.div>
                        ))}

                        {classes.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[48px] text-slate-300">
                                <Users className="w-16 h-16 mb-4 opacity-20" />
                                <p className="font-black text-xl">尚無班級資料</p>
                                <p className="text-sm font-bold mt-2">請從左側建立或匯入您的第一個班級</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Import Backup Loading Overlay */}
            {isUploading && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center border-4 border-indigo-100"
                    >
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Sparkles className="w-10 h-10 text-indigo-500 animate-spin-slow" />
                        </div>
                        <h3 className="text-2xl font-black text-indigo-950 mb-2">正在還原資料</h3>
                        <p className="text-slate-500 font-bold mb-6 text-sm">{uploadProgress.filename}</p>

                        {uploadProgress.total > 0 && typeof uploadProgress.total === 'number' && typeof uploadProgress.current === 'number' && (
                            <div className="w-full">
                                <div className="flex justify-between text-sm font-bold text-indigo-400 mb-2">
                                    <span>還原進度</span>
                                    <span>{uploadProgress.current} / {uploadProgress.total}</span>
                                </div>
                                <div className="w-full h-3 bg-indigo-50 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-indigo-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (uploadProgress.current / uploadProgress.total) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                confirmText="確認刪除"
            />

            <AnimatePresence>
                {shareModalClass && (() => {
                    // 從最新 classes 找對應 doc，避免 sharedWith 變動後 Modal 顯示 stale 資料
                    const live = classes.find(c => c.id === shareModalClass.id) || shareModalClass;
                    return (
                        <ShareClassModal
                            classData={live}
                            onClose={() => setShareModalClass(null)}
                            onEnsureToken={() => ensureShareToken(live.id)}
                            onRegenerate={() => regenerateShareToken(live.id)}
                            onRemoveTeacher={(uid) => removeSharedTeacher(live.id, uid)}
                        />
                    );
                })()}
            </AnimatePresence>
        </motion.div>
    );
};

const QuickStart = ({ cls, onBack, onStartGame, onNavigate }) => {
    const { students, loading } = useStudents(cls.id);
    const [errorStatus, setErrorStatus] = useState(null); // 'empty', 'insufficient'
    const [selectedMode, setSelectedMode] = useState('classic'); // 'classic', 'reverse', 'extreme'
    const [isPreparing, setIsPreparing] = useState(true);

    useEffect(() => {
        if (!loading) {
            if (students.length === 0) {
                setErrorStatus('empty');
                setIsPreparing(false);
            } else if (students.length < 4) {
                setErrorStatus('insufficient');
                setIsPreparing(false);
            } else {
                // 不再自動開始，讓使用者選模式
                setIsPreparing(false);
            }
        }
    }, [loading, students]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20">
                <motion.div
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                >
                    <Sparkles className="w-16 h-16 text-indigo-500" />
                </motion.div>
                <p className="mt-8 font-black text-indigo-950 text-xl">正在準備挑戰資料...</p>
                <p className="text-indigo-400 font-bold mt-2">{cls.name}</p>
            </div>
        );
    }

    if (errorStatus) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-10"
            >
                <div className="clay-card max-w-md p-12 flex flex-col items-center border-rose-100 bg-rose-50/10">
                    <div className="w-20 h-20 bg-rose-100 rounded-[30px] flex items-center justify-center mb-8 shadow-inner">
                        <Users className="w-10 h-10 text-rose-500" />
                    </div>
                    <h3 className="text-2xl font-black text-indigo-950 mb-4">
                        {errorStatus === 'empty' ? '班級名單空空如也' : '挑戰人數不足'}
                    </h3>
                    <p className="text-slate-500 font-bold mb-10 leading-relaxed">
                        {errorStatus === 'empty'
                            ? '「' + cls.name + '」目前還沒有任何學生資料，請先前往管理介面匯入名單。'
                            : '為了確保練習品質，「' + cls.name + '」至少需要 4 位學生才能啟動練習模式。'}
                    </p>
                    <div className="flex flex-col w-full gap-4">
                        <button
                            onClick={() => onNavigate('manage')}
                            className="btn-clay btn-clay-primary w-full py-5 text-lg"
                        >
                            前往學員管理
                        </button>
                        <button
                            onClick={onBack}
                            className="btn-glass-secondary w-full py-4 text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" /> 返回選擇班級
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    const modes = [
        { id: 'classic', name: '經典模式', desc: '看照片猜姓名，最穩健的基礎特訓', icon: <Users className="w-5 h-5" />, color: 'bg-indigo-600' },
        { id: 'reverse', name: '反向挑戰', desc: '看姓名找照片，考驗連結記憶', icon: <ArrowLeft className="w-5 h-5" />, color: 'bg-emerald-600' },
        { id: 'extreme', name: '極限混淆', desc: '干擾項相似度極高，大師級挑戰', icon: <Sparkles className="w-5 h-5" />, color: 'bg-rose-600' }
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-10 w-full max-w-2xl mx-auto px-4"
        >
            <div className="clay-card w-full p-8 md:p-12">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onBack} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h3 className="text-2xl font-black text-indigo-950">選擇特訓模式</h3>
                        <p className="text-indigo-400 font-bold text-sm">目標班級：{cls.name}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 mb-10">
                    {modes.map((m) => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedMode(m.id)}
                            className={`flex items-center gap-5 p-6 rounded-[32px] border-4 transition-all text-left ${selectedMode === m.id
                                ? 'bg-indigo-50 border-indigo-200 shadow-xl'
                                : 'bg-white border-transparent hover:border-slate-100 shadow-md'
                                }`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${m.color} text-white`}>
                                {m.icon}
                            </div>
                            <div className="flex-1">
                                <p className={`font-black text-lg ${selectedMode === m.id ? 'text-indigo-950' : 'text-slate-700'}`}>{m.name}</p>
                                <p className="text-sm font-bold text-slate-400">{m.desc}</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-4 flex items-center justify-center ${selectedMode === m.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-200'}`}>
                                {selectedMode === m.id && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => onStartGame(students, students, selectedMode)}
                    className="btn-clay btn-clay-primary w-full py-6 text-xl flex items-center justify-center gap-3"
                >
                    <Trophy className="w-6 h-6" /> 啟動練習模式
                </button>
            </div>
        </motion.div>
    );
};

const StudentManager = ({ cls, userId, onBack, onStartGame }) => {
    const isShared = !!cls._isShared; // 共享進來的班級 → 唯讀
    const { students, addStudent, batchAddStudents, updateStudentPhoto, deleteStudent, updateStudentTags, updateStudentDescription, recropStudentPhoto } = useStudents(cls.id);
    const [showInsightBook, setShowInsightBook] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSeatNumber, setNewSeatNumber] = useState('');
    const [photoFile, setPhotoFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, filename: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [tagFilter, setTagFilter] = useState('all');
    const [editingTagsStudent, setEditingTagsStudent] = useState(null);
    const [showImportHelp, setShowImportHelp] = useState(false); // New state for help toggle
    const studentListRef = useRef(null);

    const scrollToStudentList = () => {
        setTimeout(() => {
            studentListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    // 流水號配對預覽 State
    const [sequentialPreview, setSequentialPreview] = useState(null);
    // sequentialPreview: {pairs: [{file, student}], unmatchedFiles: File[] } | null

    // Grouping State
    const [showGroupingModal, setShowGroupingModal] = useState(false);
    const [groupingStrategy, setGroupingStrategy] = useState('random'); // random, hetero, interest
    const [groupSize, setGroupSize] = useState(4);
    const [groups, setGroups] = useState([]);

    // 預覽狀態
    const [previewingStudent, setPreviewingStudent] = useState(null);

    // 收集所有標籤
    const allTags = React.useMemo(() => {
        const tags = new Set();
        students.forEach(s => s.tags?.forEach(t => tags.add(t)));
        return Array.from(tags);
    }, [students]);

    const filteredStudents = React.useMemo(() => {
        let result = filterStudents(students, searchQuery);
        if (tagFilter !== 'all') {
            result = result.filter(s => s.tags?.includes(tagFilter));
        }
        return result;
    }, [students, searchQuery, tagFilter]);

    const handleGroup = () => {
        let result = [];
        const targets = filteredStudents.length > 0 ? filteredStudents : students;

        if (groupingStrategy === 'random') {
            result = groupRandomly(targets, groupSize);
        } else if (groupingStrategy === 'hetero') {
            result = groupHeterogeneously(targets, groupSize);
        } else if (groupingStrategy === 'interest') {
            result = groupByInterest(targets, groupSize);
        }
        setGroups(result);
    };

    const handleDeleteStudent = async (id, name) => {
        if (confirm(`確定要將「${name}」從名單中移除嗎？`)) {
            try {
                await deleteStudent(id);
            } catch (err) {
                console.error("Delete student failed:", err);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newName.trim() || isUploading) return;
        setIsUploading(true);
        await addStudent(newName, photoFile, newSeatNumber);
        setNewName(''); setNewSeatNumber(''); setPhotoFile(null);
        setIsUploading(false);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // 映射數據：嘗試匹配姓名與班級座號
                const studentList = data.map(item => {
                    // 支援對應繁體/簡體/英文欄位
                    const name = item['姓名'] || item['Name'] || item['name'] || Object.values(item)[0];
                    const seatNumber = item['班級座號'] || item['座號'] || item['SeatNumber'] || item['seat'];
                    return { name, seatNumber: String(seatNumber || "") };
                }).filter(s => s.name);

                if (studentList.length > 0) {
                    if (confirm(`偵測到 ${studentList.length} 位學生，是否確認匯入？`)) {
                        setIsUploading(true);
                        await batchAddStudents(studentList);
                        setIsUploading(false);
                        alert(`成功匯入 ${studentList.length} 位學生！`);
                    }
                } else {
                    alert('未能偵測到有效的學生名單，請確保檔案包含「姓名」欄位。');
                }
            } catch (err) {
                console.error("File parsing error:", err);
                alert('檔案解析失敗，請確認檔案格式是否正確。');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = ''; // Reset input
    };

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        let matchedCount = 0;
        const matched = [];
        const unmatched = [];

        // ① 先嘗試語意匹配（姓名 / 座號）
        files.forEach((file) => {
            const fileName = file.name.split('.')[0].trim();
            const targetStudent = students.find(s =>
                s.name.trim() === fileName ||
                (s.seatNumber && String(s.seatNumber).trim() === fileName) ||
                fileName.includes(s.name.trim())
            );
            if (targetStudent) {
                matched.push({ file, student: targetStudent });
            } else {
                unmatched.push(file);
            }
        });

        // ② 判斷是否進入流水號模式
        // 條件：未匹配數量 > 50% 且至少有 2 張照片
        const unmatchedRatio = unmatched.length / files.length;
        if (files.length >= 2 && unmatchedRatio > 0.5 && students.length > 0) {
            // 流水號模式：依檔名自然排序 ↔ 依座號排序學生
            const sortedFiles = sortFilesByNatural(unmatched);
            const sortedStudents = [...students]
                .filter(s => !matched.some(m => m.student.id === s.id)) // 排除已匹配
                .sort((a, b) => {
                    const sa = parseInt(a.seatNumber) || 999;
                    const sb = parseInt(b.seatNumber) || 999;
                    return sa - sb;
                });

            const pairCount = Math.min(sortedFiles.length, sortedStudents.length);
            const pairs = Array.from({ length: pairCount }, (_, i) => ({
                file: sortedFiles[i],
                student: sortedStudents[i],
                previewUrl: URL.createObjectURL(sortedFiles[i]),
            }));
            const extraFiles = sortedFiles.slice(pairCount); // 超出學生數量的照片

            // 先執行語意匹配部分（如有）
            if (matched.length > 0) {
                setIsUploading(true);
                await Promise.all(matched.map(({ file, student }) =>
                    updateStudentPhoto(student.id, file).catch(err =>
                        console.error(`Upload failed for ${file.name}:`, err)
                    )
                ));
                setIsUploading(false);
                matchedCount = matched.length;
            }

            // 彈出流水號預覽 Modal
            setSequentialPreview({ pairs, extraFiles, prematched: matchedCount });
            e.target.value = '';
            return;
        }

        // ③ 純語意匹配模式（原有邏輯）
        setIsUploading(true);
        await Promise.all(matched.map(({ file, student }) =>
            updateStudentPhoto(student.id, file)
                .then(() => matchedCount++)
                .catch(err => console.error(`Upload failed for ${file.name}:`, err))
        ));
        setIsUploading(false);

        let message = `照片同步完成！\n✅ 成功匹配並更新：${matchedCount} 位`;
        if (unmatched.length > 0) {
            message += `\n❌ 未匹配成功：${unmatched.length} 位\n(${unmatched.slice(0, 5).map(f => f.name).join(', ')}${unmatched.length > 5 ? '...' : ''})`;
        }
        alert(message);
        e.target.value = '';
    };

    // 確認流水號配對並開始上傳
    const handleConfirmSequentialUpload = async () => {
        if (!sequentialPreview) return;
        const { pairs, prematched } = sequentialPreview;
        pairs.forEach(p => URL.revokeObjectURL(p.previewUrl));
        setSequentialPreview(null);
        setIsUploading(true);
        setUploadProgress({ current: 0, total: pairs.length, filename: '' });

        let successCount = 0;
        for (let i = 0; i < pairs.length; i++) {
            const { file, student } = pairs[i];
            setUploadProgress({ current: i + 1, total: pairs.length, filename: file.name });
            try {
                await updateStudentPhoto(student.id, file);
                successCount++;
            } catch (err) {
                console.error(`流水號上傳失敗 ${file.name}:`, err);
            }
        }
        setIsUploading(false);
        setUploadProgress({ current: 0, total: 0, filename: '' });

        alert(`🎉 照片同步完成！\n✅ 流水號配對上傳：${successCount} 位${prematched > 0 ? `\n✅ 語意匹配上傳：${prematched} 位` : ''}`);
    };

    const handleExportBackup = async () => {
        if (students.length === 0) {
            alert('班級沒有學生資料可供匯出。');
            return;
        }
        try {
            setIsUploading(true);
            setUploadProgress({ current: 0, total: 0, filename: '正在收集影像與打包ZIP備份中...' });
            await exportClassBackup(cls.id, cls.name, students);
        } catch (error) {
            console.error("Export backup failed:", error);
            alert(`匯出備份失敗: ${error.message}`);
        } finally {
            setIsUploading(false);
            setUploadProgress({ current: 0, total: 0, filename: '' });
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center w-full">
            {isShared && (
                <div className="w-full max-w-4xl mb-4 px-4">
                    <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 px-4 py-3 flex items-center gap-3">
                        <span className="text-2xl">🔗</span>
                        <p className="text-xs text-emerald-700 font-bold leading-relaxed flex-1">
                            這是其他老師分享給你的班級（唯讀）。<br />
                            你可以查看名單、玩練習、看自己的戰績，但無法編輯名單或上傳照片。
                        </p>
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between w-full max-w-4xl mb-12 px-4">
                <button onClick={onBack} className="btn-icon-back">
                    <ArrowLeft className="w-8 h-8" />
                </button>
                <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                        <h2 className="text-4xl font-black text-indigo-950">{cls.name}</h2>
                        <p className="text-indigo-400 font-black uppercase text-[10px] tracking-[0.4em] mt-2">Active Students: {students.length}</p>
                    </div>
                    {!isShared && (
                        <button onClick={handleExportBackup} className="btn-glass-pill flex items-center gap-2 text-indigo-600 hover:scale-105 transition-transform text-sm px-4 py-1">
                            <Download className="w-4 h-4" /> <span className="font-bold">匯出班級備份</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mb-12 mx-auto">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onStartGame(filteredStudents, students)}
                    disabled={filteredStudents.length < 1}
                    className={`btn-clay btn-clay-orange px-10 py-5 text-xl flex items-center ${filteredStudents.length < 1 ? 'opacity-50 grayscale cursor-not-allowed shadow-none' : 'pulse-primary'}`}
                >
                    <Gamepad2 className="w-6 h-6 mr-2" />
                    {tagFilter === 'all' ? '啟動全班練習' : `啟動「${tagFilter}」特訓`}
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowGroupingModal(true)}
                    className="btn-clay bg-indigo-500 text-white px-8 py-5 text-xl flex items-center shadow-lg border-2 border-indigo-400"
                >
                    <Users className="w-6 h-6 mr-2" />
                    分組助手
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowInsightBook(true)}
                    disabled={students.length < 2}
                    className={`btn-clay bg-gradient-to-br from-rose-500 to-pink-600 text-white px-8 py-5 text-xl flex items-center shadow-lg border-2 border-rose-400 ${students.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="AI 找出最容易混淆的學生 pair 與區分點"
                >
                    <Sparkles className="w-6 h-6 mr-2" />
                    攻略本
                </motion.button>
            </div>

            {/* 搜尋 與 篩選 (New UI) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-5xl mb-12 px-4 flex flex-col gap-6"
            >
                {/* Search Bar */}
                <div className="relative group w-full">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl md:rounded-[32px] opacity-20 blur-xl group-focus-within:opacity-40 transition-opacity duration-500" />
                    <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl md:rounded-[32px] border-2 border-indigo-100 shadow-clay-card flex items-center px-4 md:px-6 py-1 h-16 md:h-20 transition-all group-focus-within:scale-[1.02] group-focus-within:border-indigo-300">
                        <Search className="text-indigo-400 w-6 h-6 md:w-8 md:h-8 mr-3 md:mr-4" />
                        <input
                            type="text"
                            placeholder="搜尋學員姓名或座號..."
                            className="w-full bg-transparent border-none outline-none text-lg md:text-xl font-bold text-indigo-950 placeholder-indigo-300 h-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <Trash2 className="w-5 h-5 text-slate-400" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tag Filter (RWD Wrap) */}
                <div className="w-full pb-4 px-4 overflow-visible">
                    <div className="flex flex-wrap gap-3 justify-center">
                        <button
                            onClick={() => {
                                setTagFilter('all');
                                scrollToStudentList();
                            }}
                            className={`clay-pill ${tagFilter === 'all' ? 'active' : 'inactive'}`}
                        >
                            <Tag className="w-4 h-4" />
                            所有標籤
                        </button>

                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => {
                                    setTagFilter(tag);
                                    scrollToStudentList();
                                }}
                                className={`clay-pill ${tagFilter === tag ? 'active' : 'inactive'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${tagFilter === tag ? 'bg-white' : 'bg-indigo-400'}`} />
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {!isShared && (
            <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl mb-24 px-4">
                <div className="clay-card clay-card-create flex-1 p-8 md:p-12 relative overflow-hidden text-white">
                    {/* Decorative Background */}
                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-6 mb-10">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-lg border border-white/30 transform -rotate-6">
                                <UserPlus className="w-10 h-10 text-white drop-shadow-md" />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white leading-tight drop-shadow-sm">收編新戰友</h3>
                                <p className="text-indigo-100/80 font-bold text-sm tracking-[0.2em] mt-2 uppercase bg-white/10 px-3 py-1 rounded-full w-fit">Create Profile</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            <div className="flex flex-col sm:flex-row gap-5">
                                <div className="relative flex-[2] create-input-group">
                                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 w-6 h-6 z-10" />
                                    <input
                                        type="text"
                                        placeholder="姓名"
                                        className="clay-input-glass"
                                        value={newName} onChange={(e) => setNewName(e.target.value)} required
                                    />
                                </div>
                                <div className="relative flex-1 create-input-group">
                                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 w-6 h-6 z-10" />
                                    <input
                                        type="text"
                                        placeholder="座號"
                                        className="clay-input-glass"
                                        value={newSeatNumber} onChange={(e) => setNewSeatNumber(e.target.value)}
                                    />
                                </div>
                            </div>

                            <label className="group upload-zone-glass flex flex-col items-center justify-center gap-3 py-8 cursor-pointer relative overflow-hidden">
                                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-white/20 relative z-10">
                                    <Camera className="w-7 h-7 text-white" />
                                </div>
                                <span className="text-white font-bold text-sm opacity-90 group-hover:opacity-100 relative z-10 tracking-wider">
                                    {photoFile ? <span className="text-emerald-300 flex items-center gap-2 bg-emerald-900/30 px-3 py-1 rounded-lg">✅ {photoFile.name}</span> : '上傳大頭照 (選填)'}
                                </span>
                                <input type="file" className="hidden" onChange={(e) => setPhotoFile(e.target.files[0])} accept="image/*" />
                            </label>

                            <button
                                type="submit"
                                disabled={isUploading}
                                className="bg-white text-indigo-600 hover:bg-indigo-50 hover:scale-[1.02] active:scale-95 transition-all duration-300 h-20 text-xl font-black w-full shadow-xl rounded-[28px] mt-2 relative overflow-hidden group/btn flex items-center justify-center gap-3"
                            >
                                {isUploading ? (
                                    <span className="animate-pulse">上傳中...</span>
                                ) : (
                                    <>
                                        <div className="bg-indigo-100 p-2 rounded-xl relative z-10">
                                            <UserPlus className="w-6 h-6 text-indigo-600" />
                                        </div>
                                        <span className="relative z-10">確認加入</span>
                                    </>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-100/50 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                            </button>
                        </form>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Excel Card - Vibrant Green */}
                        <label className="clay-card clay-card-green group cursor-pointer p-8 flex flex-col items-center justify-center gap-4 h-full min-h-[220px]">
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />

                            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 relative z-10">
                                <FileSpreadsheet className="w-10 h-10 text-emerald-600 group-hover:text-emerald-500" />
                            </div>

                            <div className="text-center relative z-10">
                                <h3 className="text-2xl font-black text-emerald-900 group-hover:text-emerald-700 transition-colors">匯入名單</h3>
                                <p className="text-emerald-600/80 font-bold text-xs uppercase tracking-widest mt-2 bg-white/60 px-3 py-1 rounded-full">Excel / CSV</p>
                            </div>

                            {/* Hover Decorative Icon */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-20 transition-opacity duration-500 transform translate-x-4 group-hover:translate-x-0">
                                <Sparkles className="w-12 h-12 text-emerald-500" />
                            </div>
                        </label>

                        {/* Photo Card - Vibrant Sky Blue */}
                        <label className="clay-card clay-card-sky group cursor-pointer p-8 flex flex-col items-center justify-center gap-4 h-full min-h-[220px]">
                            <input type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" multiple />

                            <div className="w-20 h-20 bg-sky-100 rounded-3xl flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 relative z-10">
                                <Images className="w-10 h-10 text-sky-600 group-hover:text-sky-500" />
                            </div>

                            <div className="text-center relative z-10">
                                <h3 className="text-2xl font-black text-sky-900 group-hover:text-sky-700 transition-colors">匯入照片</h3>
                                <p className="text-sky-600/80 font-bold text-xs uppercase tracking-widest mt-2 bg-white/60 px-3 py-1 rounded-full">Batch Upload</p>
                            </div>

                            {/* Hover Decorative Icon */}
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-20 transition-opacity duration-500 transform translate-x-4 group-hover:translate-x-0">
                                <Camera className="w-12 h-12 text-sky-500" />
                            </div>
                        </label>
                    </div>

                    {/* Import Instructions (Collapsible) */}
                    <div className="w-full max-w-4xl mx-auto mt-6 px-4">
                        <button
                            onClick={() => setShowImportHelp(!showImportHelp)}
                            className="btn-glass-pill mx-auto mb-6"
                        >
                            <Info className="w-4 h-4" />
                            <span>{showImportHelp ? '隱藏匯入說明' : '查看匯入格式說明'}</span>
                        </button>

                        <AnimatePresence>
                            {showImportHelp && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
                                        {/* List Format Guide */}
                                        <div className="clay-instruction-card clay-instruction-emerald">
                                            <h4 className="flex items-center mb-4">
                                                <div className="instruction-icon-box bg-emerald-100 text-emerald-600">
                                                    <FileSpreadsheet className="w-6 h-6" />
                                                </div>
                                                <span className="font-black text-emerald-900 text-lg">匯入名單規範</span>
                                            </h4>

                                            <div className="flex flex-col gap-3 text-sm text-emerald-900/80 font-bold">
                                                <div className="flex items-center flex-wrap gap-2">
                                                    <span className="opacity-70">🔹 支援格式：</span>
                                                    <span className="instruction-tag bg-emerald-100 text-emerald-700">.xlsx</span>
                                                    <span className="instruction-tag bg-emerald-100 text-emerald-700">.csv</span>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <span className="opacity-70">🔹 必填欄位 (標頭)：</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="instruction-tag bg-emerald-500 text-white shadow-emerald-200/50">姓名</span>
                                                        <span className="instruction-tag bg-emerald-500 text-white shadow-emerald-200/50">座號</span>
                                                        <span className="instruction-tag bg-slate-100 text-slate-500 border-slate-200">學號 (選填)</span>
                                                    </div>
                                                </div>

                                                <div className="mt-2 p-3 bg-yellow-50/50 border-2 border-yellow-100 rounded-2xl flex items-start gap-2">
                                                    <div className="mt-0.5 min-w-[16px]">⚠️</div>
                                                    <p className="text-xs text-yellow-700 leading-relaxed opacity-90">若使用 CSV，請確認編碼為 <span className="font-black">UTF-8</span> 以避免亂碼。</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Photo Format Guide */}
                                        <div className="clay-instruction-card clay-instruction-blue">
                                            <h4 className="flex items-center mb-4">
                                                <div className="instruction-icon-box bg-blue-100 text-blue-600">
                                                    <Images className="w-6 h-6" />
                                                </div>
                                                <span className="font-black text-blue-900 text-lg">照片檔名規則</span>
                                            </h4>

                                            <div className="flex flex-col gap-3 text-sm text-blue-900/80 font-bold">
                                                <div className="flex items-center flex-wrap gap-2">
                                                    <span className="opacity-70">🔹 支援格式：</span>
                                                    <span className="instruction-tag bg-blue-100 text-blue-700">.jpg</span>
                                                    <span className="instruction-tag bg-blue-100 text-blue-700">.png</span>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <span className="opacity-70">🔹 模式一｜語意匹配：</span>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="bg-white/80 p-3 rounded-2xl border-2 border-blue-50 hover:border-blue-200 transition-colors shadow-sm">
                                                            <code className="text-blue-600 font-black text-lg block mb-1">座號_姓名.jpg</code>
                                                            <span className="text-xs text-slate-400 font-medium">例：01_王小明.jpg</span>
                                                        </div>
                                                        <div className="bg-white/80 p-3 rounded-2xl border-2 border-blue-50 hover:border-blue-200 transition-colors shadow-sm">
                                                            <code className="text-blue-600 font-black text-lg block mb-1">學號.jpg</code>
                                                            <span className="text-xs text-slate-400 font-medium">例：11001.jpg</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    <span className="opacity-70">⭐ 模式二｜流水號自動配對：</span>
                                                    <div className="bg-gradient-to-br from-sky-50 to-indigo-50 p-3 rounded-2xl border-2 border-sky-200 shadow-sm">
                                                        <code className="text-sky-600 font-black text-lg block mb-1">IMG_8860.jpg</code>
                                                        <span className="text-xs text-sky-700 font-bold leading-relaxed">
                                                            直接上傳相機原始流水號！系統自動依數字排序照片，並對應座號由小到大的學生，無需改檔名。
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {isUploading && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.6) 0%, rgba(168,85,247,0.5) 50%, rgba(14,165,233,0.5) 100%)', backdropFilter: 'blur(18px)' }}>
                            {/* 背景光暈裝飾 */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                    className="absolute -top-24 -left-24 w-72 h-72 rounded-full"
                                    style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, transparent 70%)' }} />
                                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                                    className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full"
                                    style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.45) 0%, transparent 70%)' }} />
                                <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.5, 0.25] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
                                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)' }} />
                            </div>
                            {/* 主卡片 */}
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0, y: 30 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                                className="relative w-full max-w-md bg-white rounded-[40px] overflow-hidden"
                                style={{ border: '6px solid rgba(255,255,255,0.9)', boxShadow: '0 40px 80px rgba(79,70,229,0.3), inset 0 2px 0 rgba(255,255,255,0.8)' }}
                            >
                                {/* 頂部彩虹通條 */}
                                <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6, #6366f1, #06b6d4)' }} />
                                <div className="p-7 sm:p-10 flex flex-col items-center gap-5">
                                    {/* 旋轉圖示 + 標題 */}
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="relative">
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center"
                                                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', boxShadow: '0 12px 30px rgba(99,102,241,0.4)' }}
                                            >
                                                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow" />
                                            </motion.div>
                                            <motion.div
                                                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                                                transition={{ duration: 1.8, repeat: Infinity }}
                                                className="absolute inset-0 rounded-2xl sm:rounded-3xl"
                                                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', filter: 'blur(12px)' }}
                                            />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-black text-indigo-950 text-xl sm:text-2xl tracking-tight">正在上傳照片</p>
                                            <p className="text-indigo-400 font-bold text-xs sm:text-sm mt-1 truncate max-w-[260px] sm:max-w-[320px]">
                                                {uploadProgress.filename || '壓縮並同步至雲端...'}
                                            </p>
                                        </div>
                                    </div>
                                    {/* 超大百分比 + 彩虹進度條 */}
                                    {uploadProgress.total > 0 && (
                                        <div className="w-full flex flex-col items-center gap-3">
                                            <motion.div
                                                key={Math.round((uploadProgress.current / uploadProgress.total) * 100)}
                                                initial={{ scale: 0.7, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className="font-black leading-none select-none"
                                                style={{
                                                    fontSize: 'clamp(3.5rem, 13vw, 5.5rem)',
                                                    background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 40%, #8b5cf6 70%, #06b6d4 100%)',
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                    backgroundClip: 'text',
                                                    filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.3))'
                                                }}
                                            >
                                                {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                                            </motion.div>
                                            <div className="flex items-center gap-2 text-sm font-black text-indigo-400 -mt-1">
                                                <span className="text-indigo-600 text-base">{uploadProgress.current}</span>
                                                <span className="opacity-40">/</span>
                                                <span>{uploadProgress.total} 張</span>
                                            </div>
                                            <div className="w-full h-5 sm:h-6 rounded-full overflow-hidden"
                                                style={{ background: 'linear-gradient(90deg, #e0e7ff, #ede9fe)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08)' }}>
                                                <motion.div
                                                    className="h-full rounded-full relative overflow-hidden"
                                                    initial={{ width: '0%' }}
                                                    animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                                    style={{ background: 'linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6, #6366f1, #06b6d4)', boxShadow: '0 0 16px rgba(139,92,246,0.6)' }}
                                                >
                                                    <motion.div
                                                        animate={{ x: ['-100%', '200%'] }}
                                                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                                                        className="absolute inset-0 w-1/3"
                                                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
                                                    />
                                                </motion.div>
                                            </div>
                                            <div className="flex gap-[5px] flex-wrap justify-center">
                                                {Array.from({ length: Math.min(uploadProgress.total, 24) }, (_, i) => {
                                                    const done = i < uploadProgress.current;
                                                    const active = i === uploadProgress.current - 1;
                                                    return (
                                                        <motion.div
                                                            key={i}
                                                            animate={active ? { scale: [1, 1.6, 1], opacity: [1, 0.6, 1] } : {}}
                                                            transition={{ duration: 0.6, repeat: active ? Infinity : 0 }}
                                                            className="w-2.5 h-2.5 rounded-full"
                                                            style={{
                                                                background: done ? `hsl(${210 + (i / Math.min(uploadProgress.total, 24)) * 150}, 80%, 60%)` : '#e0e7ff',
                                                                boxShadow: done ? '0 0 6px rgba(99,102,241,0.4)' : 'none'
                                                            }}
                                                        />
                                                    );
                                                })}
                                                {uploadProgress.total > 24 && (
                                                    <span className="text-[11px] text-indigo-300 font-bold self-center ml-1">+{uploadProgress.total - 24}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>
            )}


            <div ref={studentListRef} className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6 w-full max-w-7xl px-4 pb-20">
                {filteredStudents.map(student => (
                    <StudentCard
                        key={student.id}
                        student={student}
                        readOnly={isShared}
                        onEdit={() => !isShared && setEditingTagsStudent(student)}
                        onDelete={(id) => handleDeleteStudent(id, student.name)}
                        onLongPress={(std) => setPreviewingStudent(std)}
                    />
                ))}
            </div>

            {/* 快速預覽組件 (鬆開時清除狀態) */}
            <div onMouseUp={() => setPreviewingStudent(null)} onTouchEnd={() => setPreviewingStudent(null)}>
                <QuickPreview student={previewingStudent} isOpen={!!previewingStudent} />
            </div>

            {/* Grouping Modal */}
            <AnimatePresence>
                {showGroupingModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setShowGroupingModal(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white/90 backdrop-blur-xl rounded-[40px] p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/50"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-indigo-950">智慧分組助手</h3>
                                        <p className="text-indigo-400 font-bold text-sm">Smart Grouping</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowGroupingModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <XCircle className="w-8 h-8 text-slate-400" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="clay-card p-4 bg-indigo-50/50">
                                    <label className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2 block">分組策略</label>
                                    <select
                                        value={groupingStrategy}
                                        onChange={(e) => setGroupingStrategy(e.target.value)}
                                        className="w-full bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 font-bold text-indigo-900 outline-none focus:border-indigo-400"
                                    >
                                        <option value="random">🎲 隨機分組</option>
                                        <option value="hetero">⚡ 異質分組 (強弱混合)</option>
                                        <option value="interest">❤️ 興趣分組 (同標籤)</option>
                                    </select>
                                </div>
                                <div className="clay-card p-4 bg-indigo-50/50">
                                    <label className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2 block">每組人數</label>
                                    <input
                                        type="number"
                                        min="2"
                                        max="10"
                                        value={groupSize}
                                        onChange={(e) => setGroupSize(parseInt(e.target.value))}
                                        className="w-full bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 font-bold text-indigo-900 outline-none focus:border-indigo-400"
                                    />
                                </div>
                                <button
                                    onClick={handleGroup}
                                    className="btn-clay bg-indigo-600 text-white flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    <span className="text-lg">開始分組</span>
                                </button>
                            </div>

                            {/* Results */}
                            {groups.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {groups.map((group, idx) => (
                                        <div key={idx} className="clay-card p-4 border-2 border-indigo-50 hover:border-indigo-200 transition-colors">
                                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-indigo-50">
                                                <h4 className="font-black text-indigo-900 text-lg">第 {idx + 1} 組</h4>
                                                <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg text-xs font-bold">{group.length} 人</span>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {group.map(student => (
                                                    <div key={student.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-colors">
                                                        <img
                                                            src={student.photoUrl || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${student.name}`}
                                                            className="w-8 h-8 rounded-full object-cover bg-indigo-50"
                                                            alt=""
                                                        />
                                                        <span className="font-bold text-slate-700">{student.name}</span>
                                                        {student.tags && student.tags[0] && (
                                                            <span className="text-xs bg-slate-100 text-slate-500 px-1 rounded ml-auto">{student.tags[0]}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {groups.length === 0 && (
                                <div className="text-center py-20 opacity-50">
                                    <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                                    <p className="font-bold text-slate-400 text-xl">點擊「開始分組」產生結果</p>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 流水號配對預覽 Modal */}
            <AnimatePresence>
                {sequentialPreview && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white/95 backdrop-blur-xl rounded-[40px] p-8 max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-white/50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                                    <Images className="w-7 h-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-2xl font-black text-indigo-950">流水號照片配對</h3>
                                    <p className="text-indigo-400 font-bold text-sm">請確認配對結果後再上傳</p>
                                </div>
                                <div className="bg-sky-100 text-sky-700 px-4 py-2 rounded-2xl font-black text-lg">
                                    {sequentialPreview.pairs.length} 對
                                </div>
                            </div>

                            {/* Info Banner */}
                            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl px-5 py-3 mb-5 flex items-start gap-3">
                                <span className="text-lg mt-0.5">ℹ️</span>
                                <p className="text-sm text-amber-800 font-bold leading-relaxed">
                                    系統依照片的<span className="text-amber-600">數字流水號排序</span>，自動對應座號由小到大的學生。若順序有誤，請取消後改用「座號_姓名」格式命名。
                                </p>
                            </div>

                            {/* Preview Table */}
                            <div className="overflow-y-auto flex-1 rounded-2xl border-2 border-slate-100 mb-6">
                                <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-0 text-xs font-black text-slate-400 uppercase tracking-wider bg-slate-50 px-4 py-3 border-b border-slate-100">
                                    <span className="col-span-2">照片檔案</span>
                                    <span className="px-2">→</span>
                                    <span>學生</span>
                                </div>
                                {sequentialPreview.pairs.map(({ file, student, previewUrl }, idx) => (
                                    <div
                                        key={idx}
                                        className={`grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 px-4 py-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-b border-slate-50 last:border-0`}
                                    >
                                        {/* 縮圖 */}
                                        <img
                                            src={previewUrl}
                                            alt={file.name}
                                            className="w-12 h-12 rounded-xl object-cover border-2 border-sky-100 flex-shrink-0"
                                        />
                                        {/* 檔名 */}
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                                            <p className="text-xs text-slate-400 font-medium">#{idx + 1}</p>
                                        </div>
                                        {/* 箭頭 */}
                                        <ArrowRight className="w-5 h-5 text-indigo-300 flex-shrink-0" />
                                        {/* 學生資訊 */}
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-indigo-900 truncate">{student.name}</p>
                                            <p className="text-xs text-sky-500 font-bold">座號 {student.seatNumber || '-'}</p>
                                        </div>
                                    </div>
                                ))}
                                {sequentialPreview.extraFiles?.length > 0 && (
                                    <div className="px-4 py-3 bg-rose-50 border-t border-rose-100">
                                        <p className="text-xs text-rose-500 font-bold">⚠️ 以下 {sequentialPreview.extraFiles.length} 張照片超出學生人數，將不會上傳：{sequentialPreview.extraFiles.map(f => f.name).join(', ')}</p>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        sequentialPreview.pairs.forEach(p => URL.revokeObjectURL(p.previewUrl));
                                        setSequentialPreview(null);
                                    }}
                                    className="flex-1 py-4 rounded-[20px] border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all text-lg"
                                >
                                    取消
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleConfirmSequentialUpload}
                                    className="flex-[2] py-4 rounded-[20px] bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-lg shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 hover:shadow-xl transition-shadow"
                                >
                                    <Images className="w-6 h-6" />
                                    確認配對並上傳
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>


            {
                editingTagsStudent && (
                    <TagEditor
                        key={editingTagsStudent.id}
                        student={editingTagsStudent}
                        onClose={() => setEditingTagsStudent(null)}
                        onRecrop={() => recropStudentPhoto(editingTagsStudent.id, editingTagsStudent.photoUrl)}
                        onSave={async (tags, description, closeAfterSave = true) => {
                            try {
                                const updatePromises = [
                                    updateStudentTags(editingTagsStudent.id, tags)
                                ];
                                if (description !== undefined) {
                                    updatePromises.push(updateStudentDescription(editingTagsStudent.id, description));
                                }
                                await Promise.all(updatePromises);
                                if (closeAfterSave) {
                                    setEditingTagsStudent(null);
                                }
                                return true;
                            } catch (err) {
                                console.error("Save failed:", err);
                                alert("儲存失敗，請檢查網路連線");
                                return false;
                            }
                        }}
                    />
                )
            }

            <AnimatePresence>
                {showInsightBook && (
                    <InsightBook
                        classId={cls.id}
                        teacherUid={userId}
                        students={students}
                        onClose={() => setShowInsightBook(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div >
    );
};

const StudentCard = ({ student, onEdit, onDelete, onLongPress, readOnly = false }) => {
    const photoSrc = useCachedPhoto(student.id, student.photoUrl);

    // 整合長按交互（唯讀模式下點擊也只開預覽，不進編輯）
    const longPressProps = useLongPress(
        () => onLongPress(student),
        () => readOnly ? onLongPress(student) : onEdit(),
        { delay: 450 }
    );

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -8, scale: 1.05, zIndex: 20 }}
            className="flex flex-col items-center group relative cursor-pointer"
            {...longPressProps}
        >
            {/* Card Container - Pro Max Premium */}
            <div className="w-full aspect-[3/4] clay-card p-0 overflow-hidden relative border-4 border-white group-hover:border-indigo-200 shadow-clay-card group-hover:shadow-indigo-500/30 transition-all duration-300 rounded-[32px] bg-white/80 backdrop-blur-xl">

                {/* Action Buttons (Compact) — 唯讀模式不顯示 */}
                {!readOnly && (
                    <div className="absolute top-2 right-2 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(student.id); }}
                            className="btn-square-danger shadow-lg hover:scale-110 transition-transform bg-white/90 backdrop-blur-md"
                            title="移除"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Photo Area */}
                <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-purple-50 relative group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors duration-500">
                    {photoSrc ? (
                        <img src={photoSrc} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={student.name} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden pb-8">
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/50 via-white/20 to-purple-100/50 opacity-50" />
                            <div className="w-20 h-20 bg-white/40 backdrop-blur-md rounded-[24px] flex items-center justify-center mb-1 shadow-lg border border-white/50 group-hover:scale-110 transition-transform duration-500 z-10">
                                <User className="w-10 h-10 text-indigo-300 group-hover:text-indigo-500 transition-colors duration-300" />
                            </div>
                        </div>
                    )}

                    {/* Gradient Overlay & Info */}
                    <div className="absolute inset-x-0 bottom-0 p-4 pt-24 bg-gradient-to-t from-white via-white/95 to-transparent z-20">
                        <div className="flex flex-col items-center text-center">
                            <p className="text-indigo-950 font-black text-xl leading-tight drop-shadow-sm w-full truncate px-2 relative z-30">
                                {student.name}
                            </p>
                            {student.seatNumber && (
                                <span className="mt-2 px-3 py-1 bg-indigo-500 text-white rounded-full text-xs font-bold shadow-md shadow-indigo-200 uppercase tracking-wider relative z-30">
                                    #{student.seatNumber}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tags (Minimalist Pills) */}
                {student.tags && student.tags.length > 0 && (
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                        {student.tags.slice(0, 1).map(tag => (
                            <span key={tag} className="px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] font-black text-indigo-600 shadow-sm border border-indigo-50/50">
                                {tag}
                            </span>
                        ))}
                        {student.tags.length > 1 && <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center font-bold shadow-sm border-2 border-white">+{student.tags.length - 1}</span>}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Student Details & Tag Editor Modal
const TagEditor = ({ student, onClose, onSave, onRecrop }) => {
    const [recropping, setRecropping] = useState(false);
    const [recropResult, setRecropResult] = useState(null); // { ok, method, reason }
    const handleRecrop = async () => {
        if (!onRecrop || recropping) return;
        setRecropping(true);
        setRecropResult(null);
        try {
            const { cropMeta } = await onRecrop();
            setRecropResult({ ok: true, method: cropMeta?.method, reason: cropMeta?.reason });
        } catch (err) {
            console.error('Re-crop failed:', err);
            setRecropResult({ ok: false, reason: err.message || '重新裁切失敗' });
        } finally {
            setRecropping(false);
        }
    };
    const [tags, setTags] = useState(student.tags || []);
    const [description, setDescription] = useState(student.description || '');
    const [inputValue, setInputValue] = useState('');
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [showAiSuggestion, setShowAiSuggestion] = useState(false);
    const [pendingAiData, setPendingAiData] = useState(null);
    const [undoSnapshot, setUndoSnapshot] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const wheelTargetRef = useRef(null);
    const { generateDescription, loading: aiLoading, error: aiError, description: aiDescription, tags: aiTags } = useGeminiVision();

    const handleOpenLightbox = () => { setLightboxOpen(true); setZoom(1); setPan({ x: 0, y: 0 }); };
    const handleCloseLightbox = () => setLightboxOpen(false);
    const handleMouseDown = (e) => { setDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); };
    const handleMouseMove = (e) => { if (!dragging) return; setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
    const handleMouseUp = () => setDragging(false);
    const handleTouchStart = (e) => { const t = e.touches[0]; setDragging(true); setDragStart({ x: t.clientX - pan.x, y: t.clientY - pan.y }); };
    const handleTouchMove = (e) => { if (!dragging) return; const t = e.touches[0]; setPan({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y }); };

    // 用原生 addEventListener 綁定 wheel 事件（passive: false），避免 React passive listener 阻擋 preventDefault
    useEffect(() => {
        const el = wheelTargetRef.current;
        if (!el || !lightboxOpen) return;
        const onWheel = (e) => {
            e.preventDefault();
            setZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.002, 0.5), 6));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [lightboxOpen]);

    const handleAiGenerate = async () => {
        if (student.photoUrl) {
            await generateDescription(student.photoUrl);
        }
    };

    useEffect(() => {
        if (aiDescription || (aiTags && aiTags.length > 0)) {
            setPendingAiData({ description: aiDescription, tags: aiTags });
            setShowAiSuggestion(true);
        }
    }, [aiDescription, aiTags]);

    const applyAiSuggestion = (overwrite = false) => {
        if (!pendingAiData) return;

        // 保存當前狀態進快照以供撤銷
        setUndoSnapshot({ tags: [...tags], description });

        let nextTags = [...tags];
        let nextDescription = description;

        if (overwrite) {
            // 直接替換為 AI 內容
            nextDescription = pendingAiData.description || '';
            nextTags = pendingAiData.tags || [];
        } else {
            // 合併描述
            if (pendingAiData.description) {
                if (!nextDescription || !nextDescription.includes(pendingAiData.description)) {
                    nextDescription = nextDescription ? `${nextDescription}\n${pendingAiData.description}` : pendingAiData.description;
                }
            }

            // 合併標籤
            if (pendingAiData.tags && pendingAiData.tags.length > 0) {
                const newTags = pendingAiData.tags.filter(t => !nextTags.includes(t));
                nextTags = [...nextTags, ...newTags];
            }
        }

        // 更新本地 State
        setTags(nextTags);
        setDescription(nextDescription);
        setShowAiSuggestion(false);
        setPendingAiData(null);

        // 自動儲存：直接同步至 Firestore
        handleInternalSave(nextTags, nextDescription, false);
    };

    const handleInternalSave = async (t = tags, d = description, close = true) => {
        setIsSaving(true);
        const success = await onSave(t, d, close);
        setIsSaving(false);
        if (success) {
            setLastSaved(new Date());
        }
    };

    const handleUndo = () => {
        if (undoSnapshot) {
            setTags(undoSnapshot.tags);
            setDescription(undoSnapshot.description);
            setUndoSnapshot(null);
        }
    };

    const dismissAiSuggestion = () => {
        setShowAiSuggestion(false);
        setPendingAiData(null);
    };

    const addTag = () => {
        if (inputValue.trim() && !tags.includes(inputValue.trim())) {
            setTags([...tags, inputValue.trim()]);
            setInputValue('');
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="clay-card p-0 max-w-6xl w-full relative flex flex-col md:flex-row overflow-hidden shadow-2xl h-[90vh] md:h-[85vh] md:max-h-[800px]"
            >
                {/* Close Button Mobile/Desktop */}
                <button onClick={onClose} className="absolute top-4 right-4 z-50 text-slate-400 hover:text-rose-500 bg-white/50 backdrop-blur-sm p-2 rounded-full transition-colors">
                    <XCircle className="w-8 h-8" />
                </button>

                {/* Left: Photo Area */}
                <div className="w-full md:w-[45%] lg:w-[40%] bg-slate-900 relative flex items-center justify-center overflow-hidden group min-h-[30vh] md:min-h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 to-purple-900/20 z-0" />

                    {student.photoUrl ? (
                        <img
                            src={student.photoUrl}
                            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.03] cursor-zoom-in relative z-10"
                            alt={student.name}
                            onClick={handleOpenLightbox}
                            title="點擊放大檢視原圖"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-indigo-200">
                            <div className="w-32 h-32 mb-4 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <User className="w-16 h-16 opacity-50" />
                            </div>
                            <p className="font-bold text-lg opacity-60">無照片</p>
                        </div>
                    )}

                    {/* 放大提示按鈕 */}
                    {student.photoUrl && (
                        <button
                            onClick={handleOpenLightbox}
                            className="absolute top-3 left-3 z-20 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                            title="全螢幕檢視"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        </button>
                    )}

                    {/* 既有特徵疊加層 (繽紛明顯版 Pro Max) - 移到下方避免擋住臉 */}
                    {(description || (tags && tags.length > 0)) && (
                        <div className="absolute bottom-4 left-4 right-4 z-40 pointer-events-none md:bottom-8 md:left-8 md:right-8">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="relative group/overlay max-w-3xl mx-auto"
                            >
                                {/* 虹彩漸層邊框外發光層 */}
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000 animate-tilt"></div>

                                <div className="relative bg-black/40 backdrop-blur-xl rounded-[24px] p-5 border border-white/20 shadow-2xl overflow-hidden">
                                    {/* 背景裝飾光暈 */}
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl" />

                                    <div className="flex items-center justify-between mb-3 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-5 bg-gradient-to-b from-pink-400 to-indigo-600 rounded-full" />
                                            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em] drop-shadow-md">
                                                {isSaving ? '同步雲端中...' : (lastSaved ? '已同步至雲端' : '已存記憶特徵')}
                                            </span>
                                        </div>
                                        {isSaving ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                                        )}
                                    </div>
                                    {lastSaved && !isSaving && (
                                        <div className="absolute top-2 right-10 text-[9px] text-emerald-400 font-bold opacity-80">
                                            最後同步: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                    )}

                                    {description && (
                                        <p className="text-white text-sm font-bold leading-relaxed mb-4 line-clamp-4 drop-shadow-sm brightness-110">
                                            {description}
                                        </p>
                                    )}

                                    {tags && tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 relative z-10">
                                            {tags.map((t, idx) => {
                                                const colors = [
                                                    'bg-pink-500/80 text-white border-pink-400/50',
                                                    'bg-indigo-500/80 text-white border-indigo-400/50',
                                                    'bg-emerald-500/80 text-white border-emerald-400/50',
                                                    'bg-amber-500/80 text-white border-amber-400/50',
                                                    'bg-violet-500/80 text-white border-violet-400/50'
                                                ];
                                                return (
                                                    <span
                                                        key={t}
                                                        className={`px-3 py-1 rounded-lg text-[10px] font-black border-2 backdrop-blur-md shadow-sm transform hover:scale-105 transition-transform ${colors[idx % colors.length]}`}
                                                    >
                                                        #{t}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Overlay Info for Photo (Mobile Only) */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent text-white pt-20 md:hidden pointer-events-none z-20">
                        <h2 className="text-3xl font-black">{student.name}</h2>
                        {student.seatNumber && <p className="font-bold opacity-80">#{student.seatNumber}</p>}
                    </div>

                    {/* AI Generate Button & Undo Button */}
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 z-30 flex flex-col items-end gap-3">
                        <AnimatePresence>
                            {undoSnapshot && (
                                <motion.button
                                    initial={{ opacity: 0, x: 20, scale: 0.8 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 10, scale: 0.8 }}
                                    onClick={(e) => { e.stopPropagation(); handleUndo(); }}
                                    className="btn-glass-pill !bg-rose-500/90 !text-white shadow-lg border-2 border-rose-400/50 hover:bg-rose-600 transition-all flex items-center gap-2 group py-2 px-4"
                                >
                                    <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
                                    <span className="font-bold text-xs uppercase tracking-wider">撤銷 AI 套用</span>
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {student.photoUrl && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleAiGenerate(); }}
                                disabled={aiLoading}
                                className={`btn-glass-pill !bg-white/90 !backdrop-blur-xl shadow-lg border-2 border-indigo-100 text-indigo-600 hover:scale-105 transition-all
                  ${aiLoading ? 'opacity-80 cursor-wait' : ''}`}
                            >
                                {aiLoading ? (
                                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400" />
                                )}
                                <span className="font-bold">{aiLoading ? 'AI 觀察中...' : 'AI 記憶特徵'}</span>
                            </button>
                        )}

                        {student.photoUrl && onRecrop && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRecrop(); }}
                                disabled={recropping}
                                className={`btn-glass-pill !bg-white/90 !backdrop-blur-xl shadow-lg border-2 border-emerald-100 text-emerald-600 hover:scale-105 transition-all ${recropping ? 'opacity-80 cursor-wait' : ''}`}
                                title="用 AI 自動把照片對齊到人臉"
                            >
                                {recropping ? (
                                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <span className="text-lg">✂️</span>
                                )}
                                <span className="font-bold">{recropping ? '裁切中...' : '重新裁切'}</span>
                            </button>
                        )}
                    </div>

                    {/* 裁切狀態徽章 / 失敗提示 */}
                    {(student.cropMeta?.method === 'center' || (recropResult && !recropResult.ok) || (recropResult?.ok && recropResult.method === 'center')) && (
                        <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-6 z-30 pointer-events-none flex justify-center">
                            <div className="bg-amber-500/90 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg border border-amber-300/50 flex items-center gap-2">
                                <span>⚠️</span>
                                <span>{recropResult?.ok === false ? recropResult.reason : '未偵測到人臉，使用中央裁切'}</span>
                            </div>
                        </div>
                    )}
                    {recropResult?.ok && recropResult.method === 'face' && (
                        <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-6 z-30 pointer-events-none flex justify-center">
                            <div className="bg-emerald-500/90 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg border border-emerald-300/50 flex items-center gap-2">
                                <span>✓</span>
                                <span>已重新對齊人臉</span>
                            </div>
                        </div>
                    )}

                    {/* AI 建議疊加層 (直接在照片上作呈現) */}
                    <AnimatePresence>
                        {showAiSuggestion && pendingAiData && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="absolute inset-x-4 bottom-20 md:bottom-24 z-30 p-5 bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/50"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-amber-100 p-2 rounded-xl">
                                            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
                                        </div>
                                        <div>
                                            <span className="block font-black text-indigo-950 text-sm">AI 魔法觀察建議</span>
                                            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">AI Insight Results</span>
                                        </div>
                                    </div>
                                    <button onClick={dismissAiSuggestion} className="bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-500 p-1 rounded-full transition-colors">
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-3 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                                    {pendingAiData.description && (
                                        <div className="text-sm text-indigo-900 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/30 leading-relaxed font-medium">
                                            {pendingAiData.description}
                                        </div>
                                    )}
                                    {pendingAiData.tags && pendingAiData.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {pendingAiData.tags.map(t => (
                                                <span key={t} className="px-3 py-1 bg-amber-100/50 text-amber-700 rounded-lg text-[11px] font-black border border-amber-200/50">
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 mt-1">
                                    <button
                                        onClick={() => applyAiSuggestion(false)}
                                        className="flex-1 py-3 text-indigo-600 font-bold rounded-2xl border-2 border-indigo-50 bg-white hover:bg-indigo-50 transition-all active:scale-[0.98] text-xs shadow-sm"
                                        title="將 AI 觀察結果加到現有內容後方"
                                    >
                                        保留並合併
                                    </button>
                                    <button
                                        onClick={() => applyAiSuggestion(true)}
                                        className="flex-[1.5] py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                                        title="清除現有內容，改用 AI 觀察結果"
                                    >
                                        <Zap className="w-4 h-4 fill-white" />
                                        直接替換更新
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Lightbox */}
                {lightboxOpen && student.photoUrl && (
                    <div
                        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
                        onClick={handleCloseLightbox}
                    >
                        {/* 操作說明 */}
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-bold tracking-widest select-none">
                            滾輪縮放·拖曳平移·點擊空白關閉
                        </div>
                        {/* 关閉按鈕 */}
                        <button
                            onClick={handleCloseLightbox}
                            className="absolute top-4 right-4 z-10 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
                        >
                            <XCircle className="w-8 h-8" />
                        </button>
                        {/* 縮放重置按鈕 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setZoom(1); setPan({ x: 0, y: 0 }); }}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-sm font-bold transition-all"
                        >
                            重置 ({Math.round(zoom * 100)}%)
                        </button>
                        {/* 圖片區域 */}
                        <div
                            ref={wheelTargetRef}
                            className="w-full h-full flex items-center justify-center overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleMouseUp}
                            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                        >
                            <img
                                src={student.photoUrl}
                                alt={student.name}
                                draggable={false}
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transition: dragging ? 'none' : 'transform 0.15s ease',
                                    maxWidth: '90vw',
                                    maxHeight: '90vh',
                                    objectFit: 'contain',
                                    userSelect: 'none',
                                    pointerEvents: 'none'
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Right: Details & Tags */}
                <div className="w-full md:w-[55%] lg:w-[60%] flex flex-col bg-white/60 backdrop-blur-xl h-full overflow-hidden">

                    {/* Header (Fixed) */}
                    <div className="hidden md:block p-6 md:p-10 md:pb-4 flex-shrink-0">
                        <h2 className="text-4xl font-black text-indigo-950 mb-2">{student.name}</h2>
                        <div className="flex items-center gap-3">
                            {student.seatNumber && (
                                <span className="px-3 py-1 bg-indigo-500 text-white rounded-full text-sm font-bold shadow-md uppercase tracking-wider">
                                    #{student.seatNumber}
                                </span>
                            )}
                            <span className="text-slate-500 font-bold text-sm">學員詳情 & 標籤管理</span>
                        </div>
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-2 custom-scrollbar">
                        {/* AI Description Editor / Result */}
                        <div className="mb-6 flex-shrink-0 relative">
                            <h3 className="flex items-center gap-2 text-indigo-800 font-bold text-sm uppercase tracking-wide mb-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                AI 記憶口訣
                            </h3>

                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={aiLoading ? "AI 正在掃描照片特徵中..." : "點擊左圖「AI 記憶特徵」按鈕，或在此手動輸入特徵..."}
                                className={`w-full h-32 md:h-40 p-4 rounded-2xl border text-indigo-900 font-medium leading-relaxed resize-none outline-none transition-all placeholder-indigo-300 scrollbar-thin
                  ${aiLoading ? 'bg-indigo-50/80 animate-pulse border-indigo-200' : 'bg-indigo-50/50 border-indigo-100 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300'}`}
                            />



                            <AnimatePresence>
                                {aiError && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 text-xs font-bold flex items-center gap-2 mt-2"
                                    >
                                        <Zap className="w-4 h-4" />
                                        {aiError}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Tag Input */}
                        <div className="flex gap-2 mb-4 flex-shrink-0">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                placeholder="新增特徵標籤 (如: 眼鏡, 短髮)..."
                                className="clay-input flex-1 !py-3 !text-base"
                                autoFocus
                            />
                            <button onClick={addTag} className="btn-clay btn-clay-primary px-4 rounded-xl font-black aspect-square flex items-center justify-center">
                                <Plus className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tag List */}
                        <div className="min-h-[120px] mb-6 p-4 bg-white/40 rounded-2xl border-2 border-white/50 shadow-inner">
                            <div className="flex flex-wrap gap-2">
                                {tags.length > 0 ? tags.map(tag => (
                                    <span key={tag} className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-bold flex items-center gap-2 shadow-sm border border-indigo-50 hover:scale-105 transition-transform">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="text-indigo-300 hover:text-rose-500 transition-colors">
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </span>
                                )) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 opacity-60 py-8">
                                        <Tag className="w-8 h-8" />
                                        <p className="text-sm font-medium">尚無標籤，請新增特徵</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons (Fixed) */}
                    <div className="p-6 md:p-10 md:pt-4 flex gap-4 flex-shrink-0 bg-gradient-to-t from-white/40 via-white/40 to-transparent">
                        <button onClick={onClose} className="btn-clay btn-clay-rose flex-1 py-4 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">關閉</button>
                        <button onClick={() => handleInternalSave(tags, description, true)} disabled={isSaving} className="btn-clay btn-clay-primary flex-[2] py-4 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                            {isSaving ? '儲存中...' : '儲存並關閉'}
                        </button>
                    </div>
                </div>

            </motion.div>
        </div>
    );
};

export default App;
