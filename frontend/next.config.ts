import type { NextConfig } from "next";

// Geocoding lives in the backend service. The client calls it directly via
// NEXT_PUBLIC_BACKEND_URL (see src/lib/api.ts): in production Vercel injects the
// relative route prefix "/_/backend" (same origin, no CORS); in local dev it's
// the backend dev server.
//
// PostHog reverse proxy: analytics is sent to /ingest (same origin) so ad blockers
// don't drop it, then rewritten to PostHog. See docs/integrations/posthog.md.
const POSTHOG_UPSTREAM =
  process.env.NEXT_PUBLIC_POSTHOG_UPSTREAM ?? "https://us.i.posthog.com";
const POSTHOG_ASSETS = POSTHOG_UPSTREAM.replace(".i.posthog.com", "-assets.i.posthog.com");

const nextConfig: NextConfig = {
  transpilePackages: ["@pinprint/shared"],
  // PostHog sends a trailing-slash-sensitive request to /ingest/decide.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: `${POSTHOG_ASSETS}/static/:path*` },
      { source: "/ingest/:path*", destination: `${POSTHOG_UPSTREAM}/:path*` },
    ];
  },
};

export default nextConfig;
