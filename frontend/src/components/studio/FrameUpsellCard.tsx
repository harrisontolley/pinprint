"use client";

import { usePosterStore } from "@/lib/store/posterStore";
import { formatUsd, DEFAULT_FRAME_COLOR } from "@/lib/commerce/price";
import { PRODUCTS_BY_ID } from "@/lib/commerce/printProducts";

/**
 * The ready-to-hang frame upsell. A checkbox card (ink-ring when on, same
 * language as the size cards) that adds the per-size frame upcharge to the
 * total. Rendered only on the print path — the parent gates on
 * format === "print". Material/color choice is a single default for now
 * (Oak/Natural) — the 8-variant picker lands in a follow-up PR; this just
 * keeps the toggle working against the new frame model in the meantime.
 */
export function FrameUpsellCard() {
  const productId = usePosterStore((s) => s.productId);
  const frame = usePosterStore((s) => s.frame);
  const setFrame = usePosterStore((s) => s.setFrame);
  const product = PRODUCTS_BY_ID[productId];
  const addFrame = frame !== null;

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-surface-card p-3 transition-colors ${
        addFrame
          ? "border-ink ring-1 ring-ink"
          : "border-hairline hover:border-hairline-strong"
      }`}
    >
      <input
        type="checkbox"
        checked={addFrame}
        onChange={(e) =>
          setFrame(e.target.checked ? { material: "Oak", color: DEFAULT_FRAME_COLOR } : null)
        }
        className="mt-0.5 h-4 w-4 cursor-pointer rounded-xs border-hairline-strong accent-ink"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">
            Add a premium natural-oak frame
          </span>
          <span className="shrink-0 rounded-pill bg-surface-strong px-2 py-0.5 text-xs font-semibold text-ink">
            +{formatUsd(product.frameUpchargeCents)}
          </span>
        </span>
        <span className="text-xs text-muted">
          Premium solid-oak frame, glass front — arrives wired, ready to hang.
        </span>
      </span>
    </label>
  );
}
