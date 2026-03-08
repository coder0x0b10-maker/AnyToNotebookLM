# AnyToNotebookLM - 第一階段規格書

## 總覽
**AnyToNotebookLM** 旨在將任何線上內容來源無縫橋接至 Google NotebookLM，以實現進階的 AI 輔助閱讀、摘要和查詢功能。

## 架構設計
- **資料擷取層：** 指定 `agent-reach` 作為主要的擷取工具。它能原生處理 X/Twitter、Reddit、YouTube、微信公眾號及一般網頁的驗證與解析，並轉換為乾淨的 Markdown 格式。
- **處理與儲存層：** 透過 `notebooklm` 技能作為橋樑。它透過 Cookie 進行驗證，以管理資料來源、建立筆記本並處理查詢。

## 第一階段交付目標
1. **資料擷取流程：** 提供統一的介面，將 URL 傳遞給 `agent-reach` 並輸出解析後的 Markdown 內容。
2. **筆記本同步流程：** 透過 `notebooklm` 工具自動將生成的 Markdown 檔案上傳至指定的筆記本中。
3. **基礎 CLI/指令介面：** 允許使用者透過單一指令完成協作（例如：`/any2nlm <url> --notebook-id <id>`）。

## 未來展望（第二階段）
- 多來源批次擷取。
- 特定作者或 RSS 訂閱源的自動同步。
- 強化元資料標籤。