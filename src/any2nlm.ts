import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface Any2NLMOptions {
  url?: string;
  search?: string;
  notebookId?: string;
  notebookName?: string;
  notebookKeyword?: string;
  notebookMatchMode?: 'exact' | 'contains' | 'regex';
  title?: string;
  outputPath?: string;
  dryRun: boolean;
  autoSelect?: boolean;
  limit?: number;
  preview?: boolean;
}

export class AnyToNotebookLM {
  private tempFiles: string[] = [];

  async run(options: Any2NLMOptions): Promise<void> {
    try {
      // Validate that either url or search is provided, but not both
      const hasUrl = !!options.url;
      const hasSearch = !!options.search;
      if (!hasUrl && !hasSearch) {
        this.handleError('Either --url or --search must be specified', 2);
      }
      if (hasUrl && hasSearch) {
        this.handleError('Only one of --url or --search can be specified', 2);
      }

      let targetUrl: string;
      if (hasSearch) {
        targetUrl = await this.searchAndSelect(options.search!, options);
        console.log(`[AnyToNotebookLM] Selected URL: ${targetUrl}`);
      } else {
        targetUrl = options.url!;
      }

      console.log(`[AnyToNotebookLM] Starting extraction from: ${targetUrl}`);
      
      // Step 1: Validate notebook target options
      this.validateNotebookOptions(options);
      
      // Step 2: Resolve notebook ID if not provided directly
      const notebookId = await this.resolveNotebookId(options);
      
      // Step 3: Extract content using agent-reach
      const markdownContent = await this.extractContent(targetUrl);
      
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
      } else {
        console.log(`[AnyToNotebookLM] Dry run completed - content not uploaded`);
      }
      
      this.cleanup();
      process.exit(0);
      
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  private async extractContent(url: string): Promise<string> {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleError(`URL extraction failed: ${errorMessage}`, 10);
    }
  }

  private async searchAndSelect(query: string, options: Any2NLMOptions): Promise<string> {
    console.log(`[Search] Performing semantic search for: ${query}`);
    const results = await this.performExaSearch(query, options.limit || 10);
    
    if (results.length === 0) {
      this.handleError('No search results found', 11);
    }

    if (options.autoSelect) {
      const selected = results[0];
      console.log(`[Search] Auto-selected top result: ${selected.title}`);
      return selected.url;
    }

    console.log(`[Search] Found ${results.length} results:`);
    results.forEach((item, idx) => {
      const preview = options.preview ? ` - ${item.snippet?.substring(0, 80) || ''}...` : '';
      console.log(`  ${idx + 1}) ${item.title}${preview}`);
      console.log(`     ${item.url}`);
    });

    const answer = await this.promptUser('\nSelect a result by number (or Ctrl+C to cancel): ');
    const choice = parseInt(answer, 10);
    if (isNaN(choice) || choice < 1 || choice > results.length) {
      this.handleError('Invalid selection', 2);
    }

    return results[choice - 1].url;
  }

  private async performExaSearch(query: string, limit: number): Promise<Array<{title: string; url: string; snippet?: string}>> {
    // Use Agent Reach's Exa search via CLI/API
    // Fallback: try to call agent-reach search if available; otherwise use a placeholder
    try {
      this.checkPrerequisite('agent-reach');
      const command = `agent-reach search "${query}" --limit ${limit} --json`;
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
      const parsed = JSON.parse(output);
      // Expected format: { results: [{ title, url, snippet }, ...] }
      return parsed.results || [];
    } catch (error) {
      // Fallback: use a simple mock or error
      this.handleError(`Exa search failed: ${error instanceof Error ? error.message : String(error)}`, 11);
    }
  }

