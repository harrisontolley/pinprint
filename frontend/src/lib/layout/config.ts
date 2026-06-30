import type { LayoutConfig } from "./types";
import { posterGeometry, contentSafeRect, POSTER_MARGIN } from "@/lib/poster/geometry";

/**
 * Default layout tuning for a poster. The compass center + safe radius come from
 * the shared `posterGeometry` so the renderer and the collision engine agree for
 * any aspect ratio. `baseRadius` is clamped to the safe radius so short/landscape
 * frames don't start arrows outside the drawing area.
 */
export function defaultLayoutConfig(
  width: number,
  height: number,
  overrides: Partial<LayoutConfig> = {},
): LayoutConfig {
  const { cx, cy, maxRadius } = posterGeometry(width, height);
  return {
    width,
    height,
    cx,
    cy,
    margin: POSTER_MARGIN,
    homeRadius: 46,
    baseRadius: Math.min(260, maxRadius),
    maxRadius,
    // Distance scaling: nearest place lands on `minRadius`, farthest on
    // `maxRadius`. The floor clears the home marker / rose (`homeRadius` 46) and
    // sits well below `baseRadius` so near vs far reads clearly.
    scaleByDistance: true,
    minRadius: Math.min(150, maxRadius),
    clusterAngleDeg: 7,
    // Must exceed a label's height (+padding) so a vertical signpost stack
    // separates by radius alone, without needing the relaxation fallback.
    radiusStep: 70,
    labelGap: 16,
    // Labels stay above the reserved bottom band (title / coords / legend / footer).
    safeBottom: contentSafeRect(width, height, POSTER_MARGIN).maxY,
    // Rest state: the affiliation icon marks the tip just past the arrowhead.
    iconAtTip: true,
    tipIconGap: 18,
    anchorDeadzone: 0.15,
    collinearCos: 0.96,
    leaderThreshold: 14,
    // Primary 2D relaxation tuning. Damping < 1 + per-constraint averaging keep
    // the symmetric separation from overshooting.
    separationDamping: 0.6,
    lineClearance: 6,
    epsilon: 0.5,
    pushStep: 10,
    perpStep: 12,
    // Generous cap: the primary relaxation and the asymmetric fallback each
    // resolve monotonically, so this is a convergence backstop, not a tuning knob.
    maxIters: 800,
    boxPadding: 6,
    // Vertical gap between same-direction labels stacked in an ordered cluster.
    clusterStackPad: 6,
    ...overrides,
  };
}
