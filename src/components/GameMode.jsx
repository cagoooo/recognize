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
    Loader2
} from 'lucide-react';
import { useRecognitionStats } from '../hooks/useRecognitionStats';
import { generateMemoryAnchor } from '../lib/gemini';

const GameMode = ({ students, className, onBack }) => {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [options, setOptions] = useState([]);
    const [score, setScore] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [startTime, setStartTime] = useState(Date.now());
    const [gameFinished, setGameFinished] = useState(false);
    const [aiHint, setAiHint] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);
    const [detailedResults, setDetailedResults] = useState([]);

    useEffect(() => {
        generateQuestion();
    }, []);

    const generateQuestion = () => {
        if (totalQuestions >= 10) {
            finishGame();
            return;
        }

        const correct = students[Math.floor(Math.random() * students.length)];
        let others = students.filter(s => s.id !== correct.id);
        others = others.sort(() => 0.5 - Math.random()).slice(0, 3);
        const allOptions = [...others, correct].sort(() => 0.5 - Math.random());

        setCurrentQuestion(correct);
        setOptions(allOptions);
        setFeedback(null);
        setStartTime(Date.now());

        // 觸發 AI 記憶錨點
        if (correct.photoUrl) {
            setAiHint(null);
            setIsAiLoading(true);
            generateMemoryAnchor(correct.photoUrl).then(hint => {
                setAiHint(hint);
                setIsAiLoading(false);
            });
        }
    };

    const handleAnswer = (studentId) => {
        if (feedback) return;
        const isCorrect = studentId === currentQuestion.id;
        const timeTaken = (Date.now() - startTime) / 1000;

        // Record detail
        setDetailedResults(prev => [...prev, { studentId: currentQuestion.id, isCorrect, timeTaken }]);

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
        } else {
            setCombo(0);
            setFeedback('wrong');
        }
        setTotalQuestions(prev => prev + 1);
        setTimeout(() => { generateQuestion(); }, 1500);
    };

    const { recordGameResult } = useRecognitionStats();

    const finishGame = async () => {
        setGameFinished(true);
        try {
            await recordGameResult(className, score, 10, detailedResults);
        } catch (e) {
            // Error logged in hook
        }
    };

    if (gameFinished) {
        return (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center py-10 w-full">
                <div className="clay-card max-w-lg p-14 flex flex-col items-center relative overflow-hidden">
                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-yellow-400/20 blur-[80px]" />
                        <div className="relative w-32 h-32 bg-yellow-100 rounded-[45px] flex items-center justify-center shadow-inner">
                            <Trophy className="w-16 h-16 text-yellow-600" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-black text-indigo-950 mb-4">特訓圓滿達成！</h2>
                    <p className="text-indigo-400 font-bold mb-10 italic">您的記憶直覺已提升至全新境界</p>
                    <div className="grid grid-cols-2 gap-6 w-full mb-10">
                        <div className="bg-white/50 backdrop-blur-md p-6 rounded-[32px] border-4 border-white shadow-xl">
                            <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">本次得分</p>
                            <p className="text-4xl font-black text-indigo-950">{score}</p>
                        </div>
                        <div className="bg-indigo-600/10 backdrop-blur-md p-6 rounded-[32px] border-4 border-indigo-100/50 shadow-xl">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">最高連擊</p>
                            <p className="text-4xl font-black text-indigo-600 flex items-center gap-2">
                                {maxCombo} <span className="text-lg">x</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onBack} className="btn-clay btn-clay-primary w-full py-6 text-xl">
                        返回總部基地
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="flex flex-col items-center py-6 w-full">
            <div className="flex items-center justify-between w-full max-w-4xl mb-12 px-4">
                <button onClick={onBack} className="btn-icon-back">
                    <ArrowLeft className="w-8 h-8" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="stats-pill">
                        <Timer className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm">問題 {totalQuestions + 1} <span className="text-slate-300">/ 10</span></span>
                    </div>
                    <div className="stats-pill bg-indigo-600 !border-indigo-500 !text-white shadow-indigo-200">
                        <Trophy className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                        <span className="text-sm font-black">{score}</span>
                    </div>
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
                            className="absolute -top-20 right-0 z-30"
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
                    className="game-photo-wrap mb-12"
                >
                    {currentQuestion?.photoUrl ? (
                        <img src={currentQuestion.photoUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full bg-indigo-50 flex items-center justify-center"><Users className="w-24 h-24 text-indigo-100" /></div>
                    )}
                    <AnimatePresence>
                        {feedback && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center">
                                <div className="bg-white p-8 rounded-[50px] shadow-3xl border-8 border-white">
                                    {feedback === 'correct' ? <CheckCircle2 className="w-20 h-20 text-emerald-500" /> : <XCircle className="w-20 h-20 text-rose-500" />}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-6 py-2 bg-rose-50 rounded-full mb-6">
                        <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
                        <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Question Mastery</span>
                    </div>
                    <h3 className="text-3xl font-black text-indigo-950 mb-3 px-4">
                        這位學生的姓名是？
                    </h3>

                    {/* AI 記憶悄悄話 */}
                    <div className="mt-4 flex justify-center px-4">
                        <AnimatePresence mode="wait">
                            {(aiHint || isAiLoading) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-white/40 backdrop-blur-xl border border-white/60 p-4 rounded-[30px] shadow-2xl max-w-sm flex items-start gap-3"
                                >
                                    <div className="bg-indigo-600 rounded-full p-2 mt-0.5">
                                        {isAiLoading ? (
                                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">AI 記憶悄悄話</p>
                                        <p className="text-sm font-bold text-indigo-950 leading-relaxed">
                                            {isAiLoading ? 'Gemini 正在仔細觀察特徵中...' : aiHint}
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <p className="text-indigo-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-6">TAP THE CORRECT IDENTITY</p>
                </div>

                <div className="game-option-grid px-4">
                    {options.map((opt, idx) => (
                        <motion.button
                            key={`${opt.id}-${idx}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleAnswer(opt.id)}
                            disabled={!!feedback}
                            className={`game-btn-clay ${feedback === 'correct' && opt.id === currentQuestion.id ? 'bg-emerald-500 text-white !border-emerald-400 !shadow-emerald-200' :
                                feedback === 'wrong' && opt.id === currentQuestion.id ? 'bg-emerald-500 text-white !border-emerald-400' :
                                    feedback === 'wrong' && opt.id !== currentQuestion.id ? 'bg-slate-50 text-slate-300 !border-slate-100 opacity-50' :
                                        'bg-white text-indigo-950 hover:bg-indigo-50/50'
                                }`}
                        >
                            {opt.name}
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GameMode;
