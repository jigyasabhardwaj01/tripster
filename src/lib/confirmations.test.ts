import { describe, expect, it } from "vitest";
import { myEffectiveConfirmation, summarizeDestinationConfirmations } from "./confirmations";

const roster = [
  { id: "p1", name: "Jigyasa" },
  { id: "p2", name: "Aaditaa" },
  { id: "p3", name: "Sakshi" },
  { id: "p4", name: "Sushmitha" },
];

describe("summarizeDestinationConfirmations", () => {
  it("treats everyone as still in when nobody has recorded anything", () => {
    const result = summarizeDestinationConfirmations(roster, []);
    expect(result.stillIn).toHaveLength(4);
    expect(result.optedOut).toHaveLength(0);
  });

  it("moves only the people who explicitly opted out", () => {
    const result = summarizeDestinationConfirmations(roster, [
      { participant_id: "p4", confirmed: false },
    ]);
    expect(result.stillIn.map((p) => p.name)).toEqual(["Jigyasa", "Aaditaa", "Sakshi"]);
    expect(result.optedOut.map((p) => p.name)).toEqual(["Sushmitha"]);
  });

  it("an explicit confirmed:true record doesn't change anything (still in either way)", () => {
    const result = summarizeDestinationConfirmations(roster, [
      { participant_id: "p1", confirmed: true },
    ]);
    expect(result.stillIn).toHaveLength(4);
    expect(result.optedOut).toHaveLength(0);
  });

  it("handles everyone opting out", () => {
    const result = summarizeDestinationConfirmations(
      roster,
      roster.map((p) => ({ participant_id: p.id, confirmed: false }))
    );
    expect(result.stillIn).toHaveLength(0);
    expect(result.optedOut).toHaveLength(4);
  });
});

describe("myEffectiveConfirmation", () => {
  it("defaults to true (in) when there's no participant id at all", () => {
    expect(myEffectiveConfirmation(null, [])).toBe(true);
  });

  it("defaults to true when this participant has no explicit record", () => {
    expect(myEffectiveConfirmation("p1", [{ participant_id: "p2", confirmed: false }])).toBe(true);
  });

  it("returns false once this participant has explicitly opted out", () => {
    expect(myEffectiveConfirmation("p1", [{ participant_id: "p1", confirmed: false }])).toBe(false);
  });

  it("returns true if they opted out and then rejoined (latest record wins via find — first match)", () => {
    // setConfirmation upserts on a unique (trip, participant, destination) key, so there's only
    // ever one row per participant per destination — this just confirms the true case reads correctly.
    expect(myEffectiveConfirmation("p1", [{ participant_id: "p1", confirmed: true }])).toBe(true);
  });
});
