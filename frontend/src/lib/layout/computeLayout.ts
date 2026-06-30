import type { Computed } from "../types";
import { bearingToVec } from "../geo/projection";
import { rectsOverlap, segIntersectsRect, mtv } from "./aabb";
import { distanceRadius } from "./magnitude";
import type {
  LabelBox,
  LabelSize,
  LaidOut,
  LayoutConfig,
  LayoutDiagnostics,
  MeasureFn,
  TextAnchor,
} from "./types";

/** Smallest absolute angular gap between two bearings, accounting for 0/360 wrap. */
function angularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Group labels into same-direction clusters: sort by bearing and break the chain
 * wherever the gap to the next bearing exceeds `clusterAngleDeg`. Shared by STEP 1's
 * radius stagger and the ordered-stacking resolver so the grouping never drifts.
 */
function clustersByBearing(laid: LaidOut[], cfg: LayoutConfig): LaidOut[][] {
  const byBearing = [...laid].sort((a, b) => a.bearingDeg - b.bearingDeg);
  const groups: LaidOut[][] = [];
  let start = 0;
  for (let i = 1; i <= byBearing.length; i++) {
    const breaks =
      i === byBearing.length ||
      angularGap(byBearing[i - 1].bearingDeg, byBearing[i].bearingDeg) > cfg.clusterAngleDeg;
    if (breaks) {
      groups.push(byBearing.slice(start, i));
      start = i;
    }
  }
  return groups;
}

/**
 * Non-decreasing least-squares isotonic regression (pool-adjacent-violators).
 * Returns the closest non-decreasing sequence to `t`. O(n).
 */
function pava(t: number[]): number[] {
  const blocks: { sum: number; count: number; val: number }[] = [];
  for (const v of t) {
    const b = { sum: v, count: 1, val: v };
    while (blocks.length && blocks[blocks.length - 1].val >= b.val) {
      const p = blocks.pop()!;
      b.sum += p.sum;
      b.count += p.count;
      b.val = b.sum / b.count;
    }
    blocks.push(b);
  }
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.count; k++) out.push(b.val);
  return out;
}

/**
 * Pack a vertical stack of label centers. Given each member's desired center
 * `targets[i]` (top→bottom), the minimum center-to-center gap `gaps[i]` between
 * consecutive members, and their `heights`, return centers `y[i]` that are:
 *  - strictly ordered with every gap satisfied (so the boxes never overlap), and
 *  - as close to the targets as possible (isotonic L2 fit), then
 *  - rigidly shifted so the stack's top/bottom edges fit within `[lo, hi]`.
 * If the stack is taller than `hi-lo` it is top-aligned (bottom overflow handled by
 * the caller's clamp/cleanup). Pure + deterministic.
 */
export function packStackVertical(
  targets: number[],
  gaps: number[],
  heights: number[],
  lo: number,
  hi: number,
): number[] {
  const n = targets.length;
  if (n === 0) return [];
  const prefix = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) prefix[i] = prefix[i - 1] + gaps[i - 1];
  // Substitute z_i = y_i - prefix_i so the gap constraints become z non-decreasing.
  const z = pava(targets.map((t, i) => t - prefix[i]));
  const y = z.map((zi, i) => zi + prefix[i]);
  // Rigid block-shift so the stack's outer edges fit within [lo, hi].
  const topEdge = y[0] - heights[0] / 2;
  const botEdge = y[n - 1] + heights[n - 1] / 2;
  const lowShift = lo - topEdge; // shift ≥ this keeps the top edge inside
  const highShift = hi - botEdge; // shift ≤ this keeps the bottom edge inside
  const shift =
    lowShift <= highShift ? Math.min(Math.max(0, lowShift), highShift) : lowShift; // too tall → top-align
  return y.map((v) => v + shift);
}

/**
 * Position a label at its arrow tip. In the default `iconAtTip` mode the gap from
 * the tip is `tipIconGap` (the affiliation icon, drawn at the inner edge of the
 * box, lands just past the arrowhead); otherwise the legacy `labelGap` is used.
 * Text extends *away* from the center: right-anchored on the left side,
 * left-anchored on the right side, centered near vertical. The box is clamped into
 * the content-safe rect (above the reserved bottom band). `perp` is honoured so the
 * asymmetric fallback resolver can still slide a label along its perpendicular; the
 * primary 2D relaxation leaves `perp` at 0 and moves the box directly.
 */
