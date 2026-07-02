import type { Computed, Units } from "@/lib/types";
import type { TemplateSpec } from "@/lib/templates/types";
import type { LabelSize, MeasureFn } from "@/lib/layout/types";
import { labelStrings, LABEL_ICON_GAP } from "./labelText";

// Canvas-based text measurement so the layout engine sizes label boxes to match
// what the SVG actually renders. Resolves next/font CSS variables to the real
// family name (canvas can't read `var(--x)`), and applies the template's font
// style/variant/weight/letter-spacing so measurement == rendering.

let sharedCtx: CanvasRenderingContext2D | null = null;
function getCtx(): CanvasRenderingContext2D | null {
  if (sharedCtx) return sharedCtx;
  if (typeof document === "undefined") return null;
  sharedCtx = document.createElement("canvas").getContext("2d");
  return sharedCtx;
}

function resolveFamily(family: string): string {
  const m = family.match(/var\((--[^)]+)\)/);
  if (m && typeof document !== "undefined") {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(m[1])
      .trim();
    if (v) return v;
  }
  return family;
}

function measureWidth(text: string, font: string, letterSpacing: number): number {
  const c = getCtx();
  if (!c) {
    // SSR / no-canvas fallback: rough estimate keeps layout sane until the
    // client re-measures with real metrics. Must scale with font size (not
    // just letter-spacing) so size-fitting logic (e.g. fitTitleFontSize)
    // still behaves without a canvas.
    const sizeMatch = font.match(/(\d+(?:\.\d+)?)px/);
    const size = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
    const avgCharWidth = size * 0.5625; // ~9px at a 16px reference size
    return text.length * avgCharWidth + Math.max(0, text.length - 1) * letterSpacing;
  }
  c.font = font;
  const withLs = c as CanvasRenderingContext2D & { letterSpacing?: string };
  let lsApplied = false;
  try {
    if ("letterSpacing" in c) {
      withLs.letterSpacing = `${letterSpacing}px`;
      lsApplied = true;
    }
  } catch {
    lsApplied = false;
  }
  const w = c.measureText(text).width;
  // If the browser ignores ctx.letterSpacing, add it manually.
  return lsApplied ? w : w + Math.max(0, text.length - 1) * letterSpacing;
}

const MIN_TITLE_SIZE = 28;

/**
 * Largest font size (<= baseSize, >= MIN_TITLE_SIZE) at which `text` fits
 * within `maxWidth`, measured to exactly mirror how Poster.tsx renders the
 * title: fixed (unscaled) letter-spacing, small-caps variant when requested,
 * plus one trailing letter-spacing gap (SVG adds this after the last glyph,
 * and textAnchor="middle" centers the full advance including it).
 */
export function fitTitleFontSize(
  text: string,
  baseSize: number,
  family: string,
  weight: number,
  letterSpacing: number,
  maxWidth: number,
  smallCaps = false,
): number {
  if (!text) return baseSize;
  const resolvedFamily = resolveFamily(family);
  const variant = smallCaps ? "small-caps " : "";
  const widthAt = (size: number) =>
    measureWidth(text, `${variant}${weight} ${size}px ${resolvedFamily}`, letterSpacing) +
    letterSpacing;
  if (widthAt(baseSize) <= maxWidth) return baseSize;
  if (widthAt(MIN_TITLE_SIZE) >= maxWidth) return MIN_TITLE_SIZE;

  let lo = MIN_TITLE_SIZE;
  let hi = baseSize;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (widthAt(mid) <= maxWidth) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/**
 * Build a measurer for this template. `showDistances` mirrors the render-time
 * toggle so the label box matches what's actually drawn: with distances hidden a
 * label is one line tall (just the name), which both fixes the icon's vertical
 * centring in PlaceLabel and shrinks the box the collision engine reasons about.
 */
export function createMeasurer(
  t: TemplateSpec,
  units: Units,
  showDistances = true,
): MeasureFn {
  const nameFamily = resolveFamily(t.nameFamily);
  const distFamily = resolveFamily(t.distFamily);
  const variant = t.nameTransform === "smallcaps" ? "small-caps " : "";
  const nameFont = `${variant}${t.nameWeight} ${t.nameSize}px ${nameFamily}`;
  const distFont = `${t.distItalic ? "italic " : ""}400 ${t.distSize}px ${distFamily}`;

  return (item: Computed): LabelSize => {
    const { name, dist } = labelStrings(item, t, units);
    const nameW = measureWidth(name, nameFont, t.nameLetterSpacing);
    const distW = showDistances
      ? measureWidth(dist, distFont, t.distLetterSpacing)
      : 0;
    const textW = Math.max(nameW, distW);
    return {
      w: t.iconSize + LABEL_ICON_GAP + textW,
      h: (showDistances ? 2 : 1) * t.lineHeight,
    };
  };
}
