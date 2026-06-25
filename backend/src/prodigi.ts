// Prodigi print-on-demand fulfilment. No SDK — a thin fetch wrapper. Scaffolded
// like db.ts: env-guarded, null when unconfigured so the app builds without a key.
// Order submission is not built yet; this is the client + readiness plumbing.
// See docs/integrations/prodigi.md and docs/integrations/prodigi/orders.md.

const SANDBOX_BASE = "https://api.sandbox.prodigi.com/v4.0";

export type ProdigiConfig = { apiKey: string; baseUrl: string };

/** Returns Prodigi config, or null when PRODIGI_API_KEY is not configured. */
export function getProdigiConfig(): ProdigiConfig | null {
  const apiKey = process.env.PRODIGI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.PRODIGI_API_BASE ?? SANDBOX_BASE;
  return { apiKey, baseUrl };
}

/** Whether the Prodigi API key is present (no network call). */
export function isProdigiConfigured(): boolean {
  return Boolean(process.env.PRODIGI_API_KEY);
}

/**
 * Authenticated fetch against the Prodigi API (attaches X-API-Key + base URL).
 * Throws when unconfigured. Callers own request/response shapes — see the
 * vendored reference in docs/integrations/prodigi/.
 */
export async function prodigiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = getProdigiConfig();
  if (!cfg) throw new Error("prodigi_not_configured");
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", cfg.apiKey);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${cfg.baseUrl}${path}`, { ...init, headers });
}
