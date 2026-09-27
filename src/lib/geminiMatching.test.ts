import { describe, expect, it } from "vitest";
import { buildCandidateList, isValidRecommendationSet, Recommendation, SubmissionForMatching } from "./geminiMatching";

function makeSubmission(overrides: Partial<SubmissionForMatching> = {}): SubmissionForMatching {
  return {
    name: "Karan",
    budgetMin: 10000,
    budgetMax: 20000,
    dateRanges: [{ startDate: "2026-11-01", exitDate: "2026-11-10" }],
    destinationTypes: ["beach"],
    preferredLocations: [],
    dealbreakers: "",
    ...overrides,
  };
}

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    destination: "Goa",
    summary: "Good budget and date fit for the group.",
    suggested_window: { start_date: "2026-11-01", end_date: "2026-11-10", season: "shoulder season" },
    budget_estimate: {
      transport: "₹3,000",
      stay: "₹4,000",
      food: "₹1,500",
      activities: "₹2,000",
      note: "estimated — not a verified price",
    },
    attractions: ["Baga Beach", "Fort Aguada", "Dudhsagar Falls"],
    ...overrides,
  };
}

describe("buildCandidateList", () => {
  it("merges preferred_locations across submissions, deduped case-insensitively", () => {
    const submissions = [
      makeSubmission({ name: "A", preferredLocations: ["Goa", "Manali"] }),
      makeSubmission({ name: "B", preferredLocations: ["goa", "Gokarna"] }),
    ];
    const candidates = buildCandidateList(submissions);
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.toLowerCase())).toEqual(expect.arrayContaining(["goa", "manali", "gokarna"]));
    expect(candidates).toContain("Goa");
  });

  it("falls back to destination_types when nobody gave a preferred location", () => {
    const submissions = [
      makeSubmission({ name: "A", preferredLocations: [], destinationTypes: ["beach", "hills"] }),
      makeSubmission({ name: "B", preferredLocations: [], destinationTypes: ["beach"] }),
    ];
    const candidates = buildCandidateList(submissions);
    expect(candidates.map((c) => c.toLowerCase())).toEqual(expect.arrayContaining(["beach", "hills"]));
  });

  it("ignores blank/whitespace-only preferred locations", () => {
    const submissions = [makeSubmission({ preferredLocations: ["  ", "", "Goa"] })];
    expect(buildCandidateList(submissions)).toEqual(["Goa"]);
  });

  it("returns an empty list when nothing was submitted at all (no fallback data either)", () => {
    const submissions = [makeSubmission({ preferredLocations: [], destinationTypes: [] })];
    expect(buildCandidateList(submissions)).toEqual([]);
  });
});

describe("isValidRecommendationSet", () => {
  const candidates = ["Goa", "Manali"];

  it("accepts a well-formed primary + alternative, both from the candidate list", () => {
    const result = {
      primary: makeRecommendation({ destination: "Goa" }),
      alternative: makeRecommendation({ destination: "Manali" }),
    };
    expect(isValidRecommendationSet(result, candidates)).toBe(true);
  });

  it("accepts a null alternative (single-candidate case)", () => {
    const result = { primary: makeRecommendation({ destination: "Goa" }), alternative: null };
    expect(isValidRecommendationSet(result, candidates)).toBe(true);
  });

  it("is case-insensitive when matching destinations to candidates", () => {
    const result = { primary: makeRecommendation({ destination: "goa" }), alternative: null };
    expect(isValidRecommendationSet(result, candidates)).toBe(true);
  });

  it("rejects a primary destination that isn't in the candidate list — the model may not invent a place", () => {
    const result = { primary: makeRecommendation({ destination: "Paris" }), alternative: null };
    expect(isValidRecommendationSet(result, candidates)).toBe(false);
  });

  it("rejects an alternative that is just a renamed duplicate of primary", () => {
    const result = {
      primary: makeRecommendation({ destination: "Goa" }),
      alternative: makeRecommendation({ destination: "goa" }),
    };
    expect(isValidRecommendationSet(result, candidates)).toBe(false);
  });

  it("rejects a missing budget_estimate field", () => {
    const bad = makeRecommendation();
    // @ts-expect-error deliberately malformed for the test
    delete bad.budget_estimate;
    expect(isValidRecommendationSet({ primary: bad, alternative: null }, candidates)).toBe(false);
  });

  it("rejects a missing suggested_window field", () => {
    const bad = makeRecommendation();
    // @ts-expect-error deliberately malformed for the test
    delete bad.suggested_window;
    expect(isValidRecommendationSet({ primary: bad, alternative: null }, candidates)).toBe(false);
  });

  it("rejects attractions that aren't an array of strings", () => {
    const bad = { ...makeRecommendation(), attractions: "Baga Beach" };
    expect(isValidRecommendationSet({ primary: bad, alternative: null }, candidates)).toBe(false);
  });

  it("rejects missing top-level fields", () => {
    expect(isValidRecommendationSet({ primary: makeRecommendation() }, candidates)).toBe(false);
    expect(isValidRecommendationSet(null, candidates)).toBe(false);
    expect(isValidRecommendationSet("Goa", candidates)).toBe(false);
  });
});
