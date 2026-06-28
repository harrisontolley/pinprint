import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blobPathnameFromUrl, signAssetUrl } from "./blob.js";

// Hermetic: only the pass-through branches of signAssetUrl are exercised (the
// signing path needs a live blob token + network). The key guarantees are that it
// never throws and degrades to the original URL when it can't/shouldn't sign.

describe("blobPathnameFromUrl", () => {
  it("extracts the store-relative pathname", () => {
    expect(blobPathnameFromUrl("https://x.blob.vercel-storage.com/posters/a-uuid.png")).toBe(
      "posters/a-uuid.png",
    );
  });
  it("returns null for the root or an unparseable URL", () => {
    expect(blobPathnameFromUrl("https://x.blob.vercel-storage.com/")).toBeNull();
    expect(blobPathnameFromUrl("not a url")).toBeNull();
  });
});

describe("signAssetUrl", () => {
  const prev = process.env.BLOB_READ_WRITE_TOKEN;
  beforeEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prev;
  });

  it("passes the URL through unchanged when blob is unconfigured", async () => {
    const url = "https://x.blob.vercel-storage.com/posters/a.png";
    expect(await signAssetUrl(url)).toBe(url);
  });

  it("never signs a legacy public blob (even when configured)", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    const url = "https://x.public.blob.vercel-storage.com/posters/a.png";
    expect(await signAssetUrl(url)).toBe(url);
  });

  it("passes through an unparseable URL", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
    expect(await signAssetUrl("not a url")).toBe("not a url");
  });
});
