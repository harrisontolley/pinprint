import { auth } from "@/lib/auth/server";

// Neon Auth API surface: /api/auth/sign-in, /sign-up, /sign-out, /session, /token,
// /callback/google, … The handler proxies to the Neon Auth service and manages the
// session cookie. This is the one Next.js server route that talks to the auth DB;
// all order/account data still lives behind the Hono backend.
//
// When auth is unconfigured (no env) the routes 503 rather than 500, keeping
// hermetic builds green.

const handlers = auth?.handler();
const unconfigured = () =>
  new Response("auth not configured", { status: 503 });

export const GET = handlers?.GET ?? unconfigured;
export const POST = handlers?.POST ?? unconfigured;
