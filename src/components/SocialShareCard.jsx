import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, X, Trophy, Sparkles, Share2 } from 'lucide-react';

const SocialShareCard = ({ score, total, className, onClose }) => {
    const cardRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        try {
            // Wait a moment for fonts/images to be ready
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                scale: 3, // High resolution
                backgroundColor: null,
                logging: false
            });

            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `recognize-stats-${Date.now()}.png`;
            link.href = url;
            link.click();
        } catch (err) {
            console.error("Screenshot failed", err);
            alert("圖片生成失敗，請稍後再試。");
        } finally {
            setIsGenerating(false);
        }
    };

    const percentage = Math.round((score / (total * 10 || 100)) * 100);
    const title = percentage >= 90 ? "記憶大師" : percentage >= 80 ? "辨認高手" : percentage >= 60 ? "潛力新星" : "特訓學員";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] p-6 max-w-sm w-full flex flex-col gap-6 shadow-2xl transform scale-100 transition-all">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-indigo-950 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-indigo-500" />
                        分享戰績
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Visual Card Area - This is what gets captured */}
                <div ref={cardRef} className="aspect-[4/5] w-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-[32px] p-8 flex flex-col items-center justify-between text-white shadow-xl relative overflow-hidden border-[6px] border-white/20">

                    {/* Background decoration */}
                    <div className="absolute inset-0 opacity-30">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
                    </div>

                    {/* Pattern Overlay */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                    {/* Content */}
                    <div className="text-center z-10 w-full">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full mb-4 border border-white/20">
                            <Sparkles className="w-3 h-3 text-yellow-300" />
                            <span className="text-[10px] font-bold tracking-widest uppercase">Recognize App</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">{className || '自主特訓'}</h2>
                        <p className="text-white/60 text-sm font-medium mt-1">{new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="text-center z-10 relative">
                        <div className="w-28 h-28 bg-gradient-to-tr from-white/20 to-white/5 backdrop-blur-xl rounded-[30px] flex items-center justify-center mx-auto mb-4 border border-white/40 shadow-lg relative group">
                            <div className="absolute inset-0 bg-white/10 blur-xl rounded-full" />
                            <Trophy className="w-14 h-14 text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.5)]" />
                        </div>
                        <div className="flex flex-col items-center">
                            <h1 className="text-7xl font-black drop-shadow-xl tracking-tighter leading-none mb-2">
                                {score}
                            </h1>
                            <div className="px-4 py-1.5 bg-white text-indigo-900 rounded-full font-black text-xs uppercase tracking-widest shadow-lg">
                                {title}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="w-full bg-black/20 backdrop-blur-md rounded-2xl p-4 flex justify-between items-center z-10 border border-white/10">
                        <div className="text-left">
                            <p className="text-[10px] text-white/60 font-medium uppercase tracking-wider mb-0.5">Teacher Tools</p>
                            <p className="text-sm font-bold">阿凱老師的記憶特訓</p>
                        </div>
                        <div className="w-10 h-10 bg-white rounded-lg p-1">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/cagoooo" alt="QR" className="w-full h-full object-contain mix-blend-multiply" />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="btn-clay btn-clay-primary w-full py-4 text-lg flex items-center justify-center gap-2 group"
                >
                    {isGenerating ? (
                        <>正在生成中...</>
                    ) : (
                        <>
                            <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                            下載戰績美圖
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SocialShareCard;
