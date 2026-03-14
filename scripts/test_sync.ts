import { runBridge } from '../src/index';

const notebookId = "2b8e9e62-4593-4101-a4cc-7090f71fc9ad";
const content = `[Content fetched from https://docs.openclaw.ai/concepts/memory]
OpenClaw memory is **plain Markdown in the agent workspace**... (Truncated for test)
`;

runBridge(notebookId, content).catch(console.error);
