# Prodigi

Print-on-demand fulfilment: once an order is paid (Stripe), we submit it to Prodigi,
which prints the poster and ships it. No SDK — plain `fetch` against their REST API.
Offline API reference is vendored in [`./prodigi/`](./prodigi/) so it's available
without network.

## Env vars

| Var | Where | Notes |
| --- | --- | --- |
| `PRODIGI_API_KEY` | backend | Sandbox key in dev. Sent as the `X-API-Key` header. |
| `PRODIGI_API_BASE` | backend | `https://api.sandbox.prodigi.com/v4.0` (sandbox) — swap to `https://api.prodigi.com/v4.0` for live. |

Sandbox dashboard: <https://sandbox-beta-dashboard.pwinty.com>. **Sandbox and live are
fully separate** — separate keys, separate base URLs, separate order history. Dev and
CI use sandbox only.

## Where the code lives

- `backend/src/prodigi.ts` — env-guarded config (`getProdigiConfig()` returns `null`
  when `PRODIGI_API_KEY` is unset), `isConfigured()`, and a thin `prodigiFetch()`
  helper that attaches the `X-API-Key` header and base URL.
- `backend/src/app.ts` → `registerRoutes()` — `POST /webhooks/prodigi` (status
  callbacks) and the `prodigi` field of `GET /health/integrations`.
- Order / fulfilment-status types the frontend reads go in `packages/shared/src/index.ts`.

## Canonical flow (to build later)

1. Stripe webhook confirms payment.
2. `POST {base}/Orders` with recipient + items (poster SKU, copies, the print asset
   URL). Use an **idempotency key** so retries don't double-print.
3. Persist the returned Prodigi order id against our order.
4. Receive status callbacks on `POST /webhooks/prodigi` (or poll `GET {base}/Orders/{id}`)
   and surface tracking to the customer.

See [`./prodigi/orders.md`](./prodigi/orders.md) for request/response shapes.

## Gotchas

- Sandbox vs live base URL + key must match — a live key against the sandbox URL fails
  confusingly. Default everything to sandbox.
- The print **asset must be a publicly reachable URL** at submission time (our exported
  PNG/SVG), not a local file.
- Orders are largely immutable once submitted; cancellation is time-limited. Validate
  before submitting.
- Prodigi has **no MCP server** — this doc + the vendored reference are the source.

## Verify

```bash
curl -s localhost:8787/health/integrations          # { "prodigi": true|false, ... }
curl -i -X POST localhost:8787/webhooks/prodigi      # malformed → 400; valid stub → 204
# Sandbox smoke (needs PRODIGI_API_KEY):
curl -s -H "X-API-Key: $PRODIGI_API_KEY" "$PRODIGI_API_BASE/Orders?top=1"
```
