import { getOrderUpdatesOptIn } from "./accountStore.js";
import { getSql } from "./db.js";
import { isResendConfigured, sendEmail } from "./email.js";
import { orderConfirmationEmail } from "./emails/orderConfirmation.js";
import { shipmentNotificationEmail } from "./emails/shipmentNotification.js";
import {
  appendOrderEvent,
  claimConfirmationEmail,
  claimShipmentEmail,
  getOrderForConfirmationEmail,
  getOrderForShipmentEmail,
  releaseConfirmationEmailClaim,
  releaseShipmentEmailClaim,
  type ShipmentEmailKind,
} from "./orders.js";

// Post-payment order emails: the confirmation ("receipt") fired once from the
// paid transition, and the shipped/delivered notifications fired from Artelo
// status transitions. Mirrors digitalDelivery.ts's shape exactly — never
// throws, idempotent via a claim/release pair on orders.ts (the atomic
// conditional UPDATE *is* the idempotency check, closing the race where two
// overlapping webhook deliveries/retries would otherwise both pass a plain
// read and double-send), env-guarded, and logs to order_events.

export type SendResult = { sent: boolean; reason?: string };

/**
 * Absolute base for the /track link these emails carry. Deliberately does NOT
 * fall back to a request `Origin` header — unlike checkout.ts's baseUrl,
 * there is no request here (these sends happen from a webhook's deferred task
 * or the fulfillment-sweep cron, both already past any request/response
 * cycle), and even if there were, an Origin header is attacker-controlled on
 * non-browser requests and this link is emailed to a third party (see
 * routes/leads.ts's backendBaseUrl for the fuller rationale on that class of
 * link). Returns null when unconfigured on Vercel so callers omit the link
 * rather than ship one pointed at the wrong place.
 */
function frontendBaseUrl(): string | null {
  const publicAppUrl = process.env.PUBLIC_APP_URL;
  if (publicAppUrl) return publicAppUrl.replace(/\/$/, "");
  if (process.env.VERCEL) return null;
  return "http://localhost:3000";
}

function trackUrl(): string | null {
  const base = frontendBaseUrl();
  return base ? `${base}/track` : null;
}

/**
 * Email a paid order's confirmation/receipt. Called fire-and-forget from the
 * Stripe webhook's paid transition (both checkout.session.completed and its
 * async-payment-succeeded parity path) and retried by the fulfillment-sweep
 * cron for any paid order still missing one after 15 minutes.
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<SendResult> {
  if (!getSql() || !isResendConfigured()) return { sent: false, reason: "unconfigured" };

  let order;
  try {
    order = await getOrderForConfirmationEmail(orderId);
  } catch {
    return { sent: false, reason: "load_failed" };
  }
  if (!order) return { sent: false, reason: "order_not_found" };
  if (order.confirmationEmailSentAt) return { sent: false, reason: "already_sent" };

  let claimed: boolean;
  try {
    claimed = await claimConfirmationEmail(order.id);
  } catch {
    return { sent: false, reason: "claim_failed" };
  }
  if (!claimed) return { sent: false, reason: "already_sent" };

  try {
    const email = orderConfirmationEmail({
      orderNumber: order.orderNumber,
      items: order.items.map((it) => ({
        label: it.productLabel,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
      })),
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      trackUrl: trackUrl(),
    });
    const sent = await sendEmail({ to: order.email, subject: email.subject, html: email.html, text: email.text });

    if (!sent) {
      await releaseConfirmationEmailClaim(order.id).catch(() => {});
      await appendOrderEvent(order.id, {
        message: "Order confirmation failed: email send failed",
        source: "system",
      }).catch(() => {});
      return { sent: false, reason: "email_send_failed" };
    }

    await appendOrderEvent(order.id, {
      message: "Order confirmation emailed",
      source: "system",
    }).catch(() => {});
    return { sent: true };
  } catch {
    await releaseConfirmationEmailClaim(order.id).catch(() => {});
    await appendOrderEvent(order.id, {
      message: "Order confirmation failed: email send failed",
      source: "system",
    }).catch(() => {});
    return { sent: false, reason: "email_send_failed" };
  }
}

/**
 * Email a shipped/delivered notification. Called fire-and-forget from
 * webhooks.ts's handleArteloPayload after a status transition, and from
 * admin.ts's manual "sync from Artelo" action. Signed-in buyers can opt out
 * via order_updates_opt_in (frontend/src/app/account/profile); guests always
 * get it since email is their only line back to the order.
 */
export async function sendShipmentNotificationEmail(
  orderId: string,
  kind: ShipmentEmailKind,
): Promise<SendResult> {
  if (!getSql() || !isResendConfigured()) return { sent: false, reason: "unconfigured" };

  let order;
  try {
    order = await getOrderForShipmentEmail(orderId);
  } catch {
    return { sent: false, reason: "load_failed" };
  }
  if (!order) return { sent: false, reason: "order_not_found" };

  const alreadySentAt = kind === "shipped" ? order.shippedEmailSentAt : order.deliveredEmailSentAt;
  if (alreadySentAt) return { sent: false, reason: "already_sent" };

  if (order.userId) {
    // Fail safe on a lookup error: an unreadable preference should not
    // silently swallow a real shipping notice, so default to "opted in".
    const optedIn = await getOrderUpdatesOptIn(order.userId).catch(() => true);
    if (!optedIn) {
      await appendOrderEvent(order.id, {
        message: `Shipment email (${kind}) skipped: recipient opted out of order updates`,
        source: "system",
      }).catch(() => {});
      return { sent: false, reason: "opted_out" };
    }
  }

  let claimed: boolean;
  try {
    claimed = await claimShipmentEmail(order.id, kind);
  } catch {
    return { sent: false, reason: "claim_failed" };
  }
  if (!claimed) return { sent: false, reason: "already_sent" };

  try {
    const email = shipmentNotificationEmail({
      kind,
      orderNumber: order.orderNumber,
      tracking: order.tracking,
      trackUrl: trackUrl(),
    });
    const sent = await sendEmail({ to: order.email, subject: email.subject, html: email.html, text: email.text });

    if (!sent) {
      await releaseShipmentEmailClaim(order.id, kind).catch(() => {});
      await appendOrderEvent(order.id, {
        message: `Shipment email (${kind}) failed: email send failed`,
        source: "system",
      }).catch(() => {});
      return { sent: false, reason: "email_send_failed" };
    }

    await appendOrderEvent(order.id, {
      message: `Shipment email (${kind}) sent`,
      source: "system",
    }).catch(() => {});
    return { sent: true };
  } catch {
    await releaseShipmentEmailClaim(order.id, kind).catch(() => {});
    await appendOrderEvent(order.id, {
      message: `Shipment email (${kind}) failed: email send failed`,
      source: "system",
    }).catch(() => {});
    return { sent: false, reason: "email_send_failed" };
  }
}
