import { describe, it, expect } from "vitest";
import { buildGlobeData, formatReadout, HOME_COLOR } from "@/lib/globe/arcs";
import { SEED_HOME, SEED_PLACES } from "@/lib/seed";
import { AFFILIATIONS } from "@/lib/affiliations/registry";

describe("buildGlobeData", () => {
  it("creates one arc per place, all starting at home", () => {
    const { arcs } = buildGlobeData(SEED_HOME, SEED_PLACES);
    expect(arcs).toHaveLength(SEED_PLACES.length);
    for (const a of arcs) {
      expect(a.startLat).toBe(SEED_HOME.lat);
      expect(a.startLng).toBe(SEED_HOME.lng);
    }
  });

  it("ends each arc at its place and colors it home-ink -> affiliation", () => {
    const { arcs } = buildGlobeData(SEED_HOME, SEED_PLACES);
    arcs.forEach((a, i) => {
      const place = SEED_PLACES[i];
      expect(a.endLat).toBe(place.lat);
      expect(a.endLng).toBe(place.lng);
      expect(a.color[0]).toBe(HOME_COLOR);
      expect(a.color[1]).toBe(AFFILIATIONS[place.affiliation].color);
    });
  });

  it("annotates each arc with the exact bearing, distance and compass", () => {
    const { arcs } = buildGlobeData(SEED_HOME, SEED_PLACES);
    // SEED_PLACES[0] is London — New York -> London is ~51° (NE), ~5,570 km.
    const london = arcs[0];
    expect(london.label).toContain("London");
    expect(london.compass).toBe("NE");
    expect(london.bearingDeg).toBeGreaterThan(45);
    expect(london.bearingDeg).toBeLessThan(60);
    expect(london.distanceKm).toBeGreaterThan(5400);
    expect(london.distanceKm).toBeLessThan(5700);
  });

  it("emits a home point plus one point per place", () => {
    const { points } = buildGlobeData(SEED_HOME, SEED_PLACES);
    expect(points).toHaveLength(SEED_PLACES.length + 1);

    const homePoints = points.filter((p) => p.isHome);
    expect(homePoints).toHaveLength(1);
    expect(homePoints[0].label).toBe(SEED_HOME.label);
    expect(homePoints[0].color).toBe(HOME_COLOR);
  });

  it("carries measurements on destination points but not on home", () => {
    const { points } = buildGlobeData(SEED_HOME, SEED_PLACES);
    const home = points.find((p) => p.isHome)!;
    expect(home.distanceKm).toBeUndefined();
    expect(home.bearingDeg).toBeUndefined();

    const dests = points.filter((p) => !p.isHome);
    expect(
      dests.every(
        (p) =>
          typeof p.distanceKm === "number" &&
          typeof p.bearingDeg === "number" &&
          typeof p.compass === "string",
      ),
    ).toBe(true);
  });
});

describe("formatReadout", () => {
  it("formats direction + distance like '51° NE · 5,570 km'", () => {
    expect(
      formatReadout({ bearingDeg: 51, compass: "NE", distanceKm: 5570 }),
    ).toBe("51° NE · 5,570 km");
  });
});
