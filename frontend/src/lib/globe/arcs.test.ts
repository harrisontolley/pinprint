import { describe, it, expect } from "vitest";
import { buildGlobeData, HOME_COLOR } from "@/lib/globe/arcs";
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

  it("emits a home point plus one point per place", () => {
    const { points } = buildGlobeData(SEED_HOME, SEED_PLACES);
    expect(points).toHaveLength(SEED_PLACES.length + 1);

    const homePoints = points.filter((p) => p.isHome);
    expect(homePoints).toHaveLength(1);
    expect(homePoints[0].label).toBe(SEED_HOME.label);
    expect(homePoints[0].color).toBe(HOME_COLOR);
  });
});
