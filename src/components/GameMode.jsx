import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Trophy,
    Timer,
    Users,
    CheckCircle2,
    XCircle,
    Heart,
    Sparkles,
    Loader2,
    Volume2,
    VolumeX
} from 'lucide-react';
import { useStudents, updateStudentAiHint } from '../hooks/useStore';
import { useRecognitionStats } from '../hooks/useRecognitionStats';
import { generateMemoryAnchor } from '../lib/gemini';
import { useVoiceCoach } from '../hooks/useVoiceCoach';
import SocialShareCard from './SocialShareCard';
import { Share2 } from 'lucide-react';

const GameMode = ({ targetStudents, allStudents, className, onBack, gameMode = 'classic' }) => {
    const [studentsQueue, setStudentsQueue] = useState([...targetStudents].sort(() => 0.5 - Math.random()));
    const [solvedCount, setSolvedCount] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [score, setScore] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [startTime, setStartTime] = useState(Date.now());
    const [gameFinished, setGameFinished] = useState(false);
    const [aiHint, setAiHint] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiProgress, setAiProgress] = useState(0);   // 0-100
    const [aiStage, setAiStage] = useState(0);         // 0,1,2
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);

    const [detailedResults, setDetailedResults] = useState([]);
    const [autoPlay, setAutoPlay] = useState(false);
    const [showShareCard, setShowShareCard] = useState(false);
    const { speak, cancel, speaking, isSupported } = useVoiceCoach();

    useEffect(() => {
        generateQuestion();
        // Prefetch first few patterns
        preloadNextImages(3);
    }, []);

    const preloadNextImages = (count = 2) => {
        const remaining = allStudents.sort(() => 0.5 - Math.random()).slice(0, count);
        remaining.forEach(s => {
            if (s.photoUrl) {
                const img = new Image();
                img.src = s.photoUrl;
            }
        });
    };

    const generateQuestion = (currentQueue = studentsQueue) => {
        if (currentQueue.length === 0) {
            finishGame();
            return;
        }

        // 從佇列最前面取出一位，但要從最新的 targetStudents / allStudents 中撈取最新資料，確保吃到最新的 aiHint
        const queueHead = currentQueue[0];
        const correct = allStudents.find(s => s.id === queueHead.id) || queueHead;

        let others = allStudents.filter(s => s.id !== correct.id);

        // 如果是極限模式，優先尋找具有相同 tag 的學生
        if (gameMode === 'extreme') {
            others = others.sort((a, b) => {
                const commonA = a.tags ? a.tags.filter(t => correct.tags?.includes(t)).length : 0;
                const commonB = b.tags ? b.tags.filter(t => correct.tags?.includes(t)).length : 0;
                return commonB - commonA; // 降序
            });
        } else {
            others = others.sort(() => 0.5 - Math.random());
        }

        others = others.slice(0, 3);
        const allOptions = [...others, correct].sort(() => 0.5 - Math.random());

        setCurrentQuestion(correct);
        setOptions(allOptions);
        setFeedback(null);
        setStartTime(Date.now());

        if (correct.photoUrl) {
            // 先判定是否有現成 Hint，有的話直接顯示，不進入 Loading 狀態
            const existingHint = correct.aiHint || (correct.description && correct.description.length < 30 ? correct.description : null);

            if (existingHint) {
                setAiHint(existingHint);
                setIsAiLoading(false);
            } else {
                setAiHint(null);
                setIsAiLoading(true);
                setAiProgress(0);
                setAiStage(0);
                // Animate progress bar across 3 stages while waiting for API
                const stages = [30, 65, 90];
                let stageIdx = 0;
                const next = () => {
                    if (stageIdx < stages.length) {
                        setAiProgress(stages[stageIdx]);
                        setAiStage(stageIdx);
                        stageIdx++;
                        setTimeout(next, 900 + stageIdx * 300);
                    }
                };
                setTimeout(next, 200);
            }

            generateMemoryAnchor(correct.photoUrl, existingHint).then(hint => {
                if (!existingHint) {
                    setAiProgress(100);
                    setAiStage(3);
                    setTimeout(() => {
                        setAiHint(hint);
                        setIsAiLoading(false);
                    }, 350);
                }

                // If it's a freshly generated hint, save it to Firestore to save tokens next time
                if (hint && !existingHint && updateStudentAiHint) {
                    updateStudentAiHint(correct.id, hint);
                }

                // Auto-play hint if enabled
                if (autoPlay && hint) {
                    speak(hint);
                }
            });

            // Preload next potential images
            preloadNextImages(2);
        }
    };

    const handleAnswer = (studentId) => {
        if (feedback) return;
        const isCorrect = studentId === currentQuestion.id;
        const timeTaken = (Date.now() - startTime) / 1000;

        // Record detail
        setDetailedResults(prev => [...prev, { studentId: currentQuestion.id, isCorrect, timeTaken }]);

        let nextQueue = [...studentsQueue];

        if (isCorrect) {
            const baseScore = Math.max(10, Math.floor(100 - timeTaken * 5));
            const comboBonus = combo * 10;
            setScore(prev => prev + baseScore + comboBonus);
            setCombo(prev => {
                const newCombo = prev + 1;
                setMaxCombo(m => Math.max(m, newCombo));
                return newCombo;
            });
            setFeedback('correct');
            setSolvedCount(prev => prev + 1);

            // 答對就移除
            nextQueue.shift();
            // Auto-speak name on correct answer
            if (autoPlay) speak(`正確！這是 ${currentQuestion.name}`);
        } else {
            setCombo(0);
            setFeedback('wrong');

            // 答錯排到隊伍最後面，或是保留在前面
            const wrongStudent = nextQueue.shift();
            nextQueue.push(wrongStudent);

            // Auto-speak on wrong answer? Maybe just the name
            if (autoPlay) speak(`可惜，這是 ${currentQuestion.name}`);
        }

        setStudentsQueue(nextQueue);
        setTotalQuestions(prev => prev + 1);
        setTimeout(() => { generateQuestion(nextQueue); }, 1500);
    };

    const { recordGameResult } = useRecognitionStats();

    const finishGame = async () => {
        setGameFinished(true);
        try {
            await recordGameResult(className, score, targetStudents.length, detailedResults);
        } catch (e) {
            // Error logged in hook
        }
    };

    if (gameFinished) {
        return (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center pt-20 sm:pt-10 pb-10 w-full px-3 sm:px-4">
                <div className="clay-card max-w-lg !p-7 sm:!p-14 flex flex-col items-center relative overflow-hidden w-full">
                    <div className="relative mb-7 sm:mb-12">
                        <div className="absolute inset-0 bg-yellow-400/20 blur-[80px]" />
                        <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-yellow-100 rounded-[36px] sm:rounded-[45px] flex items-center justify-center shadow-inner">
                            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black text-indigo-950 mb-3 sm:mb-4 text-center">特訓圓滿達成！</h2>
                    <p className="text-indigo-400 font-bold mb-6 sm:mb-10 italic text-sm sm:text-base text-center">您的記憶直覺已提升至全新境界</p>
                    <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full mb-6 sm:mb-10">
                        <div className="bg-white/50 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border-4 border-white shadow-xl">
                            <p className="text-[9px] sm:text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">本次得分</p>
                            <p className="text-2xl sm:text-4xl font-black text-indigo-950">{score}</p>
                        </div>
                        <div className="bg-indigo-600/10 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border-4 border-indigo-100/50 shadow-xl">
                            <p className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">最高連擊</p>
                            <p className="text-2xl sm:text-4xl font-black text-indigo-600 flex items-center gap-2">
                                {maxCombo} <span className="text-base sm:text-lg">x</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
                        <button onClick={onBack} className="btn-clay btn-clay-primary flex-1 !py-4 sm:!py-6 text-base sm:text-xl">
                            返回總部基地
                        </button>
                        <button onClick={() => setShowShareCard(true)} className="btn-clay bg-indigo-50 text-indigo-600 flex-1 !py-4 sm:!py-6 text-base sm:text-xl flex items-center justify-center gap-2">
                            <Share2 className="w-5 h-5 sm:w-6 sm:h-6" /> 分享
                        </button>
                    </div>

                    {showShareCard && (
                        <SocialShareCard
                            score={score}
                            total={targetStudents.length}
                            className={className}
                            onClose={() => setShowShareCard(false)}
                        />
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col items-center pt-20 sm:pt-32 md:pt-40 pb-6 w-full">
            <div className="flex flex-wrap items-center justify-between w-full max-w-4xl mb-5 sm:mb-8 md:mb-12 px-3 md:px-4 gap-y-3 gap-x-2">
                <button onClick={onBack} className="btn-icon-back flex-shrink-0">
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                </button>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
                    <div className="stats-pill">
                        <Timer className="w-5 h-5 text-indigo-400" />
                        <span className="text-xs md:text-sm">掌握度 {solvedCount} <span className="text-slate-300">/ {targetStudents.length}</span></span>
                    </div>
                    <div className="stats-pill !bg-indigo-600 !border-indigo-400 !text-white shadow-lg shadow-indigo-200/50">
                        <Trophy className="w-5 h-5 text-yellow-300 fill-yellow-300 drop-shadow-sm" />
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[8px] md:text-[10px] text-indigo-200 font-bold uppercase tracking-wider">SCORE</span>
                            <span className="text-lg md:text-xl font-black">{score}</span>
                        </div>
                    </div>
                    {isSupported && (
                        <button
                            onClick={() => setAutoPlay(!autoPlay)}
                            className={`stats-pill transition-all ${autoPlay ? '!bg-indigo-500 !text-white !border-indigo-400' : 'bg-white/50'}`}
                            title={autoPlay ? "關閉語音教練" : "開啟語音教練"}
                        >
                            {autoPlay ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-indigo-300" />}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center w-full max-w-4xl relative">
                {/* Combo Indicator */}
                <AnimatePresence>
                    {combo > 1 && (
                        <motion.div
                            initial={{ scale: 0, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 10 }}
                            className="absolute -top-12 md:-top-20 right-0 z-30 transform scale-75 md:scale-100"
                        >
                            <div className="bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-black text-2xl shadow-xl transform rotate-6 border-4 border-white">
                                COMBO x{combo}!
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div
                    key={currentQuestion?.id}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`mb-6 md:mb-8 ${gameMode === 'reverse' ? 'w-full max-w-2xl px-4' : 'game-photo-wrap'}`}
                >
                    {gameMode === 'reverse' ? (
                        <div className="w-full flex flex-col items-center justify-center bg-white/40 backdrop-blur-md rounded-[40px] shadow-2xl border-4 md:border-8 border-white p-6 md:p-8">
                            <span className="text-[8px] md:text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2 md:mb-3">Identity Target</span>
                            <span className="text-4xl md:text-6xl font-black text-indigo-950 drop-shadow-sm leading-tight text-center break-all">{currentQuestion?.name}</span>
                        </div>
                    ) : currentQuestion?.photoUrl ? (
                        <img src={currentQuestion.photoUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full bg-indigo-50 flex items-center justify-center"><Users className="w-24 h-24 text-indigo-100" /></div>
                    )}
                    <AnimatePresence>
                        {feedback && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center rounded-[50px] z-50">
                                <div className="bg-white p-8 rounded-[50px] shadow-3xl border-8 border-white">
                                    {feedback === 'correct' ? <CheckCircle2 className="w-20 h-20 text-emerald-500" /> : <XCircle className="w-20 h-20 text-rose-500" />}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <div className="text-center mb-4 sm:mb-6 md:mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-50 rounded-full mb-3 sm:mb-4">
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
                        <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Question Mastery</span>
                    </div>
                    <h3 className="text-base sm:text-xl md:text-2xl font-black text-indigo-950 mb-2 px-3 sm:px-4 flex items-center justify-center gap-2 md:gap-3">
                        {gameMode === 'reverse' ? '請點選對應的照片：' : '這位學生的姓名是？'}
                        <button onClick={() => speak(currentQuestion.name)} className="p-1.5 sm:p-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-400 transition-colors flex-shrink-0">
                            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </h3>

                    {/* AI 記憶悄悄話 */}
                    <div className="mt-4 flex justify-center px-4">
                        <AnimatePresence mode="wait">
                            {isAiLoading && (
                                <motion.div
                                    key="ai-loading"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-white/50 backdrop-blur-xl border border-indigo-100 p-5 rounded-[28px] shadow-2xl w-full max-w-sm"
                                >
                                    {/* Header */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="bg-indigo-600 rounded-full p-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Gemini 正在分析...</p>
                                    </div>

                                    {/* Stage Label */}
                                    <p className="text-xs font-bold text-indigo-700 mb-2 leading-snug">
                                        {aiStage === 0 && '🔍 掃描五官特徵...'}
                                        {aiStage === 1 && '🧠 比對記憶資料庫...'}
                                        {aiStage === 2 && '✍️ 生成記憶錨點...'}
                                        {aiStage >= 3 && '✅ 分析完成！'}
                                    </p>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-indigo-100 rounded-full h-2.5 overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-400"
                                            initial={{ width: '0%' }}
                                            animate={{ width: `${aiProgress}%` }}
                                            transition={{ duration: 0.6, ease: 'easeInOut' }}
                                        />
                                    </div>
                                    <p className="text-right text-[10px] text-indigo-300 font-bold mt-1">{aiProgress}%</p>
                                </motion.div>
                            )}
                            {!isAiLoading && aiHint && (
                                <motion.div
                                    key="ai-hint"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-white/40 backdrop-blur-xl border border-white/60 p-4 rounded-[30px] shadow-2xl max-w-sm flex items-start gap-3"
                                >
                                    <div className="bg-indigo-600 rounded-full p-2 mt-0.5">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI 記憶悄悄話</p>
                                            <button onClick={() => speak(aiHint)} className="ml-2 p-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-400 transition-colors">
                                                <Volume2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <p className="text-sm font-bold text-indigo-950 leading-relaxed">{aiHint}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <p className="text-indigo-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-4 md:mt-6">{gameMode === 'reverse' ? 'SELECT THE MATCHING PHOTO' : 'TAP THE CORRECT IDENTITY'}</p>
                </div>

                <div className={`w-full px-3 sm:px-4 ${gameMode === 'reverse' ? 'grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4' : 'game-option-grid'}`}>
                    {options.map((opt, idx) => (
                        <motion.button
                            key={`${opt.id}-${idx}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleAnswer(opt.id)}
                            disabled={!!feedback}
                            className={`${gameMode === 'reverse' ? 'p-0 overflow-hidden aspect-square md:aspect-[3/4] rounded-2xl md:rounded-3xl border-2 md:border-4' : 'game-btn-clay'} ${feedback === 'correct' && opt.id === currentQuestion.id ? 'bg-emerald-500 text-white !border-emerald-400 !shadow-emerald-200' :
                                feedback === 'wrong' && opt.id === currentQuestion.id ? 'bg-emerald-500 text-white !border-emerald-400' :
                                    feedback === 'wrong' && opt.id !== currentQuestion.id ? 'bg-slate-50 text-slate-300 !border-slate-100 opacity-50' :
                                        gameMode === 'reverse' ? 'bg-white border-white shadow-xl' : 'bg-white text-indigo-950 hover:bg-indigo-50/50'
                                }`}
                        >
                            {gameMode === 'reverse' ? (
                                opt.photoUrl ? (
                                    <img src={opt.photoUrl} className="w-full h-full object-cover" alt={opt.name} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-200"><Users className="w-10 h-10" /></div>
                                )
                            ) : (
                                opt.name
                            )}
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GameMode;
