import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/**
 * 啟動時要求所有現有 SW 自我更新（fetch sw.js 對比）
 * 配合 vite-plugin-pwa 的 skipWaiting + clientsClaim，新版會立刻接管
 * 真正的版本檢查 + 使用者觸發更新由 useVersionCheck / VersionBadge 負責
 */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update().catch(() => { }));
    });
    // 新 SW 接管時，部分情況需要 reload 才會跑新 chunk
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
