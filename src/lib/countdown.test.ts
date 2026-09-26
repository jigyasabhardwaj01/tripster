import { describe, expect, it } from "vitest";
import { computeCountdown } from "./countdown";

const NOW = new Date("2026-01-01T00:00:00Z").getTime();

describe("computeCountdown", () => {
  it("reports expired when the deadline is in the past", () => {
    const result = computeCountdown(new Date(NOW - 1000).toISOString(), NOW);
    expect(result.expired).toBe(true);
    expect(result.label).toBe("Deadline passed");
  });

  it("reports expired at exactly the deadline instant", () => {
    expect(computeCountdown(new Date(NOW).toISOString(), NOW).expired).toBe(true);
  });

  it("formats days + hours + minutes when more than a day remains", () => {
    const deadline = new Date(NOW + (2 * 86400 + 3 * 3600 + 14 * 60 + 5) * 1000).toISOString();
    const result = computeCountdown(deadline, NOW);
    expect(result.expired).toBe(false);
    expect(result.days).toBe(2);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(14);
    expect(result.label).toBe("2d 3h 14m left");
  });

  it("formats hours + minutes with no days when under 24h remain", () => {
    const deadline = new Date(NOW + (5 * 3600 + 30 * 60) * 1000).toISOString();
    const result = computeCountdown(deadline, NOW);
    expect(result.days).toBe(0);
    expect(result.label).toBe("5h 30m left");
  });

  it("shows seconds only in the final minutes (under an hour remaining)", () => {
    const deadline = new Date(NOW + (5 * 60 + 20) * 1000).toISOString();
    const result = computeCountdown(deadline, NOW);
    expect(result.label).toBe("5m 20s left");
  });
});
