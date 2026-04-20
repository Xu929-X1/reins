import { ReinsConfig, ReinsSignal, ToolCallingSnapshot, ToolDefinition } from "./types.js";

const DEFAULT_STACK_SIZE = 50;
const MAX_STACK_SIZE = 100;


export class ReinsHarness {
    private tools = new Map<string, ToolDefinition>();
    private callStack: ToolCallingSnapshot[] = [];
    private readonly stackSize: number

    constructor(config: ReinsConfig) {
        this.stackSize = Math.min(config.maxStackSize ?? DEFAULT_STACK_SIZE, MAX_STACK_SIZE)

    }


    register<TArgs, TResult>(
        name: string,
        fn: (args: TArgs) => Promise<TResult>,
        options: Omit<ToolDefinition<TArgs, TResult>, "fn">
    ) {
        this.tools.set(name, { fn, ...options } as ToolDefinition);
        return this
    }

    getStack(): ReadonlyArray<ToolCallingSnapshot> {
        return this.callStack
    }

    async call(name: string, args: unknown): Promise<{ result: unknown, signal: ReinsSignal }> {
        const tool = this.tools.get(name)
        if (!tool) throw new Error(`Tool "${name}" is not registered`)

        // before hook
        const beforeSignal = await tool.hooks?.beforeToolCall?.(args)
        if (beforeSignal && beforeSignal.action !== "continue") {
            const abortSnapshot: ToolCallingSnapshot = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                tool: name,
                args,
                result: null,
                signal: beforeSignal,

            }
            this.pushSnapshot(abortSnapshot);
            return {
                result: null,
                signal: beforeSignal
            }
        }

        let result: unknown
        let signal: ReinsSignal

        try {
            result = await tool.fn(args)
            signal = await tool.hooks?.afterToolCall?.(result) ?? { action: 'continue' }
        } catch (err) {
            signal = await tool.hooks?.onError?.(err) ?? { action: 'abort', reason: String(err) }
            result = null
        }

        const resolvedResult = signal.action === 'override' ? signal.overrideResult : result
        const originalResult = signal.action === 'override' ? result : undefined

        const snapshot: ToolCallingSnapshot = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            tool: name,
            args,
            result: resolvedResult,
            signal,
            originalResult,
        }
        this.pushSnapshot(snapshot)

        return { result: resolvedResult, signal }
    }

    private pushSnapshot(snapshot: ToolCallingSnapshot) {
        if (this.callStack.length >= this.stackSize) {
            this.callStack.shift()
        }
        this.callStack.push(snapshot)
    }



}


export function createReinsInstance(config: ReinsConfig): ReinsHarness {
    return new ReinsHarness(config);
}