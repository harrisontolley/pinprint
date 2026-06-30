import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeReverse, geocodeSearch, normalizeMaptiler } from "./nominatim.js";

// The geocode module proxies MapTiler when MAPTILER_API_KEY is set and falls
// back to public Nominatim otherwise. These tests stub fetch (no network) and
// use unique queries per case to dodge the module-level LRU cache. Redis is
// unconfigured in tests, so the L2 cache + distributed gate are no-ops.

const originalKey = process.env.MAPTILER_API_KEY;

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

beforeEach(() => {
  delete process.env.MAPTILER_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.MAPTILER_API_KEY;
  else process.env.MAPTILER_API_KEY = originalKey;
});

describe("normalizeMaptiler", () => {
  it("maps a GeoJSON feature to the GeoResult contract", () => {
    const r = normalizeMaptiler({
      id: "municipality.46425",
      text: "Paris",
      place_name: "Paris, France",
      place_type: ["place"],
      center: [2.3522, 48.8566],
      properties: { country_code: "fr", place_designation: "city" },
    });
    expect(r).toEqual({
      id: "municipality.46425",
      label: "Paris",
      fullName: "Paris, France",
      lat: 48.8566,
      lng: 2.3522,
      kind: "city",
    });
  });

  it("derives label from place_name and falls back through kind sources", () => {
    const r = normalizeMaptiler({
      id: "x",
      place_name: "Camden, London, UK",
      center: [-0.14, 51.54],
      place_type: ["neighbourhood"],
      properties: {},
    });
    expect(r.label).toBe("Camden");
    expect(r.kind).toBe("neighbourhood");
  });
});

describe("geocodeSearch provider routing", () => {
  it("calls MapTiler and maps results when a key is configured", async () => {
    process.env.MAPTILER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        features: [
          {
            id: "place.1",
            text: "Berlin",
            place_name: "Berlin, Germany",
            place_type: ["place"],
            center: [13.405, 52.52],
            properties: { place_designation: "city" },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await geocodeSearch("berlin-mt-unique");

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("api.maptiler.com/geocoding/");
    expect(calledUrl).toContain("autocomplete=true");
    expect(calledUrl).toContain("key=test-key");
    expect(results).toEqual([
      { id: "place.1", label: "Berlin", fullName: "Berlin, Germany", lat: 52.52, lng: 13.405, kind: "city" },
    ]);
  });

  it("falls back to public Nominatim when no key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { place_id: 123, name: "Oslo", display_name: "Oslo, Norway", lat: "59.91", lon: "10.75", addresstype: "city" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await geocodeSearch("oslo-osm-unique");

    expect(String(fetchMock.mock.calls[0][0])).toContain("nominatim.openstreetmap.org/search");
    expect(results[0]).toMatchObject({ label: "Oslo", lat: 59.91, lng: 10.75 });
  });
});

describe("geocodeReverse provider routing", () => {
  it("queries MapTiler reverse with lng,lat order when keyed", async () => {
    process.env.MAPTILER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        features: [
          { id: "addr.9", text: "10 Downing St", place_name: "10 Downing St, London", center: [-0.1276, 51.5034], properties: {} },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await geocodeReverse(51.5034, -0.1276);

    expect(String(fetchMock.mock.calls[0][0])).toContain("api.maptiler.com/geocoding/-0.1276,51.5034.json");
    expect(r).toMatchObject({ label: "10 Downing St", lat: 51.5034, lng: -0.1276 });
  });
});
