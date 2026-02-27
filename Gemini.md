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
   - 全域函式 `withRetry` (於 `src/lib/gemini.js`) 針對 503 (High Demand) 錯誤進行最多 3 次嘗試。
   - 重試等待時間：1s -> 2s -> 4s。

2. **圖片預處理 (Image Resizing)**:
   - 所有傳送至 API 的圖片必須透過 `resizeImageForAi` 縮放至 **512px**，以降低 Token 消耗與請求延遲。

3. **雙重快取 (Double Caching)**:
   - 實作於 `localStorage` (前綴 `gemini_memory_anchor_`)，避免重複呼叫 API，節省額度並提昇 UX。

---
*最後修訂：2026-02-27*
*維護者：石門國小阿凱老師與 Antigravity AI*