function placeLabel(l: LaidOut, cfg: LayoutConfig, size: LabelSize): void {
  l.tip = {
    x: cfg.cx + l.dir.x * l.radius,
    y: cfg.cy + l.dir.y * l.radius,
  };
  const perp = { x: -l.dir.y, y: l.dir.x };
  const gap = cfg.iconAtTip ? cfg.tipIconGap : cfg.labelGap;
  const anchorX = l.tip.x + l.dir.x * gap + perp.x * l.perp;
  const anchorY = l.tip.y + l.dir.y * gap + perp.y * l.perp;

  const anchor: TextAnchor =
    l.dir.x > cfg.anchorDeadzone
      ? "start"
      : l.dir.x < -cfg.anchorDeadzone
        ? "end"
        : "middle";

  const { w, h } = size;
  const rawX = anchor === "start" ? anchorX : anchor === "end" ? anchorX - w : anchorX - w / 2;
  const rawY = anchorY - h / 2;

  // Keep the whole label box inside the content-safe rect: poster margins on the
  // sides/top, and the title/legend/footer band top on the bottom (`safeBottom`),
  // so a label never runs off an edge or sits over the bottom text block.
  const x = clamp(rawX, cfg.margin, cfg.width - cfg.margin - w);
  const y = clamp(rawY, cfg.margin, cfg.safeBottom - h);

  // Provisional leader attach point (overwritten by `finalize`, but kept valid for
  // the fallback resolver, which reads it mid-run).
  l.labelBox = {
    x,
    y,
    w,
    h,
    anchor,
    anchorX: anchorX + (x - rawX),
    anchorY: anchorY + (y - rawY),
  };
}

/** Clamp `v` into [min, max]; if the range is inverted (box wider/taller than
 * the safe area) fall back to the lower bound so the label hugs the margin. */
function clamp(v: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(v, min), max);
}

function labelCenter(l: LaidOut): { x: number; y: number } {
  return { x: l.labelBox.x + l.labelBox.w / 2, y: l.labelBox.y + l.labelBox.h / 2 };
}

/**
 * Nudge a label one fixed `perpStep` along its perpendicular, locking the sign on
 * first use so movement is monotonic and the relaxation can't oscillate. Used only
 * by the asymmetric fallback resolver.
 */
function nudgePerp(l: LaidOut, desiredSign: number, cfg: LayoutConfig): void {
  const sign = l.perp !== 0 ? (l.perp > 0 ? 1 : -1) : desiredSign >= 0 ? 1 : -1;
  l.perp += sign * cfg.perpStep;
  l.needsLeader = true;
}

/**
 * Place arrows at their true bearings and resolve label collisions.
 *
 * The bearing angle is sacred: each arrow's direction (`dir`) and length (`radius`)
 * fix its `tip`, and only the label *box* moves to clear collisions.
 *
 * 1. Seed arrow lengths (distance-scaled) and stagger same-direction clusters along
 *    their shared spoke.
 * 2. Place each label at its rest position (icon at the tip).
 * 3. PRIMARY — a symmetric 2D relaxation: overlapping boxes push each other apart by
 *    half the minimum-translation vector each (so two cities in the same direction
 *    split the move evenly), boxes are pushed off other arrows' lines, and every box
 *    is kept inside the content-safe rect.
 * 4. FALLBACK — if a genuinely dense poster still has overlaps, reset and run the
 *    proven asymmetric resolver (only the shorter arrow's label yields), which always
 *    reaches zero overlap. This rarely fires.
 *
 * Pass a `LayoutDiagnostics` object as `diag` to capture rest centers, iteration
 * count, convergence, fallback use, and residual overlaps (used by the tuning lab).
 */
