import { beforeEach, describe, expect, it } from "vitest";
import { addMyTrip, getMyTrips } from "./myTrips";

beforeEach(() => {
  window.localStorage.clear();
});

describe("myTrips", () => {
  it("returns an empty list when nothing has been saved", () => {
    expect(getMyTrips()).toEqual([]);
  });

  it("adds a trip and reads it back", () => {
    addMyTrip({ tripId: "t1", tripName: "Goa or Bust", role: "participant" });
    const trips = getMyTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({ tripId: "t1", tripName: "Goa or Bust", role: "participant" });
  });

  it("does not downgrade an organizer to participant on a later call", () => {
    addMyTrip({ tripId: "t1", tripName: "Goa or Bust", role: "organizer" });
    addMyTrip({ tripId: "t1", tripName: "Goa or Bust", role: "participant" });
    const trips = getMyTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].role).toBe("organizer");
  });

  it("does upgrade a participant to organizer if that's genuinely what happens", () => {
    addMyTrip({ tripId: "t1", tripName: "Goa or Bust", role: "participant" });
    addMyTrip({ tripId: "t1", tripName: "Goa or Bust", role: "organizer" });
    expect(getMyTrips()[0].role).toBe("organizer");
  });

  it("keeps separate trips separate and sorts newest first", async () => {
    addMyTrip({ tripId: "t1", tripName: "First Trip", role: "organizer" });
    await new Promise((r) => setTimeout(r, 2));
    addMyTrip({ tripId: "t2", tripName: "Second Trip", role: "participant" });
    const trips = getMyTrips();
    expect(trips).toHaveLength(2);
    expect(trips[0].tripId).toBe("t2"); // most recently saved first
    expect(trips[1].tripId).toBe("t1");
  });

  it("survives a corrupted localStorage value instead of throwing", () => {
    window.localStorage.setItem("tripster:myTrips", "{not valid json");
    expect(getMyTrips()).toEqual([]);
  });
});
