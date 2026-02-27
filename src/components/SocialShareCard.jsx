import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, X, Trophy, Sparkles, Share2, Star } from 'lucide-react';

const SocialShareCard = ({ score, total, className, onClose }) => {
    const cardRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await html2canvas(cardRef.current, {
                useCORS: true,
                scale: 3,
                backgroundColor: '#312e81',
                logging: false,
                // Strip ALL class-based styles from cloned DOM to prevent oklab
                onclone: (_doc, el) => {
                    el.querySelectorAll('*').forEach(node => {
                        // Remove every class — inline styles carry the design
                        node.removeAttribute('class');
                        node.style.backdropFilter = 'none';
                        node.style.webkitBackdropFilter = 'none';
                        node.style.filter = 'none';
                    });
                },
            });

            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `recognize-${Date.now()}.png`;
            link.href = url;
            link.click();
        } catch (err) {
            console.error('Screenshot failed', err);
            alert('圖片生成失敗，請稍後再試。');
        } finally {
            setIsGenerating(false);
        }
    };

    const percentage = total > 0 ? Math.round((score / (total * 100)) * 100) : 0;
    const level =
        percentage >= 90 ? { label: '記憶大師', emoji: '👑', color: '#fbbf24' } :
            percentage >= 80 ? { label: '辨認高手', emoji: '🏆', color: '#f97316' } :
                percentage >= 60 ? { label: '潛力新星', emoji: '⭐', color: '#a78bfa' } :
                    { label: '特訓學員', emoji: '💪', color: '#6ee7b7' };

    // Card uses ONLY inline styles so html2canvas never sees oklab computed values
    const cardStyle = {
        width: '100%',
        background: 'linear-gradient(145deg, #312e81 0%, #4c1d95 40%, #1e1b4b 100%)',
        borderRadius: 28,
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            padding: '16px 16px',
            overflowY: 'auto',
        }}>
            <div style={{
                background: '#fff',
                borderRadius: 40,
                padding: 20,
                maxWidth: 400,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
                margin: 'auto',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Share2 size={18} color="#6366f1" /> 分享戰績
                    </h3>
                    <button onClick={onClose} style={{
                        background: '#f1f5f9', border: 'none', borderRadius: '50%',
                        width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <X size={18} color="#94a3b8" />
                    </button>
                </div>

                {/* ── Capture Zone ── */}
                <div ref={cardRef} style={cardStyle}>
                    {/* Decorative circles */}
                    <div style={{
                        position: 'absolute', top: -60, right: -60,
                        width: 200, height: 200,
                        borderRadius: '50%',
                        background: 'rgba(139,92,246,0.35)',
                    }} />
                    <div style={{
                        position: 'absolute', bottom: -40, left: -40,
                        width: 160, height: 160,
                        borderRadius: '50%',
                        background: 'rgba(99,102,241,0.25)',
                    }} />

                    {/* Top badge */}
                    <div style={{ textAlign: 'center', zIndex: 1 }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 999, padding: '4px 14px', marginBottom: 12,
                        }}>
                            <Sparkles size={12} color="#fde047" />
                            <span style={{ color: '#c7d2fe', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                Recognize App
                            </span>
                        </div>
                        <div style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>
                            {className || '自主特訓'}
                        </div>
                        <div style={{ color: 'rgba(199,210,254,0.7)', fontSize: 12, marginTop: 4 }}>
                            {new Date().toLocaleDateString('zh-TW')}
                        </div>
                    </div>

                    {/* Trophy + Score */}
                    <div style={{ textAlign: 'center', zIndex: 1 }}>
                        <div style={{
                            width: 84, height: 84,
                            background: 'rgba(255,255,255,0.1)',
                            border: '2px solid rgba(255,255,255,0.2)',
                            borderRadius: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 12px',
                        }}>
                            <Trophy size={42} color="#fde047" />
                        </div>
                        <div style={{ color: '#fff', fontSize: 64, fontWeight: 900, lineHeight: 1, letterSpacing: '-2px' }}>
                            {score}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(199,210,254,0.7)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            POINTS
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: level.color,
                            color: '#1e1b4b',
                            borderRadius: 999, padding: '4px 14px', marginTop: 10,
                            fontWeight: 900, fontSize: 13,
                        }}>
                            {level.emoji} {level.label}
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 16,
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        zIndex: 1,
                        boxSizing: 'border-box',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        <div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Teacher Tools</div>
                            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>阿凱老師的記憶特訓</div>
                        </div>
                        <img
                            src="https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=https://github.com/cagoooo"
                            alt="QR"
                            style={{ width: 32, height: 32, borderRadius: 6, background: '#fff', padding: 2, flexShrink: 0 }}
                            crossOrigin="anonymous"
                        />
                    </div>
                </div>

                {/* Download button */}
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    style={{
                        background: isGenerating ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 20,
                        padding: '16px 0',
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        width: '100%',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                        transition: 'all 0.2s',
                    }}
                >
                    {isGenerating ? '⏳ 生成中...' : <><Download size={18} /> 下載戰績美圖</>}
                </button>
            </div>
        </div>
    );
};

export default SocialShareCard;
