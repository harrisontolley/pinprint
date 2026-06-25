import { describe, expect, it } from "vitest";
import { formatDate, formatPrice } from "./format";

describe("formatPrice", () => {
  it("renders cents as a currency amount", () => {
    expect(formatPrice(3900)).toContain("39");
    expect(formatPrice(4900, "usd")).toContain("49");
    expect(formatPrice(0)).toContain("0");
  });
});

describe("formatDate", () => {
  it("renders a human date including the year", () => {
    expect(formatDate("2026-06-05T10:00:00.000Z")).toMatch(/2026/);
  });
});
