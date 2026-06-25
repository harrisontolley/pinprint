import { createNeonAuth } from "@neondatabase/auth/next/server";

// Server-side Neon Auth: powers the /api/auth/* proxy and signs the session-data
// cookie. Reads server-only env (NEON_AUTH_BASE_URL + NEON_AUTH_COOKIE_SECRET) —
// never NEXT_PUBLIC, so no auth secret reaches the browser. Env-guarded like the
// backend integrations: when the env is absent (e.g. a hermetic CI build) `auth`
// is null and the auth routes degrade to 503 instead of crashing the build.

function createAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) return null;
  return createNeonAuth({ baseUrl, cookies: { secret } });
}

export const auth = createAuth();
