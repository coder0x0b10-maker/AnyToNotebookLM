import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Legacy NotebookLM tool integration for backward compatibility
export async function runBridge(notebookId: string, content: string) {
    console.log("Starting AnyToNotebookLM bridge process...");
    try {
        await ingestToNotebook(notebookId, content);
        console.log("Ingestion successful.");
    } catch (error) {
        console.error("Ingestion failed:", error);
    }
}

async function ingestToNotebook(notebookId: string, content: string): Promise<void> {
    console.log(`[NotebookLM] Ingesting content into notebook: ${notebookId}`);
    
    // Use a temp file for large content to avoid command line limits
    const tempFilePath = path.join('/tmp', `notebooklm_ingest_${Date.now()}.md`);
    fs.writeFileSync(tempFilePath, content);
    
    // Command pattern: use the file path as the content source
    const command = `source /home/moltrpi5/.venv/nlm_env/bin/activate && notebooklm source add "${tempFilePath}" --notebook "${notebookId}" --title "OpenClaw Memory Concept"`;
    
    try {
        execSync(command, { shell: "/bin/bash", stdio: 'inherit' });
    } catch (error) {
        console.error("CLI Execution failed:", error);
        throw error;
    } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
}
