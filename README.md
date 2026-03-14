# AnyToNotebookLM

A lightweight bridge that turns a single online URL into clean Markdown and uploads it as a source into an existing Google NotebookLM notebook.

> **Note**: AnyToNotebookLM is built on top of two amazing open-source tools:
> - [Agent-Reach](https://github.com/Panniantong/Agent-Reach) - For semantic search and content extraction
> - [notebooklm-py](https://github.com/teng-lin/notebooklm-py) - For NotebookLM CLI integration

## Features

- **Platform-aware extraction**: Automatically routes to the best extractor for each platform
  - X/Twitter posts via `xreach`
  - YouTube videos via `yt-dlp` (includes metadata and transcripts)
  - GitHub repositories/issues/PRs via `gh` CLI
  - Generic web content via Jina Reader API
- **Semantic search**: Find relevant URLs using Agent Reach Exa search
- **Flexible notebook targeting**: Use notebook ID, name matching, or keyword search
- **Interactive selection**: Choose from search results or auto-select top result
- Upload extracted Markdown to NotebookLM notebooks
- Stateless, locally-run CLI
- Proper error handling and exit codes
- Dry-run mode for testing
- Optional file output

## Prerequisites

AnyToNotebookLM depends on two core utilities that must be installed and configured:

### 🔧 **Core Dependencies (Required)**

1. **Agent-Reach** - Semantic search and platform-specific extraction
   - **Repository**: https://github.com/Panniantong/Agent-Reach
   - **Purpose**: Provides semantic search (Exa) and platform-specific extractors
   - **Used for**: `--search` functionality and URL content extraction
   - **Note**: Without Agent-Reach, most features will not work

   ```bash
   # Install Agent-Reach
   pip install agent-reach
   
   # Setup and configure
   agent-reach setup
   
   # Verify installation
   agent-reach --version
   ```

2. **notebooklm-py** - NotebookLM CLI interface
   - **Repository**: https://github.com/teng-lin/notebooklm-py
   - **Purpose**: Provides CLI interface to Google NotebookLM
   - **Used for**: All notebook operations (list, upload source)
   - **Note**: Must be authenticated before use

   ```bash
   # Install notebooklm-py
   pip install notebooklm-cli
   
   # Authenticate with your Google account
   notebooklm auth login
   
   # Verify installation and authentication
   notebooklm list
   ```

### 🛠️ **Platform-Specific Tools (Install as needed)**

3. **Platform extraction tools** (install based on URLs you plan to use):
   - **Generic web**: `curl` (usually pre-installed)
   - **X/Twitter**: `xreach` (`npm install -g xreach-cli`)
   - **YouTube**: `yt-dlp` (`pip install yt-dlp`)
   - **GitHub**: `gh` CLI (`gh auth login` if needed)

### ⚠️ **Important Notes**

- **Agent-Reach and notebooklm-py are mandatory** - AnyToNotebookLM cannot function without them
- **Authentication required** - Both tools need proper setup/authentication before first use
- **Platform tools are conditional** - Only install the specific extractors for the platforms you use

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd AnyToNotebookLM

# 1. Install Node.js dependencies
npm install

# 2. Install and setup core dependencies (REQUIRED)
# Agent-Reach
pip install agent-reach
agent-reach setup

# notebooklm-py
pip install notebooklm-cli
notebooklm auth login

# 3. Verify core dependencies are working
agent-reach --version
notebooklm list

# 4. Install platform-specific tools (as needed)
# For X/Twitter: npm install -g xreach-cli
# For YouTube: pip install yt-dlp
# For GitHub: gh auth login (if not already done)

# 5. Build AnyToNotebookLM
npm run build

# 6. Make the CLI globally available (optional)
npm link
```

### 🔍 **Installation Verification**

Test your installation with a dry run:

```bash
# Test with direct URL
any2nlm https://example.com --notebook-name "Test" --dry-run

# Test with search (requires Agent-Reach setup)
any2nlm --search "test query" --notebook-name "Test" --dry-run --limit 1
```

## Usage

### Basic Usage

```bash
any2nlm <url> --notebook-id <uuid>
```

### Full Command Options

```bash
any2nlm (<url> | --search <query>) (--notebook-id <uuid> | --notebook-name <name> | --notebook-keyword <keyword>) [--title <string>] [--out <path>] [--dry-run] [--notebook-match-mode <mode>] [--auto-select] [--limit <number>] [--preview]
```

### Arguments

**Content Source (one of):**
- `<url>` - Direct URL to extract content from
- `--search <query>` - Semantic search query to find relevant URLs via Agent Reach Exa

**Notebook Target (one of):**
- `--notebook-id <uuid>` - Specific NotebookLM notebook ID
- `--notebook-name <name>` - Notebook display name to match
- `--notebook-keyword <keyword>` - Keyword to search within notebook names

**Optional:**
- `--notebook-match-mode <mode>` - Notebook selection behavior (exact, contains, regex) (default: contains)
- `--auto-select` - Automatically select the top search result (no interactive prompt)
- `--limit <number>` - Number of search results to fetch (default: 10)
- `--preview` - Show a short snippet for each search result
- `--title <string>` - Custom source title (optional, auto-derived if not provided)
- `--out <path>` - Write extracted Markdown to this path (optional)
- `--dry-run` - Perform extraction but do not upload to NotebookLM (optional)

### Examples

```bash
# Direct URL extraction
any2nlm https://example.com/article --notebook-id 12345678-1234-1234-1234-123456789012

# Semantic search with interactive selection
any2nlm --search "machine learning transformers" --notebook-name "Research Notes"

# Semantic search with auto-selection
any2nlm --search "latest AI news" --notebook-keyword "ai" --auto-select

# Search with preview and limited results
any2nlm --search "climate change" --notebook-name "Environment" --limit 5 --preview

# Platform-specific extractions
any2nlm https://twitter.com/user/status/123456789 --notebook-name "Social Media"
any2nlm https://youtube.com/watch?v=dQw4w9WgXcQ --notebook-name "Videos"
any2nlm https://github.com/owner/repo/issues/123 --notebook-name "Development"

# Notebook targeting options
any2nlm https://example.com/article --notebook-name "Research Notes"
any2nlm https://example.com/article --notebook-keyword "research" --notebook-match-mode contains
any2nlm https://example.com/article --notebook-name "Research Notes" --notebook-match-mode exact
any2nlm https://example.com/article --notebook-keyword ".*Research.*" --notebook-match-mode regex

# With custom title and file output
any2nlm https://example.com/article --notebook-name "Research Notes" --title "My Article" --out ./article.md

# Dry run (extract only, don't upload)
any2nlm https://example.com/article --notebook-name "Research Notes" --dry-run

# Search with dry run
any2nlm --search "python programming" --notebook-name "Tech" --dry-run --preview
```

## Exit Codes

- `0`: Success
- `2`: Invalid arguments / missing required flags
- `11`: No search results - Exa search returned no results
- `10`: Extraction failure - platform-specific extractor failed (xreach/yt-dlp/gh/Jina Reader)
- `20`: Upload failed (`notebooklm` failure)
- `30`: Missing prerequisites (tools not installed)

## Development

```bash
# Run in development mode
npm run dev -- <url> --notebook-id <uuid>
npm run dev -- --search "query" --notebook-name "Notebook"

# Build for production
npm run build
```

## Architecture

- **CLI Layer**: Command-line interface using Commander.js with interactive search selection
- **Search Layer**: Agent Reach Exa integration for semantic URL discovery
- **Extraction Layer**: Platform-aware routing to specialized extractors:
  - `xreach` for X/Twitter posts
  - `yt-dlp` for YouTube videos (metadata + transcripts)
  - `gh` CLI for GitHub repositories/issues/PRs
  - Jina Reader API for generic web content
- **Notebook Resolution**: Flexible notebook targeting with name/keyword matching
- **Upload Layer**: Uses `notebooklm` CLI for NotebookLM integration
- **Orchestration**: Coordinates the end-to-end flow with proper error handling

## 🔧 **Troubleshooting**

### Common Dependency Issues

**"Missing prerequisite: agent-reach is not installed"**
```bash
# Solution: Install Agent-Reach
pip install agent-reach
agent-reach setup

# For issues, see: https://github.com/Panniantong/Agent-Reach
```

**"Missing prerequisite: notebooklm is not installed"**
```bash
# Solution: Install notebooklm-py
pip install notebooklm-cli
notebooklm auth login

# For issues, see: https://github.com/teng-lin/notebooklm-py
```

**"Exa search failed" or "No search results found"**
```bash
# Solution: Check Agent-Reach setup
agent-reach doctor
agent-reach watch  # Test search functionality

# For search issues, see: https://github.com/Panniantong/Agent-Reach
```

**"notebooklm auth required"**
```bash
# Solution: Authenticate with Google
notebooklm auth login
notebooklm list  # Verify authentication

# For auth issues, see: https://github.com/teng-lin/notebooklm-py
```

**Platform-specific extraction failures**
```bash
# For X/Twitter: Install xreach
npm install -g xreach-cli

# For YouTube: Install yt-dlp
pip install yt-dlp

# For GitHub: Setup gh CLI
gh auth login
```

### Verification Commands

```bash
# Check all dependencies
agent-reach --version
notebooklm list
curl --version
gh --version  # if using GitHub
yt-dlp --version  # if using YouTube
```
