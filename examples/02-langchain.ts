/**
 * LangChain integration: wrap LangChain tools with reins hooks,
 * then drive a ReAct loop with full observability and interrupt control.
 *
 * Install deps:
 *   npm install @langchain/core @langchain/openai langchain zod
 *
 * Set env:
 *   OPENAI_API_KEY=sk-...
 *
 * Run: npx tsx examples/02-langchain.ts
 */

import "dotenv/config";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { z } from "zod";
import { createReinsInstance, type ReinsSignal } from "../src/index.js";

// --- raw tool functions ---

async function searchDocs(args: { query: string }): Promise<string> {
    return `Found 3 docs matching "${args.query}"`;
}

async function runCode(args: { code: string; language: string }): Promise<string> {
    return `Executed ${args.language} code. Output: 42`;
}

// --- create reins harness, register tools + hooks ---

const reins = createReinsInstance({ maxStackSize: 50 });

reins.register("search_docs", searchDocs, {
    hooks: {
        beforeToolCall: ({ query }: { query: string }) => {
            console.log(`\n[reins] search_docs ← query: "${query}"`);
        },
        afterToolCall: (result) => {
            console.log(`[reins] search_docs → ${result}`);
            return { action: "continue" };
        },
    },
});

reins.register("run_code", runCode, {
    hooks: {
        beforeToolCall: ({ language }: { language: string }) => {
            const allowed = ["python", "javascript", "typescript"];
            if (!allowed.includes(language)) {
                throw new Error(`Language "${language}" not allowed`);
            }
        },
        afterToolCall: (result) => {
            console.log(`[reins] run_code → ${result}`);
            return { action: "continue" };
        },
        onError: (err): ReinsSignal => {
            console.error(`[reins] run_code error: ${err}`);
            return { action: "abort", reason: String(err) };
        },
    },
});

// --- bridge to LangChain: wrap each tool, delegate to reins.call() ---

const searchTool = new DynamicStructuredTool({
    name: "search_docs",
    description: "Search internal documentation. Input: query string.",
    schema: z.object({ query: z.string() }),
    func: async (args) => {
        const { result, signal } = await reins.call("search_docs", args);
        if (signal.action === "abort") throw new Error(`Aborted: ${signal.reason}`);
        return String(result);
    },
});

const codeTool = new DynamicStructuredTool({
    name: "run_code",
    description: "Execute a code snippet. Input: code and language.",
    schema: z.object({
        code: z.string(),
        language: z.enum(["python", "javascript", "typescript"]),
    }),
    func: async (args) => {
        const { result, signal } = await reins.call("run_code", args);
        if (signal.action === "abort") throw new Error(`Aborted: ${signal.reason}`);
        return String(result);
    },
});

// --- LangChain agent via createAgent ---

const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0, apiKey: process.env.OPEN_AI_API_KEY });

const agent = createAgent({
    model: llm,
    tools: [searchTool, codeTool],
});

const { messages } = await agent.invoke({
    messages: [{ role: "user", content: "Find docs on quicksort, then run a Python implementation of it." }],
});

console.log("\n=== Agent output ===");
const last = messages.at(-1);
console.log(last?.content);

console.log("\n=== reins call stack ===");
for (const snap of reins.getStack()) {
    console.log(
        `  [${snap.tool}] signal=${snap.signal.action}`,
        snap.signal.action === "override" ? `original=${snap.originalResult}` : "",
    );
}
