import type { TemplateSpec } from "./types";

/**
 * Swiss Editorial — International Typographic discipline. Warm off-white field,
 * near-black ink, one confident Swiss-red accent on the home dot, and a single
 * grotesque family at multiple weights. Tight modern title tracking, monochrome
 * ink arrows. Clean typographic hierarchy, no ornament.
 */
export const swissEditorial: TemplateSpec = {
  id: "swiss-editorial",
  name: "Swiss Editorial",
  blurb: "Grotesque grid, tight hierarchy, red accent.",

  paper: "#f4f2ed",
  paperEdge: null,
  ink: "#1a1a1a",
  inkSoft: "#6e6e6e",
  accent: "#d62828",
  border: null,

  rose: "tick",
  texture: false,
  doubleBorder: false,
  ringGuides: false,
  homeGlow: false,

  titleFamily: "var(--font-space-grotesk)",
  nameFamily: "var(--font-space-grotesk)",
  distFamily: "var(--font-space-grotesk)",

  titleWeight: 700,
  titleLetterSpacing: -1,
  nameTransform: "uppercase",
  nameWeight: 500,
  nameLetterSpacing: 1,
  distItalic: false,
  distLetterSpacing: 0.5,

  titleSize: 78,
  subtitleSize: 20,
  nameSize: 22,
  distSize: 15,
  lineHeight: 26,
  arrowWidth: 2,
  arrowhead: "line",
  arrowheadSize: 14,
  homeDotSize: 8,
  iconSize: 16,

  affiliationColors: {
    born: "#d62828",
    lived: "#1a1a1a",
    visited: "#6e6e6e",
    family: "#0a3d62",
  },
  colorizeArrows: false,
  glyphOpacity: 1,
};
