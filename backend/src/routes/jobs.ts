import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { runBlobGc } from "../blobGc.js";
import { findOrdersNeedingFulfillmentSweep } from "../orders.js";
import { submitOrderToArtelo } from "../fulfillment.js";
import { deliverDigitalFiles } from "../digitalDelivery.js";

// Scheduled maintenance jobs, invoked by Vercel Cron (see vercel.json). Vercel
// sends `Authorization: Bearer $CRON_SECRET` on cron requests when CRON_SECRET is
// set; we require it. Inert (503) when CRON_SECRET is unset, like the rest of the
// env-guarded integration surface — so nothing runs in dev/build without it.
//
// Registered under /jobs at both mounts (see app.ts), so the cron path in prod is
// /_/backend/jobs/blob-gc (and .../jobs/fulfillment-sweep). GET (cron) and POST
// (manual curl) both work.

/** Constant-time check of the `Authorization: Bearer <CRON_SECRET>` header. */
function authorized(authHeader: string | undefined, secret: string): boolean {
  const prefix = "Bearer ";
  if (!authHeader || !authHeader.startsWith(prefix)) return false;
  const provided = Buffer.from(authHeader.slice(prefix.length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/** Per-run cap so a backlog can't turn one cron tick into an unbounded sweep. */
const FULFILLMENT_SWEEP_LIMIT = 20;

export function buildJobsRouter(): Hono {
  const r = new Hono();

  r.on(["GET", "POST"], "/blob-gc", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return c.json({ error: "cron_unconfigured" }, 503);
    if (!authorized(c.req.header("authorization"), secret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const dryRun = c.req.query("dryRun") === "1" || c.req.query("dryRun") === "true";
    const result = await runBlobGc({ dryRun });
    return c.json(result);
  });

  // Reconciliation safety net (hourly): the Stripe webhook now defers its
  // paid-transition side effects (Artelo submit + digital delivery) past the
  // 200 response via waitUntil — a process kill mid-task leaves a paid order
  // stuck with no retry signal. This finds `paid` orders older than 15 minutes
  // still missing their Artelo submission and/or digital delivery, and re-runs
  // both collaborators for each. Both are idempotent + never-throw (see
  // fulfillment.ts / digitalDelivery.ts), including the digital-delivery claim:
  // this does NOT force-release a stuck claim, it just calls deliverDigitalFiles
  // again — a genuinely stuck claim stays a documented manual case.
  r.on(["GET", "POST"], "/fulfillment-sweep", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return c.json({ error: "cron_unconfigured" }, 503);
    if (!authorized(c.req.header("authorization"), secret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const candidates = await findOrdersNeedingFulfillmentSweep(FULFILLMENT_SWEEP_LIMIT);
    let arteloSubmitted = 0;
    let digitalDelivered = 0;
    for (const order of candidates) {
      const [arteloResult, digitalResult] = await Promise.all([
        submitOrderToArtelo(order.id),
        deliverDigitalFiles(order.id),
      ]);
      if (arteloResult.submitted) arteloSubmitted += 1;
      if (digitalResult.delivered) digitalDelivered += 1;
    }
    return c.json({ ok: true, scanned: candidates.length, arteloSubmitted, digitalDelivered });
  });

  return r;
}
