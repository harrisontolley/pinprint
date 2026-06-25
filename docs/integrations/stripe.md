# Stripe

Payments. **Pricing/products are out of scope for now** — this doc covers the
plumbing that is scaffolded today (client init, webhook signature verification,
readiness) so the checkout flow can be built later with no surprises.

## Env vars

| Var | Where | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | backend | `sk_test_…` in dev. Never reaches the client. |
| `STRIPE_WEBHOOK_SECRET` | backend | `whsec_…`. Verifies the webhook signature. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | frontend | `pk_test_…`. Safe to expose; used by Stripe.js at checkout (not wired yet). |

Test keys: <https://dashboard.stripe.com/test/apikeys>. Stay in **test mode**.

## Where the code lives

- `backend/src/stripe.ts` — lazy, env-guarded client (`getStripe()` returns `null`
  when `STRIPE_SECRET_KEY` is unset), `isConfigured()`, and `constructWebhookEvent()`.
- `backend/src/app.ts` → `registerRoutes()` — `POST /webhooks/stripe` and the
  `stripe` field of `GET /health/integrations`.
- Order/payment types that the frontend will read go in `packages/shared/src/index.ts`.

## Webhooks

The single biggest footgun: **signature verification needs the raw, unparsed request
body.** Do not `JSON.parse` before verifying. The handler reads `await c.req.text()`
and the `stripe-signature` header, then calls `stripe.webhooks.constructEvent(raw,
sig, STRIPE_WEBHOOK_SECRET)`. A bad/missing signature → `400`. The route is mounted at
both `/webhooks/stripe` and `/_/backend/webhooks/stripe` (Vercel does not strip the
service prefix — see `app.ts`).

### Local webhook loop (Stripe CLI)

```bash
stripe login
stripe listen --forward-to localhost:8787/webhooks/stripe   # prints whsec_… → STRIPE_WEBHOOK_SECRET
stripe trigger payment_intent.succeeded                       # fire a test event
```

## Gotchas

- Raw body for signatures (above). Amounts are in the **smallest currency unit**
  (pence/cents), integers. Make every mutation **idempotent** (Stripe retries
  webhooks; use the event `id`). Treat `payment_intent.succeeded` (or
  `checkout.session.completed`) as the source of truth for "paid", never the client.

## Verify

```bash
pnpm --filter @pinprint/backend test       # hermetic signature accept/reject (backend/src/stripe.test.ts)
curl -s localhost:8787/health/integrations  # { "stripe": true|false, ... }
curl -i -X POST localhost:8787/webhooks/stripe   # no signature → 400
```

## MCP

The Stripe MCP server is in `.mcp.json` (`npx @stripe/mcp`, reads `STRIPE_SECRET_KEY`).
It can inspect test-mode objects and search Stripe docs from the agent session.
