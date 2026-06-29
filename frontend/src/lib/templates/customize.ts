import type { Affiliation } from "../types";
import type { RoseStyle, TemplateSpec } from "./types";
import { FONT_PRESETS_BY_ID } from "./fontPresets";

/**
 * User customization layered on top of a chosen template. Color + decoration
 * fields are nullable overrides (null = use the template's value); the show*
 * flags toggle elements that aren't part of the spec; the *Text fields override
 * the auto-generated title / subtitle / footer (null = use the default).
 */
export type Customization = {
  // Color overrides (null = template default).
  paperOverride: string | null;
  inkOverride: string | null;
  accentOverride: string | null;
  /**
   * Which curated colorway is selected. A bookkeeping field for the UI only —
   * the actual colours live in the three *Override fields above (a colorway just
   * sets all three). `null`/"original" = the look's own palette; "custom" = the
   * buyer edited a raw picker. See lib/templates/colorways.ts.
   */
  colorwayId: string | null;
  /** Curated type pairing applied over the look (null = the look's own fonts). */
  fontPresetId: string | null;
  // Decoration overrides (null = template default).
  textureOn: boolean | null;
  borderOn: boolean | null;
  roseOn: boolean | null;
  ringGuidesOn: boolean | null;
  /**
   * Compass-rose style override (null = template default). Supersedes the legacy
   * `roseOn` boolean when set; "none" hides the rose.
   */
  roseStyle: RoseStyle | null;
  /** Per-affiliation colour overrides merged onto the look's affiliation inks. */
  affiliationColors: Partial<Record<Affiliation, string>>;
  /** Tint arrows by affiliation (null = template default). */
  colorizeArrowsOverride: boolean | null;
  // Element visibility (these elements aren't spec fields).
  showLegend: boolean;
  showDistances: boolean;
  showNorth: boolean;
  showFooter: boolean;
  // Layout behaviour: scale arrow length by distance (farther = longer).
  scaleArrowsByDistance: boolean;
  // Text overrides (null = auto-generated default).
  titleText: string | null;
  subtitleText: string | null;
  footerText: string | null;
};

export const DEFAULT_CUSTOMIZATION: Customization = {
  paperOverride: null,
  inkOverride: null,
  accentOverride: null,
  colorwayId: null,
  fontPresetId: null,
  textureOn: null,
  borderOn: null,
  roseOn: null,
  ringGuidesOn: null,
  roseStyle: null,
  affiliationColors: {},
  colorizeArrowsOverride: null,
  showLegend: true,
  showDistances: true,
  showNorth: true,
  showFooter: true,
  scaleArrowsByDistance: true,
  titleText: null,
  subtitleText: null,
  footerText: null,
};

/**
 * True once the buyer has changed anything from the look's defaults. Value-based
 * (not reference) so a pristine design restored from a draft still reads as
 * untouched. Drives the "leave the studio?" guard. colorwayId is bookkeeping —
 * an applied colorway already shows up via the *Override fields.
 */
export function isCustomized(c: Customization): boolean {
  const d = DEFAULT_CUSTOMIZATION;
  return (
    c.paperOverride !== d.paperOverride ||
    c.inkOverride !== d.inkOverride ||
    c.accentOverride !== d.accentOverride ||
    c.fontPresetId !== d.fontPresetId ||
    c.textureOn !== d.textureOn ||
    c.borderOn !== d.borderOn ||
    c.roseOn !== d.roseOn ||
    c.ringGuidesOn !== d.ringGuidesOn ||
    c.roseStyle !== d.roseStyle ||
    c.colorizeArrowsOverride !== d.colorizeArrowsOverride ||
    c.showLegend !== d.showLegend ||
    c.showDistances !== d.showDistances ||
    c.showNorth !== d.showNorth ||
    c.showFooter !== d.showFooter ||
    c.scaleArrowsByDistance !== d.scaleArrowsByDistance ||
    c.titleText !== d.titleText ||
    c.subtitleText !== d.subtitleText ||
    c.footerText !== d.footerText ||
    Object.keys(c.affiliationColors ?? {}).length > 0
  );
}

