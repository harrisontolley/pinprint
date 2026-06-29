"use client";

import { AdvancedPanel } from "@/components/studio/AdvancedPanel";

/**
 * Make-it-yours step — colour and type lead; finer controls (compass, text,
 * what-to-show, advanced) tuck into collapsed sections so the first glance stays
 * calm. AdvancedPanel is fully self-contained and store-driven. The defaults
 * already suit the chosen look, so this step is quick to pass through but always
 * on the path.
 */
export function StepCustomize() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-body">
        Start with a colour and a typeface — the defaults already suit your look,
        so tweak anything you like, or carry straight on.
      </p>
      <AdvancedPanel />
    </div>
  );
}
