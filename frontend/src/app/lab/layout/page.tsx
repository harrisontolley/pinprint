"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import { Poster } from "@/components/poster/Poster";
import { useFontsReady } from "@/hooks/useFontsReady";
import { useHydrated } from "@/hooks/useHydrated";
import { computePlaces } from "@/lib/geo";
import { computeLayoutWithDiagnostics } from "@/lib/layout/computeLayout";
import { defaultLayoutConfig } from "@/lib/layout/config";
import { createMeasurer } from "@/components/poster/measure";
import { getActiveTemplate, TEMPLATE_ORDER } from "@/lib/templates/registry";
import { VINTAGE_VARIANT_ORDER } from "@/lib/templates/vintageVariants";
import type { LayoutConfig, LaidOut, LayoutDiagnostics } from "@/lib/layout/types";
import type { TemplateId, TemplateSpec } from "@/lib/templates/types";
import { LAB_DATASETS, type LabDataset } from "./datasets";
import { ControlsPanel } from "./ControlsPanel";
import { DebugOverlay } from "./DebugOverlay";
import { Metrics } from "./Metrics";
import { PARAM_SCHEMA } from "./paramSchema";

const W = 1000;
const H = 1500;
const PREVIEW_W = 380;

const FONT_PROBES = [
  '31px "Inter"',
  '88px "Playfair Display"',
  '31px "EB Garamond"',
  '40px "Archivo"',
  '16px "JetBrains Mono"',
];

type Overrides = Partial<LayoutConfig>;
type Layout = { items: LaidOut[]; diagnostics: LayoutDiagnostics; cfg: LayoutConfig };

/** Build a collision-resolved layout + diagnostics for one A/B side. */
function useLabLayout(
  dataset: LabDataset,
  template: TemplateSpec,
  overrides: Overrides,
  showDistances: boolean,
  ready: boolean,
): Layout {
  return useMemo(() => {
    const computed =
      dataset.computed ?? computePlaces(dataset.home, dataset.places ?? [], { mode: "great-circle" });
    const cfg = defaultLayoutConfig(W, H, { scaleByDistance: true, ...overrides });
    const measure = createMeasurer(template, dataset.units, showDistances);
    const { items, diagnostics } = computeLayoutWithDiagnostics(computed, cfg, measure);
    return { items, diagnostics, cfg };
    // `ready` (fonts + hydration) forces a re-measure once the browser canvas is live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, template, overrides, showDistances, ready]);
}

export default function LayoutLabPage() {
  const fontsReady = useFontsReady(FONT_PROBES);
  const mounted = useHydrated();
  const ready = mounted && fontsReady;

  const [datasetId, setDatasetId] = useState(LAB_DATASETS[0].id);
  const [templateId, setTemplateId] = useState<TemplateId>(LAB_DATASETS[0].templateId ?? "warm-minimal");
  const [overridesA, setOverridesA] = useState<Overrides>({});
  const [overridesB, setOverridesB] = useState<Overrides>({ boxPadding: 12, tipIconGap: 26 });
  const [showDistances, setShowDistances] = useState(true);
  const [debug, setDebug] = useState(true);

  const dataset = LAB_DATASETS.find((d) => d.id === datasetId) ?? LAB_DATASETS[0];
  const template = getActiveTemplate(
    templateId,
    dataset.vintageVariant ?? VINTAGE_VARIANT_ORDER[0],
  );

  const layoutA = useLabLayout(dataset, template, overridesA, showDistances, ready);
  const layoutB = useLabLayout(dataset, template, overridesB, showDistances, ready);

  // Dev-only gate — after all hooks so hook order is stable in every environment.
  if (process.env.NODE_ENV === "production") notFound();

  const onChange = (side: "A" | "B", key: keyof LayoutConfig, value: number | boolean) => {
    const set = side === "A" ? setOverridesA : setOverridesB;
    set((prev) => ({ ...prev, [key]: value }));
  };

  const effectiveJSON = (cfg: LayoutConfig) => {
    const out: Record<string, number | boolean> = {};
    for (const p of PARAM_SCHEMA) out[p.key] = cfg[p.key] as number | boolean;
    return JSON.stringify(out, null, 2);
  };
  const copy = (cfg: LayoutConfig) => navigator.clipboard?.writeText(effectiveJSON(cfg));

  const column = (label: string, color: string, layout: Layout, onCopy: () => void) => {
    const items = mounted ? layout.items : [];
    return (
      <div style={{ flex: "0 0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <strong style={{ color }}>{label}</strong>
          <button onClick={onCopy} style={btn}>
            Copy {label} config
          </button>
        </div>
        <div
          style={{
            position: "relative",
            width: PREVIEW_W,
            aspectRatio: `${W} / ${H}`,
            border: `2px solid ${color}`,
            background: "#fff",
          }}
        >
          <Poster
            home={dataset.home}
            items={items}
            template={template}
            units={dataset.units}
            width={W}
            height={H}
            title={dataset.home.label}
          />
          {debug && (
            <DebugOverlay items={items} cfg={layout.cfg} diagnostics={layout.diagnostics} width={W} height={H} />
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <Metrics items={items} cfg={layout.cfg} diagnostics={layout.diagnostics} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Layout Lab — collision tuning (A/B)</h1>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
        Dev-only. Pick a dataset, drag the A/B sliders, watch the debug overlay + metrics, then copy
        the config you like.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={lbl}>
          Dataset{" "}
          <select
            value={datasetId}
            onChange={(e) => {
              const d = LAB_DATASETS.find((x) => x.id === e.target.value);
              setDatasetId(e.target.value);
              if (d?.templateId) setTemplateId(d.templateId);
            }}
          >
            {LAB_DATASETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          Template{" "}
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value as TemplateId)}>
            {TEMPLATE_ORDER.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={lbl}>
          <input type="checkbox" checked={showDistances} onChange={(e) => setShowDistances(e.target.checked)} /> distances
        </label>
        <label style={lbl}>
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> debug overlay
        </label>
        <button onClick={() => setOverridesB({ ...overridesA })} style={btn}>
          A → B
        </button>
        <button onClick={() => setOverridesA({ ...overridesB })} style={btn}>
          B → A
        </button>
        <button onClick={() => { setOverridesA({}); setOverridesB({}); }} style={btn}>
          Reset both to defaults
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 360px", maxHeight: "85vh", overflowY: "auto", paddingRight: 8 }}>
          <ControlsPanel effA={layoutA.cfg} effB={layoutB.cfg} onChange={onChange} />
        </div>
        {column("A", "#2563eb", layoutA, () => copy(layoutA.cfg))}
        {column("B", "#9333ea", layoutB, () => copy(layoutB.cfg))}
      </div>
    </div>
  );
}

const btn: CSSProperties = {
  fontSize: 12,
  padding: "3px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#f8fafc",
  cursor: "pointer",
};
const lbl: CSSProperties = { fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 };
