import { describe, it, expect } from "vitest";
import { rectsOverlap, segIntersectsRect, mtv } from "./aabb";

const r = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const pt = (x: number, y: number) => ({ x, y });

describe("rectsOverlap", () => {
  it("detects clearly overlapping rects", () => {
    expect(rectsOverlap(r(0, 0, 10, 10), r(5, 5, 10, 10), 0)).toBe(true);
  });

  it("detects separated rects", () => {
    expect(rectsOverlap(r(0, 0, 10, 10), r(20, 0, 10, 10), 0)).toBe(false);
  });

  it("treats edge-touching rects as non-overlapping at zero padding", () => {
    expect(rectsOverlap(r(0, 0, 10, 10), r(10, 0, 10, 10), 0)).toBe(false);
  });

  it("expands the test by the padding on each side", () => {
    // gap of 3px between right edge (10) and left edge (13)
    expect(rectsOverlap(r(0, 0, 10, 10), r(13, 0, 10, 10), 2)).toBe(false);
    expect(rectsOverlap(r(0, 0, 10, 10), r(13, 0, 10, 10), 4)).toBe(true);
  });

  it("requires overlap on both axes", () => {
    // overlap on x but far apart on y
    expect(rectsOverlap(r(0, 0, 10, 10), r(0, 100, 10, 10), 0)).toBe(false);
  });
});

describe("segIntersectsRect", () => {
  const box = r(10, 10, 10, 10); // [10,20] x [10,20]

  it("detects a segment passing straight through", () => {
    expect(segIntersectsRect(pt(0, 15), pt(30, 15), box)).toBe(true);
  });

  it("detects a segment with an endpoint inside", () => {
    expect(segIntersectsRect(pt(15, 15), pt(100, 100), box)).toBe(true);
  });

  it("treats a zero-length segment as a point-in-rect test", () => {
    expect(segIntersectsRect(pt(15, 15), pt(15, 15), box)).toBe(true);
    expect(segIntersectsRect(pt(0, 0), pt(0, 0), box)).toBe(false);
  });

  it("misses a segment that passes nearby but outside", () => {
    expect(segIntersectsRect(pt(0, 0), pt(30, 0), box)).toBe(false); // runs along y=0
    expect(segIntersectsRect(pt(0, 0), pt(8, 30), box)).toBe(false); // left of the box
  });

  it("honours padding (a near-miss becomes a hit)", () => {
    // segment along y=8, box top edge at y=10 → 2px gap
    expect(segIntersectsRect(pt(0, 8), pt(30, 8), box, 0)).toBe(false);
    expect(segIntersectsRect(pt(0, 8), pt(30, 8), box, 3)).toBe(true);
  });

  it("does not report a segment that stops short of the box", () => {
    // horizontal segment ending at x=5, box starts at x=10
    expect(segIntersectsRect(pt(0, 15), pt(5, 15), box)).toBe(false);
  });
});

describe("mtv", () => {
  it("returns null when the rects are disjoint", () => {
    expect(mtv(r(0, 0, 10, 10), r(20, 0, 10, 10))).toBeNull();
  });

  it("returns null when only edges touch (no penetration)", () => {
    expect(mtv(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBeNull();
  });

  it("resolves along the minimum-penetration axis", () => {
    // a and b overlap 2px on x, 10px on y → push out on x (the smaller axis).
    // a is left of b (dx<0), so a is pushed further left by 2.
    expect(mtv(r(0, 0, 10, 10), r(8, 0, 10, 10))).toEqual({ x: -2, y: 0 });
  });

  it("separates the rects so they no longer overlap after applying it", () => {
    const a = r(0, 0, 10, 10);
    const b = r(8, 0, 10, 10);
    const v = mtv(a, b)!;
    const moved = { ...a, x: a.x + v.x, y: a.y + v.y };
    expect(rectsOverlap(moved, b, 0)).toBe(false);
  });

  it("breaks an equal-penetration tie toward the y axis", () => {
    // 2px penetration on both axes → resolve on y (poster is taller than wide).
    expect(mtv(r(0, 0, 10, 10), r(8, 8, 10, 10))).toEqual({ x: 0, y: -2 });
  });

  it("is antisymmetric: mtv(a,b) == -mtv(b,a)", () => {
    const a = r(0, 0, 10, 10);
    const b = r(8, 3, 10, 10);
    const ab = mtv(a, b)!;
    const ba = mtv(b, a)!;
    // `===` so signed zero (-0 vs +0) doesn't matter — only the real values do.
    expect(ab.x === -ba.x).toBe(true);
    expect(ab.y === -ba.y).toBe(true);
  });

  it("honours padding (requires a gap of `pad` between the rects)", () => {
    // 3px gap between right edge (10) and left edge (13).
    expect(mtv(r(0, 0, 10, 10), r(13, 0, 10, 10), 2)).toBeNull();
    expect(mtv(r(0, 0, 10, 10), r(13, 0, 10, 10), 4)).toEqual({ x: -1, y: 0 });
  });
});
