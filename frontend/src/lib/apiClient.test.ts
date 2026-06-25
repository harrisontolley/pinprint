import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the auth client so the test doesn't pull in the full Neon Auth lib and we
// can control the token. apiClient reads getJWTToken() to attach the Bearer header.
vi.mock("@/lib/auth/client", () => ({
  authClient: { getJWTToken: vi.fn() },
}));

import { authClient } from "@/lib/auth/client";
import { apiFetch } from "./apiClient";

const getToken = authClient as unknown as { getJWTToken: ReturnType<typeof vi.fn> };

function lastInit(spy: ReturnType<typeof vi.spyOn>): RequestInit | undefined {
  return spy.mock.calls[0]?.[1] as RequestInit | undefined;
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches the Bearer token when signed in", async () => {
    getToken.getJWTToken.mockResolvedValue("tok123");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await apiFetch("/account/orders");
    const headers = new Headers(lastInit(spy)?.headers);
    expect(headers.get("authorization")).toBe("Bearer tok123");
  });

  it("omits Authorization when signed out", async () => {
    getToken.getJWTToken.mockResolvedValue(null);
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await apiFetch("/account/orders");
    const headers = new Headers(lastInit(spy)?.headers);
    expect(headers.get("authorization")).toBeNull();
  });
});
