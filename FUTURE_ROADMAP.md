# 🚀 Recognize App 未來優化建議路線圖 (v3.7.2 後續)

> 截至 v3.7.2，已完成：IndexedDB 離線快取、SWR 同步、長按預覽、ZIP 班級備份、反向/混淆特訓、AI 記憶口訣、Firestore Rules 強化、CI/CD 全環境同步。
> 接下來把「識生學坊」推進到 **智慧視覺輔助、教師協作、教育長期紀錄** 三個層次。

---

## 🥇 優先級總覽（建議實作順序）

| 順位 | 主題 | 預期 ROI | 工程難度 | 風險點 |
|---|---|---|---|---|
| **P0** | 自動人臉對齊與智慧裁切 | ⭐⭐⭐⭐⭐ 視覺感受躍升 | 中（前端 face-api） | bundle size、效能 |
| **P0** | 班級攻略本（高混淆對比表）| ⭐⭐⭐⭐⭐ 教學核心痛點 | 中（Gemini batch）| API quota / 成本 |
| **P1** | 教師班級共享金鑰 | ⭐⭐⭐⭐ 口碑擴散引擎 | 中高（Rules 改寫）| 權限模型 |
| **P1** | PWA 真離線封裝 | ⭐⭐⭐⭐ 偏鄉/外地教學 | 中（SW 快取策略）| 快取爆炸 / 更新流程 |
| **P2** | TTS 語音記憶 | ⭐⭐⭐ 多感官輔助 | 低（Web Speech API）| 中文音色 |
| **P2** | 學期成長軌跡 | ⭐⭐⭐ 情感連結 | 中（資料模型擴充）| 儲存量 |
| **P3** | 觀察家挑戰（情緒辨識）| ⭐⭐ 創新賣點 | 高（AI 倫理）| 學生隱私 |
| **P3** | 多老師戰績排行榜 | ⭐⭐ 社群動機 | 中 | 隱私 / 動機反效果 |

---

## 🛠️ P0：立即可動工的兩支「殺手級」功能

### 1. 🧠 自動人臉對齊與智慧裁切 (Smart Face Cropping)

**痛點**：老師上傳的學生照片來源混雜（畢業照、家長傳的生活照、活動側拍），主體偏移、背景雜亂，導致卡片排版不一致，視覺上像「半成品」。

**技術建議**：
- 採用 **`face-api.js`** 或 **MediaPipe Face Detection (Web)**，前端純客戶端執行，不消耗 Gemini quota
- 流程：上傳 → 偵測 bounding box → 自動以「頭頂留 15% padding、肩膀切齊」邏輯產生 1:1 方形裁切 → IndexedDB 同時保留原圖 + 裁切圖
- **降級策略**：若 face detection 失敗（戴口罩、側臉），fallback 到中央方形裁切，避免阻塞流程
- 加 **「重新裁切」手動按鈕**，避免自動偵測抓錯（例：抓到背景的另一個人）

**實作步驟**：
1. 先在 `lib/faceCrop.js` 寫純函式（input: File → output: Blob）
2. 在 `StudentImport.jsx` 上傳流程接入，加 progress UI
3. IndexedDB schema v3：新增 `croppedBlob` 欄位
4. 加 feature flag，先讓自己班試跑一週

**注意**：
- face-api.js 的 model 約 5-10MB，要走 dynamic import + Service Worker 快取，不能塞進主 bundle
- iPad / 老舊裝置可能會卡，需設 `navigator.hardwareConcurrency` 判斷是否啟用

---

### 2. 📊 班級攻略本 (Class Insight Report)

**痛點**：老師最痛苦的不是「記不住」，而是「分不清那兩個」。需要被主動告知「五甲王小明 vs 李小華需要區分梨渦」。

**技術建議**：
- 在班級頁加「🎯 產生攻略本」按鈕，後端用 Gemini Batch 對該班所有學生兩兩比對
- Prompt 設計：「以下是同班學生 A 與 B 的照片與特徵。請輸出 JSON：{ similarity: 0-1, distinguishingPoint: '王小明有梨渦，李小華較圓臉' }」
- 只儲存 similarity > 0.7 的 pair，避免資料爆炸
- 結果存 Firestore `class_insights/{classId}` 集合，加上 generatedAt timestamp，三個月後失效重新產生

