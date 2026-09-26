import { describe, expect, it } from "vitest";
import { InvalidDateRangeError, validateDateRanges } from "./dateRangeValidation";

describe("validateDateRanges", () => {
  it("passes when every exit_date is strictly after its start_date", () => {
    expect(() =>
      validateDateRanges([
        { start_date: "2026-11-01", exit_date: "2026-11-10" },
        { start_date: "2026-12-01", exit_date: "2026-12-02" },
      ])
    ).not.toThrow();
  });

  it("passes with an empty list", () => {
    expect(() => validateDateRanges([])).not.toThrow();
  });

  it("throws InvalidDateRangeError when exit_date equals start_date", () => {
    expect(() => validateDateRanges([{ start_date: "2026-11-01", exit_date: "2026-11-01" }])).toThrow(
      InvalidDateRangeError
    );
  });

  it("throws InvalidDateRangeError when exit_date is before start_date", () => {
    expect(() => validateDateRanges([{ start_date: "2026-11-10", exit_date: "2026-11-01" }])).toThrow(
      InvalidDateRangeError
    );
  });

  it("throws on the first bad range even if later ranges are fine", () => {
    expect(() =>
      validateDateRanges([
        { start_date: "2026-11-10", exit_date: "2026-11-01" },
        { start_date: "2026-12-01", exit_date: "2026-12-05" },
      ])
    ).toThrow(InvalidDateRangeError);
  });

  it("throws when a range is missing a date entirely", () => {
    expect(() => validateDateRanges([{ start_date: "", exit_date: "2026-11-01" }])).toThrow(
      InvalidDateRangeError
    );
    expect(() => validateDateRanges([{ start_date: "2026-11-01", exit_date: "" }])).toThrow(
      InvalidDateRangeError
    );
  });
});
