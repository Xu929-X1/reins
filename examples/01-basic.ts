/**
 * Basic usage: wrap plain async functions with lifecycle hooks.
 * No external dependencies — just reins.
 *
 * Run: npx tsx examples/01-basic.ts
 */

import { createReinsInstance } from "../src/index.js";

const harness = createReinsInstance({ maxStackSize: 50 });

// --- tool functions ---

async function searchWeb(args: { query: string }): Promise<string> {
    // simulate a web search
    return `Results for: "${args.query}"`;
}

async function writeFile(args: { path: string; content: string }): Promise<string> {
    // simulate file write
    return `Written ${args.content.length} bytes to ${args.path}`;
}

// --- register with hooks ---

harness
    .register("search", searchWeb, {
        hooks: {
            beforeToolCall: (args) => {
                console.log("[search] calling with:", args);
            },
            afterToolCall: (result) => {
                console.log("[search] got:", result);
                return { action: "continue" };
            },
        },
    })
    .register("write_file", writeFile, {
        hooks: {
            beforeToolCall: (args) => {
                // block writes to sensitive paths
                if (args.path.startsWith("/etc")) {
                    throw new Error(`Blocked write to sensitive path: ${args.path}`);
                }
            },
            afterToolCall: (result) => {
                console.log("[write_file] done:", result);
                return { action: "continue" };
            },
            onError: (err) => {
                console.error("[write_file] error:", err);
                return { action: "abort", reason: String(err) };
            },
        },
    });

// --- simulated ReAct loop ---

const agentActions = [
    { tool: "search", args: { query: "best TypeScript patterns" } },
    { tool: "write_file", args: { path: "/tmp/notes.txt", content: "some notes" } },
    { tool: "write_file", args: { path: "/etc/passwd", content: "evil" } }, // will abort
];

for (const action of agentActions) {
    const { result, signal } = await harness.call(action.tool, action.args);

    if (signal.action === "abort") {
        console.log(`\nLoop aborted — reason: ${signal.reason}`);
        break;
    }

    console.log(`result: ${result}\n`);
}

console.log("\n--- call stack ---");
for (const snap of harness.getStack()) {
    console.log(`[${snap.tool}] signal=${snap.signal.action} args=${JSON.stringify(snap.args)}`);
}
