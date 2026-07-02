"use client";

import type { RefObject } from "react";
import { Poster } from "@/components/poster/Poster";
import type { LaidOut } from "@/lib/layout/types";
import type { TemplateSpec } from "@/lib/templates/types";
import type { DisplayOptions } from "@/lib/templates/customize";
import type { Place, Units } from "@/lib/types";

/**
 * The hero: the live poster hung on a quiet gallery wall — soft ivory backdrop,
 * a single deep shadow under the print, nothing competing with the artwork
 * (DESIGN.md). posterRef wraps the card so export can read the live <svg>.
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
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center bg-canvas-soft p-4 sm:p-6 lg:p-10 ${className}`}
    >
      {sample && (
        <span className="absolute left-4 top-4 z-20 rounded-pill bg-ink/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-on-primary backdrop-blur sm:left-6 sm:top-6 lg:left-10 lg:top-10">
          Example
        </span>
      )}
      <div
        ref={posterRef}
        className="relative z-10 h-full max-h-full max-w-full overflow-hidden rounded-sm bg-surface-card shadow-2xl"
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
    </div>
  );
}
