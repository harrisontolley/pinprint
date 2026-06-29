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
 * The differentiator band: a "measured globe" that proves Pinprint computes the
 * exact bearing + great-circle distance from home to each place (the same numbers
 * it prints). Two columns on desktop — message left, globe right. The globe
 * settles into a composed frame on reveal then holds still so the readouts are
 * legible; it's lazily mounted and fully static under prefers-reduced-motion.
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
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
        {/* Left: the differentiation, in words. */}
        <div className="flex flex-col items-start gap-4">
          <SectionLabel>{globe.eyebrow}</SectionLabel>
          <h2 className="font-display text-[clamp(1.75rem,4vw,36px)] font-normal leading-[1.17] tracking-[-0.36px] text-ink">
            {globe.headline}
          </h2>
          <p className="max-w-[52ch] text-[16px] leading-[1.5] tracking-[0.16px] text-body">
            {globe.body}
          </p>
          <p className="text-[13px] leading-[1.5] text-muted">{globe.caption}</p>
        </div>

        {/* Right: the measured globe. Square box reserves height so the late
            mount causes no layout shift. */}
        <div className="flex justify-center md:justify-end">
          <div
            ref={wrapRef}
            className="relative aspect-square w-full max-w-[560px]"
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
      </div>
    </Section>
  );
}
