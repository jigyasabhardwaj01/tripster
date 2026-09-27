import { describe, expect, it } from "vitest";
import {
  computeDeadline,
  computeGateState,
  computeMissingNames,
  decrementExpectedParticipantCount,
  participantKey,
  shouldCloseGate,
} from "./sessionGate";

describe("computeDeadline", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");

  it("supports durations as short as 5 minutes", () => {
    expect(computeDeadline(createdAt, 5, "minutes").toISOString()).toBe("2026-01-01T00:05:00.000Z");
  });

  it("supports hours", () => {
    expect(computeDeadline(createdAt, 2, "hours").toISOString()).toBe("2026-01-01T02:00:00.000Z");
  });

  it("supports days", () => {
    expect(computeDeadline(createdAt, 3, "days").toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});

describe("shouldCloseGate", () => {
  it("does not close while submissions are short and the deadline hasn't passed", () => {
    expect(shouldCloseGate(3, 5, "collecting", false)).toBe(false);
  });

  it("closes when everyone expected has submitted (condition a)", () => {
    expect(shouldCloseGate(5, 5, "collecting", false)).toBe(true);
  });

  it("closes when the deadline has passed with at least one submission, even if others are missing (condition b)", () => {
    expect(shouldCloseGate(2, 5, "collecting", true)).toBe(true);
  });

  it("does NOT close when the deadline has passed with zero submissions", () => {
    expect(shouldCloseGate(0, 5, "collecting", true)).toBe(false);
  });

  it("never re-fires once the gate has already left collecting, regardless of which condition would now hold", () => {
    expect(shouldCloseGate(5, 5, "ready_for_analysis", false)).toBe(false);
    expect(shouldCloseGate(5, 5, "generating", true)).toBe(false);
    expect(shouldCloseGate(5, 5, "complete", true)).toBe(false);
  });

  it("never closes with an unset/zero expected count and no passed deadline", () => {
    expect(shouldCloseGate(0, 0, "collecting", false)).toBe(false);
  });
});

describe("decrementExpectedParticipantCount", () => {
  it("decrements by one", () => {
    expect(decrementExpectedParticipantCount(5, 3)).toBe(4);
  });

  it("never drops below the number who have already submitted", () => {
    expect(decrementExpectedParticipantCount(4, 4)).toBe(4);
  });

  it("never drops below 1", () => {
    expect(decrementExpectedParticipantCount(1, 0)).toBe(1);
  });
});

describe("participantKey", () => {
  it("is case-insensitive and trims whitespace", () => {
    expect(participantKey("Karan")).toBe(participantKey("karan"));
    expect(participantKey("  Karan  ")).toBe(participantKey("Karan"));
  });
});

describe("computeMissingNames", () => {
  it("returns null when no expected-names list was given — count-only, no guessing who", () => {
    expect(computeMissingNames(null, ["Priya"])).toBeNull();
  });

  it("lists expected names that haven't submitted, in their original casing", () => {
    expect(computeMissingNames(["Karan", "Priya", "Rahul"], ["priya"])).toEqual(["Karan", "Rahul"]);
  });

  it("is case-insensitive when matching submitted names against expected names", () => {
    expect(computeMissingNames(["Karan"], ["KARAN"])).toEqual([]);
  });

  it("returns an empty array (not null) when everyone expected has submitted", () => {
    expect(computeMissingNames(["Karan", "Priya"], ["Priya", "Karan"])).toEqual([]);
  });
});

describe("computeGateState", () => {
  it("reports remaining count and stays unlocked while collecting", () => {
    const state = computeGateState({
      submittedCount: 3,
      expectedParticipantCount: 5,
      submissionStatus: "collecting",
      deadlinePassed: false,
    });
    expect(state.locked).toBe(false);
    expect(state.remainingCount).toBe(2);
    expect(state.noResponsesAtDeadline).toBe(false);
  });

  it("flags noResponsesAtDeadline only when the deadline passed with zero submissions and still collecting", () => {
    const state = computeGateState({
      submittedCount: 0,
      expectedParticipantCount: 5,
      submissionStatus: "collecting",
      deadlinePassed: true,
    });
    expect(state.locked).toBe(false);
    expect(state.noResponsesAtDeadline).toBe(true);
  });

  it("does not flag noResponsesAtDeadline once locked, even with zero submissions somehow recorded", () => {
    const state = computeGateState({
      submittedCount: 0,
      expectedParticipantCount: 5,
      submissionStatus: "complete",
      deadlinePassed: true,
    });
    expect(state.noResponsesAtDeadline).toBe(false);
  });

  it("is locked once the gate has closed, regardless of the deadline", () => {
    const state = computeGateState({
      submittedCount: 5,
      expectedParticipantCount: 5,
      submissionStatus: "complete",
      deadlinePassed: false,
    });
    expect(state.locked).toBe(true);
  });
});
