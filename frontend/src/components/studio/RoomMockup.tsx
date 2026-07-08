"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Poster } from "@/components/poster/Poster";
import { quadToMatrix3d, type Quad } from "@/lib/mockup/perspective";
import type { LaidOut } from "@/lib/layout/types";
import type { TemplateSpec } from "@/lib/templates/types";
import type { DisplayOptions } from "@/lib/templates/customize";
import type { Place, Units } from "@/lib/types";
import type { FrameColor, FrameSelection } from "@/lib/commerce/price";

// The same moody-green lounge photo the landing page uses (LandingPoster): a
// natural-oak frame over a deep green wall, warm brass lamp lower-right. The live
// studio design is warped into the frame's print area so the buyer sees their own
// piece on a real wall. One photo drives all eight frame finishes (see below).
const ROOM_SRC = "/showcase/room-lounge.png";
const ROOM_W = 1203;
const ROOM_H = 816;
const ROOM_AR = ROOM_W / ROOM_H;

// Inner print area (the black rectangle inside the oak frame), as fractions of
// the room image in [TL, TR, BR, BL] order — the exact quad LandingPoster warps
// the poster onto. The photo is shot straight-on, so it's axis-aligned.
const PRINT_QUAD: Quad = [
  [0.3516, 0.0748],
  [0.6492, 0.0748],
  [0.6492, 0.7316],
  [0.3516, 0.7316],
];

// Outer edge of the photographed oak frame, measured from the same photo by
// scanning outward from the print area until the pixels hit the wall. The tint
// band spans this whole rectangle; the print plate (drawn on top) masks its
// centre, so only the frame ring — the part sitting over the real oak — shows.
const FRAME_QUAD: Quad = [
  [0.34, 0.0551],
  [0.66, 0.0551],
  [0.66, 0.7488],
  [0.34, 0.7488],
];

export type FinishStyle = {
  /** How the tint combines with the photographed oak underneath. */
  blend: "multiply" | "screen" | "normal";
  opacity: number;
  /** CSS background: a solid tint or a vertical gradient for metallic sheen. */
  background: string;
};

// Per-finish recolour of the one photographed natural-oak frame. Dark woods
// MULTIPLY (deepening the oak while keeping its grain and the room's real
// top-edge shadow); pale/painted finishes lay a near-opaque NORMAL coat that
// desaturates the warm wood while a little of its lighting still bleeds through;
// gold SCREENS over the already-warm oak for a polished sheen. Metals carry a
// top→bottom gradient so they read reflective, not flat. Natural Oak is the photo
// itself — no entry here, no overlay. Every value was calibrated by compositing
// the candidate over the real room pixels; the rgb()s are the fill, not the
// visible result.
export const FRAME_FINISHES: Partial<Record<FrameColor, FinishStyle>> = {
  BlackOak: { blend: "multiply", opacity: 1, background: "rgb(60, 72, 96)" },
  WalnutOak: { blend: "multiply", opacity: 1, background: "rgb(120, 101, 92)" },
  WhiteOak: { blend: "normal", opacity: 0.82, background: "rgb(200, 190, 179)" },
  BlackMetal: {
    blend: "multiply",
    opacity: 1,
    background: "linear-gradient(to bottom, rgb(96, 100, 118), rgb(46, 49, 60))",
  },
  WhiteMetal: {
    blend: "normal",
    opacity: 0.9,
    background: "linear-gradient(to bottom, rgb(236, 235, 233), rgb(224, 223, 221))",
  },
  SilverMetal: {
    blend: "normal",
    opacity: 0.9,
    background: "linear-gradient(to bottom, rgb(210, 212, 216), rgb(150, 152, 158))",
  },
  GoldMetal: {
    blend: "screen",
    opacity: 0.95,
    background: "linear-gradient(to bottom, rgb(150, 120, 55), rgb(110, 85, 38))",
  },
};

type Rect = { x: number; y: number; width: number; height: number };

/**
 * The object-contain rect of the room image inside a `w`×`h` box (letterboxed to
 * the room's aspect ratio). Keeps the mockup fully visible at any container
 * shape — the cramped mobile stage (38dvh) or the tall desktop pane — with the
 * warped overlays aligned to the image wherever it lands.
 */
