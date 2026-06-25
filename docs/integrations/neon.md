# Neon (Postgres)

Hosted serverless Postgres. **Wired but feature-less today** — the only consumer is the
`/health/db` connectivity check. No schema, ORM, or migrations yet; future data work
(orders, etc.) builds on this client.

## Env vars

| Var | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | backend | Pooled connection string from the Neon dashboard. |

## Where the code lives

- `backend/src/db.ts` — `getSql()` (lazy `@neondatabase/serverless` client, `null` when
  `DATABASE_URL` is unset) and `pingDb()` (`select 1`). This is the **pattern** every
  other integration follows.
- `backend/src/app.ts` — `GET /health/db` and the `db` field of `/health/integrations`.

## Gotchas

- Use the **pooled** connection string for serverless (the one with `-pooler` in the
  host), not the direct one.
- The Neon project scales to zero; the first query after idle has a brief cold start.
- `getSql()` returns `null` when unconfigured — callers must handle it (as `pingDb`
  does), never assume a client.

## Verify

```bash
curl -s localhost:8787/health/db            # { "ok": true } when DATABASE_URL is set
curl -s localhost:8787/health/integrations  # { "db": true|false, ... }
```

## MCP

The Neon MCP server is in `.mcp.json` (`https://mcp.neon.tech/mcp`) — inspect branches,
tables, and run SQL against the project from the agent session. Prefer a Neon **branch**
for any schema experimentation so `main` stays clean.
