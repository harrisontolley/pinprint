"use client";

import { formatUsd, discountPercent } from "@/lib/commerce/price";
import type { PrintProduct } from "@/lib/commerce/printProducts";

/**
 * One purchasable print size: a proportional glyph, the dimensions, and the
 * price. Active = ink ring (matches the look cards). The optional badge ("Popular",
 * "Premium") is a quiet chip, not a color shout; it falls back to product.popular.
 */
export function SizeCard({
  product,
  active,
  badge,
  onSelect,
}: {
  product: PrintProduct;
  active: boolean;
  badge?: string;
  onSelect: () => void;
}) {
  const ratio = product.widthIn / product.heightIn;
  const gw = ratio >= 1 ? 30 : Math.round(30 * ratio);
  const gh = ratio >= 1 ? Math.round(30 / ratio) : 30;
  const badgeLabel = badge ?? (product.popular ? "Popular" : null);
  const off = discountPercent(product.listPriceCents, product.priceCents);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`relative flex cursor-pointer flex-col items-start gap-2 rounded-lg border bg-surface-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
        active
          ? "border-ink ring-1 ring-ink"
          : "border-hairline hover:border-hairline-strong"
      }`}
    >
      {badgeLabel && (
        <span className="absolute right-2 top-2 rounded-pill bg-surface-strong px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
          {badgeLabel}
        </span>
      )}
      <span
        className="flex h-8 w-8 items-center justify-center"
        aria-hidden
      >
        <span
          className={`rounded-[2px] border ${active ? "border-ink" : "border-hairline-strong"}`}
          style={{ width: gw, height: gh }}
        />
      </span>
      <span className="text-sm font-medium text-ink">{product.label}</span>
      <span className="flex items-baseline gap-1.5 text-sm">
        {off > 0 && (
          <span className="text-muted line-through">
            {formatUsd(product.listPriceCents)}
          </span>
        )}
        <span className="text-body-strong">{formatUsd(product.priceCents)}</span>
        {off > 0 && (
          <span className="font-semibold text-success">−{off}%</span>
        )}
      </span>
    </button>
  );
}
