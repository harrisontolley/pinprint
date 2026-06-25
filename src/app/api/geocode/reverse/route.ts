import { geocodeReverse } from "@/lib/server/nominatim";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lon") ?? searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "bad_params" }, { status: 400 });
  }
  try {
    const result = await geocodeReverse(lat, lng);
    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return Response.json({ error: "geocode_failed" }, { status: 502 });
  }
}