function containedRect(w: number, h: number): Rect {
  if (w <= 0 || h <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  if (w / h > ROOM_AR) {
    const width = h * ROOM_AR;
    return { x: (w - width) / 2, y: 0, width, height: h };
  }
  const height = w / ROOM_AR;
  return { x: 0, y: (h - height) / 2, width: w, height };
}

/** Map a fractional quad to pixel corners inside the contained image rect. */
function cornersInRect(quad: Quad, r: Rect): Quad {
  return quad.map(([fx, fy]) => [r.x + fx * r.width, r.y + fy * r.height]) as Quad;
}

/**
 * The live studio design shown framed on a real wall — a studio-side fork of
 * LandingPoster. The measured `items` are passed straight through (same 2:3
 * viewBox), so there's no second layout pass; the poster SVG is warped (CSS
 * matrix3d homography) into the framed print, and the chosen frame colour
 * recolours the photographed oak in place.
 */
export function RoomMockup({
  home,
  items,
  template,
  units,
  width,
  height,
  title,
  subtitle,
  footer,
  display,
  frame,
  className = "",
}: {
  home: Place | null;
  items: LaidOut[];
  template: TemplateSpec;
  units: Units;
  width: number;
  height: number;
  title: string | null;
  subtitle: string | null;
  footer: string | null;
  display: DisplayOptions;
  frame: FrameSelection;
  className?: string;
}) {
  // Track the container's pixel size so the print-area fractions map to pixels
  // for the homography (mirrors LandingPoster's ResizeObserver).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rc = entries[0]?.contentRect;
      if (rc) setSize({ width: rc.width, height: rc.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect = useMemo(() => containedRect(size.width, size.height), [size]);

  // matrix3d mapping the poster's native viewBox onto the framed print quad.
  const posterTransform = useMemo(() => {
    if (rect.width <= 0) return undefined;
    return quadToMatrix3d(cornersInRect(PRINT_QUAD, rect), width, height);
  }, [rect, width, height]);

  // matrix3d + source size for the tint band over the outer oak-frame rectangle.
  const band = useMemo(() => {
    if (rect.width <= 0) return undefined;
    const w = (FRAME_QUAD[1][0] - FRAME_QUAD[0][0]) * rect.width;
    const h = (FRAME_QUAD[2][1] - FRAME_QUAD[0][1]) * rect.height;
    return { w, h, transform: quadToMatrix3d(cornersInRect(FRAME_QUAD, rect), w, h) };
  }, [rect]);

  const finish = frame ? FRAME_FINISHES[frame.color] : undefined;
  const ready = posterTransform != null;

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className}`}>
      {/* The scene as one labelled image (mirroring the flat poster's role=img
          label, which leaves the a11y tree while the wall view hides that card).
          The caption below sits OUTSIDE this wrapper so it stays readable —
          descendants of role=img are presentational. */}
      <div
        role="img"
        aria-label={
          home
            ? `Map of places radiating from ${home.label}, framed on a wall above a leather armchair and a brass lamp`
            : "Your design framed on a wall above a leather armchair and a brass lamp"
        }
        className="absolute inset-0"
      >
        <Image
          src={ROOM_SRC}
          alt=""
          width={ROOM_W}
          height={ROOM_H}
          className="absolute inset-0 h-full w-full object-contain"
          sizes="(min-width: 1024px) 640px, 90vw"
        />

        {ready && finish && band && (
          // Tint band over the photographed oak. It fills the whole outer frame
          // rectangle; the opaque print plate below masks its centre, so only the
          // frame ring shows. Deliberately NOT isolated — it blends with the room
          // image behind it, carrying the wood's grain and the room's lighting
          // through the recolour.
          <div
            data-testid="frame-tint"
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: band.w,
              height: band.h,
              transform: band.transform,
              background: finish.background,
              mixBlendMode: finish.blend,
              opacity: finish.opacity,
            }}
            aria-hidden
          />
        )}

        {ready && (
          // One warped "plate" (shares the matrix3d), isolated so the blend-mode
          // shading layers below tint ONLY the graphic, not the room behind it.
          // The stack bakes the room's real lighting onto the live print (warm
          // paper tone + vignette, then a brass-lamp glow) so it reads
          // printed-and-framed rather than pasted on — calibrated against this
          // same room in LandingPoster.
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width,
              height,
              transform: posterTransform,
              isolation: "isolate",
              boxShadow:
                "inset 0 0 26px 7px rgba(22,16,10,0.17), 0 0 0 1px rgba(12,10,9,0.07)",
            }}
            aria-hidden
          >
            <Poster
              home={home}
              items={items}
              template={template}
              units={units}
              width={width}
              height={height}
              title={title}
              subtitle={subtitle}
              footer={footer}
              display={display}
              idPrefix="mockup"
            />

            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{
                backgroundImage:
                  "radial-gradient(125% 120% at 62% 62%, rgba(255,255,255,0) 50%, rgba(52,46,38,0.3) 100%), linear-gradient(#efe9dc, #efe9dc)",
              }}
            />
            <div
              className="absolute inset-0 mix-blend-screen"
              style={{
                backgroundImage:
                  "linear-gradient(305deg, rgba(255,196,120,0.18) 0%, rgba(255,214,150,0.06) 26%, rgba(255,255,255,0) 50%)",
              }}
            />
          </div>
        )}
      </div>

      {/* Honesty note: the photo's frame is part of the scene, so a buyer who
          hasn't added a frame must never read it as included. Anchored to the
          contained photo's bottom edge so it stays on the picture at any
          container shape. */}
      {ready && frame === null && (
        <p
          className="absolute z-10 flex justify-center"
          style={{
            left: rect.x,
            width: rect.width,
            top: rect.y + rect.height - 34,
          }}
        >
          <span className="rounded-pill bg-ink/75 px-3 py-1 text-[11px] font-medium text-on-primary backdrop-blur">
            Shown in a natural oak frame. Loose prints arrive unframed.
          </span>
        </p>
      )}
    </div>
  );
}
