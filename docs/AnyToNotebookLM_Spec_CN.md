# AnyToNotebookLM - 规格日期：2026-03-13

## 问题陈述

用户需要一种简单的方法，将网页内容添加为 Google NotebookLM 笔记本中的来源。现有方案通常需要手动复制粘贴或复杂的工作流。AnyToNotebookLM 通过提供一个单一命令，从任意 URL 提取内容并直接上传到指定的 NotebookLM 笔记本来解决这个问题。

## 目标

**主要目标：** 提供一个单一命令，将 URL 提取与 NotebookLM 来源上传打通。

**具体目标：**
- 从单个 URL 提取内容并生成干净的 Markdown 格式
- 将该 Markdown 作为来源上传到指定的 NotebookLM 笔记本
- 保持无状态执行（不持久化任何配置或缓存）
- 提供清晰的错误信息与可操作的诊断提示
- 提供可靠的退出码，便于自动化与脚本集成

## 非目标

**明确不在范围内：**
- 在 NotebookLM 中查询或对已上传内容执行提示词/问答
- 批量导入（多个 URL）或定时同步
- 长期凭据管理（认证交由底层工具处理）
- 超出单个来源标题的丰富元数据标注
- 笔记本创建或管理（必须指向既有笔记本）
- 跨平台支持（仅 Linux 实现）
- Web 界面或 GUI（仅 CLI）

## 架构与集成模式

**技术栈：**
- **编排器：** Node.js/TypeScript CLI
- **提取：** `agent-reach` CLI 用于 URL 内容提取
- **上传：** `notebooklm` CLI 用于 NotebookLM 集成
- **运行环境：** 本地 Linux 环境，通过 shell 执行外部命令

**分层职责：**
- **编排层：** 输入校验、临时文件管理、外部工具调用、错误处理
- **提取层：** `agent-reach` 负责站点解析与来源平台认证
- **上传层：** `notebooklm` CLI 负责 NotebookLM 认证与来源上传

**约束：**
- Cookie/认证由本工具之外处理（用户必须预先完成 `notebooklm` 登录）
- 所有命令通过本地 Linux 的 shell 执行
- 不提供任何持久化配置或状态管理

## 端到端流程

1. **输入校验：** CLI 校验必需参数与前置条件
2. **搜索（若使用 --search）：** 通过 Agent Reach Exa 执行语义搜索，呈现结果，让用户选择（或若使用 --auto-select 则自动选择）
3. **笔记本解析：** 通过以下任一方式解析目标笔记本 id：
   - 显式提供 `--notebook-id`，或
   - `--notebook-name`，或
   - `--notebook-keyword`
4. **内容提取：** 调用 `agent-reach` 将 URL 提取为 Markdown
5. **临时文件创建：** 将 Markdown 内容写入临时 `.md` 文件
6. **笔记本上传：** 调用 `notebooklm source add "<markdown_file_path>" --notebook "<notebook_id>" --title "<source_title>"`
7. **清理：** 删除临时文件
8. **退出：** 返回合适的退出码（成功为 0，失败为非 0）

## CLI 契约

### 主命令
```bash
any2nlm (<url> | --search <query>) (--notebook-id <uuid> | --notebook-name <name> | --notebook-keyword <keyword>) [--title <title>] [--out <path>] [--dry-run] [--notebook-match-mode <mode>] [--auto-select] [--limit <number>] [--preview]
```

### 参数规范

**必需参数：**
- 以下二者之一：
  - `<url>`：提取工具所支持的任意 URL
  - `--search <query>`：通过 Agent Reach Exa 语义搜索查找相关 URL
- 以下三者之一：
  - `--notebook-id <uuid>`：必须指向既有的 NotebookLM 笔记本
  - `--notebook-name <name>`：用于匹配的笔记本显示名称
  - `--notebook-keyword <keyword>`：用于在笔记本名称中搜索的关键字

**可选参数：**
- `--notebook-match-mode <mode>`：使用 `--notebook-name` 或 `--notebook-keyword` 时的选择行为
  - `exact`：仅接受单个完全相同（区分大小写）的名称匹配
  - `contains`：不区分大小写的子串匹配
  - `regex`：正则表达式匹配（正则引擎由实现决定）
  - 默认：`contains`
- `--auto-select`：自动选择第一条搜索结果（无交互提示）
- `--limit <number>`：获取搜索结果的数量（默认：10）
- `--preview`：为每条搜索结果显示简短摘要
- `--title <title>`：NotebookLM 中显示的来源标题（默认：由 URL 推导）
- `--out <path>`：将提取的 Markdown 写入指定路径（同时仍会上载）
- `--dry-run`：仅执行提取与输出，不上传至 NotebookLM

### 笔记本解析规则

- **优先级：**
  - 若提供 `--notebook-id`，直接使用。
  - 否则解析 `--notebook-name`。
  - 否则解析 `--notebook-keyword`。
