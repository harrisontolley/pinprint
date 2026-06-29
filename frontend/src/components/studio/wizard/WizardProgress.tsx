"use client";

import type { StepMeta } from "@/lib/studio/steps";

/**
 * The staged-flow progress indicator. On desktop it's a horizontal row of
 * numbered, labelled steps; on mobile it collapses to "Step N of M · {label}"
 * over a slim progress bar. Pure / props-driven. Steps up to `furthest` are
 * tappable to jump back; later steps are inert. `aria-current="step"` marks the
 * active one.
 */
export function WizardProgress({
  steps,
  current,
  furthest,
  onJump,
  className = "",
}: {
  steps: StepMeta[];
  current: number;
  /** Highest step index the user has reached — bounds which steps are tappable. */
  furthest: number;
  onJump: (index: number) => void;
  className?: string;
}) {
  const active = steps[current];

  return (
    <nav
      aria-label="Progress"
      className={`shrink-0 border-b border-hairline bg-canvas ${className}`}
    >
      {/* Mobile: tappable numbered steps + current label */}
      <div className="px-4 py-2.5 lg:hidden">
        <ol className="flex items-center">
          {steps.map((s, i) => {
            const isActive = i === current;
            const isDone = i < current;
            const reachable = i <= furthest;
            return (
              <li key={s.id} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  onClick={() => reachable && onJump(i)}
                  disabled={!reachable}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border text-xs font-semibold transition-colors disabled:cursor-default ${
                    isActive || isDone
                      ? "border-primary bg-primary text-on-primary"
                      : reachable
                        ? "border-hairline-strong text-body"
                        : "border-hairline-strong text-muted-soft"
                  } ${isActive ? "ring-2 ring-primary/20" : ""}`}
                >
                  {isDone ? "✓" : i + 1}
                </button>
                {i < steps.length - 1 && (
                  <span
                    className={`h-px flex-1 ${i < current ? "bg-primary" : "bg-hairline"}`}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-sm font-medium text-ink">{active.label}</p>
      </div>

      {/* Desktop: horizontal numbered steps */}
      <ol className="hidden items-center gap-1 px-4 py-3 lg:flex">
        {steps.map((s, i) => {
          const isActive = i === current;
          const isDone = i < current;
          const reachable = i <= furthest;
          return (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => reachable && onJump(i)}
                disabled={!reachable}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-2 rounded-pill px-2.5 py-1.5 text-sm transition-colors disabled:cursor-default ${
                  isActive
                    ? "text-ink"
                    : reachable
                      ? "text-body hover:bg-surface-strong"
                      : "text-muted-soft"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border text-[11px] font-semibold ${
                    isActive || isDone
                      ? "border-primary bg-primary text-on-primary"
                      : "border-hairline-strong text-muted"
                  }`}
                  aria-hidden
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span className={isActive ? "font-medium" : ""}>
                  {s.label}
                  {s.optional && (
                    <span className="ml-1 text-xs text-muted">· optional</span>
                  )}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className="h-px w-4 bg-hairline" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
