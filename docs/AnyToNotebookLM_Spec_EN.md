# AnyToNotebookLM - Specification Date: 2026-03-13

## Problem Statement

Users need a simple way to add web content as sources to their Google NotebookLM notebooks. Existing solutions require manual copy-pasting or complex workflows. AnyToNotebookLM solves this by providing a single command that extracts content from any URL and uploads it directly to a specified NotebookLM notebook.

## Goals

**Primary Goal:** Provide a single command that bridges URL extraction to NotebookLM source upload.

**Specific Objectives:**
- Extract content from one URL into clean Markdown format
- Upload that Markdown into a specified NotebookLM notebook as a source
- Maintain stateless execution (no persistent config or caching)
- Provide clear error reporting with actionable diagnostics
- Ensure reliable exit codes for automation and scripting

## Non-Goals

**Explicitly Out of Scope:**
- Querying NotebookLM or running prompts against uploaded content
- Batch ingestion (multiple URLs) or scheduled syncing
- Managing long-lived credentials (auth delegated to underlying tools)
- Rich metadata tagging beyond a single source title
- Notebook creation or management (must target existing notebooks)
- Cross-platform support (Linux-only implementation)
- Web interface or GUI (CLI-only)

## Architecture & Integration Pattern

**Technology Stack:**
- **Orchestrator:** Node.js/TypeScript CLI
- **Extraction:** Platform-aware routing using Agent-Reach toolchain (`xreach` for X, `yt-dlp` for YouTube, `gh` for GitHub, Jina Reader for generic web)
- **Upload:** `notebooklm` CLI for NotebookLM integration
- **Execution:** Local Linux environment with shell command execution

**Layer Responsibilities:**
- **Orchestration Layer:** Input validation, temporary file management, external tool invocation, error handling
- **Extraction Layer:** Platform-aware routing to Agent-Reach toolchain (xreach, yt-dlp, gh, Jina Reader) with per-platform authentication handling
- **Upload Layer:** `notebooklm` CLI manages NotebookLM authentication and source upload

**Constraints:**
- Cookie/authentication handled outside this tool (user must pre-authenticate with `notebooklm`)
- All command execution via shell on local Linux environment
- No persistent configuration or state management

## End-to-End Flow

1. **Input Validation:** CLI validates required arguments and prerequisites
2. **Search (if --search):** Perform semantic search via Agent Reach Exa, present results, and let the user select (or auto-select if --auto-select)
3. **Notebook Resolution:** Resolve the target notebook id from either:
   - explicit `--notebook-id`, or
   - `--notebook-name`, or
   - `--notebook-keyword`
4. **Content Extraction:** Route URL extraction by platform; use Agent-Reach toolchain (`xreach`, `yt-dlp`, `gh`, Jina Reader) to produce Markdown
5. **Temporary File Creation:** Write Markdown content to temporary `.md` file
6. **Notebook Upload:** Call `notebooklm source add "<markdown_file_path>" --notebook "<notebook_id>" --title "<source_title>"`
7. **Cleanup:** Remove temporary files
8. **Exit:** Return appropriate exit code (0 on success, non-zero on failure)

## CLI Contract

### Primary Command
```bash
any2nlm (<url> | --search <query>) (--notebook-id <uuid> | --notebook-name <name> | --notebook-keyword <keyword>) [--title <title>] [--out <path>] [--dry-run] [--notebook-match-mode <mode>] [--auto-select] [--limit <number>] [--preview]
```

### Arguments Specification

**Required Arguments:**
- One of:
  - `<url>`: Any supported URL for the configured extraction tool
  - `--search <query>`: Semantic search query to find relevant URLs via Agent Reach Exa
- One of:
  - `--notebook-id <uuid>`: Must reference an existing NotebookLM notebook
  - `--notebook-name <name>`: Notebook display name to match
  - `--notebook-keyword <keyword>`: Keyword to search within notebook names

**Optional Arguments:**
- `--notebook-match-mode <mode>`: Notebook selection behavior when `--notebook-name` or `--notebook-keyword` is used
  - `exact`: only accept a single exact (case-sensitive) name match
  - `contains`: case-insensitive substring match
  - `regex`: regular expression match (implementation-defined regex engine)
  - default: `contains`
- `--auto-select`: Automatically select the top search result (no interactive prompt)
- `--limit <number>`: Number of search results to fetch (default: 10)
- `--preview`: Show a short snippet for each search result
- `--title <title>`: Source title displayed in NotebookLM (default: derived from URL)
- `--out <path>`: Write extracted Markdown to this path (in addition to uploading)
- `--dry-run`: Perform extraction and file output steps but do not upload to NotebookLM

### Notebook Resolution Rules

- **Precedence:**
  - If `--notebook-id` is provided, it is used directly.
  - Otherwise `--notebook-name` is resolved.
  - Otherwise `--notebook-keyword` is resolved.
