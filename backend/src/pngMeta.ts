// Tiny dependency-free PNG header reader. Used by the fulfilment DPI guard to
// learn a print asset's pixel dimensions (server-rendered or the browser-canvas
// fallback) without pulling in an image library or downloading a 50 MB blob.
//
// A PNG is an 8-byte signature followed immediately by the IHDR chunk:
//   bytes 0–7   signature 89 50 4E 47 0D 0A 1A 0A
//   bytes 8–11  IHDR length (always 13)
//   bytes 12–15 chunk type "IHDR"
//   bytes 16–19 width  (big-endian uint32)
//   bytes 20–23 height (big-endian uint32)
// So 24 bytes is all we ever need.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = [0x49, 0x48, 0x44, 0x52];

/**
 * Read a PNG's pixel dimensions straight out of its IHDR chunk. Returns null for
 * anything that isn't a well-formed PNG header (garbage, truncated, other format).
 */
export function pngDimensions(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  for (let i = 0; i < 4; i++) if (bytes[12 + i] !== IHDR[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const w = view.getUint32(16, false);
  const h = view.getUint32(20, false);
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

/** Minimal shape of the fetch we need — injectable so tests don't hit the network. */
export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  body: ReadableStream<Uint8Array> | null;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

/**
 * Fetch just enough of a remote PNG to read its dimensions. Requests a Range of
 * the first 33 bytes; if the server honours it we get a tiny 206 body, and if it
 * ignores Range (200, full body) we still only read the first chunk off the
 * stream and cancel — so we never buffer a multi-MB poster to measure it.
 * Never throws; returns null on any error.
 */
export async function fetchPngDimensions(
  url: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<{ w: number; h: number } | null> {
  try {
    const res = await fetchImpl(url, { headers: { Range: "bytes=0-32" } });
    if (!res.ok) return null;

    // Prefer streaming the first chunk so a Range-ignoring server (200 + full
    // body) doesn't make us download the whole file.
    if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (total < 24) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            total += value.length;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      return pngDimensions(merged);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    return pngDimensions(buf);
  } catch {
    return null;
  }
}
