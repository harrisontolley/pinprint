import { Hono } from "hono";
import { createOrder, type NewOrder, type NewOrderItem } from "../orders.js";

// Dev-only order creation, so the account/track flows can be exercised before the
// real checkout ships. Guarded by DEV_SEED_TOKEN: every route 403s unless the env
// var is set AND the request sends a matching `x-dev-seed-token` header. With the
// token unset (production), the whole router is inert.

function authorized(token: string | undefined): boolean {
  const expected = process.env.DEV_SEED_TOKEN;
  return Boolean(expected) && token === expected;
}

function parseItems(raw: unknown): NewOrderItem[] {
  if (!Array.isArray(raw)) return [];
  const items: NewOrderItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (typeof o.productId !== "string" || typeof o.productLabel !== "string") continue;
    items.push({
      productId: o.productId,
      productLabel: o.productLabel,
      quantity: typeof o.quantity === "number" ? o.quantity : 1,
      unitPriceCents: typeof o.unitPriceCents === "number" ? o.unitPriceCents : 0,
      posterConfig:
        o.posterConfig && typeof o.posterConfig === "object"
          ? (o.posterConfig as Record<string, unknown>)
          : {},
      prodigiSku: typeof o.prodigiSku === "string" ? o.prodigiSku : undefined,
      assetUrl: typeof o.assetUrl === "string" ? o.assetUrl : undefined,
    });
  }
  return items;
}

export function buildDevRouter(): Hono {
  const r = new Hono();

  r.post("/orders", async (c) => {
    if (!authorized(c.req.header("x-dev-seed-token"))) {
      return c.json({ error: "forbidden" }, 403);
    }
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const items = parseItems(body.items);
    if (typeof body.email !== "string" || items.length === 0) {
      return c.json({ error: "invalid_order" }, 400);
    }
    const input: NewOrder = {
      userId: typeof body.userId === "string" ? body.userId : null,
      email: body.email,
      status: "pending_payment",
      stripePaymentIntentId:
        typeof body.stripePaymentIntentId === "string" ? body.stripePaymentIntentId : undefined,
      prodigiOrderId:
        typeof body.prodigiOrderId === "string" ? body.prodigiOrderId : undefined,
      items,
    };
    const { orderNumber } = await createOrder(input);
    return c.json({ orderNumber }, 201);
  });

  return r;
}