/** Show/hide flags for non-spec poster elements. */
export type DisplayOptions = {
  legend: boolean;
  distances: boolean;
  north: boolean;
  footer: boolean;
};

/** Title / subtitle / footer overrides (null = use the poster default). */
export type TextOverrides = {
  title: string | null;
  subtitle: string | null;
  footer: string | null;
};

export type Resolved = {
  template: TemplateSpec;
  display: DisplayOptions;
  text: TextOverrides;
};

/** True for a non-empty, non-whitespace override string. */
function has(s: string | null): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/** Keep only the affiliation entries that carry a real colour value. */
function definedAffiliationColors(
  c: Partial<Record<Affiliation, string>>,
): Partial<Record<Affiliation, string>> {
  const out: Partial<Record<Affiliation, string>> = {};
  for (const [k, v] of Object.entries(c)) {
    if (has(v ?? null)) out[k as Affiliation] = v as string;
  }
  return out;
}

/**
 * Merge a customization onto a base template. Returns a fresh derived spec plus
 * the display + text overrides the renderer needs. Pure — safe to memoize on
 * (base, customization).
 */
export function resolveCustomized(
  base: TemplateSpec,
  c: Customization,
): Resolved {
  const template: TemplateSpec = { ...base };

  if (has(c.paperOverride)) template.paper = c.paperOverride;
  if (has(c.inkOverride)) template.ink = c.inkOverride;
  if (has(c.accentOverride)) template.accent = c.accentOverride;

  if (c.textureOn !== null) template.texture = c.textureOn;
  if (c.ringGuidesOn !== null) template.ringGuides = c.ringGuidesOn;
  if (c.roseOn !== null) {
    // Restore a sensible rose when re-enabling a template that has none.
    template.rose = c.roseOn ? (base.rose === "none" ? "tick" : base.rose) : "none";
  }
  if (c.borderOn !== null) {
    template.border = c.borderOn ? (base.border ?? base.ink) : null;
  }

  // Fields below were added after persistence shipped. Normalize against the
  // defaults so a snapshot saved by an older build (missing these keys) resolves
  // safely rather than writing `undefined` onto the spec.
  const next = { ...DEFAULT_CUSTOMIZATION, ...c };

  // Compass-rose style override wins over the legacy roseOn toggle above.
  if (next.roseStyle !== null) template.rose = next.roseStyle;

  // Curated type pairing: swap the three families + the treatment that keeps
  // the pairing coherent. Sizing stays template-owned so proportions hold.
  if (next.fontPresetId) {
    const fp = FONT_PRESETS_BY_ID[next.fontPresetId];
    if (fp) {
      template.titleFamily = fp.titleFamily;
      template.nameFamily = fp.nameFamily;
      template.distFamily = fp.distFamily;
      template.titleWeight = fp.titleWeight;
      template.nameTransform = fp.nameTransform;
      template.distItalic = fp.distItalic;
    }
  }

  // Per-affiliation colour overrides, merged onto the look's inks (blank values
  // ignored). A fresh object — never mutate base.affiliationColors.
  const affOverrides = definedAffiliationColors(next.affiliationColors);
  if (Object.keys(affOverrides).length > 0) {
    template.affiliationColors = { ...template.affiliationColors, ...affOverrides };
  }

  if (next.colorizeArrowsOverride !== null) {
    template.colorizeArrows = next.colorizeArrowsOverride;
  }

  return {
    template,
    display: {
      legend: c.showLegend,
      distances: c.showDistances,
      north: c.showNorth,
      footer: c.showFooter,
    },
    text: {
      title: has(c.titleText) ? c.titleText : null,
      subtitle: has(c.subtitleText) ? c.subtitleText : null,
      footer: has(c.footerText) ? c.footerText : null,
    },
  };
}
