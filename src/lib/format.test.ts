import { describe, expect, it } from "vitest";
import { formatDeadline } from "./format";

describe("formatDeadline", () => {
  it("says the window is closed once the deadline has passed", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatDeadline(past)).toMatch(/closed/i);
  });

  it("warns about less than an hour left when very close to the deadline", () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    expect(formatDeadline(soon)).toMatch(/less than an hour left/);
  });

  it("reports the rounded hour count when well within the window", () => {
    const later = new Date(Date.now() + 47.6 * 60 * 60 * 1000).toISOString();
    expect(formatDeadline(later)).toMatch(/48 hours left/);
  });

  it("uses singular 'hour' for exactly one hour left", () => {
    const oneHour = new Date(Date.now() + 60 * 60 * 1000 + 100).toISOString();
    expect(formatDeadline(oneHour)).toMatch(/1 hour left(?!s)/);
  });
});
