import { describe, expect, it } from "vitest";
import { initials } from "./avatar";

describe("initials", () => {
  it("takes the first letter of up to two words, uppercased", () => {
    expect(initials("Priya Sharma")).toBe("PS");
  });

  it("handles a single name", () => {
    expect(initials("karan")).toBe("K");
  });

  it("ignores extra whitespace and extra words", () => {
    expect(initials("  Rahul   Kumar Verma  ")).toBe("RK");
  });

  it("falls back to a placeholder for an empty name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });
});
