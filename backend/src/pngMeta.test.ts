import { describe, expect, it, vi } from "vitest";
import { fetchPngDimensions, pngDimensions, type FetchLike } from "./pngMeta.js";

// Build a valid 24-byte PNG header for a given width/height.
function pngHeader(w: number, h: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR length 13
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(bytes.buffer).setUint32(16, w, false);
  new DataView(bytes.buffer).setUint32(20, h, false);
  return bytes;
}

function streamResponse(bytes: Uint8Array, opts: { ok?: boolean; status?: number } = {}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 206,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    arrayBuffer: async () => bytes.buffer,
  };
}

describe("pngDimensions", () => {
  it("reads width/height from a valid IHDR", () => {
    expect(pngDimensions(pngHeader(7200, 10800))).toEqual({ w: 7200, h: 10800 });
  });

  it("returns null for garbage", () => {
    expect(pngDimensions(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(pngDimensions(new Uint8Array(24))).toBeNull(); // right length, wrong signature
  });

  it("returns null when the signature is valid but IHDR is missing", () => {
    const bytes = pngHeader(100, 100);
    bytes[12] = 0x00; // corrupt "IHDR"
    expect(pngDimensions(bytes)).toBeNull();
  });

  it("ignores trailing bytes past the header", () => {
    const header = pngHeader(3600, 5400);
    const padded = new Uint8Array(200);
    padded.set(header, 0);
    expect(pngDimensions(padded)).toEqual({ w: 3600, h: 5400 });
  });
});

describe("fetchPngDimensions", () => {
  it("reads dims from a 206 range response", async () => {
    const fetchImpl = vi.fn(async () => streamResponse(pngHeader(7200, 10800))) as unknown as FetchLike;
    expect(await fetchPngDimensions("https://blob/x.png", fetchImpl)).toEqual({ w: 7200, h: 10800 });
  });

  it("requests only the header range", async () => {
    const fetchImpl = vi.fn(async () => streamResponse(pngHeader(100, 100)));
    await fetchPngDimensions("https://blob/x.png", fetchImpl as unknown as FetchLike);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://blob/x.png",
      expect.objectContaining({ headers: { Range: "bytes=0-32" } }),
    );
  });

  it("still works when the server ignores Range (200 + full body, read first chunk only)", async () => {
    // A large body delivered in one chunk; we only need the first 24 bytes.
    const big = new Uint8Array(5_000_000);
    big.set(pngHeader(4667, 7000), 0);
    const fetchImpl = vi.fn(async () => streamResponse(big, { status: 200 }));
    expect(await fetchPngDimensions("https://blob/x.png", fetchImpl as unknown as FetchLike)).toEqual({
      w: 4667,
      h: 7000,
    });
  });

  it("returns null on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => streamResponse(new Uint8Array(0), { ok: false, status: 404 }));
    expect(await fetchPngDimensions("https://blob/x.png", fetchImpl as unknown as FetchLike)).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await fetchPngDimensions("https://blob/x.png", fetchImpl as unknown as FetchLike)).toBeNull();
  });
});
