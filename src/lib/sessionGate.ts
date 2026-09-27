// Pure decision logic for the submission-count gate — split out of
// sessionDb.ts (which imports "server-only") so the rules themselves are
// unit-testable without a real Supabase connection.

export type SubmissionStatus = "collecting" | "ready_for_analysis" | "generating" | "complete";
export type RecommendationStatus = "not_started" | "in_progress" | "complete" | "failed";

/**
 * The core rule: generation fires only when every expected participant has
 * submitted, and only while still "collecting" (never re-fires once the
 * gate has already closed). The deadline is not a parameter here on
 * purpose — it is informational only and never triggers this.
 */
export function shouldCloseGate(
  submittedCount: number,
  expectedParticipantCount: number,
  submissionStatus: SubmissionStatus
): boolean {
  return submissionStatus === "collecting" && expectedParticipantCount > 0 && submittedCount >= expectedParticipantCount;
}

/**
 * Organizer's "remove a non-responding participant" action: decrements the
 * expected count by one, floored at whichever is higher of 1 or the number
 * who have already submitted (so the organizer can't shrink the count below
 * people who are already in) — this is what lets the gate re-check and
 * potentially close on the next attempt.
 */
export function decrementExpectedParticipantCount(
  currentExpectedCount: number,
  currentSubmittedCount: number
): number {
  return Math.max(currentExpectedCount - 1, currentSubmittedCount, 1);
}

/** Case-insensitive "same participant" key, matching the unique index on lower(name). */
export function participantKey(name: string): string {
  return name.trim().toLowerCase();
}

export interface GateStateInput {
  submittedCount: number;
  expectedParticipantCount: number;
  submissionStatus: SubmissionStatus;
  deadlinePassed: boolean;
}

export interface GateState {
  locked: boolean;
  remainingCount: number;
  deadlinePassedWithMissingSubmissions: boolean;
}

/** Assembles the read-only view of gate state the frontend needs — no I/O. */
export function computeGateState(input: GateStateInput): GateState {
  const locked = input.submissionStatus !== "collecting";
  return {
    locked,
    remainingCount: Math.max(input.expectedParticipantCount - input.submittedCount, 0),
    deadlinePassedWithMissingSubmissions: input.deadlinePassed && !locked,
  };
}
