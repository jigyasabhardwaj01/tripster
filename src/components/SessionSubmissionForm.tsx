"use client";

import { useState } from "react";
import { DESTINATION_TYPES, DestinationType } from "@/lib/types";
import { DateRangeInput, SubmissionInput } from "@/lib/sessionClient";

function emptyRange(): DateRangeInput {
  return { start_date: "", exit_date: "" };
}

/** exit_date must be strictly after start_date — the day after start_date, in YYYY-MM-DD, for the exit picker's min attribute. */
function dayAfter(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface SessionSubmissionFormValues extends SubmissionInput {}

export default function SessionSubmissionForm({
  initialValues,
  nameHint,
  onSubmit,
}: {
  initialValues?: Partial<SessionSubmissionFormValues>;
  nameHint?: string;
  onSubmit: (values: SessionSubmissionFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [budgetMin, setBudgetMin] = useState(initialValues?.budget_min?.toString() ?? "");
  const [budgetMax, setBudgetMax] = useState(initialValues?.budget_max?.toString() ?? "");
  const [dateRanges, setDateRanges] = useState<DateRangeInput[]>(
    initialValues?.date_ranges?.length ? initialValues.date_ranges : [emptyRange()]
  );
  const [destinationTypes, setDestinationTypes] = useState<DestinationType[]>(
    (initialValues?.destination_types as DestinationType[]) ?? []
  );
  const [preferredLocationsText, setPreferredLocationsText] = useState(
    initialValues?.preferred_locations?.join(", ") ?? ""
  );
  const [dealbreakers, setDealbreakers] = useState(initialValues?.dealbreakers ?? "");

  const [rangeErrors, setRangeErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleType(t: DestinationType) {
    setDestinationTypes((prev) => (prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]));
  }

  function updateRange(idx: number, field: keyof DateRangeInput, value: string) {
    setDateRanges((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    setRangeErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  function addRange() {
    setDateRanges((prev) => [...prev, emptyRange()]);
  }

  function removeRange(idx: number) {
    setDateRanges((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function validateRanges(ranges: DateRangeInput[]): boolean {
    const errors: Record<number, string> = {};
    ranges.forEach((r, idx) => {
      if (r.start_date && r.exit_date && r.exit_date <= r.start_date) {
        errors[idx] = "Exit date must be after the start date.";
      }
    });
    setRangeErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const min = Number(budgetMin);
    const max = Number(budgetMax);
    if (!name.trim()) return setError("Enter your name.");
    if (!budgetMin || !budgetMax || Number.isNaN(min) || Number.isNaN(max) || min > max) {
      return setError("Enter a valid budget range (min must be ≤ max).");
    }
    const validRanges = dateRanges.filter((r) => r.start_date && r.exit_date);
    if (validRanges.length === 0) return setError("Add at least one available date range.");
    if (!validateRanges(validRanges)) return; // inline per-row errors already shown
    if (destinationTypes.length === 0) return setError("Pick at least one destination type you'd enjoy.");

    const preferredLocations = preferredLocationsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        budget_min: min,
        budget_max: max,
        date_ranges: validRanges,
        destination_types: destinationTypes,
        preferred_locations: preferredLocations,
        dealbreakers,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Couldn't save your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">
          Your name{nameHint && ` (${nameHint})`}
        </span>
        <input
          className="rounded-lg border border-gray-300 px-3 py-2"
          placeholder="e.g. Priya"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Min budget (₹)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="10000"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Max budget (₹)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="20000"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Dates you&apos;re available</span>
        {dateRanges.map((r, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                value={r.start_date}
                onChange={(e) => updateRange(idx, "start_date", e.target.value)}
                required
              />
              <span className="text-gray-400">–</span>
              <input
                type="date"
                min={dayAfter(r.start_date)}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                value={r.exit_date}
                onChange={(e) => updateRange(idx, "exit_date", e.target.value)}
                required
              />
              {dateRanges.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRange(idx)}
                  className="shrink-0 px-1 text-gray-400"
                  aria-label="Remove date range"
                >
                  ✕
                </button>
              )}
            </div>
            {rangeErrors[idx] && <p className="text-xs text-red-600">{rangeErrors[idx]}</p>}
          </div>
        ))}
        <button type="button" onClick={addRange} className="self-start text-sm font-medium text-brand-700">
          + Add another window
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">What kind of trip? (pick any)</span>
        <div className="flex flex-wrap gap-2">
          {DESTINATION_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => toggleType(t)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                destinationTypes.includes(t)
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">
          Specific places you&apos;d want to go <span className="font-normal text-gray-400">(optional)</span>
        </span>
        <input
          className="rounded-lg border border-gray-300 px-3 py-2"
          placeholder="e.g. Goa, Manali"
          value={preferredLocationsText}
          onChange={(e) => setPreferredLocationsText(e.target.value)}
        />
        <span className="text-xs text-gray-500">
          Comma-separated. Leave blank to let the destination type above speak for you.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Dealbreakers — anything you won&apos;t do</span>
        <textarea
          className="min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. no overnight buses, nothing above 10,000ft"
          value={dealbreakers}
          onChange={(e) => setDealbreakers(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Submit my preferences"}
      </button>
    </form>
  );
}