export function computeLayout(
  items: Computed[],
  cfg: LayoutConfig,
  measure: MeasureFn,
  diag?: LayoutDiagnostics,
): LaidOut[] {
  // Seed each arrow's length. With distance scaling on, length encodes distance
  // (farther = longer) via a log-normalized map across this poster's range. A
  // single place or an all-equal-distance set has no range to scale across, so
  // it falls back to the fixed `baseRadius` (the uniform, unscaled look).
  const distances = items.map((p) => p.distanceKm);
  const dMin = Math.min(...distances);
  const dMax = Math.max(...distances);
  const useMagnitude = cfg.scaleByDistance && dMax > dMin;
  const baseRadiusFor = (p: Computed): number =>
    useMagnitude
      ? distanceRadius(p.distanceKm, dMin, dMax, cfg.minRadius, cfg.maxRadius)
      : cfg.baseRadius;

  const sizes = new Map<string, LabelSize>();
  const laid: LaidOut[] = items.map((p) => {
    sizes.set(p.id, measure(p));
    return {
      ...p,
      dir: bearingToVec(p.bearingDeg),
      radius: baseRadiusFor(p),
      perp: 0,
      tip: { x: 0, y: 0 },
      labelBox: {} as LabelBox,
      needsLeader: false,
    };
  });

  // STEP 1 — stagger near-identical bearings so same-direction arrows don't
  // overlap. Cluster by bearing; within a cluster, order by distance (nearest
  // shortest) and walk outward, forcing each arrow at least `radiusStep` past the
  // previous one. This keeps each arrow's seeded length (so distance scaling shows
  // through) while still guaranteeing separation for near-equidistant places.
  for (const group of clustersByBearing(laid, cfg)) {
    const byDistance = [...group].sort((a, b) => a.distanceKm - b.distanceKm);
    let prev = -Infinity;
    for (const g of byDistance) {
      g.radius = Math.min(Math.max(g.radius, prev + cfg.radiusStep), cfg.maxRadius);
      prev = g.radius;
    }
  }

  // STEP 2 — place each label at its rest (icon-at-tip) position, and remember that
  // rest center so we can decide later whether a leader is needed and pull labels
  // back toward it after collisions clear.
  const restCenter: Record<string, { x: number; y: number }> = {};
  // Seed tip Y per label (before any resolution) — defines the desired cluster order
  // ("match the tips"): a label whose seed tip is higher should end up higher.
  const seedTipY: Record<string, number> = {};
  laid.forEach((l) => {
    placeLabel(l, cfg, sizes.get(l.id)!);
    restCenter[l.id] = labelCenter(l);
    seedTipY[l.id] = l.tip.y;
  });

  const center = { x: cfg.cx, y: cfg.cy };

  // Overshoot margin. Damped separation approaches the padding boundary
  // asymptotically and would stop (movement < epsilon) a hair short, leaving a
  // sub-pixel overlap. Pushing this far *past* the required gap guarantees the boxes
  // actually clear it before convergence. Must exceed the per-axis residual (~epsilon).
  const settle = cfg.epsilon + 1;

  // Clamp a label box into the content-safe rect (in place).
  const clampBoxInto = (l: LaidOut): void => {
    l.labelBox.x = clamp(l.labelBox.x, cfg.margin, cfg.width - cfg.margin - l.labelBox.w);
    l.labelBox.y = clamp(l.labelBox.y, cfg.margin, cfg.safeBottom - l.labelBox.h);
  };

  // Push vector that moves label `l` off the (infinite) line through the center with
  // direction `dirObstacle`, to its current side, leaving `padNeeded` clearance — or
  // null if it already clears. Only applied after `segIntersectsRect` confirms the
  // box actually sits on that arrow's finite spoke.
  const pushOffSpoke = (
    l: LaidOut,
    dirObstacle: { x: number; y: number },
    padNeeded: number,
  ): { x: number; y: number } | null => {
    const n = { x: -dirObstacle.y, y: dirObstacle.x }; // unit normal to the spoke
    const c = labelCenter(l);
    const signedDist = (c.x - center.x) * n.x + (c.y - center.y) * n.y;
    // Clearance needed along the normal to match `segIntersectsRect(..., padNeeded)`:
    // that test expands the box by `padNeeded` on every side, so the box's reach along
    // the (possibly diagonal) normal is `(w/2)|n.x| + (h/2)|n.y|` plus the padding's own
    // projection `padNeeded·(|n.x|+|n.y|)`. Matching it exactly (plus `settle`) is what
    // lets the box actually clear a steep spoke rather than graze it by a fraction.
    const boxReach =
      (l.labelBox.w / 2) * Math.abs(n.x) +
      (l.labelBox.h / 2) * Math.abs(n.y) +
      padNeeded * (Math.abs(n.x) + Math.abs(n.y));
    const need = boxReach + settle - Math.abs(signedDist);
    if (need <= 0) return null;
    const sign = signedDist >= 0 ? 1 : -1;
    return { x: sign * n.x * need, y: sign * n.y * need };
  };

  // With icon-at-tip the arrow is *meant* to reach its own label (the icon marks the
  // tip), so a box straddling its tip is fine. The arrow only "ends in its own text"
  // when the box has been dragged inward past the tip — i.e. the tip lies outward of
  // the box center along the arrow — so the shaft crosses the text. Only that is a defect.
  const arrowEndsInText = (l: LaidOut): boolean => {
    if (!segIntersectsRect(center, l.tip, l.labelBox, 0)) return false;
    const c = labelCenter(l);
    return (l.tip.x - c.x) * l.dir.x + (l.tip.y - c.y) * l.dir.y > 0;
  };

  // Push vector that moves label `l` out of the home marker disc — or null if clear.
  // Effectively never fires for real posters (labels sit well beyond `homeRadius`),
  // but keeps text off the compass center if a very short arrow ever gets there.
  const pushOffHome = (l: LaidOut): { x: number; y: number } | null => {
    const b = l.labelBox;
    const qx = Math.max(b.x, Math.min(center.x, b.x + b.w));
    const qy = Math.max(b.y, Math.min(center.y, b.y + b.h));
    const dx = qx - center.x;
    const dy = qy - center.y;
    const d = Math.hypot(dx, dy);
    if (d >= cfg.homeRadius) return null;
    if (d < 1e-6) {
      const c = labelCenter(l);
      const m = Math.hypot(c.x - center.x, c.y - center.y) || 1;
      const mag = cfg.homeRadius + settle;
      return { x: ((c.x - center.x) / m) * mag, y: ((c.y - center.y) / m) * mag };
    }
    const need = cfg.homeRadius - d + settle;
    return { x: (dx / d) * need, y: (dy / d) * need };
  };

  // Apply a (damped) move to a box, clamp it into the safe rect, and accumulate how
  // far it actually travelled this pass. Shared by every constraint below.
  let movedThisPass = 0;
  const moveBox = (l: LaidOut, dx: number, dy: number): void => {
    const ox = l.labelBox.x;
    const oy = l.labelBox.y;
    l.labelBox.x += dx * cfg.separationDamping;
    l.labelBox.y += dy * cfg.separationDamping;
    clampBoxInto(l);
    movedThisPass += Math.hypot(l.labelBox.x - ox, l.labelBox.y - oy);
  };

  // PRIMARY — symmetric 2D relaxation (Gauss–Seidel: each constraint moves its boxes
  // immediately, so later constraints in the same pass see the updated positions). This
  // converges much faster and escapes the local minima a simultaneous (Jacobi) update
  // gets stuck in. The per-pair split keeps it symmetric — two overlapping labels each
  // move half the gap. Damping (<1) keeps it stable; the iteration order is fixed, so
  // the result is fully deterministic.
  const relax2D = (): void => {
    const n = laid.length;
    for (let iter = 0; iter < cfg.maxIters; iter++) {
      if (diag) diag.iterations = iter + 1;
      movedThisPass = 0;

      // (a) box vs box — split the move evenly (half each). Detect overlap at
      // `boxPadding`, push `settle` past it on the resolved axis so the boxes clear the
      // gap rather than asymptotically approaching it.
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const v = mtv(laid[i].labelBox, laid[j].labelBox, cfg.boxPadding);
          if (!v) continue;
          const ex = v.x === 0 ? 0 : v.x + Math.sign(v.x) * settle;
          const ey = v.y === 0 ? 0 : v.y + Math.sign(v.y) * settle;
          moveBox(laid[i], ex * 0.5, ey * 0.5);
          moveBox(laid[j], -ex * 0.5, -ey * 0.5);
        }
      }

      // (b) box vs other arrows' spokes — the line is immovable, so only the box moves.
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          if (!segIntersectsRect(center, laid[j].tip, laid[i].labelBox, cfg.lineClearance)) continue;
          const p = pushOffSpoke(laid[i], laid[j].dir, cfg.lineClearance);
          if (p) moveBox(laid[i], p.x, p.y);
        }
      }

      // (c) the arrow crossing its OWN outer text (box dragged inward past its tip).
      for (let i = 0; i < n; i++) {
        if (!arrowEndsInText(laid[i])) continue;
        const p = pushOffSpoke(laid[i], laid[i].dir, cfg.boxPadding);
        if (p) moveBox(laid[i], p.x, p.y);
      }

      // (d) box vs the home marker disc.
      for (let i = 0; i < n; i++) {
        const p = pushOffHome(laid[i]);
        if (p) moveBox(laid[i], p.x, p.y);
      }

      if (movedThisPass < cfg.epsilon) {
        if (diag) diag.converged = true;
        break;
      }
    }
  };

  // --- Asymmetric fallback resolver (the proven, guaranteed-zero path) ---------
  const collinear = (a: LaidOut, b: LaidOut): boolean =>
    Math.abs(a.dir.x * b.dir.x + a.dir.y * b.dir.y) > cfg.collinearCos;
  const place = (l: LaidOut): void => placeLabel(l, cfg, sizes.get(l.id)!);
  /** Lengthen an arrow one step (no leader). Returns false if already maxed out. */
  const grow = (l: LaidOut): boolean => {
    if (l.radius >= cfg.maxRadius) return false;
    l.radius = Math.min(l.radius + cfg.pushStep, cfg.maxRadius);
    place(l);
    return true;
  };
  /** Nudge one label along its perpendicular, away from another. */
  const nudgeFrom = (t: LaidOut, other: LaidOut): void => {
    const tc = labelCenter(t);
    const oc = labelCenter(other);
    nudgePerp(t, (tc.x - oc.x) * -t.dir.y + (tc.y - oc.y) * t.dir.x, cfg);
    place(t);
  };
  /** Push label t off arrow o's sacred line. The line never moves, so this is always
   * one-sided: grow t clear when the spokes diverge, else nudge it to its own side. */
  const clearLine = (t: LaidOut, o: LaidOut): void => {
    if (collinear(t, o) || !grow(t)) {
      const n = { x: -o.dir.y, y: o.dir.x }; // normal to o's spoke
      const tc = labelCenter(t);
      const side = (tc.x - center.x) * n.x + (tc.y - center.y) * n.y;
      const along = -t.dir.y * n.x + t.dir.x * n.y; // t's perp axis · n
      nudgePerp(t, (side >= 0 ? 1 : -1) * (along >= 0 ? 1 : -1), cfg);
      place(t);
    }
  };

  const relaxFallback = (): void => {
    for (let iter = 0; iter < cfg.maxIters; iter++) {
      let moved = false;

      // (a) label vs label — only the shorter-radius label yields.
      for (let i = 0; i < laid.length; i++) {
        for (let j = i + 1; j < laid.length; j++) {
          const a = laid[i];
          const b = laid[j];
          if (!rectsOverlap(a.labelBox, b.labelBox, cfg.boxPadding)) continue;
          const shorter = a.radius <= b.radius ? a : b;
          if (!grow(shorter)) nudgeFrom(shorter, shorter === a ? b : a);
          moved = true;
        }
      }

      // (b) label vs line — other arrows' spokes, plus the OWN line only when the
      // arrow crosses the outer text (icon-at-tip makes a tip-straddling box fine).
      for (let i = 0; i < laid.length; i++) {
        for (let j = 0; j < laid.length; j++) {
          if (i === j) {
            if (!arrowEndsInText(laid[i])) continue;
          } else if (!segIntersectsRect(center, laid[j].tip, laid[i].labelBox, cfg.boxPadding)) {
            continue;
          }
          clearLine(laid[i], laid[j]);
          moved = true;
        }
      }

      if (!moved) break;
    }
  };

  const overlapsRemain = (): boolean => {
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        if (rectsOverlap(laid[i].labelBox, laid[j].labelBox, cfg.boxPadding)) return true;
      }
      if (arrowEndsInText(laid[i])) return true; // own arrow crossing its outer text
      for (let j = 0; j < laid.length; j++) {
        if (j === i) continue;
        if (segIntersectsRect(center, laid[j].tip, laid[i].labelBox, cfg.boxPadding)) return true;
      }
    }
    return false;
  };

  // Full-strength (undamped) move — for the residual cleanup, which must actually
  // reach zero overlap rather than approach it asymptotically.
  const moveBoxFull = (l: LaidOut, dx: number, dy: number): void => {
    l.labelBox.x += dx;
    l.labelBox.y += dy;
    clampBoxInto(l);
  };

  /** Clear the small residual overlaps the damped relaxation leaves a hair short
   * (e.g. a box grazing a steep spoke): full-strength pairwise separation + spoke /
   * own-line / home pushes, looping until nothing overlaps. Box-box stays symmetric
   * and spoke pushes go to the box's own side, so a cluster's vertical order — already
   * established by the stack — is preserved. Best-effort: a genuinely infeasible poster
   * exits at `maxIters` and the caller's last-resort guarantee takes over. */
  const clearResidual = (): void => {
    const n = laid.length;
    for (let iter = 0; iter < cfg.maxIters; iter++) {
      if (!overlapsRemain()) break;
      let moved = false;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const v = mtv(laid[i].labelBox, laid[j].labelBox, cfg.boxPadding);
          if (!v) continue;
          const ex = v.x === 0 ? 0 : v.x + Math.sign(v.x) * settle;
          const ey = v.y === 0 ? 0 : v.y + Math.sign(v.y) * settle;
          moveBoxFull(laid[i], ex * 0.5, ey * 0.5);
          moveBoxFull(laid[j], -ex * 0.5, -ey * 0.5);
          moved = true;
        }
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          if (!segIntersectsRect(center, laid[j].tip, laid[i].labelBox, cfg.lineClearance)) continue;
          const p = pushOffSpoke(laid[i], laid[j].dir, cfg.lineClearance);
          if (p) {
            moveBoxFull(laid[i], p.x, p.y);
            moved = true;
          }
        }
      }
      for (let i = 0; i < n; i++) {
        if (arrowEndsInText(laid[i])) {
          const p = pushOffSpoke(laid[i], laid[i].dir, cfg.boxPadding);
          if (p) {
            moveBoxFull(laid[i], p.x, p.y);
            moved = true;
          }
        }
        const ph = pushOffHome(laid[i]);
        if (ph) {
          moveBoxFull(laid[i], ph.x, ph.y);
          moved = true;
        }
      }
      if (!moved) break;
    }
  };

  // Set each label's leader attach point (closest point on its box to the tip — lands
  // on the icon side) and whether it needs a leader (displaced past the threshold).
  const finalize = (): void => {
    for (const l of laid) {
      const b = l.labelBox;
      b.anchorX = clamp(l.tip.x, b.x, b.x + b.w);
      b.anchorY = clamp(l.tip.y, b.y, b.y + b.h);
      const r = restCenter[l.id];
      const c = labelCenter(l);
      l.needsLeader = Math.hypot(c.x - r.x, c.y - r.y) > cfg.leaderThreshold;
    }
  };

  const seedRadius = laid.map((l) => l.radius);

  // --- Ordered cluster stacking (preserve tip order; let labels sit above) -------
  const setBoxCenterY = (l: LaidOut, y: number): void => {
    l.labelBox.y = y - l.labelBox.h / 2;
  };
  const xOverlap = (a: LabelBox, b: LabelBox, pad: number): boolean =>
    a.x - pad < b.x + b.w && a.x + a.w + pad > b.x;

  /** Stack a same-direction cluster vertically in seed-tip order (farther/higher tip
   * → higher label), spreading only as much as needed to clear overlaps, then lifting
   * the whole stack to the side with room (so labels can sit above their arrows). */
  const stackClusterVertical = (members: LaidOut[]): void => {
    if (members.length < 2) return;
    const order = [...members].sort(
      (a, b) =>
        seedTipY[a.id] - seedTipY[b.id] || b.radius - a.radius || (a.id < b.id ? -1 : 1),
    );
    const targets = order.map((m) => labelCenter(m).y);
    const heights = order.map((m) => m.labelBox.h);
    const gaps = order.slice(0, -1).map((m, i) =>
      // Only force a vertical gap where the boxes actually share x (would overlap);
      // members already separated along the spoke keep their natural y.
      xOverlap(m.labelBox, order[i + 1].labelBox, cfg.boxPadding)
        ? (heights[i] + heights[i + 1]) / 2 + cfg.clusterStackPad + settle
        : 0,
    );
    const ys = packStackVertical(targets, gaps, heights, cfg.margin, cfg.safeBottom);
    order.forEach((m, i) => setBoxCenterY(m, ys[i]));
  };

  /** True if every cluster's labels are in the correct (seed-tip) vertical order. */
  const clusterOrderOk = (): boolean => {
    for (const cluster of clustersByBearing(laid, cfg)) {
      if (cluster.length < 2) continue;
      const order = [...cluster].sort((a, b) => seedTipY[a.id] - seedTipY[b.id]);
      for (let i = 0; i < order.length - 1; i++) {
        if (labelCenter(order[i]).y > labelCenter(order[i + 1]).y + 1e-6) return false;
      }
    }
    return true;
  };

  /** Constructive, order-preserving resolver: reset to seed radii, place each label at
   * its tip, stack each same-direction cluster in tip order (lifting to the roomier
   * side), then clear cross-cluster + spoke overlaps with the symmetric primary. Radii
   * are never grown, so tips — and therefore the order — are preserved. */
  const resolveOrdered = (): void => {
    laid.forEach((l, k) => {
      l.radius = seedRadius[k];
      l.perp = 0;
      l.needsLeader = false;
      place(l);
    });
    for (const cluster of clustersByBearing(laid, cfg)) stackClusterVertical(cluster);
    relax2D(); // damped cross-cluster + spoke cleanup (same-cluster boxes already separated)
    clearResidual(); // full-strength pass to clear any hair-short residual the damping left
  };

  // --- Resolve -----------------------------------------------------------------
  relax2D();

  const resolved = !overlapsRemain() && clusterOrderOk();
  if (diag) diag.primaryResolved = resolved;
  if (!resolved) {
    if (diag) diag.fallbackUsed = true;
    resolveOrdered();
    if (overlapsRemain()) {
      // Genuinely over-dense poster the ordered stack couldn't fully clear — fall back
      // to the proven asymmetric resolver as a last-resort zero-overlap guarantee.
      laid.forEach((l, k) => {
        l.radius = seedRadius[k];
        l.perp = 0;
        l.needsLeader = false;
        place(l);
      });
      relaxFallback();
    }
  }

  finalize();

  if (diag) {
    for (const l of laid) diag.restCenters[l.id] = restCenter[l.id];
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        if (rectsOverlap(laid[i].labelBox, laid[j].labelBox, cfg.boxPadding)) {
          diag.overlapPairs.push([laid[i].id, laid[j].id]);
        }
      }
      const b = laid[i].labelBox;
      const off =
        b.x < cfg.margin - 1e-6 ||
        b.y < cfg.margin - 1e-6 ||
        b.x + b.w > cfg.width - cfg.margin + 1e-6 ||
        b.y + b.h > cfg.safeBottom + 1e-6;
      if (off) diag.offPage.push(laid[i].id);
    }
  }

  return laid;
}

/**
 * Convenience wrapper for the tuning lab: runs `computeLayout` with a fresh
 * `LayoutDiagnostics` and returns both the layout and the diagnostics.
 */
export function computeLayoutWithDiagnostics(
  items: Computed[],
  cfg: LayoutConfig,
  measure: MeasureFn,
): { items: LaidOut[]; diagnostics: LayoutDiagnostics } {
  const diagnostics: LayoutDiagnostics = {
    iterations: 0,
    converged: false,
    primaryResolved: false,
    fallbackUsed: false,
    restCenters: {},
    overlapPairs: [],
    offPage: [],
  };
  const out = computeLayout(items, cfg, measure, diagnostics);
  return { items: out, diagnostics };
}
