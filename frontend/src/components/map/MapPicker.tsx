"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { usePosterStore } from "@/lib/store/posterStore";
import { apiUrl } from "@/lib/api";
import { AFFILIATIONS } from "@/lib/affiliations";
import type { GeoResult } from "@/lib/types";

// Vector basemap style. Defaults to OpenFreeMap's keyless "positron" (light,
// CARTO-like). Override with a MapTiler/other style URL via env to add an SLA.
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/positron";

/** A small round pin element, mirroring the old Leaflet divIcon. */
function dotEl(color: string, ring: string, title: string): HTMLElement {
  const el = document.createElement("span");
  el.title = title;
  el.style.cssText =
    `display:block;width:16px;height:16px;border-radius:9999px;` +
    `background:${color};border:2px solid #fff;box-shadow:0 0 0 1.5px ${ring}`;
  return el;
}

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const fallback: GeoResult = {
    id: `${lat},${lng}`,
    label: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    fullName: "Dropped pin",
    lat,
    lng,
  };
  try {
    const res = await fetch(apiUrl(`/geocode/reverse?lat=${lat}&lon=${lng}`));
    const r = res.ok ? ((await res.json()) as GeoResult | null) : null;
    return r && r.label ? r : fallback;
  } catch {
    return fallback;
  }
}

export default function MapPicker() {
  const home = usePosterStore((s) => s.home);
  const places = usePosterStore((s) => s.places);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Create the map once. Click drops a pin → reverse-geocode → addFromGeo.
  // We read the store imperatively in the handler to avoid stale closures.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = usePosterStore.getState().home;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: start ? [start.lng, start.lat] : [0, 20],
      zoom: start ? 4 : 1.4,
      attributionControl: { compact: true },
    });
    map.on("click", async (e) => {
      const r = await reverseGeocode(e.lngLat.lat, e.lngLat.lng);
      usePosterStore.getState().addFromGeo(r);
    });
    mapRef.current = map;

    // maplibre sizes to its container at init; re-measure if the layout settles
    // after mount (flex/dynamic-import can leave it briefly mis-sized).
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // Sync markers + viewport whenever home/places change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const pts: [number, number][] = [];
      if (home) {
        markersRef.current.push(
          new maplibregl.Marker({
            element: dotEl("#0c0a09", "rgba(0,0,0,.4)", `${home.label} · home`),
            anchor: "center",
          })
            .setLngLat([home.lng, home.lat])
            .addTo(map),
        );
        pts.push([home.lng, home.lat]);
      }
      for (const p of places) {
        markersRef.current.push(
          new maplibregl.Marker({
            element: dotEl(AFFILIATIONS[p.affiliation].color, "rgba(0,0,0,.2)", p.label),
            anchor: "center",
          })
            .setLngLat([p.lng, p.lat])
            .addTo(map),
        );
        pts.push([p.lng, p.lat]);
      }

      if (pts.length === 1) {
        map.easeTo({ center: pts[0], zoom: Math.max(map.getZoom(), 4) });
      } else if (pts.length > 1) {
        const b = pts.reduce(
          (acc, pt) => acc.extend(pt),
          new maplibregl.LngLatBounds(pts[0], pts[0]),
        );
        map.fitBounds(b, { padding: 28, maxZoom: 6 });
      }
    };

    // Markers can only be added once the style is loaded.
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [home, places]);

  return <div ref={containerRef} className="isolate h-full w-full" style={{ background: "#e9e9ea" }} />;
}