  private async promptUser(question: string): Promise<string> {
    process.stdout.write(question);
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise((resolve) => {
      rl.question('', (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private validateNotebookOptions(options: Any2NLMOptions): void {
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

  private async resolveNotebookId(options: Any2NLMOptions): Promise<string> {
    // If notebook ID is provided directly, use it
    if (options.notebookId) {
      return options.notebookId;
    }
    
    // Otherwise, resolve by name or keyword
    console.log(`[Notebook Resolution] Fetching notebook list...`);
    const notebooks = await this.fetchNotebookList();
    
    let matches: Array<{id: string, name: string}>;
    const matchMode = options.notebookMatchMode || 'contains';
    
    if (options.notebookName) {
      matches = this.matchNotebooksByName(notebooks, options.notebookName, matchMode);
    } else if (options.notebookKeyword) {
      matches = this.matchNotebooksByKeyword(notebooks, options.notebookKeyword, matchMode);
    } else {
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

  private async fetchNotebookList(): Promise<Array<{id: string, name: string}>> {
    try {
      // Check if notebooklm CLI is available
      this.checkPrerequisite('notebooklm');
      
      // Use notebooklm CLI to list notebooks with JSON output if available, otherwise parse table
      let command = 'bash -c "source /home/moltrpi5/.venv/nlm_env/bin/activate && notebooklm list --json 2>/dev/null || notebooklm list"';
      let output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
      
      // Parse the output to extract notebook information
      const notebooks = this.parseNotebookList(output);
      return notebooks;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleError(`Failed to fetch notebook list: ${errorMessage}`, 30);
    }
  }

  private parseNotebookList(output: string): Array<{id: string, name: string}> {
    // Try to parse as JSON first
    try {
      const jsonData = JSON.parse(output);
      if (jsonData.notebooks && Array.isArray(jsonData.notebooks)) {
        return jsonData.notebooks.map((item: any) => ({
          id: item.id,
          name: item.title
        }));
      }
    } catch (error) {
      // Not JSON, fall back to table parsing
    }
    
    // Parse as table format (fallback)
    const notebooks: Array<{id: string, name: string}> = [];
    
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

  private matchNotebooksByName(notebooks: Array<{id: string, name: string}>, name: string, mode: string): Array<{id: string, name: string}> {
    switch (mode) {
      case 'exact':
        return notebooks.filter(nb => nb.name === name);
      case 'contains':
        return notebooks.filter(nb => nb.name.toLowerCase().includes(name.toLowerCase()));
      case 'regex':
        try {
          const regex = new RegExp(name, 'i');
          return notebooks.filter(nb => regex.test(nb.name));
        } catch (error) {
          this.handleError(`Invalid regular expression: ${name}`, 2);
        }
      default:
        return notebooks;
    }
  }

  private matchNotebooksByKeyword(notebooks: Array<{id: string, name: string}>, keyword: string, mode: string): Array<{id: string, name: string}> {
    switch (mode) {
      case 'exact':
        return notebooks.filter(nb => nb.name.toLowerCase() === keyword.toLowerCase());
      case 'contains':
        return notebooks.filter(nb => nb.name.toLowerCase().includes(keyword.toLowerCase()));
      case 'regex':
        try {
          const regex = new RegExp(keyword, 'i');
          return notebooks.filter(nb => regex.test(nb.name));
        } catch (error) {
          this.handleError(`Invalid regular expression: ${keyword}`, 2);
        }
      default:
        return notebooks;
    }
  }

  private async uploadToNotebookLM(notebookId: string, content: string, title?: string): Promise<void> {
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
      
      execSync(command, { shell: "/bin/bash", stdio: 'inherit' });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleError(`NotebookLM upload failed: ${errorMessage}`, 20);
    }
  }

  private writeToFile(outputPath: string, content: string): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handleError(`Failed to write to output file: ${errorMessage}`, 1);
    }
  }

  private deriveTitleFromContent(content: string): string {
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

  private checkPrerequisite(tool: string): void {
    try {
      execSync(`which ${tool}`, { stdio: 'ignore' });
    } catch (error) {
      this.handleError(`Missing prerequisite: ${tool} is not installed or not in PATH`, 30);
    }
  }

  private detectPlatform(url: string): 'x' | 'youtube' | 'github' | 'web' {
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
    } catch (error) {
      this.handleError(`Invalid URL: ${url}`, 2);
      // Unreachable due to handleError, but TypeScript needs a return
      return 'web';
    }
  }

  private async extractFromX(url: string): Promise<string> {
    this.checkPrerequisite('xreach');
    console.log(`[Extraction] Using xreach for X/Twitter URL: ${url}`);
    const command = `xreach tweet "${url}" --json`;
    let output: string;
    try {
      output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
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
      data.media.forEach((m: any) => lines.push(`- ${m.url || m.preview_url || 'no URL'}`));
    }
    return lines.join('\n').trim();
  }

  private async extractFromYouTube(url: string): Promise<string> {
    this.checkPrerequisite('yt-dlp');
    console.log(`[Extraction] Using yt-dlp for YouTube URL: ${url}`);
    const jsonCmd = `yt-dlp --dump-single-json "${url}"`;
    let jsonOut: string;
    try {
      jsonOut = execSync(jsonCmd, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
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
            const vtt = execSync(`curl -s "${first.url}"`, { encoding: 'utf-8', stdio: 'pipe' });
            const clean = vtt.split('\n')
              .filter((line: string) => !line.match(/^WEBVTT|^NOTE:/) && !line.match(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/) && line.trim())
              .join('\n');
            if (clean.trim()) {
              lines.push('', '## Transcript', clean);
            }
          } catch (e) {
            // ignore transcript fetch errors
          }
        }
      }
    }
    return lines.join('\n').trim();
  }

  private async extractFromGitHub(url: string): Promise<string> {
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
    } else if (pathParts[2] === 'pull' && pathParts[3]) {
      const prNumber = pathParts[3];
      command = `gh pr view ${prNumber} -R ${owner}/${repo}`;
      context = `PR #${prNumber} in ${owner}/${repo}`;
    } else {
      command = `gh repo view ${owner}/${repo}`;
      context = `Repository ${owner}/${repo}`;
    }
    let output: string;
    try {
      output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
      throw new Error(`gh CLI failed for ${context}`);
    }
    if (!output.trim()) {
      throw new Error(`gh CLI returned empty content for ${context}`);
    }
    return output.trim();
  }

  private async extractFromWeb(url: string): Promise<string> {
    console.log(`[Extraction] Using Jina Reader API for generic web URL: ${url}`);
    const jinaUrl = `https://r.jina.ai/${url}`;
    const command = `curl -s "${jinaUrl}"`;
    let output: string;
    try {
      output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (error) {
      throw new Error(`Failed to fetch content from ${url}. Please check if the URL is accessible.`);
    }
    if (!output.trim()) {
      throw new Error(`No content extracted from ${url}`);
    }
    return output.trim();
  }

  private handleError(message: string, exitCode: number): never {
    console.error(`[ERROR] ${message}`);
    process.exit(exitCode);
  }

  private cleanup(): void {
    for (const tempFile of this.tempFiles) {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}
