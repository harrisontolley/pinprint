"use client";

import { authClient } from "@/lib/auth/client";
import { apiUrl } from "@/lib/api";

// Authenticated client-side calls to the Hono backend. The Neon Auth session lives
// in the browser, so the JWT is attached here (not from an RSC) — which also makes
// it work in local dev, where the frontend (:3000) and backend (:8787) are
// cross-origin and the auth cookie is never sent to the backend.

// getJWTToken() exists on the runtime client (authenticated JWT > anonymous > null)
// but isn't surfaced on the Next client's static type — narrow it here.
type TokenClient = { getJWTToken?: () => Promise<string | null> };

/** Current session JWT, or null when signed out / unavailable. */
export async function authToken(): Promise<string | null> {
  try {
    const get = (authClient as unknown as TokenClient).getJWTToken;
    return get ? await get() : null;
  } catch {
    return null;
  }
}

/** fetch() against the backend with the Bearer token attached when signed in. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await authToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...init, headers });
}

/** Convenience: GET + parse JSON, throwing on a non-2xx response. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}
