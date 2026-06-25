---
description: Pull secrets from Vercel into backend/.env and frontend/.env
---

Pull environment variables from Vercel for both workspaces (Vercel is the source of
truth — see docs/integrations/secrets.md). Requires `vercel login` + `vercel link` done once.

Run:

```bash
vercel env pull backend/.env
vercel env pull frontend/.env
```

Then confirm which integrations are now configured by reading the key names present
(do not print secret values). Suggest running `/verify-integration` next.
