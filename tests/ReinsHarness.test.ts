import { describe, expect, it, vi } from "vitest";
import { ReinsHarness, createReinsInstance } from "../src/core/ReinsHarness.js";

const noop = async (_args: unknown) => { };

describe("ReinsHarness", () => {
    describe("constructor", () => {
        it("caps stackSize at 100", () => {
            const h = new ReinsHarness({ maxStackSize: 9999 });
            // fill beyond cap
            h.register("t", async () => "x", { hooks: {} });
            // indirect check via stack length after 101 calls
            const calls = Array.from({ length: 101 }, () => h.call("t", null));
            return Promise.all(calls).then(() => {
                expect(h.getStack().length).toBe(100);
            });
        });

        it("defaults stackSize to 50", async () => {
            const h = new ReinsHarness({});
            h.register("t", async () => "x", { hooks: {} });
            await Promise.all(Array.from({ length: 60 }, () => h.call("t", null)));
            expect(h.getStack().length).toBe(50);
        });
    });

    describe("register", () => {
        it("returns this for chaining", () => {
            const h = new ReinsHarness({});
            const result = h.register("a", noop, { hooks: {} });
            expect(result).toBe(h);
        });
    });

    describe("call", () => {
        it("throws on unregistered tool", async () => {
            const h = new ReinsHarness({});
            await expect(h.call("missing", {})).rejects.toThrow('Tool "missing" is not registered');
        });

        it("returns result and continue signal by default", async () => {
            const h = new ReinsHarness({});
            h.register("echo", async (args) => args, { hooks: {} });
            const { result, signal } = await h.call("echo", { x: 1 });
            expect(result).toEqual({ x: 1 });
            expect(signal).toEqual({ action: "continue" });
        });

        it("calls beforeToolCall with args", async () => {
            const before = vi.fn();
            const h = new ReinsHarness({});
            h.register("t", async () => null, { hooks: { beforeToolCall: before } });
            await h.call("t", { foo: "bar" });
            expect(before).toHaveBeenCalledWith({ foo: "bar" });
        });

        it("calls afterToolCall with result", async () => {
            const after = vi.fn().mockResolvedValue({ action: "continue" });
            const h = new ReinsHarness({});
            h.register("t", async () => "output", { hooks: { afterToolCall: after } });
            await h.call("t", null);
            expect(after).toHaveBeenCalledWith("output");
        });

        it("override signal replaces result and stores originalResult", async () => {
            const h = new ReinsHarness({});
            h.register("t", async () => "bad", {
                hooks: {
                    afterToolCall: async () => ({ action: "override", overrideResult: "good" }),
                },
            });
            const { result, signal } = await h.call("t", null);
            expect(result).toBe("good");
            expect(signal).toEqual({ action: "override", overrideResult: "good" });

            const snap = h.getStack()[0];
            expect(snap.result).toBe("good");
            expect(snap.originalResult).toBe("bad");
        });

        it("abort signal propagates from afterToolCall", async () => {
            const h = new ReinsHarness({});
            h.register("t", async () => "x", {
                hooks: { afterToolCall: async () => ({ action: "abort", reason: "stop" }) },
            });
            const { signal } = await h.call("t", null);
            expect(signal).toEqual({ action: "abort", reason: "stop" });
        });

        it("calls onError on throw, defaults to abort", async () => {
            const h = new ReinsHarness({});
            h.register("t", async () => { throw new Error("boom"); }, { hooks: {} });
            const { result, signal } = await h.call("t", null);
            expect(result).toBeNull();
            expect(signal.action).toBe("abort");
            expect((signal as { action: "abort"; reason?: string }).reason).toContain("boom");
        });

        it("onError can override abort signal", async () => {
            const h = new ReinsHarness({});
            h.register("t", async () => { throw new Error("fail"); }, {
                hooks: { onError: async () => ({ action: "continue" }) },
            });
            const { signal } = await h.call("t", null);
            expect(signal).toEqual({ action: "continue" });
        });
        it("beforeToolCall abort signal stops execution before tool runs", async () => {
            const fn = vi.fn().mockResolvedValue("should not run")
            const h = new ReinsHarness({})
            h.register("t", fn, {
                hooks: {
                    beforeToolCall: async () => ({ action: "abort", reason: "blocked" })
                }
            })
            const { result, signal } = await h.call("t", null)
            expect(fn).not.toHaveBeenCalled()
            expect(result).toBeNull()
            expect(signal).toEqual({ action: "abort", reason: "blocked" })
            expect(h.getStack()[0].tool).toBe("t")
        })
    });

    describe("getStack", () => {
        it("records snapshot per call", async () => {
            const h = new ReinsHarness({});
            h.register("t", async (args) => args, { hooks: {} });
            await h.call("t", "a");
            await h.call("t", "b");
            const stack = h.getStack();
            expect(stack).toHaveLength(2);
            expect(stack[0].args).toBe("a");
            expect(stack[1].args).toBe("b");
        });

        it("snapshot has id, timestamp, tool name", async () => {
            const h = new ReinsHarness({});
            h.register("myTool", async () => 42, { hooks: {} });
            const before = Date.now();
            await h.call("myTool", null);
            const snap = h.getStack()[0];
            expect(snap.tool).toBe("myTool");
            expect(typeof snap.id).toBe("string");
            expect(snap.timestamp).toBeGreaterThanOrEqual(before);
        });

        it("evicts oldest when stack is full", async () => {
            const h = new ReinsHarness({ maxStackSize: 3 });
            h.register("t", async (n) => n, { hooks: {} });
            for (let i = 0; i < 4; i++) await h.call("t", i);
            const stack = h.getStack();
            expect(stack).toHaveLength(3);
            expect(stack[0].args).toBe(1);
            expect(stack[2].args).toBe(3);
        });
    });

    describe("createReinsInstance", () => {
        it("returns a ReinsHarness", () => {
            expect(createReinsInstance({})).toBeInstanceOf(ReinsHarness);
        });
    });
});
