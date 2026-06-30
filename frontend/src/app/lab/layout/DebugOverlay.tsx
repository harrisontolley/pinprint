import type { LaidOut, LayoutConfig, LayoutDiagnostics } from "@/lib/layout/types";
import { rectsOverlap } from "@/lib/layout/aabb";

/**
 * Diagnostic overlay drawn as a sibling SVG over the live poster (same viewBox),
 * so the renderer needs no changes. Shows the content-safe rect, every label box,
 * each arrow's spoke obstacle, overlapping pairs (red), leaders, and how far each
 * label was displaced from its rest (icon-at-tip) position.
 */
export function DebugOverlay({
  items,
  cfg,
  diagnostics,
  width,
  height,
}: {
  items: LaidOut[];
  cfg: LayoutConfig;
  diagnostics: LayoutDiagnostics;
  width: number;
  height: number;
}) {
  const center = { x: cfg.cx, y: cfg.cy };

  // Which boxes overlap another (for red highlighting).
  const overlapping = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (rectsOverlap(items[i].labelBox, items[j].labelBox, cfg.boxPadding)) {
        overlapping.add(i);
        overlapping.add(j);
      }
    }
  }
  const offPage = new Set(diagnostics.offPage);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {/* content-safe rect */}
      <rect
        x={cfg.margin}
        y={cfg.margin}
        width={cfg.width - 2 * cfg.margin}
        height={cfg.safeBottom - cfg.margin}
        fill="none"
        stroke="#22c55e"
        strokeWidth={1.5}
        strokeDasharray="6 6"
      />
      {/* home keep-out disc */}
      <circle cx={center.x} cy={center.y} r={cfg.homeRadius} fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />

      {/* arrow spokes (obstacles) */}
      {items.map((o) => (
        <line key={`spoke-${o.id}`} x1={center.x} y1={center.y} x2={o.tip.x} y2={o.tip.y} stroke="#cbd5e1" strokeWidth={1} />
      ))}

      {/* leaders + displacement vectors */}
      {items.map((o) => {
        const rest = diagnostics.restCenters[o.id];
        const c = { x: o.labelBox.x + o.labelBox.w / 2, y: o.labelBox.y + o.labelBox.h / 2 };
        return (
          <g key={`vec-${o.id}`}>
            {rest && (
              <>
                <line x1={rest.x} y1={rest.y} x2={c.x} y2={c.y} stroke="#16a34a" strokeWidth={1} strokeDasharray="2 2" />
                <circle cx={rest.x} cy={rest.y} r={3} fill="#16a34a" />
              </>
            )}
            {o.needsLeader && (
              <line x1={o.tip.x} y1={o.tip.y} x2={o.labelBox.anchorX} y2={o.labelBox.anchorY} stroke="#f97316" strokeWidth={1.5} />
            )}
          </g>
        );
      })}

      {/* label boxes */}
      {items.map((o, i) => {
        const b = o.labelBox;
        const color = offPage.has(o.id) ? "#dc2626" : overlapping.has(i) ? "#ef4444" : "#2563eb";
        return (
          <g key={`box-${o.id}`}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={overlapping.has(i) ? "rgba(239,68,68,0.12)" : "rgba(37,99,235,0.06)"}
              stroke={color}
              strokeWidth={1.5}
            />
            <circle cx={o.tip.x} cy={o.tip.y} r={3} fill="#0f172a" />
          </g>
        );
      })}
    </svg>
  );
}
