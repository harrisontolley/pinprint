import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FRAME_FINISHES, RoomMockup } from "./RoomMockup";
import { getTemplate } from "@/lib/templates/registry";
import type { FrameColor, FrameSelection } from "@/lib/commerce/price";
import type { Place } from "@/lib/types";

// Component-level check for the in-studio room mockup: the room photo renders,
// the live design is warped into it (its own <svg>), and the chosen frame finish
// drives the tint overlay. jsdom has no ResizeObserver, so we stub one that fires
// once with the room's aspect ratio — that's what flips the component from "not
// yet sized" to actually painting the warped plate + tint band. measureText has
// no canvas backing in jsdom, so layout falls back to the SSR estimate (see
// measure.ts) while still exercising the real Poster render path.

const HOME: Place = {
  id: "home",
  label: "Lisbon",
  fullName: "Lisbon, Portugal",
  lat: 38.7223,
  lng: -9.1393,
  affiliation: "lived",
};
const DISPLAY = { legend: true, distances: true, north: true, footer: true };

beforeEach(() => {
  class ResizeObserverStub {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe() {
      // Fire once with a room-shaped box so containedRect fills the container.
      this.cb(
        [{ contentRect: { width: 1203, height: 816 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  // No `globals: true` in vitest.config, so RTL's auto-cleanup never registers —
  // clean up explicitly or renders accumulate in document.body across tests.
  cleanup();
  vi.unstubAllGlobals();
});

function renderMockup(frame: FrameSelection) {
  return render(
    <RoomMockup
      home={HOME}
      items={[]}
      template={getTemplate("celestial")}
      units="km"
      width={1000}
      height={1500}
      title={null}
      subtitle={null}
      footer={null}
      display={DISPLAY}
      frame={frame}
    />,
  );
}

describe("RoomMockup", () => {
  it("renders the room photo", () => {
    const { getByRole } = renderMockup(null);
    const img = getByRole("img", { name: /framed on a wall/i });
    expect(img).toBeInTheDocument();
  });

  it("warps the live design in with its own id prefix so it never collides with the flat card", () => {
    const { container } = renderMockup({ material: "Oak", color: "NaturalOak" });
    const svg = container.querySelector("svg.poster-svg");
    expect(svg).not.toBeNull();
    // The mockup poster owns a distinct <defs> id namespace ("mockup-…"), keeping
    // it clear of the flat card's default "pp-…" ids on the same page.
    const defsIds = Array.from(container.querySelectorAll("defs [id]")).map((el) => el.id);
    expect(defsIds.length).toBeGreaterThan(0);
    expect(defsIds.every((id) => id.startsWith("mockup"))).toBe(true);
  });

  it("draws no tint band for Natural Oak (the photographed frame shows through)", () => {
    const { queryByTestId } = renderMockup({ material: "Oak", color: "NaturalOak" });
    expect(queryByTestId("frame-tint")).toBeNull();
  });

  it("draws no tint band for a loose (unframed) print", () => {
    const { queryByTestId } = renderMockup(null);
    expect(queryByTestId("frame-tint")).toBeNull();
  });

  // Every non-natural finish (all 7 FRAME_FINISHES entries) must wire its
  // declared blend mode, fill, and opacity onto the tint band.
  it.each(Object.entries(FRAME_FINISHES))(
    "tints the %s finish with its declared blend and fill",
    (color, finish) => {
      const material = color.endsWith("Metal") ? ("Metal" as const) : ("Oak" as const);
      const { getByTestId } = renderMockup({ material, color: color as FrameColor });
      const tint = getByTestId("frame-tint");
      expect(tint.style.mixBlendMode).toBe(finish.blend);
      expect(tint.style.opacity).toBe(String(finish.opacity));
      // Solid fills round-trip exactly; gradient fills keep their color stops.
      if (finish.background.startsWith("linear-gradient")) {
        expect(tint.style.background).toContain("linear-gradient");
        for (const stop of finish.background.match(/rgb\([^)]+\)/g) ?? []) {
          expect(tint.style.background).toContain(stop);
        }
      } else {
        expect(tint.style.background).toBe(finish.background);
      }
    },
  );

  it("captions an unframed print so the photographed frame never reads as included", () => {
    const { getByText } = renderMockup(null);
    expect(
      getByText("Shown in a natural oak frame. Loose prints arrive unframed."),
    ).toBeInTheDocument();
  });

  it("drops the caption once a frame is chosen", () => {
    const { queryByText } = renderMockup({ material: "Oak", color: "NaturalOak" });
    expect(queryByText(/arrive unframed/i)).toBeNull();
  });
});
