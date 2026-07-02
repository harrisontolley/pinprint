import type { Context } from "hono";

// Run a side effect *after* the HTTP response, so a slow job can't blow the
// caller's timeout. The paid-order print render is ~32 s / 1.6 GB for textured
// templates — far past Stripe's ~20 s webhook-retry window — so the paid-transition
// side effects (Artelo submit + digital delivery) must not be awaited before the
// webhook 200s. Both are already idempotent, never-throwing, and observable
// (fulfillments / order_events), so moving them off the response path is safe.

/** A deferrer: hand it a task and it runs it out-of-band. */
export type Deferrer = (task: () => Promise<unknown>) => void;

/**
 * Vercel's per-request context, if this process is a Vercel function. This is
 * the exact mechanism `@vercel/functions`' `waitUntil` uses under the hood
 * (globalThis[Symbol.for("@vercel/request-context")]) — read directly so we
 * don't need the extra dependency. Returns null anywhere else (local node).
 */
function vercelWaitUntil(): ((p: Promise<unknown>) => void) | null {
  const rc = (globalThis as Record<symbol, unknown>)[
    Symbol.for("@vercel/request-context")
  ] as { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined;
  const waitUntil = rc?.get?.()?.waitUntil;
  return typeof waitUntil === "function" ? waitUntil : null;
}

/**
 * Schedule `task` to run after the response is sent.
 *  - On Vercel (Fluid Compute — the default for Hono deployments), a `waitUntil`
 *    keeps the function alive until the promise settles. We probe Hono's
 *    `c.executionCtx` first, then Vercel's request-context global — Vercel's
 *    Hono builder isn't documented to pass an ExecutionContext into `app.fetch`,
 *    but the request-context global is populated for every function invocation.
 *  - Locally (@hono/node-server) neither exists; the long-lived node process
 *    keeps running, so plain `void task()` is enough.
 * Accessing `c.executionCtx` throws when absent, hence the try/catch. Never
 * throws and always swallows the task's own rejection.
 */
export function runAfterResponse(c: Context, task: () => Promise<unknown>): void {
  const run = () =>
    task().catch((err) => {
      console.error("[defer] deferred task failed", err);
    });
  try {
    // Prefer the platform's waitUntil when this deployment exposes it (Vercel Fluid).
    const ctx = c.executionCtx;
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(run());
      return;
    }
  } catch {
    // No ExecutionContext on this request — try the Vercel global next.
  }
  const waitUntil = vercelWaitUntil();
  if (waitUntil) {
    waitUntil(run());
    return;
  }
  void run();
}

/** Deferrer bound to a request context, for injecting into the webhook handlers. */
export function deferrerFor(c: Context): Deferrer {
  return (task) => runAfterResponse(c, task);
}

/**
 * Default deferrer for non-request callers (and tests): run immediately,
 * fire-and-forget, swallowing rejections. Preserves the "kick it off, don't let
 * it fail me" contract the handlers had before deferral existed.
 */
export const runNow: Deferrer = (task) => {
  void task().catch((err) => {
    console.error("[defer] task failed", err);
  });
};
