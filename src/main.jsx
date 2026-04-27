import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/**
 * v3.9.0 → v3.9.1 自我修復：
 *  舊版 SW 把 Firebase Storage `<img>` 的 no-cors opaque response 存進快取，
 *  造成 fetch() 抓不到照片。這段在 boot 時偵測壞 SW，清掉就 reload 一次。
 *  跑過一次後寫入 localStorage 旗標避免無限 reload。
 */
const SELF_HEAL_KEY = 'recognize_sw_heal_v391';
async function selfHealStaleSW() {
    if (localStorage.getItem(SELF_HEAL_KEY) === 'done') return;
    if (!('serviceWorker' in navigator) || !('caches' in window)) return;

    try {
        // 1. 清掉舊的 firebase-storage-images cache（含壞 opaque response）
        const cacheNames = await caches.keys();
        const targets = cacheNames.filter(n => n.includes('firebase-storage-images'));
        await Promise.all(targets.map(n => caches.delete(n)));

        // 2. 卸掉舊版 SW，讓新版 SW 接手
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));

        localStorage.setItem(SELF_HEAL_KEY, 'done');

        // 3. 有清到東西才 reload，避免無限循環
        if (targets.length > 0 || regs.length > 0) {
            console.info('[recognize] 已清除舊版 PWA 快取，重新整理中...');
            window.location.reload();
        }
    } catch (err) {
        console.warn('[recognize] SW 自我修復失敗（可忽略）:', err);
        localStorage.setItem(SELF_HEAL_KEY, 'done');
    }
}
selfHealStaleSW();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
