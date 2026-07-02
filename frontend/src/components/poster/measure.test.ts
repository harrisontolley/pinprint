import { describe, it, expect } from "vitest";
import { createMeasurer, fitTitleFontSize } from "./measure";
import { getTemplate } from "@/lib/templates/registry";
import type { Computed } from "@/lib/types";

const t = getTemplate("warm-minimal");
const item: Computed = {
  id: "x",
  label: "Paris",
  fullName: "Paris, France",
  lat: 48.8566,
  lng: 2.3522,
  affiliation: "visited",
  distanceKm: 1000,
  bearingDeg: 90,
};

describe("createMeasurer label height", () => {
  it("reserves two lines when distances are shown", () => {
    expect(createMeasurer(t, "km", true)(item).h).toBe(2 * t.lineHeight);
  });

  it("reserves a single line when distances are hidden", () => {
    expect(createMeasurer(t, "km", false)(item).h).toBe(t.lineHeight);
  });

  it("defaults to showing distances", () => {
    expect(createMeasurer(t, "km")(item).h).toBe(2 * t.lineHeight);
  });
});

describe("fitTitleFontSize", () => {
  const family = t.titleFamily;
  const weight = t.titleWeight;
  const letterSpacing = t.titleLetterSpacing;

  it("keeps the base size when the text fits", () => {
    const size = fitTitleFontSize("Paris", 100, family, weight, letterSpacing, 900);
    expect(size).toBe(100);
  });

  it("shrinks below base size for a long name that overflows", () => {
    const longName = "Special Capital Region of Jakarta";
    const size = fitTitleFontSize(longName, 100, family, weight, letterSpacing, 900);
    expect(size).toBeLessThan(100);
    expect(size).toBeGreaterThanOrEqual(28);
  });

  it("clamps at the minimum size for a pathologically long name", () => {
    const veryLongName = "A".repeat(200);
    const size = fitTitleFontSize(veryLongName, 100, family, weight, letterSpacing, 900);
    expect(size).toBe(28);
  });

  it("fits at a size that is never larger when small-caps is measured", () => {
    const longName = "Special Capital Region of Jakarta";
    const normal = fitTitleFontSize(longName, 100, family, weight, letterSpacing, 900);
    const smallCaps = fitTitleFontSize(longName, 100, family, weight, letterSpacing, 900, true);
    expect(smallCaps).toBeLessThanOrEqual(normal);
    expect(smallCaps).toBeGreaterThanOrEqual(28);
  });

  it("shrunk title width (fixed letter-spacing + trailing gap) stays within maxWidth", () => {
    // Locks in the render-match invariant: fitTitleFontSize must never return a
    // size that overflows once measured the same way Poster.tsx renders it
    // (fixed, unscaled letter-spacing plus one trailing gap).
    const longName = "Special Capital Region of Jakarta";
    const maxWidth = 900;
    const size = fitTitleFontSize(longName, 100, family, weight, letterSpacing, maxWidth);
    // Re-derive width using the same SSR-fallback formula (no canvas in vitest):
    // charWidth scales with font size, same as measureWidth's no-canvas branch.
    const avgCharWidth = size * 0.5625;
    const renderedWidth =
      longName.length * avgCharWidth +
      Math.max(0, longName.length - 1) * letterSpacing +
      letterSpacing;
    expect(renderedWidth).toBeLessThanOrEqual(maxWidth);
  });
});
