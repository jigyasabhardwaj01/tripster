// Pure logic for the dual-sourced recommendation design — split out of
// gemini.ts so it's unit-testable without pulling in the `server-only`
// package, which unconditionally throws outside a real Next.js server build.
//
// Two destinations, sourced differently:
// - "from_picks": only ever a place a participant actually typed into
//   preferred_locations. Never falls back to destination_types (a category
//   like "beach" is not a place anyone named) — if nobody named anywhere,
//   there is no from_picks destination, full stop.
// - "discovered": not list-constrained, meant to be grounded in a real web
//   search (see gemini.ts's two-call design — combining Gemini's search
//   tool with schema-constrained JSON output in one call does NOT actually
//   invoke the search, confirmed live). `verified` records whether that
//   grounding actually happened.

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

export const RECOMMENDATION_SCHEMA = {
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

function describeSubmissions(submissions: SubmissionForMatching[]): string {
  return submissions
    .map((s) => {
      const dates = s.dateRanges.map((r) => `${r.startDate} to ${r.exitDate}`).join("; ") || "none given";
      return [
        `- ${s.name}:`,
        `  budget: ₹${s.budgetMin}–₹${s.budgetMax} per person`,
        `  available dates: ${dates}`,
        `  destination types: ${s.destinationTypes.join(", ") || "no preference"}`,
        `  suggested locations: ${s.preferredLocations.join(", ") || "none"}`,
        `  dealbreakers: ${s.dealbreakers.trim() || "none stated"}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** Only ever named locations — never falls back to destination_types (those are categories, not places anyone named). */
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
  return [...seen.values()];
}

export function buildFromPicksPrompt(submissions: SubmissionForMatching[], candidates: string[]): string {
  return `You are picking ONE trip destination for a group of friends from a fixed candidate list — you may not propose anywhere outside this list, since every candidate is a place a participant actually named.

CANDIDATE LOCATIONS (choose only from these): ${candidates.join(", ")}

PARTICIPANTS:
${describeSubmissions(submissions)}

Score each candidate against every participant's budget (budget_min/budget_max), calendar overlap across everyone's date ranges, destination-type/dealbreaker fit, and whether the group's overlapping dates actually fall in a good/peak travel season for that specific place — weigh bad seasonal timing as a real downside. A dealbreaker hit on a candidate counts heavily against it even if everything else is fine for that person. Pick the ONE candidate that scores best across the whole group. If there's a tie, prefer whichever candidate more people originally suggested in "suggested locations".

Return:
- "destination": exactly one of the candidate names above.
- "summary": one to two sentences on why it fits the group and the key trade-offs.
- "suggested_window": a start_date and end_date (YYYY-MM-DD) based on the group's actual date overlap, and "season" describing whether that window is peak/shoulder/off season for that place and what that means practically.
- "budget_estimate": transport, stay, food, and activities as short per-person estimate strings (e.g. "₹3,000–5,000"), plus "note" explicitly saying this is an estimate, not a verified price.
- "attractions": 3-4 top attractions matching the group's stated trip type(s). Do not include cafes, restaurants, or an hour-by-hour itinerary.

Do not invent facts not implied by what's stated above.`;
}

/** Step 1 of the discovered-destination flow: a plain research prompt meant to be called WITH Gemini's google_search tool and WITHOUT a response schema (combining the two suppresses actual grounding — confirmed live). */
export function buildDiscoverySearchPrompt(submissions: SubmissionForMatching[]): string {
  return `Research and suggest ONE real, currently-operating travel destination (not necessarily one anyone has already named) that fits this group of friends well, using what you find from web search.

GROUP CONSTRAINTS:
${describeSubmissions(submissions)}

Use web search to find a destination that realistically fits the group's combined budget, date overlap, stated destination types, and dealbreakers — weigh seasonal timing for the actual travel window. Write up: the destination name, why it fits (grounded in what you found), the best travel window within the group's date overlap and what season that is there, a realistic per-person budget breakdown (transport/stay/food/activities), and 3-4 real top attractions there. Cite what you found; do not guess at facts you didn't find.`;
}

/** Step 2: formats step 1's grounded findings into the strict schema — no search tool here, so it can't quietly re-fabricate past what step 1 actually found. */
export function buildDiscoveryFormatPrompt(groundedFindings: string): string {
  return `Format the following researched travel findings into the exact structure requested — do not add any fact not present below, and do not change the destination.

RESEARCHED FINDINGS:
${groundedFindings}

Return "destination", "summary" (one to two sentences), "suggested_window" (start_date, end_date as YYYY-MM-DD, and "season"), "budget_estimate" (transport/stay/food/activities as short strings, plus "note" explicitly saying this is an estimate, not a verified price), and "attractions" (3-4 entries, no cafes/restaurants).`;
}

export function isValidRecommendation(value: unknown): value is Recommendation {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.destination !== "string" || typeof v.summary !== "string") return false;

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

/** The from_picks destination additionally must be exactly one of the named candidates — never invented. */
export function isValidFromPicksRecommendation(value: unknown, candidates: string[]): value is Recommendation {
  if (!isValidRecommendation(value)) return false;
  const destination = (value as Recommendation).destination;
  return candidates.some((c) => c.toLowerCase() === destination.toLowerCase());
}
