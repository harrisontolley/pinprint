"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { SEED_HOME, SEED_PLACES } from "@/lib/seed";
import { buildGlobeData, type GlobeArc, type GlobePoint } from "@/lib/globe/arcs";

/**
 * The actual react-globe.gl (three.js) scene. This is the ONLY module that pulls
 * three.js into a bundle, so it is always loaded via dynamic(ssr:false) from
 * GlobeDemo — never imported on the server. Sizing is driven by the parent
 * (the canvas needs explicit numeric width/height).
 *
 * The globe is drawn as vector country outlines (Natural Earth GeoJSON) on a
 * solid ocean sphere — sharp at any size and on-brand for a cartographic poster
 * product, rather than a photo texture that blurs as the globe grows.
 */

// Brand palette (globals.css @theme): neutral stone globe so the pastel orbs
// behind and the affiliation-colored arcs carry the color.
const OCEAN = "#d6d3d1"; // --color-hairline-strong
const LAND_FILL = "#ffffff"; // --color-surface-card
const LAND_SIDE = "rgba(120,113,108,0.18)"; // muted, faint extrusion edge
const BORDER = "#a8a29e"; // --color-muted-soft
const LABEL_INK = "#0c0a09"; // --color-ink

/** Natural Earth feature — only the fields we touch. */
type GeoFeature = { geometry: { type: string; coordinates: unknown } };

// A flat ">" chevron pointing toward +x (the direction of travel), built once
// and shared by every arrowhead; each arc clones it with its own color/transform.
function buildChevronGeometry(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0); // apex (tip)
  s.lineTo(-1, 0.8); // upper outer
  s.lineTo(-0.55, 0.8); // upper end cap
  s.lineTo(-0.2, 0); // inner notch — keeps it an open chevron, not a triangle
  s.lineTo(-0.55, -0.8); // lower end cap
  s.lineTo(-1, -0.8); // lower outer
  s.lineTo(0, 0);
  return new ShapeGeometry(s);
}
const CHEVRON_GEOMETRY = buildChevronGeometry();
const CHEVRON_SCALE = 0.075; // fraction of the globe radius
const CHEVRON_ALT = 1.03; // radius multiplier — sits just above the surface

type Props = {
  width: number;
  height: number;
  reduceMotion: boolean;
};

export default function GlobeScene({ width, height, reduceMotion }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const { arcs, points } = useMemo(
    () => buildGlobeData(SEED_HOME, SEED_PLACES),
    [],
  );

  // Solid ocean sphere; country polygons sit just above it.
  const globeMaterial = useMemo(
    () => new MeshPhongMaterial({ color: OCEAN, shininess: 6 }),
    [],
  );

  // Country outlines, fetched client-side (kept out of the initial chunk).
  const [countries, setCountries] = useState<object[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/globe/countries-110m.geojson")
      .then((r) => r.json())
      .then((geo) => {
        if (alive) setCountries(geo.features ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Lock interaction to a gentle spin + drag, and frame the Atlantic so home
  // (New York) and most destinations sit in view from the first paint.
  function handleReady() {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.45;
    g.pointOfView({ lat: 26, lng: -48, altitude: 1.9 }, 0);
    // Build the chevron layer now that getGlobeRadius()/getCoords() are valid.
    setReady(true);
  }

  // Keep auto-rotation in sync if the user's reduced-motion preference changes.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = !reduceMotion;
  }, [reduceMotion]);

  // Chevron arrowheads as a custom three.js layer: one flat chevron at each
  // arc's destination, oriented along the great-circle bearing (direction of
  // travel) so it reads as an arrow arriving at the city.
  const makeChevron = (d: object) => {
    const a = d as GlobeArc;
    return new Mesh(
      CHEVRON_GEOMETRY,
      new MeshBasicMaterial({ color: a.color[1], side: DoubleSide }),
    );
  };

  const placeChevron = (obj: object, d: object) => {
    const g = globeRef.current;
    if (!g) return;
    const a = d as GlobeArc;
    const mesh = obj as Mesh;
    const R = g.getGlobeRadius();
    const ec = g.getCoords(a.endLat, a.endLng, 0);
    const sc = g.getCoords(a.startLat, a.startLng, 0);
    const end = new Vector3(ec.x, ec.y, ec.z).normalize();
    const start = new Vector3(sc.x, sc.y, sc.z).normalize();
    // Tangent at the destination, pointing in the direction of travel.
    const planeN = new Vector3().crossVectors(start, end).normalize();
    const forward = new Vector3().crossVectors(planeN, end).normalize();
    const side = new Vector3().crossVectors(end, forward).normalize();
    mesh.quaternion.setFromRotationMatrix(
      new Matrix4().makeBasis(forward, side, end),
    );
    mesh.scale.setScalar(R * CHEVRON_SCALE);
    mesh.position.copy(end.multiplyScalar(R * CHEVRON_ALT));
  };

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl={null}
      globeMaterial={globeMaterial}
      showAtmosphere
      atmosphereColor="#cfcbc6"
      atmosphereAltitude={0.2}
      onGlobeReady={handleReady}
      // Country outlines.
      polygonsData={countries}
      polygonGeoJsonGeometry={(d: object) => (d as GeoFeature).geometry as never}
      polygonCapColor={() => LAND_FILL}
      polygonSideColor={() => LAND_SIDE}
      polygonStrokeColor={() => BORDER}
      polygonAltitude={0.012}
      polygonsTransitionDuration={0}
      // Arcs: home -> each place, gradient-colored home-ink -> affiliation.
      arcsData={arcs}
      arcStartLat={(d) => (d as GlobeArc).startLat}
      arcStartLng={(d) => (d as GlobeArc).startLng}
      arcEndLat={(d) => (d as GlobeArc).endLat}
      arcEndLng={(d) => (d as GlobeArc).endLng}
      arcColor={(d: object) => (d as GlobeArc).color}
      arcLabel={(d) => (d as GlobeArc).label}
      arcStroke={0.55}
      arcAltitudeAutoScale={0.35}
      arcDashLength={reduceMotion ? 1 : 0.5}
      arcDashGap={reduceMotion ? 0 : 0.22}
      arcDashAnimateTime={reduceMotion ? 0 : 2200}
      // City markers.
      pointsData={points}
      pointLat={(d) => (d as GlobePoint).lat}
      pointLng={(d) => (d as GlobePoint).lng}
      pointColor={(d) => (d as GlobePoint).color}
      pointRadius={(d) => ((d as GlobePoint).isHome ? 0.9 : 0.65)}
      pointAltitude={0.03}
      pointLabel={(d) => (d as GlobePoint).label}
      // City names.
      labelsData={points}
      labelLat={(d) => (d as GlobePoint).lat}
      labelLng={(d) => (d as GlobePoint).lng}
      labelText={(d) => (d as GlobePoint).label}
      labelColor={() => LABEL_INK}
      labelSize={(d) => ((d as GlobePoint).isHome ? 2 : 1.5)}
      labelDotRadius={0}
      labelAltitude={0.035}
      labelResolution={2}
      // Chevron arrowheads at each destination (built once the globe is ready).
      customLayerData={ready ? arcs : []}
      customThreeObject={makeChevron}
      customThreeObjectUpdate={placeChevron}
    />
  );
}
