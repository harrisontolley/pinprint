import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
} from "jose";
import { app } from "./app.js";
import {
  __setAuthKeyResolverForTests,
  type AuthVariables,
  requireUser,
} from "./auth.js";

// Hermetic: no Neon Auth keys. The unconfigured path is tested against the real
// app; the valid-token path uses a locally-generated EdDSA keypair injected as the
// JWKS resolver, so no network is touched and no real Neon key is needed.

const KID = "test-key";

async function makeSigner() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const jwk: JWK = { ...(await exportJWK(publicKey)), alg: "EdDSA", kid: KID };
  const resolver = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, sub: string) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "EdDSA", kid: KID })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  return { resolver, sign };
}

beforeEach(() => {
  __setAuthKeyResolverForTests(null);
});
afterEach(() => {
  __setAuthKeyResolverForTests(null);
});

describe("auth — unconfigured", () => {
  for (const base of ["", "/_/backend"]) {
    it(`401 auth_unconfigured on a protected route (${base || "/"})`, async () => {
      const res = await app.request(`${base}/account/orders`);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "auth_unconfigured" });
    });
  }
});

describe("requireUser middleware", () => {
  function testApp() {
    const r = new Hono<{ Variables: AuthVariables }>();
    r.use("*", requireUser);
    r.get("/me", (c) => c.json(c.get("user")));
    return r;
  }

  it("401 when configured but no token", async () => {
    const { resolver } = await makeSigner();
    __setAuthKeyResolverForTests(resolver);
    const res = await testApp().request("/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401 on a garbage bearer token", async () => {
    const { resolver } = await makeSigner();
    __setAuthKeyResolverForTests(resolver);
    const res = await testApp().request("/me", {
      headers: { authorization: "Bearer not.a.jwt" },
    });
    expect(res.status).toBe(401);
  });

  it("200 + extracts userId/email from a valid token", async () => {
    const { resolver, sign } = await makeSigner();
    __setAuthKeyResolverForTests(resolver);
    const token = await sign({ email: "u@example.com" }, "user-123");
    const res = await testApp().request("/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user-123", email: "u@example.com" });
  });

  it("401 on a token signed by a different key", async () => {
    const a = await makeSigner();
    const b = await makeSigner();
    __setAuthKeyResolverForTests(a.resolver); // trust A's keys
    const token = await b.sign({ email: "x@example.com" }, "user-x"); // signed by B
    const res = await testApp().request("/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });
});
