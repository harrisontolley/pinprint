"use client";

import type { LayoutConfig } from "@/lib/layout/types";
import { PARAM_SCHEMA, PARAM_GROUPS, type ParamSpec } from "./paramSchema";

type Side = "A" | "B";

/** Schema-driven sliders/toggles that edit the A and B config overrides side by side. */
export function ControlsPanel({
  effA,
  effB,
  onChange,
}: {
  effA: LayoutConfig;
  effB: LayoutConfig;
  onChange: (side: Side, key: keyof LayoutConfig, value: number | boolean) => void;
}) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));

  const control = (p: ParamSpec, side: Side, eff: LayoutConfig) => {
    if (p.kind === "toggle") {
      return (
        <input
          type="checkbox"
          checked={Boolean(eff[p.key])}
          onChange={(e) => onChange(side, p.key, e.target.checked)}
        />
      );
    }
    const value = Number(eff[p.key]);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="range"
          min={p.min}
          max={p.max}
          step={p.step}
          value={value}
          onChange={(e) => onChange(side, p.key, Number(e.target.value))}
          style={{ width: 84 }}
        />
        <input
          type="number"
          min={p.min}
          max={p.max}
          step={p.step}
          value={value}
          onChange={(e) => onChange(side, p.key, Number(e.target.value))}
          style={{ width: 56, fontSize: 11 }}
        />
      </div>
    );
  };

  return (
    <div style={{ fontSize: 12 }}>
      {PARAM_GROUPS.map((group) => (
        <div key={group} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, margin: "8px 0 4px", color: "#0f172a" }}>{group}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 10px", alignItems: "center" }}>
            <div style={{ color: "#64748b", fontSize: 11 }} />
            <div style={{ color: "#2563eb", fontWeight: 700, textAlign: "center" }}>A</div>
            <div style={{ color: "#9333ea", fontWeight: 700, textAlign: "center" }}>B</div>
            {PARAM_SCHEMA.filter((p) => p.group === group).map((p) => (
              <div key={p.key} style={{ display: "contents" }}>
                <label title={p.hint} style={{ color: "#334155" }}>
                  {p.label}
                  {p.kind === "slider" && (
                    <span style={{ color: "#94a3b8", marginLeft: 4 }}>{fmt(Number(effA[p.key]))}</span>
                  )}
                </label>
                {control(p, "A", effA)}
                {control(p, "B", effB)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
