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
exports.runBridge = runBridge;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Legacy NotebookLM tool integration for backward compatibility
async function runBridge(notebookId, content) {
    console.log("Starting AnyToNotebookLM bridge process...");
    try {
        await ingestToNotebook(notebookId, content);
        console.log("Ingestion successful.");
    }
    catch (error) {
        console.error("Ingestion failed:", error);
    }
}
async function ingestToNotebook(notebookId, content) {
    console.log(`[NotebookLM] Ingesting content into notebook: ${notebookId}`);
    // Use a temp file for large content to avoid command line limits
    const tempFilePath = path.join('/tmp', `notebooklm_ingest_${Date.now()}.md`);
    fs.writeFileSync(tempFilePath, content);
    // Command pattern: use the file path as the content source
    const command = `source /home/moltrpi5/.venv/nlm_env/bin/activate && notebooklm source add "${tempFilePath}" --notebook "${notebookId}" --title "OpenClaw Memory Concept"`;
    try {
        (0, child_process_1.execSync)(command, { shell: "/bin/bash", stdio: 'inherit' });
    }
    catch (error) {
        console.error("CLI Execution failed:", error);
        throw error;
    }
    finally {
        if (fs.existsSync(tempFilePath))
            fs.unlinkSync(tempFilePath);
    }
}
//# sourceMappingURL=legacy.js.map