**UI 呈現**：
- 高混淆學生 pair 卡片化呈現，並排兩張照片 + 紅色 highlight 區分點
- 進入特訓模式時，「極限混淆」自動優先抽取攻略本內的 pair
- 攻略本內每組可加「我已掌握 ✓」狀態，完成度同步到首頁進度條

**成本評估**：一個 30 人班 = C(30,2) = 435 次 Gemini call，用 `gemini-2.5-flash-lite` 約 NT$3-5/班，可接受

---

## 👥 P1：擴散引擎與離線韌性

### 3. 🔑 教師班級共享金鑰 (Class Share Token)

**現況**：科任老師每年要重複建檔 6-8 個班，是放棄使用的最大門檻。

**設計建議**：
- 班級新增 `shareToken: <隨機 22 字元>` 與 `sharedWith: [uid1, uid2]`
- 班導師在班級設定頁產生「分享連結」`https://recognize.app/join?token=xxx`
- 科任老師點擊 → Firestore Function 驗證 token → 將該老師 uid 加入 `sharedWith`
- **權限模型**：`sharedWith` 內的老師可 **讀取** 學生資料與照片，但 **戰績獨立**（`scores` 文件加 `teacherUid` 區分）

**Firestore Rules 改寫**（重點，改錯會炸）：
```
match /classes/{classId} {
  allow read: if isSignedIn() && (
    resource.data.teacherUid == request.auth.uid ||
    request.auth.uid in resource.data.sharedWith
  );
  allow write: if isOwner(resource.data.teacherUid); // 只有班導能改
}
match /students/{studentId} {
  allow read: if isSignedIn() && (
    get(/databases/$(database)/documents/classes/$(resource.data.classId)).data.teacherUid == request.auth.uid ||
    request.auth.uid in get(...).data.sharedWith
  );
}
```

**注意**：
- `get()` 在 rules 內每次都算 1 次讀取，會放大費用 → 學生集合內也要冗餘存 `sharedWith`，犧牲一致性換取讀取效能
- 撤銷機制：班導必須能 1 鍵把某老師從 `sharedWith` 踢掉
- 寫測試：用 Firebase Emulator + `@firebase/rules-unit-testing` 跑 rules CI

---

### 4. 📡 PWA 真離線封裝 (Always-On Mode)

**現況**：雖有 IndexedDB 快取，但首次載入仍依賴網路；Service Worker 策略尚未深度優化。

**建議**：
- 升級 Service Worker 為 **Workbox** 並用 `injectManifest` 模式
- 策略分流：
  - `*.js / *.css / *.html` → CacheFirst with NetworkFallback (含版本號)
  - 學生照片 (Storage URL) → StaleWhileRevalidate，快取上限 500MB
  - Firestore API → NetworkOnly，但前端要能處理離線狀態
- 加 **離線徽章**：頂部出現「📡 離線模式 - 顯示本地快取資料」橫幅
- 加 **「整班離線封裝」按鈕**：一鍵把該班學生 + 照片全 prefetch 到 SW cache，露營 / 校外教學前用

**注意**：
- iPadOS Safari 對 SW 快取有 50MB 軟限制，超過會被 evict → 需偵測並提醒老師
- 版本更新流程要寫好 `skipWaiting()` + 「有新版可用」toast，否則會撞到 PWA 經典坑（使用者看舊版半年）
- 參考你已有的 `pwa-cache-bust` skill

---

## 🎤 P2：感官擴充與時間維度

### 5. 🔊 TTS 語音記憶（Voice Annotations）

**建議**：
- 長按預覽彈出時，自動以 `Web Speech API.speechSynthesis` 念出「王小明 - 戴黑框眼鏡，左臉有梨渦」
- 加 **「靜音模式」開關**，並記住裝置 preference
- 若是中文發音差（Chrome on Windows 中文音色不佳），可選用 **Google Cloud TTS** 的 `cmn-TW-Wavenet-A`，但要走 proxy（避免暴露 key）

**進階**：
- 老師可錄製「自己唸名字」的 30s 音檔覆蓋 TTS（學生最熟悉的還是老師自己的聲音）
- 在 IndexedDB 存 audioBlob，與照片一起打包進 ZIP 備份

