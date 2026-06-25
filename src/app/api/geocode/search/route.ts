import { geocodeSearch } from "@/lib/server/nominatim";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);
  try {
    const results = await geocodeSearch(q);
    return Response.json(results, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return Response.json({ error: "geocode_failed" }, { status: 502 });
  }
}
