import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { RoomMockup } from "./RoomMockup";
import { getTemplate } from "@/lib/templates/registry";
import type { FrameSelection } from "@/lib/commerce/price";
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

  it("tints the frame per finish, and a different finish paints a different overlay", () => {
    const black = renderMockup({ material: "Oak", color: "BlackOak" });
    const blackTint = black.getByTestId("frame-tint");
    expect(blackTint).toBeInTheDocument();
    expect(blackTint.style.mixBlendMode).toBe("multiply");
    const blackBg = blackTint.style.background;
    black.unmount();

    const gold = renderMockup({ material: "Metal", color: "GoldMetal" });
    const goldTint = gold.getByTestId("frame-tint");
    expect(goldTint.style.mixBlendMode).toBe("screen");
    // A metal finish carries a gradient sheen; the two finishes differ visibly.
    expect(goldTint.style.background).not.toBe(blackBg);
    expect(goldTint.style.background).toContain("gradient");
  });
});
