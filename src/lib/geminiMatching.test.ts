import { describe, expect, it } from "vitest";
import { buildCandidateList, isValidMatchResult, SubmissionForMatching } from "./geminiMatching";

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

describe("buildCandidateList", () => {
  it("merges preferred_locations across submissions, deduped case-insensitively", () => {
    const submissions = [
      makeSubmission({ name: "A", preferredLocations: ["Goa", "Manali"] }),
      makeSubmission({ name: "B", preferredLocations: ["goa", "Gokarna"] }),
    ];
    const candidates = buildCandidateList(submissions);
    expect(candidates).toHaveLength(3);
    expect(candidates.map((c) => c.toLowerCase())).toEqual(
      expect.arrayContaining(["goa", "manali", "gokarna"])
    );
    // first-seen casing is kept
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

describe("isValidMatchResult", () => {
  const candidates = ["Goa", "Manali"];

  it("accepts a well-formed result whose finalized_trip is one of the candidates", () => {
    const result = {
      finalized_trip: "Goa",
      reason: "Best budget and date fit for everyone.",
      budget_check: [{ name: "Karan", within_budget: true, note: null }],
      calendar_check: [{ name: "Karan", dates_work: true, note: null }],
    };
    expect(isValidMatchResult(result, candidates)).toBe(true);
  });

  it("accepts a candidate match regardless of casing", () => {
    const result = {
      finalized_trip: "goa",
      reason: "fine",
      budget_check: [],
      calendar_check: [],
    };
    expect(isValidMatchResult(result, candidates)).toBe(true);
  });

  it("rejects a finalized_trip that isn't in the candidate list — the model may not invent a place", () => {
    const result = {
      finalized_trip: "Paris",
      reason: "fine",
      budget_check: [],
      calendar_check: [],
    };
    expect(isValidMatchResult(result, candidates)).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(isValidMatchResult({ finalized_trip: "Goa" }, candidates)).toBe(false);
    expect(isValidMatchResult(null, candidates)).toBe(false);
    expect(isValidMatchResult("Goa", candidates)).toBe(false);
  });

  it("rejects a budget_check entry missing within_budget", () => {
    const result = {
      finalized_trip: "Goa",
      reason: "fine",
      budget_check: [{ name: "Karan" }],
      calendar_check: [],
    };
    expect(isValidMatchResult(result, candidates)).toBe(false);
  });
});
