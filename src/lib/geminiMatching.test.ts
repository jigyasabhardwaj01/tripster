import { describe, expect, it } from "vitest";
import {
  buildCandidateList,
  isValidFromPicksRecommendation,
  isValidRecommendation,
  Recommendation,
  SubmissionForMatching,
} from "./geminiMatching";

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

  it("ignores blank/whitespace-only preferred locations", () => {
    const submissions = [makeSubmission({ preferredLocations: ["  ", "", "Goa"] })];
    expect(buildCandidateList(submissions)).toEqual(["Goa"]);
  });

  it("never falls back to destination_types — a category is not a place anyone named", () => {
    const submissions = [makeSubmission({ preferredLocations: [], destinationTypes: ["beach", "hills"] })];
    expect(buildCandidateList(submissions)).toEqual([]);
  });

  it("returns an empty list when nothing was submitted at all", () => {
    const submissions = [makeSubmission({ preferredLocations: [], destinationTypes: [] })];
    expect(buildCandidateList(submissions)).toEqual([]);
  });
});

describe("isValidRecommendation", () => {
  it("accepts a well-formed recommendation", () => {
    expect(isValidRecommendation(makeRecommendation())).toBe(true);
  });

  it("rejects a missing budget_estimate field", () => {
    const bad = makeRecommendation();
    // @ts-expect-error deliberately malformed for the test
    delete bad.budget_estimate;
    expect(isValidRecommendation(bad)).toBe(false);
  });

  it("rejects a missing suggested_window field", () => {
    const bad = makeRecommendation();
    // @ts-expect-error deliberately malformed for the test
    delete bad.suggested_window;
    expect(isValidRecommendation(bad)).toBe(false);
  });

  it("rejects attractions that aren't an array of strings", () => {
    const bad = { ...makeRecommendation(), attractions: "Baga Beach" };
    expect(isValidRecommendation(bad)).toBe(false);
  });

  it("rejects missing top-level fields, null, and non-objects", () => {
    expect(isValidRecommendation({ destination: "Goa" })).toBe(false);
    expect(isValidRecommendation(null)).toBe(false);
    expect(isValidRecommendation("Goa")).toBe(false);
  });
});

describe("isValidFromPicksRecommendation", () => {
  const candidates = ["Goa", "Manali"];

  it("accepts a destination that is one of the named candidates", () => {
    expect(isValidFromPicksRecommendation(makeRecommendation({ destination: "Goa" }), candidates)).toBe(true);
  });

  it("is case-insensitive when matching against candidates", () => {
    expect(isValidFromPicksRecommendation(makeRecommendation({ destination: "goa" }), candidates)).toBe(true);
  });

  it("rejects a destination nobody named — the model may never invent a place for this one", () => {
    expect(isValidFromPicksRecommendation(makeRecommendation({ destination: "Paris" }), candidates)).toBe(false);
  });

  it("rejects an otherwise-malformed recommendation even if the destination matches", () => {
    const bad = makeRecommendation({ destination: "Goa" });
    // @ts-expect-error deliberately malformed for the test
    delete bad.attractions;
    expect(isValidFromPicksRecommendation(bad, candidates)).toBe(false);
  });
});
