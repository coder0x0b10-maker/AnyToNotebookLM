"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnyToNotebookLM = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class AnyToNotebookLM {
    constructor() {
        this.tempFiles = [];
    }
    async run(options) {
        try {
            console.log(`[AnyToNotebookLM] Starting extraction from: ${options.url}`);
            // Step 1: Validate notebook target options
            this.validateNotebookOptions(options);
            // Step 2: Resolve notebook ID if not provided directly
            const notebookId = await this.resolveNotebookId(options);
            // Step 3: Extract content using agent-reach
            const markdownContent = await this.extractContent(options.url);
            // Check for meaningful content (not just headers/metadata or JSON responses)
            const contentLines = markdownContent.split('\n').filter(line => {
                const trimmed = line.trim();
                return trimmed &&
                    !trimmed.startsWith('Title:') &&
                    !trimmed.startsWith('URL Source:') &&
                    !trimmed.startsWith('Published Time:') &&
                    !trimmed.startsWith('Warning:') &&
                    !trimmed.startsWith('Markdown Content:') &&
                    !trimmed.startsWith('{') && // Skip JSON responses
                    trimmed.length > 5; // Skip very short lines
            });
            if (!markdownContent.trim() || contentLines.length === 0) {
                this.handleError('Extraction returned empty or insufficient content', 10);
            }
            console.log(`[AnyToNotebookLM] Successfully extracted ${markdownContent.length} characters`);
            // Step 4: Write to output path if specified
            if (options.outputPath) {
                this.writeToFile(options.outputPath, markdownContent);
                console.log(`[AnyToNotebookLM] Content written to: ${options.outputPath}`);
            }
            // Step 5: Upload to NotebookLM (unless dry run)
            if (!options.dryRun) {
                await this.uploadToNotebookLM(notebookId, markdownContent, options.title);
                console.log(`[AnyToNotebookLM] Successfully uploaded to NotebookLM notebook: ${notebookId}`);
            }
            else {
                console.log(`[AnyToNotebookLM] Dry run completed - content not uploaded`);
            }
            this.cleanup();
            process.exit(0);
        }
        catch (error) {
            this.cleanup();
            throw error;
        }
    }
    async extractContent(url) {
        try {
            const platform = this.detectPlatform(url);
            console.log(`[Extraction] Detected platform: ${platform}`);
            switch (platform) {
                case 'x':
                    return await this.extractFromX(url);
                case 'youtube':
                    return await this.extractFromYouTube(url);
                case 'github':
                    return await this.extractFromGitHub(url);
                case 'web':
                default:
                    return await this.extractFromWeb(url);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleError(`URL extraction failed: ${errorMessage}`, 10);
        }
    }
    validateNotebookOptions(options) {
        const notebookTargets = [options.notebookId, options.notebookName, options.notebookKeyword].filter(Boolean);
        if (notebookTargets.length === 0) {
            this.handleError('One of --notebook-id, --notebook-name, or --notebook-keyword must be specified', 2);
        }
        if (notebookTargets.length > 1) {
            this.handleError('Only one of --notebook-id, --notebook-name, or --notebook-keyword can be specified', 2);
        }
        if (options.notebookMatchMode && !['exact', 'contains', 'regex'].includes(options.notebookMatchMode)) {
            this.handleError(`Invalid match mode: ${options.notebookMatchMode}. Must be one of: exact, contains, regex`, 2);
        }
    }
    async resolveNotebookId(options) {
        // If notebook ID is provided directly, use it
        if (options.notebookId) {
            return options.notebookId;
        }
        // Otherwise, resolve by name or keyword
        console.log(`[Notebook Resolution] Fetching notebook list...`);
        const notebooks = await this.fetchNotebookList();
        let matches;
        const matchMode = options.notebookMatchMode || 'contains';
        if (options.notebookName) {
            matches = this.matchNotebooksByName(notebooks, options.notebookName, matchMode);
        }
        else if (options.notebookKeyword) {
            matches = this.matchNotebooksByKeyword(notebooks, options.notebookKeyword, matchMode);
        }
        else {
            this.handleError('No notebook resolution method available', 2);
        }
        if (matches.length === 0) {
            this.handleError('No notebooks found matching the specified criteria', 2);
        }
        if (matches.length > 1) {
            console.error('[ERROR] Multiple notebooks match your criteria:');
            matches.forEach(match => {
                console.error(`  - ${match.name} (ID: ${match.id})`);
            });
            console.error('[ERROR] Please use --notebook-id to specify the exact notebook ID');
            this.handleError('Multiple notebook matches found', 2);
        }
        const selectedNotebook = matches[0];
        console.log(`[Notebook Resolution] Selected notebook: ${selectedNotebook.name} (${selectedNotebook.id})`);
        return selectedNotebook.id;
    }
    async fetchNotebookList() {
        try {
            // Check if notebooklm CLI is available
            this.checkPrerequisite('notebooklm');
            // Use notebooklm CLI to list notebooks with JSON output if available, otherwise parse table
            let command = 'bash -c "source /home/moltrpi5/.venv/nlm_env/bin/activate && notebooklm list --json 2>/dev/null || notebooklm list"';
            let output = (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' });
            // Parse the output to extract notebook information
            const notebooks = this.parseNotebookList(output);
            return notebooks;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleError(`Failed to fetch notebook list: ${errorMessage}`, 30);
        }
    }
    parseNotebookList(output) {
        // Try to parse as JSON first
        try {
            const jsonData = JSON.parse(output);
            if (jsonData.notebooks && Array.isArray(jsonData.notebooks)) {
                return jsonData.notebooks.map((item) => ({
                    id: item.id,
                    name: item.title
                }));
            }
        }
        catch (error) {
            // Not JSON, fall back to table parsing
        }
        // Parse as table format (fallback)
        const notebooks = [];
        // Split by lines and process each line
        const lines = output.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Try different regex patterns to match UUID and title
            // Pattern 1: UUID followed by title in same line
            let match = line.match(/\│\s*([a-f0-9-]{20,36})\s*\│\s*([^│\s][^│]*?)\s*\│/);
            if (!match) {
                // Pattern 2: UUID followed by title (more flexible)
                match = line.match(/([a-f0-9-]{20,36})[^│]*\│\s*([^│\s][^│]*?)\s*\│/);
            }
            if (match) {
                const id = match[1];
                let name = match[2].trim();
                // Look ahead for additional title lines
                let j = i + 1;
                while (j < lines.length && j < i + 5) {
                    const nextLine = lines[j];
                    // Stop conditions
                    if (nextLine.match(/[a-f0-9-]{20,36}/) || nextLine.includes('└') || nextLine.match(/┃\s*Owner/)) {
                        break;
                    }
                    // Extract additional title content
                    const additionalMatch = nextLine.match(/\│\s+([^│]+?)\s*\│/);
                    if (additionalMatch) {
                        const additionalText = additionalMatch[1].trim();
                        if (additionalText &&
                            additionalText !== 'Owner' &&
                            additionalText !== 'Created' &&
                            !additionalText.match(/^\d{4}-\d{2}-\d{2}$/) &&
                            additionalText !== '') {
                            name += ' ' + additionalText;
                        }
                    }
                    j++;
                }
                // Clean up and validate
                name = name.replace(/\s+/g, ' ').trim();
                if (name &&
                    name !== id &&
                    !name.match(/^[a-f0-9-]{20,36}$/) &&
                    name.length > 3) {
                    notebooks.push({ id, name });
                }
            }
        }
        return notebooks;
    }
    matchNotebooksByName(notebooks, name, mode) {
        switch (mode) {
            case 'exact':
                return notebooks.filter(nb => nb.name === name);
            case 'contains':
                return notebooks.filter(nb => nb.name.toLowerCase().includes(name.toLowerCase()));
            case 'regex':
                try {
                    const regex = new RegExp(name, 'i');
                    return notebooks.filter(nb => regex.test(nb.name));
                }
                catch (error) {
                    this.handleError(`Invalid regular expression: ${name}`, 2);
                }
            default:
                return notebooks;
        }
    }
    matchNotebooksByKeyword(notebooks, keyword, mode) {
        switch (mode) {
            case 'exact':
                return notebooks.filter(nb => nb.name.toLowerCase() === keyword.toLowerCase());
            case 'contains':
                return notebooks.filter(nb => nb.name.toLowerCase().includes(keyword.toLowerCase()));
            case 'regex':
                try {
                    const regex = new RegExp(keyword, 'i');
                    return notebooks.filter(nb => regex.test(nb.name));
                }
                catch (error) {
                    this.handleError(`Invalid regular expression: ${keyword}`, 2);
                }
            default:
                return notebooks;
        }
    }
    async uploadToNotebookLM(notebookId, content, title) {
        try {
            // Check if notebooklm CLI is available
            this.checkPrerequisite('notebooklm');
            // Create temporary file for content
            const tempFilePath = path.join('/tmp', `any2nlm_${Date.now()}.md`);
            this.tempFiles.push(tempFilePath);
            fs.writeFileSync(tempFilePath, content);
            // Derive title if not provided
            const sourceTitle = title || this.deriveTitleFromContent(content);
            console.log(`[NotebookLM] Uploading to notebook: ${notebookId}`);
            console.log(`[NotebookLM] Source title: ${sourceTitle}`);
            // Use the notebooklm CLI
            const command = `source /home/moltrpi5/.venv/nlm_env/bin/activate && notebooklm source add "${tempFilePath}" --notebook "${notebookId}" --title "${sourceTitle}"`;
            (0, child_process_1.execSync)(command, { shell: "/bin/bash", stdio: 'inherit' });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleError(`NotebookLM upload failed: ${errorMessage}`, 20);
        }
    }
    writeToFile(outputPath, content) {
        try {
            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(outputPath, content);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleError(`Failed to write to output file: ${errorMessage}`, 1);
        }
    }
    deriveTitleFromContent(content) {
        // Try to extract title from first heading
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('# ')) {
                return trimmed.substring(2).trim();
            }
        }
        // Fallback to generic title
        return `Extracted Content ${new Date().toISOString().split('T')[0]}`;
    }
    checkPrerequisite(tool) {
        try {
            (0, child_process_1.execSync)(`which ${tool}`, { stdio: 'ignore' });
        }
        catch (error) {
            this.handleError(`Missing prerequisite: ${tool} is not installed or not in PATH`, 30);
        }
    }
    detectPlatform(url) {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();
            const pathname = parsed.pathname.toLowerCase();
            if ((hostname.includes('twitter.com') || hostname.includes('x.com')) && pathname.includes('/status/')) {
                return 'x';
            }
            if ((hostname.includes('youtube.com') && pathname.includes('/watch')) || hostname.includes('youtu.be')) {
                return 'youtube';
            }
            if (hostname.includes('github.com')) {
                return 'github';
            }
            return 'web';
        }
        catch (error) {
            this.handleError(`Invalid URL: ${url}`, 2);
            // Unreachable due to handleError, but TypeScript needs a return
            return 'web';
        }
    }
    async extractFromX(url) {
        this.checkPrerequisite('xreach');
        console.log(`[Extraction] Using xreach for X/Twitter URL: ${url}`);
        const command = `xreach tweet "${url}" --json`;
        let output;
        try {
            output = (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' });
        }
        catch (error) {
            throw new Error(`xreach failed. Ensure cookies are configured (use a small account).`);
        }
        if (!output.trim()) {
            throw new Error(`xreach returned empty content for ${url}`);
        }
        const data = JSON.parse(output);
        const lines = [
            `# Tweet by @${data.username || 'unknown'}`,
            ``,
            data.text || '',
            ``,
            `**Created:** ${data.created_at || 'unknown'}`,
            `**Stats:** ${data.retweet_count || 0} RTs, ${data.like_count || 0} Likes`,
            `**Link:** ${url}`,
        ];
        if (data.media && data.media.length > 0) {
            lines.push('', '**Media:**');
            data.media.forEach((m) => lines.push(`- ${m.url || m.preview_url || 'no URL'}`));
        }
        return lines.join('\n').trim();
    }
    async extractFromYouTube(url) {
        this.checkPrerequisite('yt-dlp');
        console.log(`[Extraction] Using yt-dlp for YouTube URL: ${url}`);
        const jsonCmd = `yt-dlp --dump-single-json "${url}"`;
        let jsonOut;
        try {
            jsonOut = (0, child_process_1.execSync)(jsonCmd, { encoding: 'utf-8', stdio: 'pipe' });
        }
        catch (error) {
            throw new Error(`yt-dlp failed to fetch metadata for ${url}`);
        }
        if (!jsonOut.trim()) {
            throw new Error(`yt-dlp returned empty metadata for ${url}`);
        }
        const meta = JSON.parse(jsonOut);
        const lines = [
            `# ${meta.title || 'Untitled Video'}`,
            ``,
            `**Channel:** ${meta.uploader || 'Unknown'}`,
            `**Uploaded:** ${meta.upload_date || 'Unknown'}`,
            `**Duration:** ${meta.duration ? `${Math.floor(meta.duration / 60)}:${(meta.duration % 60).toString().padStart(2, '0')}` : 'Unknown'}`,
            ``,
            `## Description`,
            meta.description || 'No description',
        ];
        if (meta.subtitles && typeof meta.subtitles === 'object') {
            const langKeys = Object.keys(meta.subtitles);
            const preferred = ['en', 'zh', 'zh-Hans', 'zh-Hant'];
            const chosen = preferred.find(l => langKeys.includes(l)) || langKeys[0];
            if (chosen && meta.subtitles[chosen] && Array.isArray(meta.subtitles[chosen])) {
                const first = meta.subtitles[chosen][0];
                if (first && first.url) {
                    try {
                        const vtt = (0, child_process_1.execSync)(`curl -s "${first.url}"`, { encoding: 'utf-8', stdio: 'pipe' });
                        const clean = vtt.split('\n')
                            .filter((line) => !line.match(/^WEBVTT|^NOTE:/) && !line.match(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/) && line.trim())
                            .join('\n');
                        if (clean.trim()) {
                            lines.push('', '## Transcript', clean);
                        }
                    }
                    catch (e) {
                        // ignore transcript fetch errors
                    }
                }
            }
        }
        return lines.join('\n').trim();
    }
    async extractFromGitHub(url) {
        this.checkPrerequisite('gh');
        console.log(`[Extraction] Using gh CLI for GitHub URL: ${url}`);
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts.length < 2) {
            throw new Error(`Invalid GitHub URL format: ${url}`);
        }
        const owner = pathParts[0];
        const repo = pathParts[1];
        let command = '';
        let context = '';
        if (pathParts[2] === 'issues' && pathParts[3]) {
            const issueNumber = pathParts[3];
            command = `gh issue view ${issueNumber} -R ${owner}/${repo}`;
            context = `Issue #${issueNumber} in ${owner}/${repo}`;
        }
        else if (pathParts[2] === 'pull' && pathParts[3]) {
            const prNumber = pathParts[3];
            command = `gh pr view ${prNumber} -R ${owner}/${repo}`;
            context = `PR #${prNumber} in ${owner}/${repo}`;
        }
        else {
            command = `gh repo view ${owner}/${repo}`;
            context = `Repository ${owner}/${repo}`;
        }
        let output;
        try {
            output = (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' });
        }
        catch (error) {
            throw new Error(`gh CLI failed for ${context}`);
        }
        if (!output.trim()) {
            throw new Error(`gh CLI returned empty content for ${context}`);
        }
        return output.trim();
    }
    async extractFromWeb(url) {
        console.log(`[Extraction] Using Jina Reader API for generic web URL: ${url}`);
        const jinaUrl = `https://r.jina.ai/${url}`;
        const command = `curl -s "${jinaUrl}"`;
        let output;
        try {
            output = (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' });
        }
        catch (error) {
            throw new Error(`Failed to fetch content from ${url}. Please check if the URL is accessible.`);
        }
        if (!output.trim()) {
            throw new Error(`No content extracted from ${url}`);
        }
        return output.trim();
    }
    handleError(message, exitCode) {
        console.error(`[ERROR] ${message}`);
        process.exit(exitCode);
    }
    cleanup() {
        for (const tempFile of this.tempFiles) {
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            }
            catch (error) {
                // Ignore cleanup errors
            }
        }
    }
}
exports.AnyToNotebookLM = AnyToNotebookLM;
//# sourceMappingURL=any2nlm.js.map