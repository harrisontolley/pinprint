import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Auth gating for the cron-only blob-GC route. The GC body itself (selectBlobsToDelete)
// is covered in blobGc.test.ts; here we only prove the route is locked down and
// mounted at both prefixes. No blob token is set, so an authorized call short-circuits
// to ran:false — that's the assertion, not real deletion.
//
// The fulfillment-sweep route's candidate selection (findOrdersNeedingFulfillmentSweep)
// is a plain SQL query with no dedicated unit test file for the orders.ts store
// (matching this codebase's convention — see webhooks.test.ts/digitalDelivery.test.ts,
// which module-mock ./orders.js rather than hitting a real DB); here we mock it plus
// its two idempotent collaborators to prove the route: authorizes like blob-gc, resubmits
// every candidate the store returns, and correctly counts only the successful outcomes
// (which is how "skips already-fulfilled/delivered/too-recent" actually manifests once
// the store's WHERE clause excludes them).

const findOrdersNeedingFulfillmentSweep = vi.fn(async () => [] as { id: string; orderNumber: string }[]);
vi.mock("../orders.js", () => ({
  findOrdersNeedingFulfillmentSweep: (...args: unknown[]) => findOrdersNeedingFulfillmentSweep(...args),
}));

const submitOrderToArtelo = vi.fn(async () => ({ submitted: false, reason: "already_submitted" }));
vi.mock("../fulfillment.js", () => ({
  submitOrderToArtelo: (...args: unknown[]) => submitOrderToArtelo(...args),
}));

const deliverDigitalFiles = vi.fn(async () => ({ delivered: false, reason: "already_delivered" }));
vi.mock("../digitalDelivery.js", () => ({
  deliverDigitalFiles: (...args: unknown[]) => deliverDigitalFiles(...args),
}));

const { app } = await import("../app.js");

describe("POST /jobs/blob-gc", () => {
  const prevSecret = process.env.CRON_SECRET;
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN; // keep the GC body inert/hermetic
  });
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
    if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
  });

  it("503s when CRON_SECRET is unconfigured", async () => {
    delete process.env.CRON_SECRET;
    const res = await app.request("/jobs/blob-gc", { method: "POST" });
    expect(res.status).toBe(503);
  });

  it("401s without a matching bearer secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const noAuth = await app.request("/jobs/blob-gc", { method: "POST" });
    expect(noAuth.status).toBe(401);
    const wrong = await app.request("/jobs/blob-gc", {
      method: "POST",
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.status).toBe(401);
  });

  it("runs with a valid secret (inert without a blob store)", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await app.request("/jobs/blob-gc", {
      method: "POST",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ran: false, reason: "blob_unconfigured" });
  });

  it("is mounted under the /_/backend service prefix too", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await app.request("/_/backend/jobs/blob-gc", {
      method: "GET",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ran: false, reason: "blob_unconfigured" });
  });
});

describe("POST /jobs/fulfillment-sweep", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    findOrdersNeedingFulfillmentSweep.mockReset().mockResolvedValue([]);
    submitOrderToArtelo.mockReset().mockResolvedValue({ submitted: false, reason: "already_submitted" });
    deliverDigitalFiles.mockReset().mockResolvedValue({ delivered: false, reason: "already_delivered" });
  });
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  });

  it("503s when CRON_SECRET is unconfigured", async () => {
    delete process.env.CRON_SECRET;
    const res = await app.request("/jobs/fulfillment-sweep", { method: "POST" });
    expect(res.status).toBe(503);
  });

  it("401s without a matching bearer secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const noAuth = await app.request("/jobs/fulfillment-sweep", { method: "POST" });
    expect(noAuth.status).toBe(401);
    const wrong = await app.request("/jobs/fulfillment-sweep", {
      method: "POST",
      headers: { authorization: "Bearer nope" },
    });
    expect(wrong.status).toBe(401);
  });

  it("skips fulfilled/delivered/recent orders — none returned by the store means no work", async () => {
    process.env.CRON_SECRET = "s3cret";
    findOrdersNeedingFulfillmentSweep.mockResolvedValue([]);
    const res = await app.request("/jobs/fulfillment-sweep", {
      method: "POST",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scanned: 0, arteloSubmitted: 0, digitalDelivered: 0 });
    expect(submitOrderToArtelo).not.toHaveBeenCalled();
    expect(deliverDigitalFiles).not.toHaveBeenCalled();
  });

  it("resubmits every qualifying order and counts only the successful outcomes", async () => {
    process.env.CRON_SECRET = "s3cret";
    findOrdersNeedingFulfillmentSweep.mockResolvedValue([
      { id: "ord-1", orderNumber: "PP-AAAA1111" },
      { id: "ord-2", orderNumber: "PP-BBBB2222" },
    ]);
    // ord-1 still needs its Artelo submission; ord-2 still needs digital delivery —
    // both collaborators are still called for both orders (never-throw + idempotent,
    // see fulfillment.ts/digitalDelivery.ts), only the counts should reflect success.
    submitOrderToArtelo.mockImplementation(async (id: string) =>
      id === "ord-1" ? { submitted: true } : { submitted: false, reason: "already_submitted" },
    );
    deliverDigitalFiles.mockImplementation(async (id: string) =>
      id === "ord-2" ? { delivered: true } : { delivered: false, reason: "already_delivered" },
    );
    const res = await app.request("/jobs/fulfillment-sweep", {
      method: "POST",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scanned: 2, arteloSubmitted: 1, digitalDelivered: 1 });
    expect(submitOrderToArtelo).toHaveBeenCalledWith("ord-1");
    expect(submitOrderToArtelo).toHaveBeenCalledWith("ord-2");
    expect(deliverDigitalFiles).toHaveBeenCalledWith("ord-1");
    expect(deliverDigitalFiles).toHaveBeenCalledWith("ord-2");
  });

  it("is mounted under the /_/backend service prefix too", async () => {
    process.env.CRON_SECRET = "s3cret";
    findOrdersNeedingFulfillmentSweep.mockResolvedValue([]);
    const res = await app.request("/_/backend/jobs/fulfillment-sweep", {
      method: "GET",
      headers: { authorization: "Bearer s3cret" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, scanned: 0, arteloSubmitted: 0, digitalDelivered: 0 });
  });
});
