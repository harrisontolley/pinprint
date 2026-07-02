import { describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import { deferrerFor, runAfterResponse, runNow } from "./defer.js";

// Fake Hono contexts: on Vercel Fluid c.executionCtx exposes waitUntil; locally
// accessing it throws ("no ExecutionContext"). We assert we use waitUntil when
// present and degrade to fire-and-forget when it isn't, always without throwing.

function ctxWithWaitUntil(waitUntil: (p: Promise<unknown>) => void): Context {
  return { executionCtx: { waitUntil } } as unknown as Context;
}

function ctxWithoutExecutionCtx(): Context {
  return {
    get executionCtx(): never {
      throw new Error("This context has no ExecutionContext");
    },
  } as unknown as Context;
}

describe("runAfterResponse", () => {
  it("uses executionCtx.waitUntil when the platform provides it (Vercel Fluid)", async () => {
    const waitUntil = vi.fn();
    const task = vi.fn(async () => {});
    runAfterResponse(ctxWithWaitUntil(waitUntil), task);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledTimes(1);
    await (waitUntil.mock.calls[0][0] as Promise<unknown>);
  });

  it("falls back to fire-and-forget when there's no ExecutionContext (local node)", async () => {
    const task = vi.fn(async () => {});
    expect(() => runAfterResponse(ctxWithoutExecutionCtx(), task)).not.toThrow();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("uses Vercel's request-context waitUntil when executionCtx is absent (Hono on Vercel)", async () => {
    const sym = Symbol.for("@vercel/request-context");
    const waitUntil = vi.fn();
    (globalThis as Record<symbol, unknown>)[sym] = { get: () => ({ waitUntil }) };
    try {
      const task = vi.fn(async () => {});
      runAfterResponse(ctxWithoutExecutionCtx(), task);
      expect(waitUntil).toHaveBeenCalledTimes(1);
      expect(task).toHaveBeenCalledTimes(1);
      await (waitUntil.mock.calls[0][0] as Promise<unknown>);
    } finally {
      delete (globalThis as Record<symbol, unknown>)[sym];
    }
  });

  it("swallows a deferred task's rejection (never throws, waitUntil path)", async () => {
    const rejection = Promise.reject(new Error("boom"));
    const waitUntil = vi.fn();
    runAfterResponse(
      ctxWithWaitUntil(waitUntil),
      () => rejection,
    );
    // The promise handed to waitUntil is the caught wrapper, so it resolves.
    await expect(waitUntil.mock.calls[0][0] as Promise<unknown>).resolves.toBeUndefined();
  });

  it("deferrerFor binds a deferrer to a context", () => {
    const waitUntil = vi.fn();
    const defer = deferrerFor(ctxWithWaitUntil(waitUntil));
    defer(async () => {});
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});

describe("runNow", () => {
  it("invokes the task immediately and swallows rejections", async () => {
    const task = vi.fn(async () => {
      throw new Error("nope");
    });
    expect(() => runNow(task)).not.toThrow();
    expect(task).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
});
