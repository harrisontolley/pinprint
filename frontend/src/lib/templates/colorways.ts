/**
 * Curated colorways — harmonious paper / ink / accent trios the buyer can apply
 * with one tap, instead of three raw colour pickers that tend to produce muddy,
 * off-brand results. Selecting a colorway just writes the three existing
 * override fields (paperOverride / inkOverride / accentOverride) on the
 * Customization, so the renderer needs no new wiring; Customization.colorwayId
 * only records which chip is lit.
 *
 * Every colorway keeps a light paper + dark ink. The template still supplies its
 * own secondary ink, border, and affiliation inks (which are tuned for a light
 * field), so a colorway never makes those illegible. "Original" (the look's own
 * palette) is the absence of overrides — colorwayId null or "original" — and so
 * isn't listed here. A full dark mode would need to override those secondary
 * tokens too; that's deliberately out of scope for now.
 */
export type Colorway = {
  id: string;
  name: string;
  paper: string;
  ink: string;
  accent: string;
};

/** Sentinel id for "use the look's own palette" (no overrides). */
export const ORIGINAL_COLORWAY_ID = "original";
/** Sentinel id set when the buyer edits a raw colour picker. */
export const CUSTOM_COLORWAY_ID = "custom";

export const COLORWAYS: Colorway[] = [
  { id: "cream", name: "Cream", paper: "#f6f1e7", ink: "#2b2620", accent: "#b06a3f" },
  { id: "coastal", name: "Coastal", paper: "#eef3f4", ink: "#243b46", accent: "#2f7d8c" },
  { id: "sage", name: "Sage", paper: "#eef0e7", ink: "#2f3a2c", accent: "#6f8f5a" },
  { id: "blush", name: "Blush", paper: "#f7eef0", ink: "#3a2b30", accent: "#bd647f" },
  { id: "graphite", name: "Graphite", paper: "#eceef1", ink: "#1f242b", accent: "#5b6b7d" },
];

export const COLORWAYS_BY_ID: Record<string, Colorway> = Object.fromEntries(
  COLORWAYS.map((c) => [c.id, c]),
);
