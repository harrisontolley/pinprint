import { getSql } from "./db.js";
import { type BlobEntry, blobPathnameFromUrl, deletePosterBlobs, listPosterBlobs } from "./blob.js";

// Lifecycle GC for print-asset blobs. Posters (10–60 MB each) accumulate forever
// otherwise: most are abandoned-cart previews that never become an order, and even
// fulfilled artwork shouldn't linger indefinitely (it encodes personal locations).
// This job deletes two classes:
//
//   • Orphan  — a blob never referenced by any order, older than ORPHAN_TTL.
//   • Expired — a blob referenced only by orders in a terminal state, older than
//               RETENTION_DAYS (kept that long for reprints / chargebacks).
//
// Run daily from a Vercel cron (see routes/jobs.ts + vercel.json). Env-guarded and
// non-throwing, like the rest of the integration surface.

/** Order statuses past which artwork is eligible for retention-window purge. */
const TERMINAL_STATUSES = new Set(["shipped", "delivered", "cancelled", "refunded"]);

const DEFAULT_ORPHAN_TTL_HOURS = 48;
const DEFAULT_RETENTION_DAYS = 90;

export type OrderAssetRef = { assetUrl: string; status: string; createdAt: Date };

export type GcDecision = { url: string; pathname: string; reason: "orphan" | "expired" };

export type GcOptions = { orphanTtlMs: number; retentionMs: number };

/**
 * Pure selection: decide which blobs to delete given the current blobs, the order
 * refs that point at them, and a clock. Matching is by store pathname (robust to
 * public/private host differences between the stored URL and the listed blob).
 */
export function selectBlobsToDelete(
  blobs: BlobEntry[],
  orders: OrderAssetRef[],
  now: number,
  opts: GcOptions,
): GcDecision[] {
  const refsByPath = new Map<string, OrderAssetRef[]>();
  for (const o of orders) {
    const p = blobPathnameFromUrl(o.assetUrl);
    if (!p) continue;
    const list = refsByPath.get(p) ?? [];
    list.push(o);
    refsByPath.set(p, list);
  }

  const out: GcDecision[] = [];
  for (const b of blobs) {
    const refs = refsByPath.get(b.pathname);
    if (!refs || refs.length === 0) {
      // Orphan — uploaded but never tied to an order (or its order was deleted).
      if (now - b.uploadedAt.getTime() > opts.orphanTtlMs) {
        out.push({ url: b.url, pathname: b.pathname, reason: "orphan" });
      }
      continue;
    }
    // Referenced: keep unless EVERY referencing order is terminal and past retention.
    const allExpired = refs.every(
      (r) => TERMINAL_STATUSES.has(r.status) && now - r.createdAt.getTime() > opts.retentionMs,
    );
    if (allExpired) out.push({ url: b.url, pathname: b.pathname, reason: "expired" });
  }
  return out;
}

function gcOptionsFromEnv(): GcOptions {
  const hours = Number(process.env.BLOB_ORPHAN_TTL_HOURS);
  const days = Number(process.env.BLOB_RETENTION_DAYS);
  const orphanHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_ORPHAN_TTL_HOURS;
  const retentionDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
  return { orphanTtlMs: orphanHours * 3_600_000, retentionMs: retentionDays * 86_400_000 };
}

export type GcResult =
  | { ran: false; reason: string }
  | {
      ran: true;
      scanned: number;
      deleted: number;
      orphans: number;
      expired: number;
      dryRun: boolean;
    };

/**
 * Run a single GC pass. Lists poster blobs, cross-references the orders table, and
 * deletes the orphaned/expired set (unless dryRun). Never throws — returns a
 * structured result for the cron route to report.
 */
export async function runBlobGc(input: { dryRun?: boolean } = {}): Promise<GcResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ran: false, reason: "blob_unconfigured" };
  const sql = getSql();
  if (!sql) return { ran: false, reason: "db_unconfigured" };

  const opts = gcOptionsFromEnv();
  let blobs: BlobEntry[];
  try {
    blobs = await listPosterBlobs();
  } catch (err) {
    console.error("[blobGc] list failed", err);
    return { ran: false, reason: "list_failed" };
  }

  let orders: OrderAssetRef[];
  try {
    const rows = (await sql`
      select oi.asset_url, o.status::text as status, o.created_at
      from order_items oi
      join orders o on o.id = oi.order_id
      where oi.asset_url is not null
    `) as Array<{ asset_url: string; status: string; created_at: string | Date }>;
    orders = rows.map((r) => ({
      assetUrl: r.asset_url,
      status: r.status,
      createdAt: new Date(r.created_at),
    }));
  } catch (err) {
    console.error("[blobGc] order query failed", err);
    return { ran: false, reason: "db_query_failed" };
  }

  const decisions = selectBlobsToDelete(blobs, orders, Date.now(), opts);
  const orphans = decisions.filter((d) => d.reason === "orphan").length;
  const expired = decisions.length - orphans;
  const dryRun = input.dryRun === true;

  if (!dryRun && decisions.length > 0) {
    try {
      await deletePosterBlobs(decisions.map((d) => d.url));
    } catch (err) {
      console.error("[blobGc] delete failed", err);
      return { ran: false, reason: "delete_failed" };
    }
  }

  return { ran: true, scanned: blobs.length, deleted: dryRun ? 0 : decisions.length, orphans, expired, dryRun };
}
