import { describe, expect, it } from "vitest";
import { computeShortlist, scoreDestination, ParticipantResponse } from "./scoring";
import { Destination } from "./destinations";
import { Response } from "./types";

function makeResponse(overrides: Partial<Response> = {}): Response {
  return {
    id: "r1",
    trip_id: "t1",
    participant_id: "p1",
    max_budget: 15000,
    date_ranges: [{ start: "2026-11-01", end: "2026-11-10" }],
    destination_types: ["beach"],
    dealbreakers: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: "test-dest",
    name: "Test Destination",
    region: "Testland",
    type: "beach",
    costPerPerson: 10000,
    typicalLengthDays: 4,
    tags: [],
    ...overrides,
  };
}

describe("scoreDestination — budget", () => {
  it("passes when the participant's budget covers the cost", () => {
    const dest = makeDestination({ costPerPerson: 10000 });
    const p: ParticipantResponse = {
      participantId: "p1",
      participantName: "Karan",
      response: makeResponse({ max_budget: 15000 }),
    };
    const result = scoreDestination(dest, [p]);
    expect(result.participantFits[0].budget.pass).toBe(true);
  });

  it("fails and reports the exact overage when over budget", () => {
    const dest = makeDestination({ costPerPerson: 15000 });
    const p: ParticipantResponse = {
      participantId: "p1",
      participantName: "Rohan",
      response: makeResponse({ max_budget: 12000 }),
    };
    const result = scoreDestination(dest, [p]);
    expect(result.participantFits[0].budget.pass).toBe(false);
    expect(result.participantFits[0].budget.detail).toContain("3,000");
  });
});

describe("scoreDestination — destination type", () => {
  it("passes when the destination's type is in the participant's preferred list", () => {
    const dest = makeDestination({ type: "hills" });
    const p: ParticipantResponse = {
      participantId: "p1",
      participantName: "Priya",
      response: makeResponse({ destination_types: ["beach", "hills"] }),
    };
    expect(scoreDestination(dest, [p]).participantFits[0].destinationType.pass).toBe(true);
  });

  it("fails when the destination's type isn't preferred", () => {
    const dest = makeDestination({ type: "city" });
    const p: ParticipantResponse = {
      participantId: "p1",
      participantName: "Priya",
      response: makeResponse({ destination_types: ["beach"] }),
    };
    expect(scoreDestination(dest, [p]).participantFits[0].destinationType.pass).toBe(false);
  });
});

describe("scoreDestination — dealbreakers", () => {
  it("fails when a destination tag matches a stated dealbreaker", () => {
    const dest = makeDestination({ tags: ["alcohol_nightlife", "water_sports"] });
    const p: ParticipantResponse = {
      participantId: "p1",
      participantName: "Meera",
      response: makeResponse({ dealbreakers: ["alcohol_nightlife"] }),
    };
    const result = scoreDestination(dest, [p]);
    expect(result.participantFits[0].dealbreakers.pass).toBe(false);
    expect(result.participantFits[0].dealbreakers.detail).toContain("alcohol nightlife");
  });

  it("passes when no destination tag matches any stated dealbreaker", () => {
    const dest = makeDestination({ tags: ["extreme_heat"] });
    const p: ParticipantResponse = {
      participantId: "p1",
      participantName: "Meera",
      response: makeResponse({ dealbreakers: ["alcohol_nightlife", "high_altitude"] }),
    };
    expect(scoreDestination(dest, [p]).participantFits[0].dealbreakers.pass).toBe(true);
  });
});

