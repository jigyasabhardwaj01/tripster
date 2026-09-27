import { describe, expect, it } from "vitest";
import { buildBasedOnNote, buildItineraryPdfData, ItineraryPdfSessionInput } from "./itineraryPdfData";
import { Recommendation } from "./geminiMatching";

function makeSession(overrides: Partial<ItineraryPdfSessionInput> = {}): ItineraryPdfSessionInput {
  return {
    title: "Goa-or-bust",
    expectedParticipantCount: 5,
    includedCount: null,
    missingNames: null,
    ...overrides,
  };
}

function makeRecommendation(destination: string): Recommendation {
  return {
    destination,
    summary: "Great fit.",
    suggested_window: { start_date: "2026-12-01", end_date: "2026-12-10", season: "peak" },
    budget_estimate: { transport: "₹1", stay: "₹1", food: "₹1", activities: "₹1", note: "estimated" },
    attractions: ["Beach"],
  };
}

describe("buildBasedOnNote", () => {
  it("returns null when includedCount was never set (everyone-in path, no partial-response tracking needed)", () => {
    expect(buildBasedOnNote(makeSession({ includedCount: null }))).toBeNull();
  });

  it("returns null when everyone expected was actually included", () => {
    expect(buildBasedOnNote(makeSession({ includedCount: 5, expectedParticipantCount: 5 }))).toBeNull();
  });

  it("names the missing people when expected_names was given", () => {
    expect(
      buildBasedOnNote(makeSession({ includedCount: 4, expectedParticipantCount: 5, missingNames: ["Karan"] }))
    ).toBe("Based on 4 of 5 responses. Karan didn't submit in time.");
  });

  it("names multiple missing people, comma-separated", () => {
    expect(
      buildBasedOnNote(
        makeSession({ includedCount: 3, expectedParticipantCount: 5, missingNames: ["Karan", "Priya"] })
      )
    ).toBe("Based on 3 of 5 responses. Karan, Priya didn't submit in time.");
  });

  it("falls back to a count-only note when no expected_names list was given", () => {
    expect(buildBasedOnNote(makeSession({ includedCount: 2, expectedParticipantCount: 5, missingNames: null }))).toBe(
      "Based on 2 of 5 responses."
    );
  });
});

describe("buildItineraryPdfData", () => {
  it("returns null when there's no discovered destination yet (nothing to render)", () => {
    expect(buildItineraryPdfData(makeSession(), { fromPicks: null, discovered: null, discoveredVerified: false })).toBeNull();
  });

  it("builds full data with both destinations and no based-on note when everyone was included", () => {
    const result = buildItineraryPdfData(makeSession({ includedCount: 5, expectedParticipantCount: 5 }), {
      fromPicks: makeRecommendation("Goa"),
      discovered: makeRecommendation("Varkala"),
      discoveredVerified: true,
    });
    expect(result).not.toBeNull();
    expect(result?.basedOnNote).toBeNull();
    expect(result?.fromPicks?.destination).toBe("Goa");
    expect(result?.discovered.destination).toBe("Varkala");
    expect(result?.discoveredVerified).toBe(true);
  });

  it("builds data with fromPicks null (nobody named a place) — only the discovered card renders", () => {
    const result = buildItineraryPdfData(makeSession(), {
      fromPicks: null,
      discovered: makeRecommendation("Manali"),
      discoveredVerified: false,
    });
    expect(result).not.toBeNull();
    expect(result?.fromPicks).toBeNull();
    expect(result?.discoveredVerified).toBe(false);
  });

  it("carries the based-on note through when the trip finalized on a partial response", () => {
    const result = buildItineraryPdfData(
      makeSession({ includedCount: 2, expectedParticipantCount: 4, missingNames: ["Rahul", "Asmi"] }),
      { fromPicks: makeRecommendation("Goa"), discovered: makeRecommendation("Goa"), discoveredVerified: true }
    );
    expect(result?.basedOnNote).toBe("Based on 2 of 4 responses. Rahul, Asmi didn't submit in time.");
  });
});
