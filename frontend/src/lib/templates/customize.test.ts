import { describe, it, expect } from "vitest";
import { resolveCustomized, isCustomized, DEFAULT_CUSTOMIZATION } from "./customize";
import { getTemplate } from "./registry";
import { FONT_PRESETS, FONT_PRESETS_BY_ID } from "./fontPresets";
import { COLORWAYS } from "./colorways";

const vintage = getTemplate("vintage-cartography"); // has border + ornate rose
const bold = getTemplate("bold-modern"); // border: null, rose: "none"
const warm = getTemplate("warm-minimal"); // colorizeArrows: false

describe("resolveCustomized", () => {
  it("returns the base unchanged with default customization", () => {
    const { template, display, text } = resolveCustomized(
      vintage,
      DEFAULT_CUSTOMIZATION,
    );
    expect(template.paper).toBe(vintage.paper);
    expect(template.ink).toBe(vintage.ink);
    expect(template.rose).toBe(vintage.rose);
    expect(template.border).toBe(vintage.border);
    expect(display).toEqual({
      legend: true,
      distances: true,
      north: true,
      footer: true,
    });
    expect(text).toEqual({ title: null, subtitle: null, footer: null });
  });

  it("applies color overrides and ignores blank ones", () => {
    const { template } = resolveCustomized(vintage, {
      ...DEFAULT_CUSTOMIZATION,
      paperOverride: "#123456",
      inkOverride: "   ", // blank → ignored
    });
    expect(template.paper).toBe("#123456");
    expect(template.ink).toBe(vintage.ink);
  });

  it("toggles decoration booleans, falling back when null", () => {
    const off = resolveCustomized(vintage, {
      ...DEFAULT_CUSTOMIZATION,
      textureOn: false,
      roseOn: false,
    }).template;
    expect(off.texture).toBe(false);
    expect(off.rose).toBe("none");

    const untouched = resolveCustomized(vintage, DEFAULT_CUSTOMIZATION).template;
    expect(untouched.texture).toBe(vintage.texture);
  });

  it("border toggle handles templates with and without a base border", () => {
    expect(
      resolveCustomized(vintage, { ...DEFAULT_CUSTOMIZATION, borderOn: false })
        .template.border,
    ).toBeNull();
    // bold has no border; enabling falls back to ink.
    expect(
      resolveCustomized(bold, { ...DEFAULT_CUSTOMIZATION, borderOn: true })
        .template.border,
    ).toBe(bold.ink);
  });

  it("re-enabling the rose on a roseless template restores a sensible style", () => {
    const { template } = resolveCustomized(bold, {
      ...DEFAULT_CUSTOMIZATION,
      roseOn: true,
    });
    expect(template.rose).toBe("tick");
  });

  it("passes through text overrides and visibility flags", () => {
    const { text, display } = resolveCustomized(vintage, {
      ...DEFAULT_CUSTOMIZATION,
      titleText: "  Our Travels  ",
      footerText: "",
      showLegend: false,
    });
    expect(text.title).toBe("  Our Travels  "); // trimming happens at render time
    expect(text.footer).toBeNull(); // blank → null
    expect(display.legend).toBe(false);
  });

  it("does not mutate the base template", () => {
    const before = vintage.paper;
    resolveCustomized(vintage, { ...DEFAULT_CUSTOMIZATION, paperOverride: "#000000" });
    expect(vintage.paper).toBe(before);
  });

  it("applies a font preset's families + treatment, leaving sizing intact", () => {
    const preset = FONT_PRESETS_BY_ID["mono-technical"];
    const { template } = resolveCustomized(vintage, {
      ...DEFAULT_CUSTOMIZATION,
      fontPresetId: "mono-technical",
    });
    expect(template.titleFamily).toBe(preset.titleFamily);
    expect(template.nameFamily).toBe(preset.nameFamily);
    expect(template.distFamily).toBe(preset.distFamily);
    expect(template.titleWeight).toBe(preset.titleWeight);
    expect(template.nameTransform).toBe(preset.nameTransform);
    expect(template.distItalic).toBe(preset.distItalic);
    // Sizing stays template-owned.
    expect(template.titleSize).toBe(vintage.titleSize);
  });

  it("ignores an unknown font preset id", () => {
    const { template } = resolveCustomized(vintage, {
      ...DEFAULT_CUSTOMIZATION,
      fontPresetId: "does-not-exist",
    });
    expect(template.titleFamily).toBe(vintage.titleFamily);
  });

  it("overrides the rose style, and roseStyle wins over roseOn", () => {
    expect(
      resolveCustomized(bold, { ...DEFAULT_CUSTOMIZATION, roseStyle: "starburst" })
        .template.rose,
    ).toBe("starburst");
    // roseStyle:"none" hides it even if the legacy roseOn says on.
    expect(
      resolveCustomized(vintage, {
        ...DEFAULT_CUSTOMIZATION,
        roseOn: true,
        roseStyle: "none",
      }).template.rose,
    ).toBe("none");
  });

  it("merges per-affiliation colour overrides without touching the others", () => {
    const { template } = resolveCustomized(vintage, {
      ...DEFAULT_CUSTOMIZATION,
      affiliationColors: { born: "#abcdef", visited: "   " }, // blank ignored
    });
    expect(template.affiliationColors.born).toBe("#abcdef");
    expect(template.affiliationColors.visited).toBe(vintage.affiliationColors.visited);
    expect(template.affiliationColors.lived).toBe(vintage.affiliationColors.lived);
    // base is untouched
    expect(vintage.affiliationColors.born).not.toBe("#abcdef");
  });

  it("can override colorizeArrows on a look that ships it off", () => {
    expect(warm.colorizeArrows).toBe(false);
    expect(
      resolveCustomized(warm, { ...DEFAULT_CUSTOMIZATION, colorizeArrowsOverride: true })
        .template.colorizeArrows,
    ).toBe(true);
  });
});

