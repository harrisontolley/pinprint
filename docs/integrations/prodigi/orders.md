# Prodigi Print API v4.0 — vendored reference

Offline copy of the endpoints Pinprint uses. Authoritative docs:
<https://www.prodigi.com/print-api/docs/reference/>. Base URL comes from
`PRODIGI_API_BASE`; sandbox = `https://api.sandbox.prodigi.com/v4.0`.

All requests send header `X-API-Key: <PRODIGI_API_KEY>` and `Content-Type: application/json`.

## Create order — `POST /Orders`

Submits a print + fulfilment order. Send an `Idempotency-Key` header to make retries safe.

```jsonc
// request body
{
  "shippingMethod": "Budget",            // Budget | Standard | Express | Overnight
  "recipient": {
    "name": "Ada Lovelace",
    "address": {
      "line1": "1 Analytical Way",
      "postalOrZipCode": "SW1A 1AA",
      "countryCode": "GB",
      "townOrCity": "London"
    }
  },
  "items": [
    {
      "sku": "GLOBAL-FAP-A2",            // a Prodigi product SKU (poster sizes)
      "copies": 1,
      "sizing": "fillPrintArea",
      "assets": [
        { "printArea": "default", "url": "https://.../poster.png" }  // public URL
      ]
    }
  ]
}
```

```jsonc
// response (201)
{
  "outcome": "Created",
  "order": {
    "id": "ord_123",
    "status": { "stage": "InProgress", "details": { /* ... */ } },
    "recipient": { /* echo */ },
    "items": [ /* echo + per-item status */ ]
  }
}
```

## Get order — `GET /Orders/{id}`

Returns the order with its current `status.stage`:
`InProgress` → `Complete` (shipped) | `Cancelled`. Shipment + tracking appear under
`shipments[]` once dispatched.

## Get quote — `POST /quotes`

Price + shipping estimate for items before ordering. Same item shape as create.

## Status callbacks (webhook) — our `POST /webhooks/prodigi`

Prodigi POSTs order status changes to a configured callback URL. Payload carries the
order `id` and the new `status`. Our handler validates and returns `204`; mapping
stages to our own order status is a TODO until the order flow exists.

## Notes

- SKUs: poster/framed-print SKUs are listed in the Prodigi product catalogue; pick the
  sizes Pinprint will sell and record them in the order code when built.
- `sizing`: `fillPrintArea` (crop to fill) vs `fitPrintArea` (letterbox). Posters
  generally use `fillPrintArea`.
- Asset URLs must be reachable by Prodigi's servers — use the deployed export URL, not
  a localhost path.
