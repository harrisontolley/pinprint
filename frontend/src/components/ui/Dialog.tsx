"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A small accessible modal. Portals to <body> so it escapes the studio's
 * overflow/stacking contexts. Traps Tab focus, restores focus to the trigger on
 * close, closes on Escape or backdrop click, and locks body scroll while open.
 * Entrance is intentionally un-animated, which also honours reduced-motion.
 * Compose freely, or use ConfirmDialog below for the common two-button case.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
}: {
  open: boolean;
  /** Called on Escape, backdrop click, or programmatic dismiss. */
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable control (the safe default action), else the panel.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const f = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (f.length === 0) return;
      const firstEl = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className="relative z-10 w-full max-w-sm rounded-xl border border-hairline bg-surface-card p-6 shadow-xl outline-none"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The common confirm/cancel modal. `cancel` is the safe default (rendered first,
 * focused on open). Pass `emphasis="cancel"` when the safe choice should be the
 * prominent ink button — e.g. nudging the buyer to stay rather than leave.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  emphasis = "confirm",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Which button gets the primary ink fill. */
  emphasis?: "confirm" | "cancel";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const confirmVariant = emphasis === "confirm" ? "primary" : "outline";
  const cancelVariant = emphasis === "cancel" ? "primary" : "outline";

  return (
    <Dialog open={open} onClose={onCancel} labelledBy={titleId} describedBy={bodyId}>
      <h2 id={titleId} className="font-display text-xl leading-tight text-ink">
        {title}
      </h2>
      <p id={bodyId} className="mt-2 text-sm leading-relaxed text-body">
        {body}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant={cancelVariant} size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
