export interface ReinsConfig {
    maxStackSize?: number;
}

export type ReinsSignal =
    | { action: "continue" }
    | { action: "abort"; reason?: string }
    | { action: "override"; overrideResult: unknown }

export interface ToolCallingSnapshot {
    id: string;
    timestamp: number;
    tool: string;
    args: unknown;
    result: unknown;
    signal: ReinsSignal;
    originalResult?: unknown;
}

export interface ToolHooks<TArgs = unknown, TResult = unknown> {
    beforeToolCall?: (args: TArgs) => void | ReinsSignal | Promise<void | ReinsSignal>
    afterToolCall?: (result: TResult) => ReinsSignal | Promise<ReinsSignal>;
    onError?: (error: unknown) => ReinsSignal | Promise<ReinsSignal>;
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
    fn: (args: TArgs) => Promise<TResult>;
    hooks: ToolHooks<TArgs, TResult>;
}
