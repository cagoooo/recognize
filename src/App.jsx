import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { auth, db, googleProvider } from './firebase';
import { useAuth } from './hooks/useAuth';
import { filterStudents } from './lib/search';
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
    Info,
    XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClasses, useStudents } from './hooks/useStore';
import { useGeminiVision } from './hooks/useGeminiVision';
import GameMode from './components/GameMode';
import StatsView from './components/StatsView';

const App = () => {
    const { user, loading, login, logout } = useAuth();
    const [activeView, setActiveView] = useState('home');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [gameState, setGameState] = useState({ active: false, classId: null, className: '', students: [] });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const startTraining = (cls, students) => {
        if (students.length < 4) {
            alert("該班級學生人數不足 (需至少 4 位) 無法開始練習");
            return;
        }
        setGameState({ active: true, classId: cls.id, className: cls.name, students });
        setActiveView('game');
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
        <div className="min-h-screen flex flex-col items-center pb-20 overflow-x-hidden">
            {/* Dynamic Background Layer */}
            <div className="aurora-bg">
                <div className="aurora-blob blob-1" />
                <div className="aurora-blob blob-2" />
                <div className="aurora-blob blob-3" />
                <div className="aurora-blob blob-4" />
            </div>

            <header className="fixed top-6 left-0 right-0 w-full px-4 flex justify-center pointer-events-none" style={{ zIndex: 99999 }}>
                <div className="nav-capsule pointer-events-auto relative" style={{ zIndex: 100000 }}>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="brand-section cursor-pointer relative z-[10002]"
                        onClick={() => setActiveView('home')}
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

            <main className="w-full max-w-5xl px-4 flex flex-col items-center relative z-10 pt-40 md:pt-52 pb-20">
                {/* Spacer for Fixed Header */}
                <div className="w-full h-8 md:hidden" />
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
                            {activeView === 'game' && <GameMode students={gameState.students} className={gameState.className} onBack={() => setActiveView('home')} key="game" />}
                            {activeView === 'stats' && <StatsView userId={user.uid} onBack={() => setActiveView('home')} key="stats" />}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

const HeroSection = ({ onLogin }) => (
    <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative flex flex-col items-center py-12 md:py-20 text-center max-w-4xl mx-auto overflow-hidden md:overflow-visible px-4"
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
    <div className="flex flex-col items-center gap-14 w-full">
        <motion.div
            whileHover={{ y: -12, scale: 1.01 }}
            onClick={() => onNavigate('play')}
            className="clay-card clay-card-indigo border-none flex flex-col items-center cursor-pointer group max-w-md w-full mx-auto relative overflow-hidden glow-primary"
        >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent opacity-40 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
                <div className="card-icon-box bg-white/20 backdrop-blur-md border-4 border-white/20">
                    <Target className="text-white w-12 h-12" />
                </div>
                <h3 className="text-4xl font-black text-white mb-4">挑戰辨認</h3>
                <p className="text-indigo-100 font-bold mb-10 text-base opacity-80">高強度視覺訓練</p>
                <div className="bg-white text-indigo-600 px-12 py-5 rounded-[28px] font-black shadow-2xl flex items-center gap-2 group-hover:bg-indigo-50 transition-all group-hover:scale-105">
                    立即啟動 <ChevronRight className="w-6 h-6" />
                </div>
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

const ClassManager = ({ userId, onBack, onStartGame, onNavigate, mode = 'manage' }) => {
    const { classes, addClass, deleteClass } = useClasses(userId);
    const [newClassName, setNewClassName] = useState('');

    const handleDeleteClass = async (e, id, name) => {
        e.stopPropagation();
        if (confirm(`確定要刪除「${name}」班級嗎？此動作不可復原。`)) {
            try {
                await deleteClass(id);
            } catch (err) {
                console.error("Delete class failed:", err);
            }
        }
    };
    const [selectedClass, setSelectedClass] = useState(null);


    if (selectedClass) {
        if (mode === 'play') {
            return (
                <QuickStart
                    cls={selectedClass}
                    onBack={() => setSelectedClass(null)}
                    onStartGame={(students) => onStartGame(selectedClass, students)}
                    onNavigate={onNavigate}
                />
            );
        }
        return (
            <StudentManager cls={selectedClass} onBack={() => setSelectedClass(null)} onStartGame={(students) => onStartGame(selectedClass, students)} />
        );
    }

    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full">
            <button onClick={onBack} className="btn-icon-back mb-12">
                <ArrowLeft className="w-8 h-8" />
            </button>

            {/* Hero Section / Create Class */}
            <div className="clay-card clay-card-indigo p-12 text-center max-w-lg w-full mx-auto mb-20 relative overflow-hidden text-white border-white/20">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg border border-white/20">
                        <Sparkles className="w-10 h-10 text-yellow-300" />
                    </div>
                    <h2 className="text-4xl font-black text-white mb-2 tracking-tight">啟動新班級</h2>
                    <p className="text-indigo-200 font-bold mb-8">建立一個新的挑戰空間</p>

                    <form onSubmit={(e) => { e.preventDefault(); if (newClassName.trim()) { addClass(newClassName); setNewClassName(''); } }} className="flex flex-col gap-4">
                        <div className="relative group/input">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                                <GraduationCap className="h-6 w-6 text-indigo-400 group-focus-within/input:text-indigo-600 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="例如：3年2班"
                                className="clay-input-primary"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn-clay bg-white text-indigo-600 hover:bg-indigo-50 w-full h-16 text-xl shadow-xl border-none group/btn relative overflow-hidden">
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                <Zap className="w-6 h-6" /> 立即建立
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-100/50 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                        </button>
                    </form>
                </div>
            </div>

            {/* Class List Grid */}
            <h3 className="text-2xl font-black text-indigo-950 mb-8 flex items-center gap-3">
                <Users className="w-8 h-8 text-indigo-500" />
                現有班級 <span className="text-indigo-300 text-lg">({classes.length})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl px-4 pb-20">
                {classes.map((cls, index) => (
                    <motion.div
                        key={cls.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ y: -10, scale: 1.02 }}
                        onClick={() => setSelectedClass(cls)}
                        className="clay-card p-8 flex flex-col items-center cursor-pointer w-full relative group overflow-hidden border-4 border-white hover:border-indigo-100 transition-all"
                    >
                        {/* Hover Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <button
                            onClick={(e) => handleDeleteClass(e, cls.id, cls.name)}
                            className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full text-rose-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 shadow-sm"
                            title="刪除班級"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="w-24 h-24 bg-indigo-50 rounded-[32px] flex items-center justify-center mb-6 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 relative z-10 border-4 border-white">
                            <GraduationCap className="text-indigo-500 w-12 h-12 group-hover:text-indigo-600 transition-colors" />
                        </div>

                        <h3 className="text-3xl font-black text-indigo-950 relative z-10">{cls.name}</h3>

                        <div className="mt-6 flex items-center gap-2 relative z-10 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span className="text-indigo-400 font-bold text-sm uppercase tracking-widest">Enter Class</span>
                            <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

const QuickStart = ({ cls, onBack, onStartGame, onNavigate }) => {
    const { students, loading } = useStudents(cls.id);
    const [errorStatus, setErrorStatus] = useState(null); // 'empty', 'insufficient'

    useEffect(() => {
        if (!loading) {
            if (students.length === 0) {
                setErrorStatus('empty');
            } else if (students.length < 4) {
                setErrorStatus('insufficient');
            } else {
                onStartGame(students);
            }
        }
    }, [loading, students, onStartGame]);

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

    return null;
};

const StudentManager = ({ cls, onBack, onStartGame }) => {
    const { students, addStudent, batchAddStudents, updateStudentPhoto, deleteStudent, updateStudentTags, updateStudentDescription } = useStudents(cls.id);
    const [newName, setNewName] = useState('');
    const [newSeatNumber, setNewSeatNumber] = useState('');
    const [photoFile, setPhotoFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tagFilter, setTagFilter] = useState('all');
    const [editingTagsStudent, setEditingTagsStudent] = useState(null);
    const [showImportHelp, setShowImportHelp] = useState(false); // New state for help toggle

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
        let unmatched = [];

        setIsUploading(true);

        const uploadPromises = files.map(async (file) => {
            const fileName = file.name.split('.')[0].trim(); // 拿檔名 (不含副檔名)

            // 智慧匹配：優先比對姓名，次之比對座號
            const targetStudent = students.find(s =>
                s.name.trim() === fileName ||
                (s.seatNumber && String(s.seatNumber).trim() === fileName) ||
                fileName.includes(s.name.trim()) // 處理 01_潘宥睿.jpg 這種格式
            );

            if (targetStudent) {
                try {
                    await updateStudentPhoto(targetStudent.id, file);
                    matchedCount++;
                } catch (err) {
                    console.error(`Upload failed for ${fileName}:`, err);
                }
            } else {
                unmatched.push(file.name);
            }
        });

        await Promise.all(uploadPromises);
        setIsUploading(false);

        let message = `照片同步完成！\n✅ 成功匹配並更新：${matchedCount} 位`;
        if (unmatched.length > 0) {
            message += `\n❌ 未匹配成功：${unmatched.length} 位\n(${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '...' : ''})`;
        }
        alert(message);
        e.target.value = ''; // Reset
    };

    return (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center w-full">
            <div className="flex items-center justify-between w-full max-w-4xl mb-12 px-4">
                <button onClick={onBack} className="btn-icon-back">
                    <ArrowLeft className="w-8 h-8" />
                </button>
                <div className="text-right">
                    <h2 className="text-4xl font-black text-indigo-950">{cls.name}</h2>
                    <p className="text-indigo-400 font-black uppercase text-[10px] tracking-[0.4em] mt-2">Active Students: {students.length}</p>
                </div>
            </div>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onStartGame(filteredStudents)}
                disabled={filteredStudents.length < 4}
                className="btn-clay btn-clay-orange px-20 py-7 text-2xl mb-12 mx-auto pulse-primary"
            >
                <Gamepad2 className="w-8 h-8 mr-3" />
                {tagFilter === 'all' ? '啟動全班練習' : `啟動「${tagFilter}」特訓`}
            </motion.button>

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

                {/* Tag Filter (Horizontal Scroll) */}
                <div className="w-full overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                    <div className="flex gap-4 w-max mx-auto">
                        <button
                            onClick={() => setTagFilter('all')}
                            className={`clay-pill ${tagFilter === 'all' ? 'active' : 'inactive'}`}
                        >
                            <Tag className="w-4 h-4" />
                            所有標籤
                        </button>

                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setTagFilter(tag)}
                                className={`clay-pill ${tagFilter === tag ? 'active' : 'inactive'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${tagFilter === tag ? 'bg-white' : 'bg-indigo-400'}`} />
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            <div className="flex flex-col md:flex-row gap-10 w-full max-w-4xl mb-20">
                <div className="clay-card clay-card-indigo flex-1 p-10 relative overflow-hidden text-white border-white/20">
                    {/* Decorative Background */}
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl opacity-50" />
                    <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-5 mb-8">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/20">
                                <UserPlus className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white leading-tight">收編新戰友</h3>
                                <p className="text-indigo-200 font-bold text-sm tracking-widest mt-1 uppercase">Create Profile</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="relative flex-[2] group/input">
                                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400/70 w-6 h-6 z-10 group-focus-within/input:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="姓名"
                                        className="clay-input pl-16 text-left w-full border-white/50 bg-white/90 focus:bg-white text-indigo-950 placeholder-indigo-300/70 shadow-lg"
                                        value={newName} onChange={(e) => setNewName(e.target.value)} required
                                    />
                                </div>
                                <div className="relative flex-1 group/input">
                                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400/70 w-6 h-6 z-10 group-focus-within/input:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="座號"
                                        className="clay-input pl-16 text-left w-full border-white/50 bg-white/90 focus:bg-white text-indigo-950 placeholder-indigo-300/70 shadow-lg"
                                        value={newSeatNumber} onChange={(e) => setNewSeatNumber(e.target.value)}
                                    />
                                </div>
                            </div>

                            <label className="group flex flex-col items-center justify-center gap-3 py-6 bg-white/5 border-4 border-white/20 border-dashed rounded-[32px] cursor-pointer hover:bg-white/10 hover:border-white/40 transition-all relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-white/10 relative z-10">
                                    <Camera className="w-6 h-6 text-white fill-white/20" />
                                </div>
                                <span className="text-white font-bold text-sm max-w-[200px] truncate opacity-80 group-hover:opacity-100 relative z-10 tracking-wider">
                                    {photoFile ? <span className="text-emerald-300 flex items-center gap-2">✅ {photoFile.name}</span> : '上傳大頭照 (選填)'}
                                </span>
                                <input type="file" className="hidden" onChange={(e) => setPhotoFile(e.target.files[0])} accept="image/*" />
                            </label>

                            <button
                                type="submit"
                                disabled={isUploading}
                                className="btn-clay bg-white text-indigo-600 hover:bg-indigo-50 h-18 text-xl w-full shadow-xl border-none mt-2 relative overflow-hidden group/btn"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    {isUploading ? "上傳中..." : <><UserPlus className="w-6 h-6" /> 確認加入</>}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 opacity-0 group-hover/btn:opacity-50 transition-opacity duration-500" />
                            </button>
                        </form>
                    </div>
                </div>

                <div className="flex-1 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Excel Card */}
                        <label className="clay-upload-card clay-upload-emerald group">
                            <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
                            <div className="icon-box text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                <FileSpreadsheet className="w-8 h-8" />
                            </div>
                            <div className="flex flex-col items-start gap-1">
                                <h3 className="text-xl font-black text-emerald-950">匯入名單</h3>
                                <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">Excel / CSV</p>
                            </div>
                        </label>

                        {/* Photo Card */}
                        <label className="clay-upload-card clay-upload-blue group">
                            <input type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" multiple />
                            <div className="icon-box text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <Images className="w-8 h-8" />
                            </div>
                            <div className="flex flex-col items-start gap-1">
                                <h3 className="text-xl font-black text-blue-950">匯入照片</h3>
                                <p className="text-[10px] font-bold text-blue-600/70 uppercase tracking-widest bg-white/50 px-2 py-1 rounded-md">Batch Upload</p>
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
                                        <div className="glass-instruction-card border-emerald-100">
                                            <h4 className="flex items-center gap-2 font-black text-emerald-800 text-lg">
                                                <FileSpreadsheet className="w-6 h-6" /> 匯入名單規範
                                            </h4>
                                            <div className="flex flex-col gap-2 text-sm text-emerald-900/80 font-medium">
                                                <p>🔹 支援格式：<span className="font-bold bg-emerald-100 px-2 rounded">.xlsx</span> <span className="font-bold bg-emerald-100 px-2 rounded">.csv</span></p>
                                                <p>🔹 必填欄位 (標頭)：</p>
                                                <div className="flex gap-2">
                                                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold shadow-sm text-xs">姓名</span>
                                                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold shadow-sm text-xs">座號</span>
                                                    <span className="bg-slate-200 text-slate-500 px-3 py-1 rounded-lg font-bold text-xs">學號 (選填)</span>
                                                </div>
                                                <p className="text-xs opacity-70 mt-1">⚠️ 若使用 CSV，請確認編碼為 UTF-8 以避免亂碼。</p>
                                            </div>
                                        </div>

                                        {/* Photo Format Guide */}
                                        <div className="glass-instruction-card border-blue-100">
                                            <h4 className="flex items-center gap-2 font-black text-blue-800 text-lg">
                                                <Images className="w-6 h-6" /> 照片檔名規則
                                            </h4>
                                            <div className="flex flex-col gap-2 text-sm text-blue-900/80 font-medium">
                                                <p>🔹 支援格式：<span className="font-bold bg-blue-100 px-2 rounded">.jpg</span> <span className="font-bold bg-blue-100 px-2 rounded">.png</span></p>
                                                <p>🔹 檔名格式 (二擇一)：</p>
                                                <div className="flex flex-col gap-2 mt-1">
                                                    <div className="bg-white/60 p-2 rounded-lg border border-blue-100">
                                                        <code className="text-blue-600 font-bold block mb-1">座號_姓名.jpg</code>
                                                        <span className="text-xs text-slate-500">例：01_王小明.jpg</span>
                                                    </div>
                                                    <div className="bg-white/60 p-2 rounded-lg border border-blue-100">
                                                        <code className="text-blue-600 font-bold block mb-1">學號.jpg</code>
                                                        <span className="text-xs text-slate-500">例：11001.jpg</span>
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
                        <div className="fixed inset-0 bg-indigo-900/20 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-white p-10 rounded-[48px] shadow-2xl flex flex-col items-center border-4 border-white/50"
                            >
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mb-6 p-4 bg-indigo-50 rounded-full">
                                    <Sparkles className="w-12 h-12 text-indigo-500" />
                                </motion.div>
                                <p className="font-black text-indigo-900 text-xl">正在處理檔案...</p>
                                <p className="text-indigo-400 font-bold text-sm mt-2">請稍候，這不會花太久時間</p>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6 w-full max-w-7xl px-4 pb-20">
                {filteredStudents.map((std, index) => (
                    <motion.div
                        key={std.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                        whileHover={{ y: -8, scale: 1.05, zIndex: 20 }}
                        className="flex flex-col items-center group relative cursor-pointer"
                        onClick={() => setEditingTagsStudent(std)}
                    >
                        {/* Card Container - Pro Max Premium */}
                        <div className="w-full aspect-[3/4] clay-card p-0 overflow-hidden relative border-4 border-white group-hover:border-indigo-200 shadow-clay-card group-hover:shadow-indigo-500/30 transition-all duration-300 rounded-[32px] bg-white/80 backdrop-blur-xl">

                            {/* Action Buttons (Compact) */}
                            <div className="absolute top-2 right-2 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteStudent(std.id, std.name); }}
                                    className="btn-square-danger shadow-lg hover:scale-110 transition-transform bg-white/90 backdrop-blur-md"
                                    title="移除"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Photo Area */}
                            <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-purple-50 relative group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors duration-500">
                                {std.photoUrl ? (
                                    <img src={std.photoUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={std.name} />
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
                                            {std.name}
                                        </p>
                                        {std.seatNumber && (
                                            <span className="mt-2 px-3 py-1 bg-indigo-500 text-white rounded-full text-xs font-bold shadow-md shadow-indigo-200 uppercase tracking-wider relative z-30">
                                                #{std.seatNumber}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tags (Minimalist Pills) */}
                            {std.tags && std.tags.length > 0 && (
                                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                                    {std.tags.slice(0, 1).map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] font-black text-indigo-600 shadow-sm border border-indigo-50/50">
                                            {tag}
                                        </span>
                                    ))}
                                    {std.tags.length > 1 && <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center font-bold shadow-sm border-2 border-white">+{std.tags.length - 1}</span>}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {
                editingTagsStudent && (
                    <TagEditor
                        student={editingTagsStudent}
                        onClose={() => setEditingTagsStudent(null)}
                        onSave={(tags, description) => {
                            updateStudentTags(editingTagsStudent.id, tags);
                            if (description !== undefined) {
                                updateStudentDescription(editingTagsStudent.id, description);
                            }
                            setEditingTagsStudent(null);
                        }}
                    />
                )
            }
        </motion.div >
    );
};

// Student Details & Tag Editor Modal
const TagEditor = ({ student, onClose, onSave }) => {
    const [tags, setTags] = useState(student.tags || []);
    const [description, setDescription] = useState(student.description || '');
    const [inputValue, setInputValue] = useState('');
    const { generateDescription, loading: aiLoading, error: aiError, description: aiDescription } = useGeminiVision();

    const handleAiGenerate = async () => {
        if (student.photoUrl) {
            await generateDescription(student.photoUrl);
        }
    };

    useEffect(() => {
        if (aiDescription) {
            setDescription(prev => prev ? prev + '\n' + aiDescription : aiDescription);
        }
    }, [aiDescription]);

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
                className="clay-card p-0 max-w-4xl w-full relative flex flex-col md:flex-row overflow-hidden shadow-2xl h-[90vh] md:h-auto"
            >
                {/* Close Button Mobile/Desktop */}
                <button onClick={onClose} className="absolute top-4 right-4 z-50 text-slate-400 hover:text-rose-500 bg-white/50 backdrop-blur-sm p-2 rounded-full transition-colors">
                    <XCircle className="w-8 h-8" />
                </button>

                {/* Left: Photo Zoom Area */}
                <div className="w-full md:w-1/2 bg-indigo-50 relative flex items-center justify-center overflow-hidden group min-h-[40vh] md:min-h-[500px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 z-0" />

                    {student.photoUrl ? (
                        <img
                            src={student.photoUrl}
                            className="w-full h-full object-cover transition-transform duration-700 hover:scale-110 cursor-zoom-in"
                            alt={student.name}
                            onClick={() => window.open(student.photoUrl, '_blank')}
                            title="點擊在新分頁開啟原圖"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-indigo-200">
                            <User className="w-32 h-32 mb-4 opacity-50" />
                            <p className="font-bold text-lg opacity-60">無照片</p>
                        </div>
                    )}

                    {/* Overlay Info for Photo (Mobile Only) */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent text-white pt-20 md:hidden pointer-events-none">
                        <h2 className="text-3xl font-black">{student.name}</h2>
                        {student.seatNumber && <p className="font-bold opacity-80">#{student.seatNumber}</p>}
                    </div>

                    {/* AI Generate Button (Over Photo) */}
                    {student.photoUrl && (
                        <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-20">
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
                        </div>
                    )}
                </div>

                {/* Right: Details & Tags */}
                <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col bg-white/60 backdrop-blur-xl h-full overflow-y-auto">

                    <div className="hidden md:block mb-6">
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

                    {/* AI Description Editor / Result */}
                    <div className="mb-6">
                        <h3 className="flex items-center gap-2 text-indigo-800 font-bold text-sm uppercase tracking-wide mb-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            AI 記憶口訣
                        </h3>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="點擊左圖「AI 記憶特徵」按鈕，或在此手動輸入特徵..."
                            className="w-full h-32 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-indigo-900 font-medium leading-relaxed resize-none focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none transition-all placeholder-indigo-300"
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
                    <div className="flex gap-2 mb-4">
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

                    <div className="flex-1 min-h-[120px] mb-6 p-4 bg-white/40 rounded-2xl border-2 border-white/50 shadow-inner overflow-y-auto">
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

                    <div className="flex gap-4 mt-auto pt-4 md:pt-0">
                        <button onClick={onClose} className="flex-1 py-4 font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
                        <button onClick={() => onSave(tags, description)} className="btn-clay btn-clay-primary flex-[2] py-4 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">儲存變更</button>
                    </div>
                </div>

            </motion.div>
        </div>
    );
};

export default App;
