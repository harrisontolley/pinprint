import type { Place } from "@/lib/types";
import { AFFILIATIONS } from "@/lib/affiliations/registry";

/**
 * Maps a home + its places into the arc/point arrays react-globe.gl consumes,
 * mirroring how a Pinprint poster encodes home -> places. This is pure data:
 * no three.js, no React — so it imports cheaply and is unit-testable.
 *
 * Arc colors run from the home ink to each place's affiliation color; points
 * reuse the same palette (src/lib/affiliations/registry.ts) so the globe reads
 * like the poster legend.
 */

/** Color for the home marker and the start of every arc. */
export const HOME_COLOR = "#0c0a09";

/** One great-circle arc from home to a destination. */
export type GlobeArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** Two-stop gradient [home, destination] for react-globe.gl's arcColor. */
  color: [string, string];
  /** Tooltip text, e.g. "New York -> London". */
  label: string;
};

/** One city marker on the globe. */
export type GlobePoint = {
  lat: number;
  lng: number;
  color: string;
  /** Marker radius in globe-relative (angular) units. */
  size: number;
  label: string;
  isHome: boolean;
};

export type GlobeData = {
  arcs: GlobeArc[];
  points: GlobePoint[];
};

export function buildGlobeData(home: Place, places: Place[]): GlobeData {
  const arcs: GlobeArc[] = places.map((p) => ({
    startLat: home.lat,
    startLng: home.lng,
    endLat: p.lat,
    endLng: p.lng,
    color: [HOME_COLOR, AFFILIATIONS[p.affiliation].color],
    label: `${home.label} → ${p.label}`,
  }));

  const points: GlobePoint[] = [
    {
      lat: home.lat,
      lng: home.lng,
      color: HOME_COLOR,
      size: 0.5,
      label: home.label,
      isHome: true,
    },
    ...places.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      color: AFFILIATIONS[p.affiliation].color,
      size: 0.32,
      label: p.label,
      isHome: false,
    })),
  ];

  return { arcs, points };
}
