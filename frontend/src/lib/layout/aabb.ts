type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

/**
 * Axis-aligned rectangle intersection. `pad` expands each rectangle by that many
 * pixels on every side, so a positive pad keeps labels from merely touching.
 */
export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  );
}

/**
 * Minimum translation vector that pushes `a` off `b`, or `null` if they don't
 * overlap (with `pad` required as a gap between them — same convention as
 * `rectsOverlap`). The vector lies on the axis of *smaller* penetration so the
 * label moves the shortest distance to clear; an equal-penetration tie resolves
 * on the y axis (a 1000×1500 poster is taller than wide, so vertical room is
 * cheaper). Applying `mtv(a, b)` to `a`'s position makes `rectsOverlap(a, b, pad)`
 * false. Antisymmetric for distinct centers: `mtv(a, b) === -mtv(b, a)`.
 */
export function mtv(a: Rect, b: Rect, pad = 0): Point | null {
  const aCx = a.x + a.w / 2;
  const aCy = a.y + a.h / 2;
  const bCx = b.x + b.w / 2;
  const bCy = b.y + b.h / 2;
  const dx = aCx - bCx;
  const dy = aCy - bCy;
  // Penetration on each axis: how far inside the required (half + pad) span the
  // centers sit. ≤ 0 means a gap of at least `pad` already exists on that axis.
  const px = a.w / 2 + b.w / 2 + pad - Math.abs(dx);
  const py = a.h / 2 + b.h / 2 + pad - Math.abs(dy);
  if (px <= 0 || py <= 0) return null;

  // Resolve on the smaller-penetration axis; tie (px === py) falls to y.
  if (px < py) {
    return { x: (dx >= 0 ? 1 : -1) * px, y: 0 };
  }
  return { x: 0, y: (dy >= 0 ? 1 : -1) * py };
}

/**
 * Does the segment p1→p2 touch the rectangle (expanded by `pad`)? Liang–Barsky
 * parametric clip: keep the slice of the segment inside each of the four padded
 * edges; the segment hits the box iff a non-empty slice survives. A zero-length
 * segment reduces to a point-in-rect test. Used to treat arrow lines as obstacles
 * so labels never sit on another spoke.
 */
export function segIntersectsRect(
  p1: Point,
  p2: Point,
  rect: Rect,
  pad = 0,
): boolean {
  const xmin = rect.x - pad;
  const xmax = rect.x + rect.w + pad;
  const ymin = rect.y - pad;
  const ymax = rect.y + rect.h + pad;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // For each boundary: p·t ≤ q keeps the inside half. (p, q) pairs below.
  const edges: ReadonlyArray<readonly [number, number]> = [
    [-dx, p1.x - xmin], // left
    [dx, xmax - p1.x], // right
    [-dy, p1.y - ymin], // top
    [dy, ymax - p1.y], // bottom
  ];

  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of edges) {
    if (p === 0) {
      // Parallel to this edge: outside it entirely → no hit.
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}
