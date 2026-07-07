"use client";

import { useState, type RefObject } from "react";
import { Poster } from "@/components/poster/Poster";
import { RoomMockup } from "@/components/studio/RoomMockup";
import type { LaidOut } from "@/lib/layout/types";
import type { TemplateSpec } from "@/lib/templates/types";
import type { DisplayOptions } from "@/lib/templates/customize";
import type { FrameSelection } from "@/lib/commerce/price";
import type { Place, Units } from "@/lib/types";

type MockupView = "flat" | "wall";

/**
 * The hero: the live poster hung on a quiet gallery wall — soft ivory backdrop,
 * a single deep shadow under the print, nothing competing with the artwork
 * (DESIGN.md). posterRef wraps the card so export can read the live <svg>.
 *
 * Once a size is being chosen (`mockupAvailable`, print only), a "Flat / On the
 * wall" toggle swaps the flat card for a RoomMockup that warps the same live
 * design into a framed room photo — closing the "will it look good on my wall"
 * doubt and previewing the frame upcharge. The flat card stays mounted (just
 * hidden) so export always reads its <svg>, and the mockup renders its own poster
 * with a distinct id prefix so the two SVGs never collide.
 */
export function PosterStage({
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
  posterRef,
  sample = false,
  mockupAvailable = false,
  frame = null,
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
  posterRef: RefObject<HTMLDivElement | null>;
  /** True while the preview is showing the built-in sample (no home set yet). */
  sample?: boolean;
  /** Offer the "On the wall" room mockup (print format, from the size step on). */
  mockupAvailable?: boolean;
  /** Chosen frame — drives which finish the room mockup renders. */
  frame?: FrameSelection;
  className?: string;
}) {
  const [view, setView] = useState<MockupView>("flat");
  // The stored view only takes effect while the mockup is on offer, so switching
  // to digital or stepping back before Size falls back to the flat card on its
  // own — no reset needed. Returning to a size step restores the chosen view.
  const onWall = mockupAvailable && view === "wall";

  return (
    <div
      className={`relative flex items-center justify-center bg-canvas-soft p-4 sm:p-6 lg:p-10 ${className}`}
    >
      {sample && (
        <span className="absolute left-4 top-4 z-20 rounded-pill bg-ink/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-primary backdrop-blur sm:left-6 sm:top-6 lg:left-10 lg:top-10">
          Example
        </span>
      )}

      {mockupAvailable && (
        <div
          role="group"
          aria-label="Preview view"
          className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 gap-0.5 rounded-pill border border-hairline bg-surface-card/90 p-0.5 shadow-sm backdrop-blur sm:top-6 lg:top-10"
        >
          {(["flat", "wall"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors pointer-coarse:px-3.5 pointer-coarse:py-1.5 ${
                view === v ? "bg-ink text-on-primary" : "text-muted hover:text-ink"
              }`}
            >
              {v === "flat" ? "Flat" : "On the wall"}
            </button>
          ))}
        </div>
      )}

      {/* Flat card. Kept mounted (hidden on the wall view) so export always reads
          its live <svg> via posterRef. */}
      <div
        ref={posterRef}
        className={`relative z-10 h-full max-h-full max-w-full overflow-hidden rounded-sm bg-surface-card shadow-2xl ${
          onWall ? "hidden" : ""
        }`}
        style={{ aspectRatio: `${width} / ${height}` }}
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
        />
      </div>

      {onWall && (
        <RoomMockup
          className="z-10 h-full w-full"
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
          frame={frame}
        />
      )}
    </div>
  );
}
