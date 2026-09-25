import { beforeEach, describe, expect, it } from "vitest";
import { isTripCreator, storeCreatorToken } from "./organizerToken";
import { Trip } from "./types";

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "t1",
    name: "Goa or Bust",
    organizer_name: "Karan",
    status: "collecting",
    invitees: [],
    expected_participant_count: 5,
    confirmation_window_hours: 48,
    confirmation_deadline: null,
    creator_token: "secret-token",
    created_at: "",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("isTripCreator", () => {
  it("is false before any token has been stored", () => {
    expect(isTripCreator("t1", makeTrip())).toBe(false);
  });

  it("is true once the matching token has been stored for that trip", () => {
    storeCreatorToken("t1", "secret-token");
    expect(isTripCreator("t1", makeTrip({ creator_token: "secret-token" }))).toBe(true);
  });

  it("is false if the stored token doesn't match this trip's token", () => {
    storeCreatorToken("t1", "some-other-token");
    expect(isTripCreator("t1", makeTrip({ creator_token: "secret-token" }))).toBe(false);
  });

  it("does not leak across different trips", () => {
    storeCreatorToken("t1", "secret-token");
    expect(isTripCreator("t2", makeTrip({ id: "t2", creator_token: "secret-token" }))).toBe(false);
  });
});
