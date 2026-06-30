import { describe, it, expect } from "vitest";
import {
  contentSafeRect,
  posterGeometry,
  POSTER_MARGIN,
  EST_LABEL_HALF,
  BOTTOM_BAND,
} from "./geometry";
import { POSTER_SIZES, POSTER_SIZE_ORDER } from "../templates/sizes";

describe("posterGeometry", () => {
  it("keeps the classic portrait framing unchanged", () => {
    const { cx, cy, maxRadius } = posterGeometry(1000, 1500);
    expect(cx).toBe(500);
    expect(cy).toBe(690);
    expect(maxRadius).toBe(330);
  });

  it("produces a usable, collision-safe frame for every size preset", () => {
    for (const id of POSTER_SIZE_ORDER) {
      const { width, height } = POSTER_SIZES[id];
      const { cx, cy, maxRadius } = posterGeometry(width, height);

      // A real compass fits.
      expect(maxRadius).toBeGreaterThan(0);

      // Tips + label overhang clear the reserved bottom text block...
      expect(cy + maxRadius + EST_LABEL_HALF).toBeLessThanOrEqual(
        height - BOTTOM_BAND + 0.001,
      );
      // ...and stay inside the side + top margins.
      expect(maxRadius).toBeLessThanOrEqual(cx - POSTER_MARGIN + 0.001);
      expect(cy - maxRadius).toBeGreaterThanOrEqual(
        POSTER_MARGIN + EST_LABEL_HALF - 0.001,
      );
    }
  });
});

describe("contentSafeRect", () => {
  it("reserves the bottom band for the title/legend/footer block", () => {
    const rect = contentSafeRect(1000, 1500);
    expect(rect).toEqual({
      minX: POSTER_MARGIN,
      minY: POSTER_MARGIN,
      maxX: 1000 - POSTER_MARGIN,
      maxY: 1500 - BOTTOM_BAND,
    });
  });

  it("stops the safe area well above the full-height margin", () => {
    // The point of the band fix: the bottom bound is the band top
    // (height - BOTTOM_BAND), not height - margin.
    const rect = contentSafeRect(1000, 1500);
    expect(rect.maxY).toBeLessThan(1500 - POSTER_MARGIN);
  });

  it("honours a custom margin (band is independent of the side/top margin)", () => {
    const rect = contentSafeRect(1000, 1500, 40);
    expect(rect.minX).toBe(40);
    expect(rect.minY).toBe(40);
    expect(rect.maxX).toBe(960);
    expect(rect.maxY).toBe(1500 - BOTTOM_BAND);
  });

  it("contains every arrow tip posterGeometry allows", () => {
    const { cy, maxRadius } = posterGeometry(1000, 1500);
    const rect = contentSafeRect(1000, 1500);
    expect(cy + maxRadius).toBeLessThanOrEqual(rect.maxY + 1e-6);
  });
});
