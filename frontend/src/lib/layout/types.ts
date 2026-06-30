import type { Computed } from "../types";
import type { Vec2 } from "../geo/projection";

export type TextAnchor = "start" | "end" | "middle";

/** Axis-aligned box (top-left + size) plus the SVG text anchor info. */
export type LabelBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: TextAnchor;
  /** Anchor point for the SVG <text> element (where the label "attaches"). */
  anchorX: number;
  anchorY: number;
};

/** A place resolved to concrete poster geometry. */
export type LaidOut = Computed & {
  /** Screen-space unit vector for the true bearing (North = up). Never altered. */
  dir: Vec2;
  /** Resolved arrow length in px (adjusted to avoid collisions). */
  radius: number;
  /**
   * Perpendicular offset (px, signed). Internal to the asymmetric fallback
   * resolver only — the primary 2D relaxation moves `labelBox` directly and
   * leaves this at 0. The renderer never reads it.
   */
  perp: number;
  /** Arrowhead position. */
  tip: Vec2;
  labelBox: LabelBox;
  /** True when the label was nudged off its spoke and needs a leader line. */
  needsLeader: boolean;
};

export type LayoutConfig = {
  width: number;
  height: number;
  cx: number;
  cy: number;
  margin: number;
  /** Inner gap so arrows start outside the home marker. */
  homeRadius: number;
  /** Default arrow length (used when distance scaling is off). */
  baseRadius: number;
  /** Max arrow length (keeps labels inside the safe area). */
  maxRadius: number;
  /** When true, arrow length encodes distance (farther = longer). */
  scaleByDistance: boolean;
  /** Floor arrow length for the nearest place when distance scaling is on. */
  minRadius: number;
  /** Bearings within this many degrees form a "same direction" cluster. */
  clusterAngleDeg: number;
  /** Radius stagger between stacked labels in a cluster. */
  radiusStep: number;
  /** Gap between arrow tip and label anchor (used when `iconAtTip` is off). */
  labelGap: number;
  /**
   * Bottom bound for label boxes — the title/legend/footer band top
   * (`height - BOTTOM_BAND`), so labels never sit over the bottom text block.
   */
  safeBottom: number;
  /**
   * When true, the rest position pins the affiliation icon's center at
   * `tip + dir * tipIconGap` (the icon marks the tip, just past the arrowhead),
   * with name + distance flowing outward. When false, the legacy `labelGap`
   * placement is used.
   */
  iconAtTip: boolean;
  /** Tip → icon-center offset along the arrow when `iconAtTip` is on. */
  tipIconGap: number;
  /**
   * |dir.x| below this counts as "near vertical" → the label is centered
   * (anchor "middle") rather than left/right anchored.
   */
  anchorDeadzone: number;
  /** Two spokes more aligned than this (|dir·dir| ≥ collinearCos) are treated
   * as near-collinear by the asymmetric fallback. */
  collinearCos: number;
  /** Displacement from the rest center beyond which a leader line is drawn. */
  leaderThreshold: number;
  /** Fraction (<1) of each box's averaged separation delta applied per iteration
   * in the primary 2D relaxation — damps overshoot/oscillation. */
  separationDamping: number;
  /** Clearance kept between a label box and other arrows' spokes. */
  lineClearance: number;
  /** Convergence threshold: stop relaxing when total movement (px) drops below this. */
  epsilon: number;
  /** Outward push per relaxation step (asymmetric fallback only). */
  pushStep: number;
  /** Perpendicular nudge per relaxation step (asymmetric fallback only). */
  perpStep: number;
  maxIters: number;
  /** Breathing room added around each label box for the overlap test. */
  boxPadding: number;
  /** Vertical breathing room between same-direction labels stacked in a cluster. */
  clusterStackPad: number;
};

export type LabelSize = { w: number; h: number };

/** Measures a place's two-line label box for the active template/font. */
export type MeasureFn = (item: Computed) => LabelSize;

/**
 * Optional diagnostics the engine can fill in for the tuning lab. Passing a
 * `LayoutDiagnostics` object as `computeLayout`'s 4th argument has it mutated in
 * place; omitting it (the production path) costs nothing.
 */
export type LayoutDiagnostics = {
  /** Iterations the primary 2D relaxation ran before converging / hitting maxIters. */
  iterations: number;
  /** True if the primary relaxation reached `epsilon` before `maxIters`. */
  converged: boolean;
  /** True if the primary 2D relaxation cleared all overlaps on its own — i.e. the
   * fallback was not needed. */
  primaryResolved: boolean;
  /** True if the asymmetric fallback resolver had to run. */
  fallbackUsed: boolean;
  /** Each label's rest (no-collision) center, keyed by place id. */
  restCenters: Record<string, { x: number; y: number }>;
  /** Pairs of place ids whose boxes still overlap (should be empty on feasible posters). */
  overlapPairs: [string, string][];
  /** Ids of any boxes still poking outside the content-safe rect. */
  offPage: string[];
};
