# Integrations

Canonical reference for every third-party service Pinprint talks to. **Read the
relevant file here before writing or changing integration code** — it records the
env vars, the test/sandbox setup, where the code lives, the known footguns, and
the exact command to verify your change.

| Service | What it does | Doc | Server code | Client code |
| --- | --- | --- | --- | --- |
| **Neon** | Postgres database | [neon.md](./neon.md) | `backend/src/db.ts` | — |
| **Stripe** | Payments | [stripe.md](./stripe.md) | `backend/src/stripe.ts` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Stripe.js, later) |
| **Prodigi** | Print-on-demand fulfilment | [prodigi.md](./prodigi.md) · [API ref](./prodigi/) | `backend/src/prodigi.ts` | — |
| **PostHog** | Analytics, replay, flags, errors | [posthog.md](./posthog.md) | optional | `frontend/src/app/providers.tsx` |

Secrets workflow for all of them: [secrets.md](./secrets.md).

## Three rules that keep this codebase safe and typed

1. **Secrets live only in the backend.** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `PRODIGI_API_KEY`, `DATABASE_URL` are read from `process.env` in `backend/src/*`
   and never imported into `frontend/`. The browser only ever sees `NEXT_PUBLIC_*`
   values (publishable keys, the PostHog project key) — these are designed to be
   public.

2. **Anything that crosses the wire is typed in `packages/shared`.** Order shapes,
   webhook-derived statuses, anything the frontend reads from the backend goes in
   `packages/shared/src/index.ts` so both sides share one source of truth (the
   `GeoResult` type is the existing example).

3. **Integrations follow the `db.ts` pattern: lazy, env-guarded, null when
   unconfigured.** A missing key is never a crash — `getStripe()` / `getProdigi()`
   return `null` exactly like `getSql()`, and `/health/integrations` reports what is
   configured. This keeps the app buildable and the tests hermetic without any keys.

## Current state (harness, not features)

The integrations are **scaffolded, not built into product flows**. Present today:
client initialisers, webhook signature-verification endpoints (verify → 204, with a
`TODO` body), a readiness check, the PostHog provider wiring, and the docs/tests
that set the conventions. Building checkout, orders, and fulfilment comes later —
each as its own spec → plan → PR.