- **解析机制：**
  - CLI 通过 `notebooklm` CLI 获取用户的笔记本列表（具体子命令由实现决定）。
  - CLI 使用所选匹配模式选择唯一的 notebook id。
- **歧义处理：**
  - 若匹配结果为 0 个，以退出码 `2` 退出并打印提示信息。
  - 若匹配到多个，以退出码 `2` 退出并打印匹配的笔记本名称/id，并提示使用 `--notebook-id`。

### 输出产物

**标准输出：**
- 人类可读的进度日志，展示每个步骤
- 成功/失败确认以及相关细节

**文件输出（指定 `--out` 时）：**
- 在指定路径生成干净的 Markdown 文件
- 内容与将要上传到 NotebookLM 的内容完全一致

**错误输出：**
- 将可操作的错误信息输出到 stderr
- 针对缺少依赖、认证问题或参数错误提供明确提示

### 退出码

- `0`：成功（已提取并上传，或 dry-run 成功完成）
- `2`：参数错误（缺少必需 flag 或参数格式不正确）
- `11`：无搜索结果（Exa 搜索无结果）
- `10`：提取失败（`agent-reach` 提取失败）
- `20`：上传失败（`notebooklm` 上传失败）
- `30`：缺少前置条件（必需工具未安装或不可执行）

## 假设与前置条件

**系统要求：**
- 本地 Linux 环境
- Node.js（v18 或更高）用于运行 CLI
- 可用于调用外部工具的 shell

**外部依赖：**
- 已安装并可正常使用 `agent-reach` CLI 进行 URL 提取
- 已安装 `notebooklm` CLI，且已完成 Google 账号认证
- 用户通过以下任一方式指向既有笔记本：
  - `--notebook-id`，或
  - 可成功解析的 `--notebook-name` / `--notebook-keyword`

**认证模型：**
- 所有认证均在本工具之外完成
- 用户需先单独运行 `notebooklm auth login`，再使用 AnyToNotebookLM
- 本工具不保存任何凭据或 token

## 错误处理与可观测性

**失败模式：**
- **空内容：** 若提取结果为空/仅空白，以退出码 10 失败
- **工具不可用：** 若找不到 `agent-reach` 或 `notebooklm`，以退出码 30 失败
- **上传失败：** 若 `notebooklm` 命令失败，包含底层输出并以退出码 20 失败
- **参数错误：** 缺少必需 flag 或参数格式不正确，以退出码 2 失败
- **笔记本未找到/歧义：** 通过名称/关键字解析时，若无匹配或多匹配，以退出码 2 失败并输出指引

**清理行为：**
- 成功与失败均需删除临时文件
- 不留下任何残留状态或配置

**日志策略：**
- 将进度信息输出到 stdout（提取进度、上传确认）
- 将错误细节输出到 stderr，并附带可操作提示
- 不记录敏感信息（token、cookie）

## 验收标准

**成功标准：**
- 给定支持的 URL 与可解析的笔记本目标（id、名称或关键字），命令可成功上传新的来源到目标笔记本
- 提取内容保持良好的 Markdown 格式与结构
- 来源标题正确设置（自定义或由 URL 推导）
- 执行结束后临时文件被正确清理

**失败标准：**
- 参数错误应立即以退出码 2 退出并给出清晰错误信息
- 缺少必需工具应以退出码 30 退出并提供安装指引
- 提取失败应以退出码 10 退出并提供诊断信息
- 上传失败应以退出码 20 退出并包含底层错误输出
- 名称/关键字匹配到 0 个或多个笔记本时，以退出码 2 退出，并列出匹配结果（若有）并提示使用 `--notebook-id`

**无状态标准：**
- 不创建任何配置文件或持久化状态
- 不保存任何凭据或 token
- 多次运行互相独立，不产生副作用

## 实现备注

**标题推导逻辑：**
- 若存在首个 Markdown 标题（# Title），默认使用其作为标题
- 若无标题，回退为 URL 域名
- 若仍不可得，最终回退为时间戳名称

**临时文件管理：**
- 在系统临时目录创建唯一文件名
- 在 finally 块中执行清理以确保删除
- 设置合适的文件权限，便于外部工具访问

**命令执行：**
- 通过 shell 执行所有外部命令并进行完善的错误处理
- 捕获 stdout/stderr 用于日志与错误报告
- 设置合理超时，避免进程卡住

## 未来考虑

**潜在增强：**
- 通过 URL 列表文件实现多来源批量提取
- RSS 或特定作者内容的定时同步
- 强化元数据标注与分类
- 笔记本自动创建能力
- 跨平台支持（Windows/macOS）
- 为非技术用户提供 Web 界面

**集成机会：**
- 浏览器扩展：一键提取 URL
- API 服务：提供编程接口
- 与常见笔记/知识管理平台集成
- 支持 `agent-reach` 之外的其它提取工具