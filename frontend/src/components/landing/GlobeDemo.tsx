"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Section } from "./Section";
import { SectionLabel } from "./SectionLabel";
import { copy } from "./copy";

// react-globe.gl pulls in three.js and touches the DOM at import, so it must be
// client-only. dynamic(ssr:false) splits it into its own chunk; the in-view gate
// below means that chunk isn't fetched until the section nears the viewport.
const GlobeScene = dynamic(() => import("./GlobeScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-full bg-surface-strong/40" />
  ),
});

/**
 * Landing-page centerpiece: a rotating 3D globe drawing great-circle arcs from
 * home to each place, mirroring how a poster encodes home -> places. It's the
 * one intentional exception to DESIGN.md's "no animation" rule, kept contained:
 * below the fold, lazily mounted, and fully static under prefers-reduced-motion.
 */
export function GlobeDemo() {
  const { globe } = copy;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [inView, setInView] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Mount the globe only when the section nears the viewport (protects LCP and
  // defers the three.js chunk fetch). One-shot.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Feed the wrapper's pixel size to the canvas (react-globe.gl needs numbers).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) {
        setSize({ width: Math.round(r.width), height: Math.round(r.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Honor prefers-reduced-motion, and react to live changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const ready = inView && size.width > 0 && size.height > 0;

  return (
    <Section id="globe" orbs="preview">
      <div className="flex flex-col items-start gap-4">
        <SectionLabel>{globe.eyebrow}</SectionLabel>
        <h2 className="font-display text-[clamp(1.75rem,4vw,36px)] font-normal leading-[1.17] tracking-[-0.36px] text-ink">
          {globe.headline}
        </h2>
        <p className="max-w-[52ch] text-[16px] leading-[1.5] tracking-[0.16px] text-body">
          {globe.body}
        </p>
      </div>

      <div className="mt-10 flex justify-center">
        {/* Square box reserves height so the late mount causes no layout shift. */}
        <div
          ref={wrapRef}
          className="relative aspect-square w-full max-w-[760px]"
          aria-hidden
        >
          {ready && (
            <GlobeScene
              width={size.width}
              height={size.height}
              reduceMotion={reduceMotion}
            />
          )}
        </div>
      </div>
    </Section>
  );
}
