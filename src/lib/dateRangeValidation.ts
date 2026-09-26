// Pure — no "server-only" import — so it's unit-testable and shareable with
// client-side form validation later (same rule, both places: exit_date must
// be strictly after start_date).
export interface DateRange {
  start_date: string;
  exit_date: string;
}

export class InvalidDateRangeError extends Error {
  constructor(message = "Exit date must be after the start date.") {
    super(message);
    this.name = "InvalidDateRangeError";
  }
}

/** Throws InvalidDateRangeError on the first bad range — never fails silently. */
export function validateDateRanges(ranges: DateRange[]): void {
  for (const r of ranges) {
    if (!r.start_date || !r.exit_date) {
      throw new InvalidDateRangeError("Each date range needs both a start date and an exit date.");
    }
    if (new Date(r.exit_date).getTime() <= new Date(r.start_date).getTime()) {
      throw new InvalidDateRangeError();
    }
  }
}
