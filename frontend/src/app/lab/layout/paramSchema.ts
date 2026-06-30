import type { LayoutConfig } from "@/lib/layout/types";

/** A tunable layout parameter exposed as a control in the lab. */
export type ParamSpec = {
  key: keyof LayoutConfig;
  label: string;
  group: "Spacing" | "Solver" | "Geometry";
  kind: "slider" | "toggle";
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
};

/**
 * The layout-config knobs worth tuning visually. `width/height/cx/cy` are framing
 * constants and are intentionally omitted. Grouped for the controls panel.
 */
export const PARAM_SCHEMA: ParamSpec[] = [
  // Spacing / visual — the knobs you'll live in.
  { key: "tipIconGap", label: "Tip → icon gap", group: "Spacing", kind: "slider", min: 0, max: 60, step: 1, hint: "Distance from the arrow tip to the icon (icon-at-tip)." },
  { key: "boxPadding", label: "Box padding", group: "Spacing", kind: "slider", min: 0, max: 30, step: 1, hint: "Breathing room kept around every label." },
  { key: "clusterStackPad", label: "Cluster stack pad", group: "Spacing", kind: "slider", min: 0, max: 30, step: 1, hint: "Vertical gap between same-direction labels stacked in a cluster." },
  { key: "leaderThreshold", label: "Leader threshold", group: "Spacing", kind: "slider", min: 0, max: 80, step: 1, hint: "Displacement past which a dashed leader is drawn." },
  { key: "labelGap", label: "Label gap (legacy)", group: "Spacing", kind: "slider", min: 0, max: 80, step: 1, hint: "Tip → box gap when icon-at-tip is OFF." },
  { key: "anchorDeadzone", label: "Anchor deadzone", group: "Spacing", kind: "slider", min: 0, max: 0.5, step: 0.01, hint: "|dir.x| below this centers the label (anchor: middle)." },
  { key: "iconAtTip", label: "Icon at tip", group: "Spacing", kind: "toggle", hint: "Icon marks the tip just past the arrowhead." },

  // Solver / convergence.
  { key: "separationDamping", label: "Separation damping", group: "Solver", kind: "slider", min: 0.1, max: 1, step: 0.05, hint: "Fraction of each push applied per pass." },
  { key: "lineClearance", label: "Line clearance", group: "Solver", kind: "slider", min: 0, max: 30, step: 1, hint: "Clearance kept between a label and other spokes." },
  { key: "epsilon", label: "Convergence ε", group: "Solver", kind: "slider", min: 0.05, max: 5, step: 0.05, hint: "Stop when total movement drops below this." },
  { key: "maxIters", label: "Max iterations", group: "Solver", kind: "slider", min: 100, max: 2000, step: 100 },

  // Geometry / structural.
  { key: "margin", label: "Margin", group: "Geometry", kind: "slider", min: 40, max: 140, step: 5 },
  { key: "safeBottom", label: "Safe bottom", group: "Geometry", kind: "slider", min: 900, max: 1420, step: 10, hint: "Labels stay above this (the bottom title/legend band)." },
  { key: "homeRadius", label: "Home radius", group: "Geometry", kind: "slider", min: 0, max: 120, step: 2, hint: "Keep-out disc around the home marker." },
  { key: "minRadius", label: "Min radius", group: "Geometry", kind: "slider", min: 80, max: 400, step: 10 },
  { key: "baseRadius", label: "Base radius", group: "Geometry", kind: "slider", min: 100, max: 400, step: 10 },
  { key: "maxRadius", label: "Max radius", group: "Geometry", kind: "slider", min: 100, max: 500, step: 10 },
  { key: "clusterAngleDeg", label: "Cluster angle°", group: "Geometry", kind: "slider", min: 0, max: 20, step: 1 },
  { key: "radiusStep", label: "Radius step", group: "Geometry", kind: "slider", min: 20, max: 160, step: 5 },
  { key: "collinearCos", label: "Collinear cos", group: "Geometry", kind: "slider", min: 0.8, max: 0.999, step: 0.005 },
  { key: "scaleByDistance", label: "Scale by distance", group: "Geometry", kind: "toggle" },
];

export const PARAM_GROUPS: ParamSpec["group"][] = ["Spacing", "Solver", "Geometry"];
