import React, { useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, AlertCircle, Sparkles, Share2 } from 'lucide-react';
import SocialShareCard from './SocialShareCard';

const AnalyticsDashboard = ({ scores, students }) => {
    const [showShareCard, setShowShareCard] = useState(false);
    // 1. 計算成長趨勢 (取最近 10 筆)
    const growthData = useMemo(() => {
        if (!scores || scores.length === 0) return [];
        return scores
            .slice(0, 10)
            .reverse()
            .map((s, index) => ({
                name: `Game ${index + 1}`,
                score: s.score,
                accuracy: s.accuracy,
                date: s.timestamp?.toDate().toLocaleDateString() || ''
            }));
    }, [scores]);

    // 2. 計算「需加強名單」 (根據學生的 stats.correctAttempts / stats.totalAttempts)
    const hardToRememberData = useMemo(() => {
        if (!students || students.length === 0) return [];

        const stats = students
            .map(s => {
                const total = s.stats?.totalAttempts || 0;
                const correct = s.stats?.correctAttempts || 0;
                const accuracy = total === 0 ? 100 : (correct / total) * 100; // 沒練過算 100% 避免誤判
                return {
                    name: s.name,
                    accuracy: Math.round(accuracy),
                    total,
                    photoUrl: s.photoUrl
                };
            })
            .filter(s => s.total > 0 && s.accuracy < 80) // 只顯示練習過且正確率低於 80% 的
            .sort((a, b) => a.accuracy - b.accuracy) // 由低到高排序
            .slice(0, 5); // 取前 5 名

        return stats;
    }, [students]);

    return (
        <div className="w-full space-y-8">
            {/* 成長曲線圖 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="clay-card p-8 bg-white/80 backdrop-blur-sm"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-indigo-950">成長趨勢</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Recent Performance</p>
                        </div>
                    </div>
                    {scores && scores.length > 0 && (
                        <button
                            onClick={() => setShowShareCard(true)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-2 rounded-full transition-colors"
                            title="分享最新戰績"
                        >
                            <Share2 className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={growthData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                            <Tooltip
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                                cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="score"
                                stroke="#6366f1"
                                strokeWidth={4}
                                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 8, fill: '#4f46e5' }}
                                animationDuration={1500}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* 難以辨認名單 (重點加強) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="clay-card p-8 bg-white/80 backdrop-blur-sm border-orange-100"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-orange-100 rounded-xl text-orange-500">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-indigo-950">重點加強名單</h3>
                        <p className="text-orange-300 text-xs font-bold uppercase tracking-wider">Hardest to Recall</p>
                    </div>
                </div>

                {hardToRememberData.length > 0 ? (
                    <div className="space-y-4">
                        {hardToRememberData.map((student, index) => (
                            <div key={student.name} className="flex items-center justify-between p-4 bg-orange-50/50 rounded-2xl hover:bg-orange-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        {student.photoUrl ? (
                                            <img src={student.photoUrl} alt={student.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center text-orange-600 font-bold border-2 border-white shadow-md">
                                                {student.name[0]}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm text-xs font-black text-orange-500">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-indigo-900">{student.name}</p>
                                        <p className="text-xs text-orange-400 font-bold">準確率 {student.accuracy}%</p>
                                    </div>
                                </div>
                                <div className="w-24 h-2 bg-orange-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${student.accuracy}%` }}
                                        className={`h-full rounded-full ${student.accuracy < 50 ? 'bg-rose-500' : 'bg-orange-400'}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="text-emerald-600 font-bold">目前沒有需要特別加強的學生！</p>
                        <p className="text-slate-400 text-sm mt-1">大家的辨認率都在 80% 以上，太棒了！</p>
                    </div>
                )}
            </motion.div>


            {/* Social Share Modal */}
            {
                showShareCard && scores && scores.length > 0 && (
                    <SocialShareCard
                        score={scores[0].score} // Assuming scores are sorted desc
                        total={10} // GameMode is hardcoded to 10
                        className="自主特訓"
                        onClose={() => setShowShareCard(false)}
                    />
                )
            }
        </div >
    );
};

export default AnalyticsDashboard;
