# Contributing to Pinprint

Thanks for your interest in improving Pinprint!

## Getting set up

```bash
pnpm install
git config core.hooksPath .githooks      # enable the secret-scan pre-commit hook
pnpm dev          # frontend on :3000, backend on :8787
```

Requires Node `>=20` and pnpm (see `packageManager` in `package.json`).

### Secrets & integrations

Secrets live in Vercel (source of truth). After `vercel login && vercel link`, pull
them with `vercel env pull backend/.env` and `vercel env pull frontend/.env`. Never
commit real keys — only `*.env.example` templates. Integration setup, gotchas, and
verification steps live in [`docs/integrations/`](docs/integrations/README.md).

Agents working in this repo: a recommended Claude harness config (broader command
allowlist + a typecheck-on-stop hook) is in `.claude/settings.recommended.json` —
review and copy it to `.claude/settings.json` to activate.

## Before opening a pull request

Run the full check suite from the repo root — CI runs the same:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Project layout

- `frontend/` — Next.js app (Poster Studio UI, rendering, export).
- `backend/` — Hono API (geocoding proxy, Neon health check).
- `packages/shared/` — types shared across the API boundary.

## Guidelines

- Keep the API contract in `packages/shared` as the single source of truth for
  data crossing the frontend/backend boundary.
- Add or update tests alongside the code you change.
- Match the surrounding code style; ESLint and TypeScript are enforced in CI.
- Keep pull requests focused — one logical change per PR.
