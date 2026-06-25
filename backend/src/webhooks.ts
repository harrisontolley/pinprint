import type Stripe from "stripe";
import type { OrderStatus, OrderTracking } from "@pinprint/shared";
import {
  advanceOrderStatus,
  findOrderByProdigiId,
  findOrderByStripeCheckoutSession,
  findOrderByStripePaymentIntent,
} from "./orders.js";

// Order persistence driven by the Stripe and Prodigi webhooks. The DB-touching
// handlers no-op gracefully when DATABASE_URL is unset (the find* helpers return
// null), so an unconfigured deploy still 204s. The pure mapping helpers below are
// exported for unit testing without a database.

// ── Prodigi mapping (pure) ───────────────────────────────────────────────────

/** Map a Prodigi fulfilment stage to our order status. */
export function mapProdigiStage(stage: string): OrderStatus | null {
  switch (stage) {
    case "InProgress":
      return "in_production";
    case "Complete":
      return "shipped"; // Prodigi "Complete" == dispatched
    case "Cancelled":
      return "cancelled";
    default:
      return null;
  }
}

type ProdigiShipment = {
  carrier?: { name?: string; service?: string };
  tracking?: { number?: string; url?: string };
};

/** Pull carrier/tracking from the first shipment, if any. */
export function trackingFromShipments(shipments: unknown): OrderTracking | undefined {
  if (!Array.isArray(shipments) || shipments.length === 0) return undefined;
  const s = shipments[0] as ProdigiShipment;
  const tracking: OrderTracking = {
    carrier: s.carrier?.name,
    number: s.tracking?.number,
    url: s.tracking?.url,
  };
  if (!tracking.carrier && !tracking.number && !tracking.url) return undefined;
  return tracking;
}

/** Normalize a Prodigi callback (handles both the bare order and CloudEvents wrap). */
export function extractProdigiOrder(payload: unknown): {
  id?: string;
  stage?: string;
  shipments?: unknown;
} {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  const order = ((data?.order ?? root.order ?? root) ?? {}) as Record<string, unknown>;
  const status = order.status as Record<string, unknown> | undefined;
  return {
    id: typeof order.id === "string" ? order.id : undefined,
    stage: typeof status?.stage === "string" ? (status.stage as string) : undefined,
    shipments: order.shipments,
  };
}

// ── Handlers (DB-touching; no-op when unconfigured) ──────────────────────────

/** Advance an order in response to a Stripe webhook event. */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const located =
        (await findOrderByStripeCheckoutSession(s.id)) ??
        (s.payment_intent
          ? await findOrderByStripePaymentIntent(String(s.payment_intent))
          : null);
      if (located && located.status === "pending_payment") {
        await advanceOrderStatus(located.id, "paid", {
          message: "Payment received",
          source: "stripe",
          payload: event,
        });
      }
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const located = await findOrderByStripePaymentIntent(pi.id);
      if (located && located.status === "pending_payment") {
        await advanceOrderStatus(located.id, "paid", {
          message: "Payment received",
          source: "stripe",
          payload: event,
        });
      }
      break;
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const piId =
        typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      const located = piId ? await findOrderByStripePaymentIntent(piId) : null;
      if (located) {
        await advanceOrderStatus(located.id, "refunded", {
          message: "Payment refunded",
          source: "stripe",
          payload: event,
        });
      }
      break;
    }
    default:
      break;
  }
}

/** Advance an order in response to a Prodigi status callback. */
export async function handleProdigiPayload(payload: unknown): Promise<{ handled: boolean }> {
  const { id, stage, shipments } = extractProdigiOrder(payload);
  if (!id || !stage) return { handled: false };
  const status = mapProdigiStage(stage);
  if (!status) return { handled: false };
  const located = await findOrderByProdigiId(id);
  if (!located) return { handled: false };
  await advanceOrderStatus(located.id, status, {
    message: `Prodigi: ${stage}`,
    source: "prodigi",
    payload,
    tracking: trackingFromShipments(shipments),
  });
  return { handled: true };
}
