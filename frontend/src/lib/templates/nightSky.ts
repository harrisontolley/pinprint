import type { TemplateSpec } from "./types";

/**
 * Night sky — a cool observatory starfield. Deep cool navy, radiating starburst,
 * faint dotted rings, a soft glow at center, thin steel-blue arrows and cool
 * starlight serif names. Cooler than the warm-gold Celestial; no constellation
 * lines (that stays Constellation's identity).
 */
export const nightSky: TemplateSpec = {
  id: "night-sky",
  name: "Night Sky",
  blurb: "Cool navy starfield, dotted rings, silver labels.",

  paper: "#0a1228",
  paperEdge: "#050a18",
  ink: "#e9edf5",
  inkSoft: "#8e9bbf",
  accent: "#8fb8dd",
  border: "#283050",

  rose: "starburst",
  texture: false,
  doubleBorder: false,
  ringGuides: true,
  homeGlow: true,

  titleFamily: "var(--font-playfair)",
  nameFamily: "var(--font-garamond)",
  distFamily: "var(--font-garamond)",

  titleWeight: 600,
  titleLetterSpacing: 5,
  nameTransform: "smallcaps",
  nameWeight: 500,
  nameLetterSpacing: 2,
  distItalic: true,
  distLetterSpacing: 1,

  titleSize: 82,
  subtitleSize: 23,
  nameSize: 29,
  distSize: 21,
  lineHeight: 33,
  arrowWidth: 1.5,
  arrowhead: "line",
  arrowheadSize: 14,
  homeDotSize: 11,
  iconSize: 25,

  affiliationColors: {
    born: "#cfe0f2",
    lived: "#9ec8b8",
    visited: "#a8c4ee",
    family: "#e0a9b8",
  },
  colorizeArrows: false,
  glyphOpacity: 0.95,
};
