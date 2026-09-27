import { describe, expect, it } from "vitest";
import { computeGateState, decrementExpectedParticipantCount, participantKey, shouldCloseGate } from "./sessionGate";

describe("shouldCloseGate", () => {
  it("does not close while submissions are still short of the expected count", () => {
    // Acceptance criterion 1: 3 of 5 submitted must not be treated as ready.
    expect(shouldCloseGate(3, 5, "collecting")).toBe(false);
  });

  it("closes the moment submitted_count == expected_participant_count", () => {
    // Acceptance criterion 2.
    expect(shouldCloseGate(5, 5, "collecting")).toBe(true);
  });

  it("closes when submitted_count exceeds expected (e.g. count dropped via removal after submission)", () => {
    expect(shouldCloseGate(6, 5, "collecting")).toBe(true);
  });

  it("never re-fires once the gate has already left collecting", () => {
    // Acceptance criterion 5 (exactly once): the second of two racing callers
    // must see submission_status already advanced and not close again.
    expect(shouldCloseGate(5, 5, "ready_for_analysis")).toBe(false);
    expect(shouldCloseGate(5, 5, "generating")).toBe(false);
    expect(shouldCloseGate(5, 5, "complete")).toBe(false);
  });

  it("never closes with an unset/zero expected count", () => {
    expect(shouldCloseGate(0, 0, "collecting")).toBe(false);
  });
});

describe("decrementExpectedParticipantCount", () => {
  it("decrements by one", () => {
    expect(decrementExpectedParticipantCount(5, 3)).toBe(4);
  });

  it("never drops below the number who have already submitted", () => {
    // Acceptance criterion 8: removing a non-responder must not strand
    // people who already submitted below the new expected count.
    expect(decrementExpectedParticipantCount(4, 4)).toBe(4);
  });

  it("never drops below 1", () => {
    expect(decrementExpectedParticipantCount(1, 0)).toBe(1);
  });
});

describe("participantKey", () => {
  it("is case-insensitive and trims whitespace", () => {
    // Acceptance criterion 4: "Karan" and "karan" must be the same participant.
    expect(participantKey("Karan")).toBe(participantKey("karan"));
    expect(participantKey("  Karan  ")).toBe(participantKey("Karan"));
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
    expect(state.deadlinePassedWithMissingSubmissions).toBe(false);
  });

  it("flags deadline-passed-with-missing-submissions only while still collecting", () => {
    // Acceptance criterion 7: passing the deadline with people missing must
    // not auto-generate — it should surface as this flag, not as locked.
    const state = computeGateState({
      submittedCount: 3,
      expectedParticipantCount: 5,
      submissionStatus: "collecting",
      deadlinePassed: true,
    });
    expect(state.locked).toBe(false);
    expect(state.deadlinePassedWithMissingSubmissions).toBe(true);
  });

  it("is locked once the gate has closed, regardless of the deadline", () => {
    const state = computeGateState({
      submittedCount: 5,
      expectedParticipantCount: 5,
      submissionStatus: "complete",
      deadlinePassed: false,
    });
    expect(state.locked).toBe(true);
    expect(state.deadlinePassedWithMissingSubmissions).toBe(false);
  });
});