- **Resolution mechanism:**
  - The CLI obtains the user’s notebook list via the `notebooklm` CLI (exact subcommand is implementation-defined).
  - The CLI then selects a single notebook id using the chosen match mode.
- **Ambiguity handling:**
  - If zero notebooks match, exit with code `2` and print a helpful message.
  - If more than one notebook matches, exit with code `2` and print the matching notebook names/ids and a hint to use `--notebook-id`.

### Output Artifacts

**Standard Output:**
- Human-readable progress logs showing each step
- Success/failure confirmation with relevant details

**File Output (when `--out` specified):**
- Clean Markdown file at the specified path
- Content identical to what would be uploaded to NotebookLM

**Error Output:**
- Actionable error messages to stderr
- Specific hints for missing dependencies, auth issues, or invalid parameters

### Exit Codes

- `0`: Success - content extracted and uploaded (or dry-run completed)
- `2`: Invalid arguments - missing required flags or malformed parameters
- `11`: No search results - Exa search returned no results
- `10`: Extraction failure - platform-specific extractor failed (xreach/yt-dlp/gh/Jina Reader)
- `20`: Upload failure - `notebooklm` failed to upload content
- `30`: Missing prerequisites - required tools not installed or not executable

## Assumptions & Prerequisites

**System Requirements:**
- Local Linux environment
- Node.js (v18 or higher) for CLI execution
- Shell access for external tool invocation

**External Dependencies:**
- `curl` (for generic web extraction via Jina Reader)
- `xreach` (optional, required for X/Twitter URL extraction)
- `yt-dlp` (optional, required for YouTube URL extraction)
- `gh` CLI (optional, required for GitHub URL extraction)
- `notebooklm` CLI - Already authenticated with Google account
- User targets an existing NotebookLM notebook via either:
  - `--notebook-id`, or
  - a resolvable `--notebook-name` / `--notebook-keyword`

**Authentication Model:**
- All authentication handled outside this tool
- User must run `notebooklm auth login` separately before using AnyToNotebookLM
- No credential management or persistence within this tool

## Error Handling & Observability

**Failure Modes:**
- **Empty Content:** If extraction returns empty/whitespace content, fail with exit code 10
- **Tool Unavailable:** If required platform tool (xreach, yt-dlp, gh, curl) not found, fail with exit code 30
- **Upload Failure:** If `notebooklm` command fails, include underlying tool output and exit with code 20
- **Invalid Arguments:** Missing required flags or malformed parameters result in exit code 2
- **Notebook Not Found / Ambiguous:** When resolving by name/keyword, if the match set is empty or has multiple results, exit with code 2 and print guidance

**Cleanup Behavior:**
- Always remove temporary files on both success and failure
- No residual state or configuration left behind

**Logging Strategy:**
- Progress information to stdout (extraction progress, upload confirmation)
- Error details to stderr with actionable hints
- No sensitive information (tokens, cookies) logged

## Acceptance Criteria

**Success Criteria:**
- Given a supported URL and a resolvable notebook target (id, name, or keyword), the command successfully uploads a new source to the target notebook
- Extracted content maintains proper Markdown formatting and structure
- Source title is correctly set (either custom or derived from URL)
- Temporary files are properly cleaned up after execution

**Failure Criteria:**
- Invalid arguments result in immediate exit with code 2 and clear error message
- Missing tools result in exit code 30 with installation guidance
- Extraction failures result in exit code 10 with diagnostic information
- Upload failures result in exit code 20 with underlying error details
- Notebook name/keyword that matches zero or multiple notebooks results in exit code 2 with a list of matches (if any) and a hint to use `--notebook-id`

**Statelessness Criteria:**
- No configuration files or persistent state created
- No credentials or tokens stored by this tool
- Multiple runs can be executed independently without side effects

## Implementation Notes

**Title Derivation Logic:**
- Default title extracted from first Markdown heading (# Title) if available
- Fallback to URL domain name if no heading found
- Final fallback to timestamp-based name if both above fail

**Temporary File Management:**
- Files created in system temp directory with unique names
- Cleanup performed in finally blocks to ensure removal
- File permissions set appropriately for external tool access

**Command Execution:**
- All external commands executed via shell with proper error handling
- Stdout/stderr captured for logging and error reporting
- Reasonable timeouts implemented to prevent hanging

## Future Considerations

**Potential Enhancements:**
- Multi-source batch ingestion with URL list files
- Scheduled syncing for RSS feeds or author-specific content
- Enhanced metadata tagging and categorization
- Notebook auto-creation capabilities
- Cross-platform support (Windows/macOS)
- Web interface for non-technical users

**Integration Opportunities:**
- Browser extension for one-click URL extraction
- API server for programmatic access
- Integration with popular note-taking platforms
- Support for additional extraction tools beyond agent-reach