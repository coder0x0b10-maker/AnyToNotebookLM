"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBridge = exports.AnyToNotebookLM = void 0;
/**
 * AnyToNotebookLM - Implementation Logic
 * Bridges AgentReach (DeepReader) with NotebookLM
 */
var any2nlm_1 = require("./any2nlm");
Object.defineProperty(exports, "AnyToNotebookLM", { enumerable: true, get: function () { return any2nlm_1.AnyToNotebookLM; } });
// Legacy export for backward compatibility
var legacy_1 = require("./legacy");
Object.defineProperty(exports, "runBridge", { enumerable: true, get: function () { return legacy_1.runBridge; } });
//# sourceMappingURL=index.js.map