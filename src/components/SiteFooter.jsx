/**
 * SiteFooter — 網站頁尾（品牌區＋重點＋作者署名）
 * 樣式寫在 index.css 的「網站頁尾」段落（專案的 * { padding: 0 } 會蓋掉 Tailwind 的間距 class）。
 * 署名連到阿凱老師教育科技創新專區；列印時隱藏。
 */

import React from 'react';
import { GraduationCap, Sparkles, Camera, Gamepad2 } from 'lucide-react';

const POINTS = [
    { Icon: Sparkles, tone: 'indigo', title: 'AI 記憶特徵', desc: '由後端代呼叫 Gemini，網頁不含金鑰' },
    { Icon: Camera, tone: 'rose', title: '自動人臉裁切', desc: 'MediaPipe 在瀏覽器端偵測與置中' },
    { Icon: Gamepad2, tone: 'orange', title: '挑戰辨認＋攻略本', desc: '遊戲練習，搭配班級相似臉孔比對' },
];

const SiteFooter = () => (
    <footer className="site-footer">
        <div className="site-footer__card">
            <div className="site-footer__inner">
                <div className="site-footer__brand">
                    <div className="brand-logo-clay relative overflow-hidden flex-shrink-0">
                        <GraduationCap className="text-white w-6 h-6 relative z-10" />
                    </div>
                    <div>
                        <strong>識生學坊</strong>
                        <span>幫老師快速記住每一位學生的臉與名字</span>
                    </div>
                </div>
                <ul className="site-footer__points">
                    {POINTS.map((point) => {
                        const PointIcon = point.Icon;
                        return (
                            <li key={point.title}>
                                <span className={`site-footer__icon site-footer__icon--${point.tone}`}>
                                    <PointIcon className="w-5 h-5" />
                                </span>
                                <span>
                                    <strong>{point.title}</strong>
                                    <small>{point.desc}</small>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <p className="site-footer__credit">
                Made with <span className="site-footer__heart" aria-label="愛心">❤️</span> by{' '}
                <a
                    href="https://cagoooo.github.io/Akai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="阿凱老師教育科技創新專區"
                    className="site-footer__author"
                >
                    阿凱老師
                </a>
                <span className="site-footer__school">
                    <span className="site-footer__dot" aria-hidden="true">・</span>
                    桃園市龍潭區石門國民小學
                </span>
            </p>
        </div>
    </footer>
);

export default SiteFooter;
