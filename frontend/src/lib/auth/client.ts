"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// Client-side Neon Auth. Talks to the same-origin /api/auth proxy (no public auth
// URL needed). Exposes useSession(), signIn.social(), signOut(), and getJWTToken()
// — the last is how we authenticate calls to the Hono backend (see lib/apiClient).
export const authClient = createAuthClient();
