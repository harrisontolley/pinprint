# PostHog

Product analytics, session replay, feature flags, and error tracking — all four are
wired in the client provider. Initialisation is **env-guarded**: with no
`NEXT_PUBLIC_POSTHOG_KEY` the provider is a no-op, so the app builds and runs without
it (and tests/CI stay clean).

## Env vars

| Var | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | frontend | `phc_…` project key. Safe to expose. |
| `NEXT_PUBLIC_POSTHOG_HOST` | frontend | `/ingest` — the reverse-proxy path (below). |
| `NEXT_PUBLIC_POSTHOG_UPSTREAM` | frontend | Region the proxy forwards to (`us`/`eu`). |
| `POSTHOG_PERSONAL_API_KEY` | backend/MCP | Only for the PostHog MCP server, not the app. |

Project key: <https://us.posthog.com> → Project settings.

## Where the code lives

- `frontend/src/app/providers.tsx` — `"use client"` `PostHogProvider`. Enables
  autocapture + pageviews, **session replay**, and **exception capture**. No-ops when
  the key is unset.
- `frontend/src/app/layout.tsx` — wraps `{children}` in `<Providers>`.
- `frontend/src/lib/flags.ts` — `useFeatureFlag(key)` helper (the flag pattern; no flag
  is consumed yet).
- `frontend/next.config.ts` — `rewrites()` reverse-proxy: `/ingest/*` → PostHog.

## Reverse proxy (why `/ingest`)

Ad blockers drop requests to `*.posthog.com`. Routing events through our own origin
(`/ingest`) keeps capture working. `NEXT_PUBLIC_POSTHOG_HOST=/ingest` tells `posthog-js`
to send there; `next.config.ts` rewrites `/ingest/*` to `NEXT_PUBLIC_POSTHOG_UPSTREAM`.

## The four capabilities

- **Product analytics** — autocapture + manual `posthog.capture('event', props)`.
- **Session replay** — `disable_session_recording: false` in the provider; **mask
  inputs by default** for privacy (`maskAllInputs`). Don't record payment fields.
- **Feature flags** — read via `useFeatureFlag` / `posthog.isFeatureEnabled(key)`;
  bootstrap from the provider to avoid a flicker on first paint.
- **Error tracking** — exceptions auto-captured; PostHog replaces Sentry here.

## Gotchas

- Only `NEXT_PUBLIC_*` is available in the browser — never reference a secret here.
- Initialise once, client-side only (the provider handles this); never `init` in a
  Server Component.
- Mask PII in replays; exclude the (future) checkout fields.

## Verify

```bash
pnpm --filter @pinprint/frontend build      # builds with and without the key set
# With NEXT_PUBLIC_POSTHOG_KEY set, run `pnpm dev` and confirm requests hit /ingest in
# the browser Network tab and events land in the PostHog dashboard.
```

## MCP

The PostHog MCP server is in `.mcp.json` (`https://mcp.posthog.com/mcp`, Bearer
`POSTHOG_PERSONAL_API_KEY`) — query insights, flags, and errors from the agent session.
