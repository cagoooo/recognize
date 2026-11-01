# Gemini API 選用與維護規範

## 📡 模型選用核心政策 (Model Selection)

> [!IMPORTANT]
> **當前最穩定模型：`gemini-2.5-flash-lite`**
>
> 理由：
> 1. **`gemini-1.5-flash` 已經停用**。
> 2. `gemini-2.5-flash-lite` 在圖片辨識與 JSON 物件生成的穩定度最高，且支援最新的 Vision 功能。

## 🛡️ 穩定性強化機制 (Stability & Resilience)

1. **自動重試 (Exponential Backoff)**:
   - 後端 `functions/index.js` 的 `generateText` 針對 5xx 與 `finishReason: OTHER` 最多嘗試 3 次。
   - 重試等待時間：1s -> 2s。

2. **圖片預處理 (Image Resizing)**:
   - 所有傳送至 API 的圖片必須透過 `resizeImageForAi`（於 `src/lib/geminiClient.js`）縮放至 **512px**，以降低 Token 消耗與請求延遲。

3. **雙重快取 (Double Caching)**:
   - 實作於 `localStorage` (前綴 `gemini_memory_anchor_`)，避免重複呼叫 API，節省額度並提昇 UX。

## 🔐 金鑰與後端呼叫 (v3.15.0 起)

> [!IMPORTANT]
> **公開網頁不得含 Gemini 金鑰。** 前端只透過 `askGemini()`（`src/lib/geminiClient.js`）呼叫 Cloud Function `recognizeCallGemini`。

- **金鑰**：Secret Manager 的 `RECOGNIZE_GEMINI_API_KEY`，實體金鑰「識生學坊 後端專用」在 `photopoet-ha364`，沿用該專案的 AI Studio 花費上限；輪換金鑰後要重新部署 Function。
- **提示詞與模型**：都在 `functions/tasks.js`，前端只能指定任務（`memoryAnchor` / `describe` / `compare`）。新增 AI 功能要先在這裡加任務。
- **速率限制**：每人每小時 200 次、全站每天 2000 次，計數在 Firestore `recognize_gemini_usage`（只有後端能讀寫）。
- **共用專案注意**：`face-2fa85` 同時給「學生肖像權使用授權」使用，線上 Firestore 規則比本 repo 多一段 `signatures`。
  - 部署一律用 `firebase deploy --only functions:recognize --project face-2fa85 --account cagooo@gmail.com`。
  - **不要**執行 `firebase deploy`、`--only functions` 或 `--only firestore`，會動到另一個 app。

---
*最後修訂：2026-11-01*
*維護者：石門國小阿凱老師與 Antigravity AI*
