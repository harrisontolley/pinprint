import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderTimeline } from "./OrderTimeline";

describe("OrderTimeline", () => {
  it("renders the newest event first (current status on top)", () => {
    render(
      <OrderTimeline
        entries={[
          { status: "paid", message: "Payment received", createdAt: "2026-06-01T10:00:00Z" },
          { status: "shipped", message: "Shipped", createdAt: "2026-06-03T10:00:00Z" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Shipped");
    expect(items[1]).toHaveTextContent("Payment received");
  });

  it("shows an empty state with no entries", () => {
    render(<OrderTimeline entries={[]} />);
    expect(screen.getByText(/no updates yet/i)).toBeInTheDocument();
  });
});
