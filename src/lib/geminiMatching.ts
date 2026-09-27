// Pure logic for the two-destination (primary + alternative) recommendation
// design — split out of gemini.ts so it's unit-testable without pulling in
// the `server-only` package, which unconditionally throws outside a real
// Next.js server build.

export interface SubmissionForMatching {
  name: string;
  budgetMin: number;
  budgetMax: number;
  dateRanges: { startDate: string; exitDate: string }[];
  destinationTypes: string[];
  preferredLocations: string[];
  dealbreakers: string;
}

export interface BudgetEstimate {
  transport: string;
  stay: string;
  food: string;
  activities: string;
  note: string; // always something like "estimated — not a verified price"
}

export interface SuggestedWindow {
  start_date: string;
  end_date: string;
  season: string; // e.g. "peak season — expect crowds and higher prices"
}

export interface Recommendation {
  destination: string;
  summary: string; // why it fits + key trade-offs, one to two sentences
  suggested_window: SuggestedWindow;
  budget_estimate: BudgetEstimate;
  attractions: string[]; // 3-4 entries matching the group's stated trip type
}

export interface RecommendationSet {
  primary: Recommendation;
  // Genuinely a different place than primary. Only null when the candidate
  // list (see buildCandidateList) has fewer than two entries — the model is
  // never allowed to invent a second destination nobody suggested.
  alternative: Recommendation | null;
}

const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    destination: { type: "string" },
    summary: { type: "string" },
    suggested_window: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        season: { type: "string" },
      },
      required: ["start_date", "end_date", "season"],
    },
    budget_estimate: {
      type: "object",
      properties: {
        transport: { type: "string" },
        stay: { type: "string" },
        food: { type: "string" },
        activities: { type: "string" },
        note: { type: "string" },
      },
      required: ["transport", "stay", "food", "activities", "note"],
    },
    attractions: { type: "array", items: { type: "string" } },
  },
  required: ["destination", "summary", "suggested_window", "budget_estimate", "attractions"],
};

export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    primary: RECOMMENDATION_SCHEMA,
    alternative: { ...RECOMMENDATION_SCHEMA, nullable: true },
  },
  required: ["primary", "alternative"],
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

  const wantsAlternative = candidates.length >= 2;

  return `You are recommending trip destinations for a group of friends from a fixed candidate list — you may not propose anywhere outside this list.

CANDIDATE LOCATIONS (choose only from these): ${candidates.join(", ")}

PARTICIPANTS:
${lines.join("\n\n")}

For each candidate, score it against every participant's budget (budget_min/budget_max), calendar overlap across everyone's date ranges, destination-type/dealbreaker fit, and whether the group's overlapping dates actually fall in a good/peak travel season for that specific place (e.g. a hill station in monsoon, a beach town in peak monsoon rains, or a desert town in peak summer heat are all poor timing even if budget and dates otherwise line up) — weigh bad seasonal timing as a real downside. A dealbreaker hit on a candidate counts heavily against it even if everything else is fine for that person.

Pick "primary": the ONE candidate that scores best across the whole group on all of these factors together. If there's a tie, prefer whichever candidate more people originally suggested in "suggested locations".
${
  wantsAlternative
    ? `Pick "alternative": a genuinely different destination from the candidate list — not the same place under another name — evaluated on the same criteria. It does not need to beat "primary", just be a reasonable second option.`
    : `There is only one candidate location, so return "alternative" as null — do not invent a second destination that nobody suggested.`
}

For each of primary (and alternative, if not null), return:
- "destination": exactly one of the candidate names above.
- "summary": one to two sentences on why it fits the group and the key trade-offs.
- "suggested_window": a start_date and end_date (YYYY-MM-DD) based on the group's actual date overlap, and "season" describing whether that window is peak/shoulder/off season for that place and what that means practically (crowds, prices, weather).
- "budget_estimate": transport, stay, food, and activities as short per-person estimate strings (e.g. "₹3,000–5,000"), plus "note" explicitly saying this is an estimate, not a verified price.
- "attractions": 3-4 top attractions matching the group's stated trip type(s). Do not include cafes, restaurants, or an hour-by-hour itinerary.

Do not invent facts not implied by what's stated above.`;
}

function isValidRecommendation(value: unknown, candidates: string[]): value is Recommendation {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.destination !== "string" || typeof v.summary !== "string") return false;
  const destination = v.destination;
  if (!candidates.some((c) => c.toLowerCase() === destination.toLowerCase())) return false;

  const window = v.suggested_window as Record<string, unknown> | undefined;
  if (
    typeof window !== "object" ||
    window === null ||
    typeof window.start_date !== "string" ||
    typeof window.end_date !== "string" ||
    typeof window.season !== "string"
  ) {
    return false;
  }

  const budget = v.budget_estimate as Record<string, unknown> | undefined;
  if (
    typeof budget !== "object" ||
    budget === null ||
    typeof budget.transport !== "string" ||
    typeof budget.stay !== "string" ||
    typeof budget.food !== "string" ||
    typeof budget.activities !== "string" ||
    typeof budget.note !== "string"
  ) {
    return false;
  }

  if (!Array.isArray(v.attractions) || !v.attractions.every((a) => typeof a === "string")) return false;

  return true;
}

export function isValidRecommendationSet(value: unknown, candidates: string[]): value is RecommendationSet {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isValidRecommendation(v.primary, candidates)) return false;

  if (v.alternative === null) return true;
  if (!isValidRecommendation(v.alternative, candidates)) return false;

  // Must be genuinely different from primary — not a renamed duplicate.
  const primary = v.primary as Recommendation;
  const alternative = v.alternative as Recommendation;
  return primary.destination.toLowerCase() !== alternative.destination.toLowerCase();
}
