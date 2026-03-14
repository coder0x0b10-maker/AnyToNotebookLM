# AnyToNotebookLM - 規格日期：2026-03-13

## 問題陳述

使用者需要一個簡單的方法，將網路內容新增為 Google NotebookLM 筆記本中的資料來源。現有解法往往需要手動複製貼上或繁瑣的工作流程。AnyToNotebookLM 透過提供單一指令，從任意 URL 擷取內容並直接上傳到指定的 NotebookLM 筆記本，以解決此問題。

## 目標

**主要目標：** 提供一個單一指令，將 URL 內容擷取與 NotebookLM 來源上傳串接起來。

**具體目標：**
- 從單一 URL 擷取內容並轉為乾淨的 Markdown 格式
- 將該 Markdown 作為來源上傳到指定的 NotebookLM 筆記本
- 維持無狀態執行（不保存任何持久化設定或快取）
- 提供清楚的錯誤回報與可行的診斷提示
- 提供可靠的結束碼（exit code），便於自動化與腳本整合

## 非目標

**明確不在範圍內：**
- 在 NotebookLM 中查詢或對上傳內容執行提示詞/問答
- 批次擷取（多個 URL）或排程同步
- 長期憑證管理（驗證交由底層工具處理）
- 超出單一來源標題的豐富元資料標註
- 筆記本建立或管理（必須指向既有筆記本）
- 跨平台支援（僅 Linux 實作）
- Web 介面或 GUI（僅 CLI）

## 架構與整合模式

**技術棧：**
- **協調器：** Node.js/TypeScript CLI
- **擷取：** `agent-reach` CLI 用於 URL 內容擷取
- **上傳：** `notebooklm` CLI 用於 NotebookLM 整合
- **執行環境：** 本機 Linux 環境，以 shell 執行外部指令

**分層職責：**
- **協調層：** 輸入驗證、暫存檔案管理、外部工具呼叫、錯誤處理
- **擷取層：** `agent-reach` 負責站點解析與來源平台驗證
- **上傳層：** `notebooklm` CLI 負責 NotebookLM 驗證與來源上傳

**限制：**
- Cookie/驗證由本工具以外處理（使用者必須先讓 `notebooklm` 完成登入）
- 所有指令透過本機 Linux 的 shell 執行
- 不提供任何持久化設定或狀態管理

## 端到端流程

1. **輸入驗證：** CLI 驗證必要參數與先決條件
2. **搜尋（若使用 --search）：** 透過 Agent Reach Exa 執行語義搜尋，呈現結果，讓使用者選擇（或若使用 --auto-select 則自動選擇）
3. **筆記本解析：** 以下列任一方式解析目標筆記本 id：
   - 明確指定 `--notebook-id`，或
   - `--notebook-name`，或
   - `--notebook-keyword`
4. **內容擷取：** 呼叫 `agent-reach` 將 URL 擷取為 Markdown
5. **暫存檔建立：** 將 Markdown 內容寫入暫存 `.md` 檔
6. **筆記本上傳：** 呼叫 `notebooklm source add "<markdown_file_path>" --notebook "<notebook_id>" --title "<source_title>"`
7. **清理：** 移除暫存檔案
8. **結束：** 回傳適當的結束碼（成功為 0，失敗為非 0）

## CLI 契約

### 主要指令
```bash
any2nlm (<url> | --search <query>) (--notebook-id <uuid> | --notebook-name <name> | --notebook-keyword <keyword>) [--title <title>] [--out <path>] [--dry-run] [--notebook-match-mode <mode>] [--auto-select] [--limit <number>] [--preview]
```

### 參數規格

**必要參數：**
- 下列二者擇一：
  - `<url>`：擷取工具所支援的任意 URL
  - `--search <query>`：透過 Agent Reach Exa 語義搜尋尋找相關 URL
- 下列三者擇一：
  - `--notebook-id <uuid>`：必須指向既有的 NotebookLM 筆記本
  - `--notebook-name <name>`：要匹配的筆記本顯示名稱
  - `--notebook-keyword <keyword>`：用於在筆記本名稱中搜尋的關鍵字

**選用參數：**
- `--notebook-match-mode <mode>`：使用 `--notebook-name` 或 `--notebook-keyword` 時的選擇行為
  - `exact`：僅接受單一筆完全相同（大小寫敏感）的名稱匹配
  - `contains`：大小寫不敏感的子字串匹配
  - `regex`：正規表示式匹配（regex 引擎由實作決定）
  - 預設：`contains`
- `--auto-select`：自動選擇第一筆搜尋結果（無互動提示）
- `--limit <number>`：取得搜尋結果的數量（預設：10）
- `--preview`：為每筆搜尋結果顯示簡短摘要
- `--title <title>`：NotebookLM 中顯示的來源標題（預設：由 URL 推導）
- `--out <path>`：將擷取出的 Markdown 寫入指定路徑（並仍會上傳）
- `--dry-run`：僅進行擷取與輸出，不上傳至 NotebookLM

### 筆記本解析規則

- **優先順序：**
  - 若提供 `--notebook-id`，直接使用。
  - 否則解析 `--notebook-name`。
  - 否則解析 `--notebook-keyword`。
