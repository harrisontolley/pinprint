import Stripe from "stripe";

// Stripe client, scaffolded like db.ts: lazy, env-guarded, null when unconfigured
// so the app builds and tests run without a key. Pricing/products/checkout are not
// built yet — this is just the client + webhook signature plumbing. The secret key
// is backend-only and must never reach the client.

let client: Stripe | null = null;

/** Returns a Stripe client, or null when STRIPE_SECRET_KEY is not configured. */
export function getStripe(): Stripe | null {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client = new Stripe(key);
  return client;
}

/** Whether the Stripe secret key is present (no network call). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Verify and parse a webhook payload. `rawBody` MUST be the unparsed request body
 * — verification fails against re-serialized JSON. Throws on a missing/invalid
 * signature or when Stripe is unconfigured.
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) throw new Error("stripe_not_configured");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
