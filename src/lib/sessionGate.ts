// Pure decision logic for the submission gate — split out of sessionDb.ts
// (which imports "server-only") so the rules themselves are unit-testable
// without a real Supabase connection.

export type SubmissionStatus = "collecting" | "ready_for_analysis" | "generating" | "complete";
export type RecommendationStatus = "not_started" | "in_progress" | "complete" | "failed";
export type DurationUnit = "minutes" | "hours" | "days";

const UNIT_MS: Record<DurationUnit, number> = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};

/** deadline = createdAt + duration, computed once at trip creation and stored as an absolute timestamp. */
export function computeDeadline(createdAt: Date, durationValue: number, durationUnit: DurationUnit): Date {
  return new Date(createdAt.getTime() + durationValue * UNIT_MS[durationUnit]);
}

/**
 * The core rule: generation fires the moment either condition holds —
 * (a) everyone expected has submitted, or (b) the deadline has passed with
 * at least one submission. Zero submissions at a passed deadline never
 * closes the gate (surfaced on the frontend as "no responses" instead of a
 * generated result) — never fires a second time once the gate has closed.
 */
export function shouldCloseGate(
  submittedCount: number,
  expectedParticipantCount: number,
  submissionStatus: SubmissionStatus,
  deadlinePassed: boolean
): boolean {
  if (submissionStatus !== "collecting") return false;
  const everyoneIn = expectedParticipantCount > 0 && submittedCount >= expectedParticipantCount;
  const deadlineWithAtLeastOne = deadlinePassed && submittedCount >= 1;
  return everyoneIn || deadlineWithAtLeastOne;
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

/**
 * Only meaningful when the organizer named expected participants up front
 * (optional) — otherwise we genuinely don't know who's missing, only how
 * many, and callers should show a count-only message instead of guessing
 * names. Case-insensitive, dedupes, preserves the original casing from
 * expectedNames.
 */
export function computeMissingNames(expectedNames: string[] | null, submittedNames: string[]): string[] | null {
  if (expectedNames === null) return null;
  const submittedKeys = new Set(submittedNames.map(participantKey));
  return expectedNames.filter((n) => !submittedKeys.has(participantKey(n)));
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
  /** Deadline passed, gate never closed, and nobody submitted at all — a distinct message, not a generated (empty) result. */
  noResponsesAtDeadline: boolean;
}

/** Assembles the read-only view of gate state the frontend needs — no I/O. */
export function computeGateState(input: GateStateInput): GateState {
  const locked = input.submissionStatus !== "collecting";
  return {
    locked,
    remainingCount: Math.max(input.expectedParticipantCount - input.submittedCount, 0),
    noResponsesAtDeadline: input.deadlinePassed && !locked && input.submittedCount === 0,
  };
}
