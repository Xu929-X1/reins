# reins

> AOP-based harness for LLM agents. Human-in-the-loop, resumability, and observability — without touching your core loop.

[English](./README.md) | [中文](./i18n/README.zh-CN.md)

## Why reins?

LLM agents are opaque by default. When something goes wrong mid-run,
most frameworks give you two options: let it finish (wasting tokens and
money), or kill it (losing all progress).

reins is built around a different idea: every tool call in a ReAct loop
is an observable, interruptible checkpoint.

- **Observe** — inspect inputs, outputs, and internal state at each step
- **Interrupt** — pause the loop when something looks wrong
- **Correct** — override a bad result or redirect the agent
- **Resume** — continue from where you stopped, not from the beginning
- **Framework agnostic** — register any function, from any library, or none at all

You stay in control. The loop stays yours.

reins is designed for **human-paced agents** — tasks where a person
can follow along, understand each step, and intervene when needed.
If your agent needs 1000 tool calls to finish a task, reins will
tell you that's probably a problem worth fixing first.

Most agent frameworks optimize for longer sessions and full autonomy.
reins optimizes for **human readability and confidence**. An agent
you can follow is an agent you can trust.

## Core Concepts

A basic ReAct agent looks like this:

```javascript
while (true) {
  const action = await llm.think(context)
  if (action.type === 'finish') break

  const result = await myTools[action.tool](action.args)
  context.push({ tool: action.tool, result })
}
```

Simple — but completely opaque. You can't see what the agent is
thinking, catch a bad tool call before it causes damage, or recover
from a failure without starting over.

reins exposes two lifecycle hooks around every tool call:

```
┌──────────────────────────────────────────────────┐
│                    ReAct Loop                    │
│                                                  │
│   llm.think(context)                             │
│         │                                        │
│         │  action = { tool, args }               │
│         │                                        │
│  ┌──────▼──────────────┐                         │
│  │  beforeToolCall     │  ← llm's intent         │
│  └──────┬──────────────┘   validate args         │
│         │                  abort early           │
│         │                                        │
│   tool(args)                                     │
│         │                                        │
│  ┌──────▼──────────────┐                         │
│  │   afterToolCall     │  ← what happened        │
│  └─────────────────────┘   override result       │
│                             save snapshot        │
│                             abort or continue    │
└──────────────────────────────────────────────────┘
```

`beforeToolCall` gives you the LLM's intent — what tool it chose and
why. `afterToolCall` gives you the result that will become the next
iteration's context. Between these two hooks, you have full visibility
into every decision the agent makes.

Each hook returns a **signal** that controls what happens next:

| Signal     | Effect                                           |
|------------|--------------------------------------------------|
| `continue` | Loop proceeds normally                           |
| `abort`    | Loop stops immediately                           |
| `override` | Replace the tool result before it enters context |

## Install

```bash
npm install reins
```

## Usage

```typescript
import { createHarness } from 'reins'

const harness = createHarness({ stackSize: 50 })

// Register any function — framework agnostic
harness.register('search', searchFn, {
  beforeToolCall: async (args) => {
    console.log('LLM wants to search:', args)
    return { action: 'continue' }
  },
  afterToolCall: async (result) => {
    if (!result.hits.length) {
      return { action: 'abort', reason: 'No results found' }
    }
    return { action: 'continue' }
  },
})

// Your loop — unchanged except for one line
while (true) {
  const action = await llm.think(context)
  if (action.type === 'finish') break

  const { result, signal } = await harness.call(action.tool, action.args)
  if (signal.action === 'abort') break

  context.push({ tool: action.tool, result })
}
```

One line changed. Full visibility gained.

Works with any function — bare async functions, LangChain tools,
LlamaIndex tools, or OpenAI functions. Wrap them once, register once:

```typescript
// bare function
harness.register('search', mySearchFn)

// langchain
harness.register('search', (args) => langchainTool.invoke(args))

// llamaindex
harness.register('search', (args) => llamaIndexTool.call(args))
```

## API

<!-- document public API here -->

## Roadmap

- [ ] `@reins/devtools` — visual stack inspector

## License

MIT