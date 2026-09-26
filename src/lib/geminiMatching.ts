// Pure logic for the single-finalized-trip matching design — split out of
// gemini.ts so it's unit-testable without pulling in the `server-only`
// package, which unconditionally throws outside a real Next.js server build.

export interface SubmissionForMatching {
  name: string;
  budgetMin: number;
  budgetMax: number;
  dateRanges: { startDate: string; exitDate: string }[];
  destinationTypes: string[];
  preferredLocations: string[];
  dealbreakers: string;
}

export interface BudgetCheck {
  name: string;
  within_budget: boolean;
  note: string | null;
}

export interface CalendarCheck {
  name: string;
  dates_work: boolean;
  note: string | null;
}

export interface MatchResult {
  finalized_trip: string;
  reason: string;
  budget_check: BudgetCheck[];
  calendar_check: CalendarCheck[];
}

export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    finalized_trip: { type: "string" },
    reason: { type: "string" },
    budget_check: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          within_budget: { type: "boolean" },
          note: { type: "string", nullable: true },
        },
        required: ["name", "within_budget"],
      },
    },
    calendar_check: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dates_work: { type: "boolean" },
          note: { type: "string", nullable: true },
        },
        required: ["name", "dates_work"],
      },
    },
  },
  required: ["finalized_trip", "reason", "budget_check", "calendar_check"],
};

/** Merges preferred_locations across submissions, deduped case-insensitively; falls back to destination_types if empty. */
export function buildCandidateList(submissions: SubmissionForMatching[]): string[] {
  const seen = new Map<string, string>(); // lowercase -> first-seen original casing
  for (const s of submissions) {
    for (const loc of s.preferredLocations) {
      const trimmed = loc.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) seen.set(key, trimmed);
    }
  }
  if (seen.size > 0) return [...seen.values()];

  for (const s of submissions) {
    for (const type of s.destinationTypes) {
      const trimmed = type.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) seen.set(key, trimmed);
    }
  }
  return [...seen.values()];
}

export function buildPrompt(submissions: SubmissionForMatching[], candidates: string[]): string {
  const lines = submissions.map((s) => {
    const dates = s.dateRanges.map((r) => `${r.startDate} to ${r.exitDate}`).join("; ") || "none given";
    return [
      `- ${s.name}:`,
      `  budget: ₹${s.budgetMin}–₹${s.budgetMax} per person`,
      `  available dates: ${dates}`,
      `  destination types: ${s.destinationTypes.join(", ") || "no preference"}`,
      `  suggested locations: ${s.preferredLocations.join(", ") || "none"}`,
      `  dealbreakers: ${s.dealbreakers.trim() || "none stated"}`,
    ].join("\n");
  });

  return `You are finalizing ONE trip destination for a group of friends from a fixed candidate list — you may not propose anywhere outside this list.

CANDIDATE LOCATIONS (choose exactly one of these): ${candidates.join(", ")}

PARTICIPANTS:
${lines.join("\n\n")}

For each candidate, score it against every participant's budget (budget_min/budget_max), calendar overlap across everyone's date ranges, and destination-type/dealbreaker fit — a dealbreaker hit on a candidate counts heavily against it even if budget and dates are fine for that person. Pick the ONE candidate that scores best across the whole group. If there's a tie, prefer whichever candidate more people originally suggested in "suggested locations".

Return the finalized destination, a one-to-two sentence reason citing budget fit, date overlap, and any relevant type/dealbreaker point, and per-participant budget_check and calendar_check lists. Only include a "note" when the answer is false/no — otherwise note should be null. Do not invent facts not implied by what's stated above.`;
}

export function isValidMatchResult(value: unknown, candidates: string[]): value is MatchResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.finalized_trip !== "string" || typeof v.reason !== "string") return false;
  const finalizedTrip = v.finalized_trip;
  // Must be one of the candidates the group actually suggested (case-insensitive).
  if (!candidates.some((c) => c.toLowerCase() === finalizedTrip.toLowerCase())) return false;
  if (!Array.isArray(v.budget_check) || !Array.isArray(v.calendar_check)) return false;

  const validBudget = v.budget_check.every((b) => {
    if (typeof b !== "object" || b === null) return false;
    const x = b as Record<string, unknown>;
    return typeof x.name === "string" && typeof x.within_budget === "boolean";
  });
  const validCalendar = v.calendar_check.every((c) => {
    if (typeof c !== "object" || c === null) return false;
    const x = c as Record<string, unknown>;
    return typeof x.name === "string" && typeof x.dates_work === "boolean";
  });
  return validBudget && validCalendar;
}
