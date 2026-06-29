import type { TemplateSpec } from "./types";

/**
 * Blueprint — a cyanotype technical drawing. Deep Prussian-blue field, a fine
 * cyan drafting grid, hairline arrows, a technical crosshair compass, and
 * monospaced typography throughout (title included). Two-colour by intent;
 * affiliation shows only as a near-monochrome cyan family.
 */
export const blueprint: TemplateSpec = {
  id: "blueprint",
  name: "Blueprint",
  blurb: "Cyanotype blue, drafting grid, mono labels.",

  paper: "#0a3d62",
  paperEdge: "#082f4d",
  ink: "#e8f1fb",
  inkSoft: "#84accb",
  accent: "#8fc7f5",
  border: "#6f9fc4",

  rose: "crosshair",
  texture: false,
  doubleBorder: true,
  ringGuides: false,
  homeGlow: false,
  backdrop: "grid",

  titleFamily: "var(--font-jetbrains-mono)",
  nameFamily: "var(--font-jetbrains-mono)",
  distFamily: "var(--font-jetbrains-mono)",

  titleWeight: 700,
  titleLetterSpacing: 5,
  nameTransform: "uppercase",
  nameWeight: 500,
  nameLetterSpacing: 1,
  distItalic: false,
  distLetterSpacing: 0.5,

  titleSize: 58,
  subtitleSize: 19,
  nameSize: 22,
  distSize: 16,
  lineHeight: 28,
  arrowWidth: 1.2,
  arrowhead: "line",
  arrowheadSize: 13,
  homeDotSize: 8,
  iconSize: 20,

  affiliationColors: {
    born: "#bfe0ff",
    lived: "#9fd0ff",
    visited: "#d6ebff",
    family: "#7fb8e6",
  },
  colorizeArrows: false,
  glyphOpacity: 0.85,
};
