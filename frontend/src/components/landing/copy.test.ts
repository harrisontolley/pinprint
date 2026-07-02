import { describe, expect, it } from "vitest";
import { copy } from "./copy";

// Brand voice guard (DESIGN.md): chrome copy never uses em/en dashes, emoji,
// or exclamation marks. Serialising the whole object catches every string,
// including ones added later.
describe("landing copy voice rules", () => {
  const all = JSON.stringify(copy);

  it("contains no em or en dashes", () => {
    expect(all).not.toMatch(/[—–]/);
  });

  it("contains no exclamation marks", () => {
    expect(all).not.toMatch(/!/);
  });

  it("keeps the compare footer column (competitors.test.ts contract)", () => {
    const compare = copy.footer.columns.find((c) => c.title === "Compare");
    expect(compare).toBeDefined();
  });
});
