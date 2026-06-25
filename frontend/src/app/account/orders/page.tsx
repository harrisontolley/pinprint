"use client";

import Link from "next/link";
import type { OrderSummary } from "@pinprint/shared";
import { useResource } from "@/lib/account/useResource";
import { Card, SectionHeading } from "@/components/account/Card";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";
import { Loading, ErrorNote, EmptyState } from "@/components/account/States";
import { formatDate, formatPrice } from "@/lib/account/format";

export default function OrdersPage() {
  const { data, loading, error } = useResource<OrderSummary[]>("/account/orders");

  return (
    <div>
      <SectionHeading title="Orders" description="Every poster you've ordered." />

      {loading ? <Loading /> : null}
      {error ? <ErrorNote message={error} /> : null}
      {!loading && data && data.length === 0 ? (
        <EmptyState>
          You haven&apos;t placed any orders yet.{" "}
          <Link href="/studio" className="text-ink underline">
            Make a poster
          </Link>
          .
        </EmptyState>
      ) : null}

      <ul className="flex flex-col gap-3">
        {(data ?? []).map((o) => (
          <li key={o.orderNumber}>
            <Link href={`/account/orders/${o.orderNumber}`}>
              <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:border-hairline-strong">
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-ink">{o.previewLabel}</p>
                  <p className="text-xs text-muted">
                    {o.orderNumber} · {formatDate(o.createdAt)} ·{" "}
                    {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm text-body">
                    {formatPrice(o.totalCents, o.currency)}
                  </span>
                  <OrderStatusBadge status={o.status} />
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
