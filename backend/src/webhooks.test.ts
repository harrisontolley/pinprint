import { describe, expect, it } from "vitest";
import { app } from "./app.js";
import {
  extractProdigiOrder,
  handleProdigiPayload,
  mapProdigiStage,
  trackingFromShipments,
} from "./webhooks.js";

// Pure mapping helpers are unit-tested directly; the routes are tested for their
// no-op-when-unconfigured behavior (no DATABASE_URL in the hermetic test env, so
// order lookups return null and the handlers don't throw).

describe("prodigi stage mapping", () => {
  it("maps known stages", () => {
    expect(mapProdigiStage("InProgress")).toBe("in_production");
    expect(mapProdigiStage("Complete")).toBe("shipped");
    expect(mapProdigiStage("Cancelled")).toBe("cancelled");
  });
  it("returns null for unknown stages", () => {
    expect(mapProdigiStage("Whatever")).toBeNull();
  });
});

describe("extractProdigiOrder", () => {
  it("reads a bare order payload", () => {
    expect(extractProdigiOrder({ id: "ord_1", status: { stage: "Complete" } })).toMatchObject({
      id: "ord_1",
      stage: "Complete",
    });
  });
  it("reads a CloudEvents-wrapped payload", () => {
    const got = extractProdigiOrder({
      data: { order: { id: "ord_2", status: { stage: "InProgress" }, shipments: [] } },
    });
    expect(got).toMatchObject({ id: "ord_2", stage: "InProgress" });
  });
  it("tolerates junk", () => {
    expect(extractProdigiOrder(null)).toEqual({ id: undefined, stage: undefined, shipments: undefined });
  });
});

describe("trackingFromShipments", () => {
  it("pulls carrier + tracking from the first shipment", () => {
    expect(
      trackingFromShipments([
        { carrier: { name: "DPD" }, tracking: { number: "X1", url: "https://t/X1" } },
      ]),
    ).toEqual({ carrier: "DPD", number: "X1", url: "https://t/X1" });
  });
  it("returns undefined when empty or absent", () => {
    expect(trackingFromShipments([])).toBeUndefined();
    expect(trackingFromShipments(undefined)).toBeUndefined();
    expect(trackingFromShipments([{}])).toBeUndefined();
  });
});

describe("handleProdigiPayload — unconfigured DB", () => {
  it("no-ops (handled:false) without throwing", async () => {
    await expect(
      handleProdigiPayload({ id: "ord_x", status: { stage: "Complete" } }),
    ).resolves.toEqual({ handled: false });
  });
});

describe("webhook routes", () => {
  for (const base of ["", "/_/backend"]) {
    it(`prodigi: valid JSON → 204 (${base || "/"})`, async () => {
      const res = await app.request(`${base}/webhooks/prodigi`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "ord_1", status: { stage: "Complete" } }),
      });
      expect(res.status).toBe(204);
    });

    it(`prodigi: invalid JSON → 400 (${base || "/"})`, async () => {
      const res = await app.request(`${base}/webhooks/prodigi`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });

    it(`stripe: missing signature → 400 (${base || "/"})`, async () => {
      const res = await app.request(`${base}/webhooks/stripe`, {
        method: "POST",
        body: "{}",
      });
      expect(res.status).toBe(400);
    });
  }
});
