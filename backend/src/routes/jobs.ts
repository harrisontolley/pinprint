import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { runBlobGc } from "../blobGc.js";

// Scheduled maintenance jobs, invoked by Vercel Cron (see vercel.json). Vercel
// sends `Authorization: Bearer $CRON_SECRET` on cron requests when CRON_SECRET is
// set; we require it. Inert (503) when CRON_SECRET is unset, like the rest of the
// env-guarded integration surface — so nothing runs in dev/build without it.
//
// Registered under /jobs at both mounts (see app.ts), so the cron path in prod is
// /_/backend/jobs/blob-gc. GET (cron) and POST (manual curl) both work.

/** Constant-time check of the `Authorization: Bearer <CRON_SECRET>` header. */
function authorized(authHeader: string | undefined, secret: string): boolean {
  const prefix = "Bearer ";
  if (!authHeader || !authHeader.startsWith(prefix)) return false;
  const provided = Buffer.from(authHeader.slice(prefix.length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

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

  return r;
}
