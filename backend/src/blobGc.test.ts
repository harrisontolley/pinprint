import { describe, expect, it } from "vitest";
import { type BlobEntry, type OrderAssetRef, selectBlobsToDelete } from "./blobGc.js";

// The deletion decision is the risky part (deleting live artwork would break
// fulfilment / reprints), so the pure selection is tested exhaustively without a
// blob store or DB.

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const OPTS = { orphanTtlMs: 48 * HOUR, retentionMs: 90 * DAY };

function blob(pathname: string, ageMs: number): BlobEntry {
  return {
    pathname,
    url: `https://x.blob.vercel-storage.com/${pathname}`,
    uploadedAt: new Date(NOW - ageMs),
  };
}
function ref(pathname: string, status: string, ageMs: number): OrderAssetRef {
  return {
    assetUrl: `https://x.blob.vercel-storage.com/${pathname}`,
    status,
    createdAt: new Date(NOW - ageMs),
  };
}

describe("selectBlobsToDelete", () => {
  it("keeps a fresh orphan, deletes an old orphan", () => {
    const blobs = [blob("posters/fresh.png", 1 * HOUR), blob("posters/old.png", 72 * HOUR)];
    const out = selectBlobsToDelete(blobs, [], NOW, OPTS);
    expect(out).toEqual([
      { url: blobs[1].url, pathname: "posters/old.png", reason: "orphan" },
    ]);
  });

  it("keeps a blob referenced by a live (non-terminal) order, however old", () => {
    const blobs = [blob("posters/live.png", 365 * DAY)];
    const orders = [ref("posters/live.png", "paid", 365 * DAY)];
    expect(selectBlobsToDelete(blobs, orders, NOW, OPTS)).toEqual([]);
  });

  it("keeps a terminal order still inside the retention window", () => {
    const blobs = [blob("posters/recent.png", 10 * DAY)];
    const orders = [ref("posters/recent.png", "delivered", 10 * DAY)];
    expect(selectBlobsToDelete(blobs, orders, NOW, OPTS)).toEqual([]);
  });

  it("expires a terminal order past the retention window", () => {
    const blobs = [blob("posters/done.png", 120 * DAY)];
    const orders = [ref("posters/done.png", "shipped", 120 * DAY)];
    const out = selectBlobsToDelete(blobs, orders, NOW, OPTS);
    expect(out).toEqual([
      { url: blobs[0].url, pathname: "posters/done.png", reason: "expired" },
    ]);
  });

  it("keeps a blob if ANY referencing order is still live", () => {
    // Same asset reused across two orders: one terminal+old, one still paid.
    const blobs = [blob("posters/shared.png", 200 * DAY)];
    const orders = [
      ref("posters/shared.png", "cancelled", 200 * DAY),
      ref("posters/shared.png", "paid", 5 * DAY),
    ];
    expect(selectBlobsToDelete(blobs, orders, NOW, OPTS)).toEqual([]);
  });

  it("expires only when every referencing order is terminal and old", () => {
    const blobs = [blob("posters/multi.png", 200 * DAY)];
    const orders = [
      ref("posters/multi.png", "refunded", 200 * DAY),
      ref("posters/multi.png", "delivered", 150 * DAY),
    ];
    const out = selectBlobsToDelete(blobs, orders, NOW, OPTS);
    expect(out.map((d) => d.reason)).toEqual(["expired"]);
  });
});