- **解析機制：**
  - CLI 透過 `notebooklm` CLI 取得使用者筆記本清單（實際子指令由實作決定）。
  - CLI 使用所選匹配模式挑選唯一的 notebook id。
- **歧義處理：**
  - 若無任何筆記本匹配，使用結束碼 `2` 並印出提示訊息。
  - 若匹配到多筆，使用結束碼 `2` 並列出匹配的筆記本名稱/id，並提示改用 `--notebook-id`。

### 輸出產物

**標準輸出：**
- 以人類可讀的進度日誌顯示各步驟
- 成功/失敗確認與相關細節

**檔案輸出（指定 `--out` 時）：**
- 在指定路徑產出乾淨的 Markdown 檔
- 內容與上傳至 NotebookLM 的內容完全一致

**錯誤輸出：**
- 將可行的錯誤訊息輸出到 stderr
- 針對缺少依賴、驗證問題或參數錯誤提供具體提示

### 結束碼

- `0`：成功（已擷取並上傳，或 dry-run 成功完成）
- `2`：參數錯誤（缺少必要旗標或格式不正確）
- `11`：無搜尋結果（Exa 搜尋無結果）
- `10`：擷取失敗（`agent-reach` 無法擷取內容）
- `20`：上傳失敗（`notebooklm` 無法上傳內容）
- `30`：缺少先決條件（必要工具未安裝或不可執行）

## 假設與先決條件

**系統需求：**
- 本機 Linux 環境
- Node.js（v18 或以上）用於執行 CLI
- 具備可呼叫外部工具的 shell

**外部依賴：**
- 已安裝並可正常使用 `agent-reach` CLI 進行 URL 擷取
- 已安裝 `notebooklm` CLI，且已完成 Google 帳號登入
- 使用者以以下任一方式指定既有筆記本：
  - `--notebook-id`，或
  - 可成功解析的 `--notebook-name` / `--notebook-keyword`

**驗證模型：**
- 所有驗證均在本工具外處理
- 使用者需先個別執行 `notebooklm auth login` 再使用 AnyToNotebookLM
- 本工具不保存任何憑證或 token

## 錯誤處理與可觀測性

**失敗模式：**
- **空內容：** 若擷取結果為空/僅空白，結束碼為 10
- **工具不可用：** 若找不到 `agent-reach` 或 `notebooklm`，結束碼為 30
- **上傳失敗：** 若 `notebooklm` 指令失敗，包含底層輸出並以結束碼 20 結束
- **參數錯誤：** 缺少必要旗標或格式不正確，以結束碼 2 結束
- **筆記本不存在/歧義：** 以名稱/關鍵字解析時若無匹配或多筆匹配，以結束碼 2 結束並輸出指引

**清理行為：**
- 成功與失敗皆必須移除暫存檔
- 不留下任何殘留狀態或設定

**日誌策略：**
- 將進度資訊輸出至 stdout（擷取進度、上傳確認）
- 將錯誤細節輸出至 stderr 並附上可行提示
- 不記錄敏感資訊（token、cookie）

## 驗收標準

**成功標準：**
- 給定支援的 URL 與可解析的筆記本目標（id、名稱或關鍵字），指令可成功上傳新的來源到目標筆記本
- 擷取內容維持良好的 Markdown 格式與結構
- 來源標題正確設定（自訂或由 URL 推導）
- 執行完成後暫存檔確實清除

**失敗標準：**
- 參數錯誤立即以結束碼 2 結束並提供清楚錯誤訊息
- 缺少必要工具時以結束碼 30 結束並提供安裝指引
- 擷取失敗以結束碼 10 結束並提供診斷資訊
- 上傳失敗以結束碼 20 結束並包含底層錯誤輸出
- 名稱/關鍵字匹配 0 筆或多筆時以結束碼 2 結束，並列出匹配結果（若有）與提示改用 `--notebook-id`

**無狀態標準：**
- 不建立任何設定檔或持久化狀態
- 不保存任何憑證或 token
- 多次執行彼此獨立，不產生副作用

## 實作備註

**標題推導邏輯：**
- 若 Markdown 首個標題（# Title）存在，預設取其作為標題
- 若無標題，回退使用 URL 網域名稱
- 若仍不可得，最後回退為時間戳記名稱

**暫存檔管理：**
- 在系統暫存目錄建立唯一檔名
- 以 finally 區塊確保清理
- 設定適當檔案權限，便於外部工具存取

**指令執行：**
- 透過 shell 執行所有外部指令並妥善處理錯誤
- 擷取 stdout/stderr 以利日誌與錯誤回報
- 設定合理的逾時，避免程序無限等待

## 未來考量

**潛在增強：**
- 透過 URL 清單檔進行多來源批次擷取
- RSS 或特定作者內容的排程同步
- 強化元資料標註與分類
- 筆記本自動建立能力
- 跨平台支援（Windows/macOS）
- 為非技術使用者提供 Web 介面

**整合機會：**
- 瀏覽器擴充套件：一鍵擷取 URL
- API 伺服器：提供程式化存取
- 與常見筆記/知識管理平台整合
- 支援 `agent-reach` 以外的其他擷取工具