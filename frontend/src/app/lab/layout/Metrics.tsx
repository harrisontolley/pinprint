import type { LaidOut, LayoutConfig, LayoutDiagnostics } from "@/lib/layout/types";
import { rectsOverlap } from "@/lib/layout/aabb";

/** Live quality readout for one layout (one A/B column). */
export function Metrics({
  items,
  cfg,
  diagnostics,
}: {
  items: LaidOut[];
  cfg: LayoutConfig;
  diagnostics: LayoutDiagnostics;
}) {
  let overlaps = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (rectsOverlap(items[i].labelBox, items[j].labelBox, cfg.boxPadding)) overlaps++;
    }
  }
  const leaders = items.filter((o) => o.needsLeader);
  const leaderLen = Math.round(
    leaders.reduce((s, o) => s + Math.hypot(o.tip.x - o.labelBox.anchorX, o.tip.y - o.labelBox.anchorY), 0),
  );

  const rows: [string, string, boolean?][] = [
    ["Overlaps", String(overlaps), overlaps > 0],
    ["Off-page", String(diagnostics.offPage.length), diagnostics.offPage.length > 0],
    ["Leaders", `${leaders.length} (${leaderLen}px)`],
    ["Iterations", String(diagnostics.iterations)],
    ["Converged", diagnostics.converged ? "yes" : "no", !diagnostics.converged],
    ["Primary solved", diagnostics.primaryResolved ? "yes" : "no"],
    ["Fallback used", diagnostics.fallbackUsed ? "yes" : "no", diagnostics.fallbackUsed],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 12px", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
      {rows.map(([k, v, warn]) => (
        <div key={k} style={{ display: "contents" }}>
          <span style={{ color: "#64748b" }}>{k}</span>
          <span style={{ color: warn ? "#dc2626" : "#0f172a", fontWeight: warn ? 700 : 400, textAlign: "right" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