describe("curated libraries", () => {
  const HEX = /^#[0-9a-f]{6}$/i;

  it("colorways have unique ids and valid hex trios", () => {
    const ids = COLORWAYS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COLORWAYS) {
      expect(c.paper).toMatch(HEX);
      expect(c.ink).toMatch(HEX);
      expect(c.accent).toMatch(HEX);
    }
  });

  it("a colorway applied via the override fields resolves to its colours", () => {
    const cw = COLORWAYS[0];
    const { template } = resolveCustomized(vintage, {
      ...DEFAULT_CUSTOMIZATION,
      colorwayId: cw.id,
      paperOverride: cw.paper,
      inkOverride: cw.ink,
      accentOverride: cw.accent,
    });
    expect(template.paper).toBe(cw.paper);
    expect(template.ink).toBe(cw.ink);
    expect(template.accent).toBe(cw.accent);
  });

  it("font presets have unique ids and var() families", () => {
    const ids = FONT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of FONT_PRESETS) {
      expect(p.titleFamily).toMatch(/^var\(--font-/);
      expect(p.nameFamily).toMatch(/^var\(--font-/);
      expect(p.distFamily).toMatch(/^var\(--font-/);
    }
  });
});

describe("isCustomized (leave-guard dirty check)", () => {
  it("is false for the untouched defaults", () => {
    expect(isCustomized(DEFAULT_CUSTOMIZATION)).toBe(false);
  });

  it("is false for a fresh copy of the defaults (value-based, not reference)", () => {
    expect(isCustomized({ ...DEFAULT_CUSTOMIZATION })).toBe(false);
  });

  it("detects each kind of change", () => {
    const cases: Partial<Parameters<typeof isCustomized>[0]>[] = [
      { paperOverride: "#fff" },
      { fontPresetId: "modern-sans" },
      { roseStyle: "deco" },
      { colorizeArrowsOverride: true },
      { showLegend: false },
      { scaleArrowsByDistance: false },
      { titleText: "Home" },
      { affiliationColors: { born: "#abcdef" } },
    ];
    for (const patch of cases) {
      expect(isCustomized({ ...DEFAULT_CUSTOMIZATION, ...patch })).toBe(true);
    }
  });

  it("ignores colorwayId alone (bookkeeping only)", () => {
    expect(
      isCustomized({ ...DEFAULT_CUSTOMIZATION, colorwayId: "custom" }),
    ).toBe(false);
  });
});
