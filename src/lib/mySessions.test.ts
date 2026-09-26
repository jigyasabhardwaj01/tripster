import { beforeEach, describe, expect, it } from "vitest";
import { addMySession, getMyName, getMySessions, storeMyName } from "./mySessions";

beforeEach(() => {
  window.localStorage.clear();
});

describe("mySessions", () => {
  it("returns empty when nothing saved", () => {
    expect(getMySessions()).toEqual([]);
  });

  it("adds and reads back a session", () => {
    addMySession({ sessionId: "s1", title: "Goa or Bust" });
    const sessions = getMySessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ sessionId: "s1", title: "Goa or Bust" });
  });

  it("sorts newest first", async () => {
    addMySession({ sessionId: "s1", title: "First" });
    await new Promise((r) => setTimeout(r, 2));
    addMySession({ sessionId: "s2", title: "Second" });
    expect(getMySessions().map((s) => s.sessionId)).toEqual(["s2", "s1"]);
  });

  it("survives corrupted localStorage", () => {
    window.localStorage.setItem("tripster:mySessions", "{not json");
    expect(getMySessions()).toEqual([]);
  });
});

describe("my name per session", () => {
  it("is null before anything is stored", () => {
    expect(getMyName("s1")).toBeNull();
  });

  it("stores and retrieves independently per session id", () => {
    storeMyName("s1", "Karan");
    storeMyName("s2", "Priya");
    expect(getMyName("s1")).toBe("Karan");
    expect(getMyName("s2")).toBe("Priya");
  });
});
