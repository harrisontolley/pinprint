import type { NameTransform } from "./types";

/**
 * Curated type pairings the buyer can swap onto any look, layered over the
 * template via `resolveCustomized` (Customization.fontPresetId). We expose a
 * handful of coherent pairings rather than raw font pickers — a real designer's
 * shortlist, not a dropdown of every family. The families are the same
 * next/font CSS variables the templates already load (see lib/fonts.ts), so no
 * new fonts are shipped.
 *
 * The "Original" choice is the absence of a preset (fontPresetId === null) — it
 * keeps the look's own fonts, so it isn't listed here.
 */
export type FontPreset = {
  id: string;
  /** Short name shown under the specimen tile. */
  name: string;
  /** The two families, e.g. "Playfair · Garamond" — a quiet caption. */
  hint: string;
  titleFamily: string;
  nameFamily: string;
  distFamily: string;
  // Type treatment that keeps the pairing coherent (the rest of the spec's
  // sizing is left to the template so proportions stay intact).
  titleWeight: number;
  nameTransform: NameTransform;
  distItalic: boolean;
};

export const FONT_PRESETS: FontPreset[] = [
  {
    id: "serif-classic",
    name: "Serif Classic",
    hint: "Playfair · Garamond",
    titleFamily: "var(--font-playfair)",
    nameFamily: "var(--font-garamond)",
    distFamily: "var(--font-garamond)",
    titleWeight: 600,
    nameTransform: "smallcaps",
    distItalic: true,
  },
  {
    id: "modern-sans",
    name: "Modern Sans",
    hint: "Archivo · Inter",
    titleFamily: "var(--font-archivo)",
    nameFamily: "var(--font-inter)",
    distFamily: "var(--font-inter)",
    titleWeight: 800,
    nameTransform: "uppercase",
    distItalic: false,
  },
  {
    id: "editorial",
    name: "Editorial",
    hint: "Fraunces · Inter",
    titleFamily: "var(--font-fraunces)",
    nameFamily: "var(--font-inter)",
    distFamily: "var(--font-inter)",
    titleWeight: 500,
    nameTransform: "smallcaps",
    distItalic: true,
  },
  {
    id: "mono-technical",
    name: "Mono Technical",
    hint: "Space Grotesk · JetBrains Mono",
    titleFamily: "var(--font-space-grotesk)",
    nameFamily: "var(--font-space-grotesk)",
    distFamily: "var(--font-jetbrains-mono)",
    titleWeight: 600,
    nameTransform: "uppercase",
    distItalic: false,
  },
];

export const FONT_PRESETS_BY_ID: Record<string, FontPreset> =
  Object.fromEntries(FONT_PRESETS.map((p) => [p.id, p]));
