import React, { useState, useEffect } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Calendar, Zap, LayoutGrid, Heart, Users, Trophy } from 'lucide-react';
import { useClasses, useStudents, useScores } from '../hooks/useStore';
import AnalyticsDashboard from './AnalyticsDashboard';

const StatsView = ({ userId, onBack }) => {
    const { classes } = useClasses(userId);
    const [selectedClassId, setSelectedClassId] = useState(null);

    // Default to first class when keys loaded
    useEffect(() => {
        if (classes.length > 0 && !selectedClassId) {
            setSelectedClassId(classes[0].id);
        }
    }, [classes, selectedClassId]);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const { students } = useStudents(selectedClassId);
    const { scores } = useScores(selectedClass?.name);

    // Calculate Leaderboard (Global)
    const leaderboardData = React.useMemo(() => {
        if (selectedClassId || !scores || scores.length === 0) return [];

        const classStats = {};
        scores.forEach(s => {
            if (!classStats[s.className]) {
                classStats[s.className] = { totalScore: 0, count: 0, maxScore: 0 };
            }
            classStats[s.className].totalScore += s.score;
            classStats[s.className].count += 1;
            classStats[s.className].maxScore = Math.max(classStats[s.className].maxScore, s.score);
        });

        return Object.entries(classStats)
            .map(([name, stat]) => ({
                name,
                avg: Math.floor(stat.totalScore / stat.count),
                max: stat.maxScore,
                games: stat.count
            }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 5);
    }, [scores, selectedClassId]);

    // Calculate Current Class Stats
    const stats = React.useMemo(() => {
        if (!scores || scores.length === 0) return { avg: 0, max: 0, total: 0 };
        const total = scores.length;
        const sum = scores.reduce((acc, curr) => acc + curr.score, 0);
        const max = Math.max(...scores.map(s => s.score));
        return {
            avg: Math.round(sum / total),
            max,
            total
        };
    }, [scores]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-10 w-full px-4">
            <div className="flex flex-col items-center gap-6 mb-10 w-full max-w-5xl">
                <div className="flex items-center justify-between w-full">
                    <button onClick={onBack} className="btn-icon-back">
                        <ArrowLeft className="w-8 h-8" />
                    </button>
                    <div className="text-right">
                        <h2 className="text-3xl font-black text-indigo-950">戰績進化中樞</h2>
                        <p className="text-indigo-400 font-bold italic text-sm mt-1">
                            <Heart className="w-4 h-4 inline-block mr-1 fill-rose-500 text-rose-500" /> 用心記住，成就非凡
                        </p>
                    </div>
                </div>

                {/* Class Selector */}
                {/* Class Selector (Centered Scroll) */}
                <div className="w-full overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                    <div className="flex gap-4 w-max mx-auto sm:mx-0 sm:w-full sm:justify-center">
                        <button
                            onClick={() => setSelectedClassId(null)}
                            className={`clay-pill ${!selectedClassId ? 'active' : 'inactive'}`}
                        >
                            🏆 榮譽榜
                        </button>
                        {classes.map(cls => (
                            <button
                                key={cls.id}
                                onClick={() => setSelectedClassId(cls.id)}
                                className={`clay-pill ${selectedClassId === cls.id ? 'active' : 'inactive'}`}
                            >
                                {cls.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {selectedClass ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-5xl mb-12">
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="clay-card p-8 flex flex-col items-center border-emerald-50">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 text-emerald-600"><TrendingUp /></div>
                            <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">平均得分</p>
                            <p className="text-3xl font-black text-indigo-950">{stats.avg}</p>
                        </motion.div>
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="clay-card p-8 flex flex-col items-center border-orange-50">
                            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-4 text-orange-500"><Zap fill="currentColor" /></div>
                            <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">巔峰戰力</p>
                            <p className="text-3xl font-black text-indigo-950">{stats.max}</p>
                        </motion.div>
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="clay-card p-8 flex flex-col items-center border-purple-50">
                            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 text-purple-600"><Calendar /></div>
                            <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-1">累計場次</p>
                            <p className="text-3xl font-black text-indigo-950">{stats.total}</p>
                        </motion.div>
                    </div>

                    <div className="w-full max-w-5xl">
                        <AnalyticsDashboard scores={scores} students={students} />
                    </div>
                </>
            ) : (
                <div className="w-full max-w-4xl flex flex-col gap-8">
                    <div className="clay-card bg-yellow-400 border-none p-10 relative overflow-hidden text-white mb-8">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-300 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl opacity-50" />
                        <div className="relative z-10 flex items-center gap-6">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-[30px] flex items-center justify-center shadow-inner">
                                <Trophy className="w-10 h-10 text-white fill-white" />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black mb-2">班級爭霸戰</h3>
                                <p className="text-yellow-100 font-bold text-lg">最強班級排行榜</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {leaderboardData.map((cls, idx) => (
                            <motion.div
                                key={cls.name}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className="clay-card p-6 flex items-center justify-between group hover:scale-[1.02] transition-transform cursor-pointer"
                                onClick={() => {
                                    const targetClass = classes.find(c => c.name === cls.name);
                                    if (targetClass) setSelectedClassId(targetClass.id);
                                }}
                            >
                                <div className="flex items-center gap-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${idx === 0 ? 'bg-yellow-100 text-yellow-600' :
                                        idx === 1 ? 'bg-slate-100 text-slate-500' :
                                            idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-indigo-50 text-indigo-400'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-indigo-950">{cls.name}</h4>
                                        <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider">{cls.games} 場戰役</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-indigo-600">{cls.avg}</p>
                                    <p className="text-[10px] text-indigo-300 font-bold uppercase">Avg Score</p>
                                </div>
                            </motion.div>
                        ))}

                        {leaderboardData.length === 0 && (
                            <div className="text-center py-20 text-indigo-300 font-bold">
                                尚無任何班級戰績，快去挑戰吧！
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default StatsView;