describe("scoreDestination — dates", () => {
  it("passes everyone when the whole group's ranges overlap for long enough", () => {
    const dest = makeDestination({ typicalLengthDays: 4 });
    const participants: ParticipantResponse[] = [
      { participantId: "p1", participantName: "A", response: makeResponse({ date_ranges: [{ start: "2026-11-01", end: "2026-11-10" }] }) },
      { participantId: "p2", participantName: "B", response: makeResponse({ date_ranges: [{ start: "2026-11-03", end: "2026-11-09" }] }) },
    ];
    const result = scoreDestination(dest, participants);
    expect(result.participantFits.every((f) => f.dates.pass)).toBe(true);
  });

  it("fails everyone when there's no common window long enough, blaming the blocker", () => {
    const dest = makeDestination({ typicalLengthDays: 4 });
    const participants: ParticipantResponse[] = [
      { participantId: "p1", participantName: "A", response: makeResponse({ date_ranges: [{ start: "2026-11-01", end: "2026-11-10" }] }) },
      { participantId: "p2", participantName: "B", response: makeResponse({ date_ranges: [{ start: "2026-11-03", end: "2026-11-09" }] }) },
      // C is only free for a single day that doesn't overlap the others at all
      { participantId: "p3", participantName: "C", response: makeResponse({ date_ranges: [{ start: "2026-12-01", end: "2026-12-01" }] }) },
    ];
    const result = scoreDestination(dest, participants);
    const [a, b, c] = result.participantFits;
    expect(a.dates.pass).toBe(false);
    expect(b.dates.pass).toBe(false);
    expect(c.dates.pass).toBe(false);
    // A and B's own ranges overlap fine (11/3-11/9, 7 days) — C is the one whose
    // range shares nothing with anyone, so only C gets individually blamed;
    // A and B each get the generic "group doesn't have a window" message,
    // since excluding either of *them* still leaves no shared window (A vs C,
    // or B vs C, never overlap either).
    expect(c.dates.detail).toMatch(/overlap enough with the group/);
    expect(a.dates.detail).toMatch(/shared .*-day window/);
    expect(b.dates.detail).toMatch(/shared .*-day window/);
  });

  it("reports a shared group message when even excluding one person wouldn't fix it", () => {
    const dest = makeDestination({ typicalLengthDays: 4 });
    const participants: ParticipantResponse[] = [
      { participantId: "p1", participantName: "A", response: makeResponse({ date_ranges: [{ start: "2026-11-01", end: "2026-11-02" }] }) },
      { participantId: "p2", participantName: "B", response: makeResponse({ date_ranges: [{ start: "2026-12-01", end: "2026-12-02" }] }) },
      { participantId: "p3", participantName: "C", response: makeResponse({ date_ranges: [{ start: "2027-01-01", end: "2027-01-02" }] }) },
    ];
    const result = scoreDestination(dest, participants);
    expect(result.participantFits.every((f) => f.dates.detail.match(/shared .*-day window/))).toBe(true);
  });
});

describe("computeShortlist", () => {
  it("ranks a destination matching everyone's stated preferences above one that doesn't", () => {
    const participants: ParticipantResponse[] = [
      {
        participantId: "p1",
        participantName: "Karan",
        response: makeResponse({ max_budget: 40000, destination_types: ["beach"], dealbreakers: [] }),
      },
      {
        participantId: "p2",
        participantName: "Priya",
        response: makeResponse({ max_budget: 40000, destination_types: ["beach"], dealbreakers: [] }),
      },
    ];
    const results = computeShortlist(participants, 20);
    const goa = results.find((r) => r.destination.id === "goa");
    const lehLadakh = results.find((r) => r.destination.id === "leh_ladakh");
    expect(goa).toBeDefined();
    expect(lehLadakh).toBeDefined();
    // Both like beach/high budget — Goa (beach, no dealbreaker hits for this group) should
    // clearly outscore Leh-Ladakh (adventure type, several dealbreaker tags, way over typical fit).
    expect(goa!.score).toBeGreaterThan(lehLadakh!.score);
  });

  it("respects the topN limit", () => {
    const participants: ParticipantResponse[] = [
      { participantId: "p1", participantName: "Karan", response: makeResponse() },
    ];
    expect(computeShortlist(participants, 3)).toHaveLength(3);
    expect(computeShortlist(participants, 1)).toHaveLength(1);
  });
});
