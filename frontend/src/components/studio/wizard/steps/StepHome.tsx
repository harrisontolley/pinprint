"use client";

import dynamic from "next/dynamic";
import { usePosterStore } from "@/lib/store/posterStore";
import { PlaceSearch } from "@/components/controls/PlaceSearch";
import { NameField } from "@/components/controls/PlaceList";
import type { GeoResult } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/map/MapPicker"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-strong" />,
});

/**
 * Step 2 — the one question that anchors everything: where's home? The first
 * place added becomes home (addFromGeo). Search-first, with a click-to-drop map
 * shown only until home is set. Once it's set we confirm it and point the user on
 * to the places step.
 */
export function StepHome() {
  const home = usePosterStore((s) => s.home);
  const setHome = usePosterStore((s) => s.setHome);
  const addFromGeo = usePosterStore((s) => s.addFromGeo);

  function handleSelect(r: GeoResult) {
    addFromGeo(r); // no home yet → this becomes home
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-body">
          Start with your home — the place at the centre of your map. Everywhere
          else points back to it.
        </p>
        <PlaceSearch onSelect={handleSelect} placeholder="Search your home town…" />
      </div>

      {home ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-hairline-strong bg-surface-strong/50 p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 rounded-pill bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-primary">
                Home
              </span>
              <NameField
                value={home.label}
                onChange={(v) => setHome({ ...home, label: v })}
                ariaLabel="Home label"
              />
            </div>
            <p className="mt-1 truncate pl-1 text-xs text-muted">{home.fullName}</p>
            <p className="mt-2 text-xs text-muted">
              That&rsquo;s your centre — continue to add the places that matter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHome(null)}
            className="shrink-0 text-xs text-muted-soft transition-colors hover:text-error"
            title="Change home"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">
            Tip: this is usually where you live now. You can rename it afterwards.
          </p>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Or drop a pin
            </p>
            <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
              <div className="h-56 w-full">
                <MapPicker />
              </div>
              <p className="bg-surface-strong px-2.5 py-1.5 text-[11px] text-muted">
                Click the map to set your home · © OpenStreetMap · © OpenFreeMap
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
