#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const any2nlm_1 = require("./any2nlm");
const program = new commander_1.Command();
program
    .name('any2nlm')
    .description('AnyToNotebookLM - Turn a URL into Markdown and upload to NotebookLM')
    .version('1.0.0');
program
    .argument('<url>', 'URL to extract content from')
    .option('--notebook-id <uuid>', 'NotebookLM notebook ID')
    .option('--notebook-name <name>', 'Notebook display name to match')
    .option('--notebook-keyword <keyword>', 'Keyword to search within notebook names')
    .option('--notebook-match-mode <mode>', 'Notebook selection behavior (exact, contains, regex)', 'contains')
    .option('--title <string>', 'Source title for NotebookLM')
    .option('--out <path>', 'Write extracted Markdown to this path')
    .option('--dry-run', 'Perform extraction but do not upload to NotebookLM')
    .action(async (url, options) => {
    const any2nlm = new any2nlm_1.AnyToNotebookLM();
    try {
        await any2nlm.run({
            url,
            notebookId: options.notebookId,
            notebookName: options.notebookName,
            notebookKeyword: options.notebookKeyword,
            notebookMatchMode: options.notebookMatchMode,
            title: options.title,
            outputPath: options.out,
            dryRun: options.dryRun || false
        });
    }
    catch (error) {
        // Error handling is done inside AnyToNotebookLM with proper exit codes
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map