---

### 6. 📈 學期成長軌跡 (Growth Timeline)

**建議**：
- 學生資料模型新增 `photoHistory: [{ semester: '2026-上', photoUrl, uploadedAt }]`
- 每學期老師上傳新照片時，舊照片自動歸檔而非覆蓋
- 學生詳情頁新增 timeline 視圖，可滑動比對「一年級 → 六年級」的變化
- 畢業時可一鍵產生「成長紀念冊 PDF」（呼應你的 `pdf-export-print-best-practice` skill，用 `window.print()` + `@media print`）

**儲存成本**：每學生 6 張 × 200KB ≈ 1.2MB，30 人班 = 36MB，Firebase Storage 免費層內可承受

---

## 🧪 P3：實驗性 / 需審慎評估

### 7. 😊 觀察家挑戰（情緒辨識）

**直接建議**：**先不要做**。
- 對國小學童做情緒分類，家長 / 學校行政可能會反彈（「為什麼 AI 在分析我小孩開不開心」）
- 替代方案：改成「**特徵觀察挑戰**」——AI 標記照片中的客觀視覺特徵（戴眼鏡、馬尾、運動服），老師需從特徵反推學生，避開情緒爭議

### 8. 🏆 多老師戰績排行榜

**注意風險**：教師圈是熟人圈，公開排行可能造成壓力反效果。
- 改成「**自己 vs 自己**」的歷史進步曲線
- 或匿名化的「全國老師中位數對比」，只比百分位不顯名

---

## 🧰 跨切面技術債（背景任務）

這些不是新功能，但累積到一定程度會拖慢迭代速度，建議排程處理：

### A. 測試覆蓋率提升至 80%
- 目前 ~63%，但「核心邏輯 100%」是個樂觀估計
- 應補：`useRecognitionStats` 的 race condition、IndexedDB 升級流程、ZIP 匯入的損壞檔處理
- 加 Playwright E2E：登入 → 建班 → 匯入 → 玩一輪測驗 → 驗證戰績寫入

### B. Sentry 或類似錯誤監控
- 目前線上錯誤完全靠老師回報
- 用 Sentry 免費層（5K events/月足夠）抓住 production 的 silent failure
- 特別注意 IndexedDB quota exceed、Firestore offline persistence 衝突

### C. 效能 budget
- 用 Lighthouse CI 在每次 PR 跑分，設 budget：FCP < 1.5s、TTI < 3s、bundle < 500KB
- face-api.js 進來後一定會炸這條線，提前規劃 dynamic import

### D. Firestore 索引與成本健檢
- 跑一輪 `firebase firestore:indexes` 檢查是否有 N+1 查詢
- 用 Firebase Usage Dashboard 看 reads/writes 趨勢，學生數成長後容易破免費層
- 攻略本功能上線前，先估清楚 Gemini + Firestore 的月成本天花板

### E. i18n 預備
- 即使現在只有中文，把所有 UI 字串集中到 `i18n/zh-TW.json`
- 未來想推給東南亞、日韓的繁中老師時不用重構

### F. 無障礙 (a11y)
- 跑一次 axe-core，補 alt text、aria-label、focus-visible
- 學生詳情 Modal 要支援 ESC 關閉、focus trap
- 戰績圖表（Recharts）要有 SR 替代文字

---

## 🎯 90 天落地建議（如果你只能挑三件事）

1. **第 1-30 天**：P0-1 自動人臉裁切（純前端，無新成本）+ Sentry 接入
2. **第 31-60 天**：P0-2 班級攻略本（含 Gemini batch + 攻略本驅動的特訓 pair 抽選）
3. **第 61-90 天**：P1-3 教師班級共享金鑰（含 Rules unit testing）

完成這三件，App 會從「個人記憶輔助工具」進化為「學校級教師協作平台」，值得發布 v4.0.0 大版號。

---

> [!IMPORTANT]
> **建議下個版本：v3.8.0** 命名為「視覺一致性升級」，主推 P0-1 + 攻略本 MVP。
> v4.0.0 留給「教師協作」（共享金鑰 + 真離線 PWA）作為里程碑事件。

---

*最後更新：2026-04-27*
*維護人：石門國小阿凱老師 × Claude Opus 4.7*
