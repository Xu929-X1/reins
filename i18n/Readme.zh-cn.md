# reins

> 基于 AOP 的 LLM Agent 控制层。支持人工介入、断点恢复和过程观测——无需修改你的核心循环。

[English](../README.md) | 中文

## 为什么选择 reins？

LLM Agent 默认是个黑盒。出错了，大多数框架只给你两个选择：让它跑完（浪费 token 和钱），或者直接kill掉（丢失所有进度）。

reins 围绕一个不同的理念构建：ReAct 循环里的每一次工具调用，都是一个可观测、可中断的检查点。

- **观测** — 在每一步检查输入、输出和内部状态
- **中断** — 发现问题时随时暂停循环
- **纠正** — 覆盖错误结果或重定向 Agent
- **恢复** — 从出错的地方继续，而不是从头开始
- **框架无关** — 注册任意函数，不依赖任何特定库

控制权在你手里，循环逻辑是你的。

reins 为**人工节奏的 Agent** 而设计——任务的每一步都应该让人能跟得上、看得懂、随时介入。如果你的 Agent 需要 1000 次工具调用才能完成任务，reins 会告诉你：这个问题本身可能才是需要先解决的。

大多数 Agent 框架在追求更长的会话时长和完全自治。reins 追求的是**人类可读性和可信度**。你能看懂的 Agent，才是你能信任的 Agent。

## 核心概念

一个基础的 ReAct Agent 长这样：

```javascript
while (true) {
  const action = await llm.think(context)
  if (action.type === 'finish') break

  const result = await myTools[action.tool](action.args)
  context.push({ tool: action.tool, result })
}
```

简单——但完全不透明。你看不到 Agent 在想什么，无法在工具调用出错前拦截，出了问题也只能从头来。

reins 在每次工具调用前后暴露两个生命周期钩子：

```
┌──────────────────────────────────────────────────┐
│                    ReAct 循环                    │
│                                                  │
│   llm.think(context)                             │
│         │                                        │
│         │  action = { tool, args }               │
│         │                                        │
│  ┌──────▼──────────────┐                         │
│  │  beforeToolCall     │  ← LLM 的意图           │
│  └──────┬──────────────┘   校验参数              │
│         │                  提前终止              │
│         │                                        │
│   tool(args)                                     │
│         │                                        │
│  ┌──────▼──────────────┐                         │
│  │   afterToolCall     │  ← 调用结果             │
│  └─────────────────────┘   覆盖结果              │
│                             保存快照             │
│                             继续或终止           │
└──────────────────────────────────────────────────┘
```

`beforeToolCall` 让你看到 LLM 的意图——它选择了哪个工具、传了什么参数。`afterToolCall` 让你看到结果——也就是下一轮循环的 context 输入。这两个钩子覆盖了 Agent 每一个决策的完整过程。

每个钩子返回一个 **signal** 来控制后续行为：

| Signal     | 效果                             |
|------------|----------------------------------|
| `continue` | 循环正常继续                     |
| `abort`    | 立即停止循环                     |
| `override` | 替换工具调用结果再写入 context   |

## 安装

```bash
npm install reins
```

## 使用

```typescript
import { createHarness } from 'reins'

const harness = createHarness({ stackSize: 50 })

// 注册任意函数——框架无关
harness.register('search', searchFn, {
  beforeToolCall: async (args) => {
    console.log('LLM 想要搜索：', args)
    return { action: 'continue' }
  },
  afterToolCall: async (result) => {
    if (!result.hits.length) {
      return { action: 'abort', reason: '没有搜索结果' }
    }
    return { action: 'continue' }
  },
})

// 你的循环——只改一行
while (true) {
  const action = await llm.think(context)
  if (action.type === 'finish') break

  const { result, signal } = await harness.call(action.tool, action.args)
  if (signal.action === 'abort') break

  context.push({ tool: action.tool, result })
}
```

只改一行，完整可见。

支持任意函数——裸函数、LangChain tool、LlamaIndex tool 或 OpenAI function，包一层注册即可：

```typescript
// 裸函数
harness.register('search', mySearchFn)

// langchain
harness.register('search', (args) => langchainTool.invoke(args))

// llamaindex
harness.register('search', (args) => llamaIndexTool.call(args))
```

## API

<!-- 公开 API 文档 -->

## Roadmap

- [ ] `@reins/devtools` — 可视化调用栈检查工具

## License

MIT