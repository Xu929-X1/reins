# reins

> AOP-based harness for LLM agents. Human-in-the-loop, resumability, and observability — without touching your core loop.

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

You stay in control. The loop stays yours.

## Core Concepts

> **Note:** reins currently supports hand-written ReAct loops. Integration with LangChain, LlamaIndex, and other frameworks is on the roadmap.

A basic ReAct agent looks like this:

```javascript
while (true) {
  const action = await llm.think(context)
  if (action.type === 'finish') break

  const result = await myTools[action.tool](action.args)
  context.push({ tool: action.tool, result })
}
```

Simple — but completely opaque. You can't see what the agent is thinking, catch a bad tool call before it causes damage, or recover from a failure without starting over.

reins exposes four lifecycle hooks inside this loop:

```
┌─────────────────────────────────────────────────┐
│                   ReAct Loop                    │
│                                                 │
│  ┌──────────────┐                               │
│  │ beforeThink  │  ← inspect / modify context   │
│  └──────┬───────┘                               │
│         │                                       │
│   llm.think(context)                            │
│         │                                       │
│  ┌──────▼───────┐                               │
│  │  afterThink  │  ← see what the LLM decided   │
│  └──────┬───────┘                               │
│         │                                       │
│  ┌──────▼──────────────┐                        │
│  │  beforeToolCall     │  ← validate args       │
│  └──────┬──────────────┘                        │
│         │                                       │
│   myTools[action.tool](action.args)             │
│         │                                       │
│  ┌──────▼──────────────┐                        │
│  │   afterToolCall     │  ← inspect, override,  │
│  └─────────────────────┘    or abort            │
│                                                 │
└─────────────────────────────────────────────────┘
```

Each hook can return a **signal** that controls what happens next:

| Signal     | Effect                                           |
|------------|--------------------------------------------------|
| `continue` | Loop proceeds normally                           |
| `abort`    | Loop stops immediately                           |
| `override` | Replace the tool result before it enters context |

With reins, the same loop becomes:

```javascript
const harness = createHarness({ stackSize: 50 })

harness.register('search', searchFn, {
  beforeToolCall: (args) => { /* validate */ },
  afterToolCall:  (result) => { /* inspect or override */ },
})

while (true) {
  const action = await llm.think(context)
  if (action.type === 'finish') break

  const { result, signal } = await harness.call(action.tool, action.args)
  if (signal.action === 'abort') break

  context.push({ tool: action.tool, result })
}
```

One line changed. Full visibility gained.

## Install

```bash
npm install reins
```

## Usage

```ts
// example here
```

## API

<!-- document public API here -->

## Roadmap

- [ ] LangChain tool adapter
- [ ] LlamaIndex tool adapter
- [ ] `@reins/devtools` — visual stack inspector

## License

MIT