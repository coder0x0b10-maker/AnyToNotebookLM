#!/usr/bin/env node

import { Command } from 'commander';
import { AnyToNotebookLM } from './any2nlm';

const program = new Command();

program
  .name('any2nlm')
  .description('AnyToNotebookLM - Turn a URL into Markdown and upload to NotebookLM')
  .version('1.0.0');

program
  .argument('[url]', 'URL to extract content from (mutually exclusive with --search)')
  .option('--search <query>', 'Semantic search query to find relevant URLs (mutually exclusive with <url>)')
  .option('--notebook-id <uuid>', 'NotebookLM notebook ID')
  .option('--notebook-name <name>', 'Notebook display name to match')
  .option('--notebook-keyword <keyword>', 'Keyword to search within notebook names')
  .option('--notebook-match-mode <mode>', 'Notebook selection behavior (exact, contains, regex)', 'contains')
  .option('--title <string>', 'Source title for NotebookLM')
  .option('--out <path>', 'Write extracted Markdown to this path')
  .option('--dry-run', 'Perform extraction but do not upload to NotebookLM')
  .option('--auto-select', 'Automatically select the top search result (no interactive prompt)')
  .option('--limit <number>', 'Number of search results to fetch', '10')
  .option('--preview', 'Show a short snippet for each search result')
  .action(async (url: string | undefined, options) => {
    const any2nlm = new AnyToNotebookLM();
    
    try {
      await any2nlm.run({
        url,
        search: options.search,
        notebookId: options.notebookId,
        notebookName: options.notebookName,
        notebookKeyword: options.notebookKeyword,
        notebookMatchMode: options.notebookMatchMode,
        title: options.title,
        outputPath: options.out,
        dryRun: options.dryRun || false,
        autoSelect: options.autoSelect || false,
        limit: parseInt(options.limit, 10) || 10,
        preview: options.preview || false
      });
    } catch (error) {
      // Error handling is done inside AnyToNotebookLM with proper exit codes
      process.exit(1);
    }
  });

program.parse();
