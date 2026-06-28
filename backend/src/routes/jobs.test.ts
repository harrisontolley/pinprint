import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../app.js";

// Auth gating for the cron-only blob-GC route. The GC body itself (selectBlobsToDelete)
// is covered in blobGc.test.ts; here we only prove the route is locked down and
// mounted at both prefixes. No blob token is set, so an authorized call short-circuits
// to ran:false — that's the assertion, not real deletion.

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
