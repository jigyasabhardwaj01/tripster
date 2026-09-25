import { describe, expect, it } from "vitest";
import { buildNudgeMessage, buildNudgeWhatsAppLink } from "./nudge";

describe("buildNudgeMessage", () => {
  it("includes the participant's name, trip name, and link", () => {
    const message = buildNudgeMessage("Goa or Bust", "https://tripster.app/trip/abc", "Priya");
    expect(message).toContain("Priya");
    expect(message).toContain("Goa or Bust");
    expect(message).toContain("https://tripster.app/trip/abc");
  });
});

describe("buildNudgeWhatsAppLink", () => {
  it("produces a wa.me link with no phone number (opens the picker) and an encoded message", () => {
    const link = buildNudgeWhatsAppLink("Goa or Bust", "https://tripster.app/trip/abc", "Priya");
    expect(link).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const encodedPart = link.split("?text=")[1];
    expect(decodeURIComponent(encodedPart)).toContain("Priya");
    expect(decodeURIComponent(encodedPart)).toContain("https://tripster.app/trip/abc");
  });

  it("safely encodes special characters in the trip name", () => {
    const link = buildNudgeWhatsAppLink("Trip & Friends? 100%!", "https://tripster.app/trip/abc", "Rohan");
    // must not contain raw & or ? outside the one query-string separator, or it'd break the URL
    const [base, query] = link.split("?text=");
    expect(base).toBe("https://wa.me/");
    expect(query).not.toContain("&Friends"); // raw & would have split the query string
    expect(decodeURIComponent(query)).toContain("Trip & Friends? 100%!");
  });
});
