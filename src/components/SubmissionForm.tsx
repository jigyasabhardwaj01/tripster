"use client";

import { useState } from "react";
import { DateRange, DEALBREAKERS, DealbreakerId, DESTINATION_TYPES, DestinationType } from "@/lib/types";

function emptyRange(): DateRange {
  return { start: "", end: "" };
}

export interface SubmissionFormValues {
  name: string;
  maxBudget: number;
  dateRanges: DateRange[];
  destinationTypes: DestinationType[];
  dealbreakers: DealbreakerId[];
}

export default function SubmissionForm({
  initialName = "",
  nameHint,
  onSubmit,
}: {
  initialName?: string;
  nameHint?: string;
  onSubmit: (values: SubmissionFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [maxBudget, setMaxBudget] = useState("");
  const [dateRanges, setDateRanges] = useState<DateRange[]>([emptyRange()]);
  const [destinationTypes, setDestinationTypes] = useState<DestinationType[]>([]);
  const [dealbreakers, setDealbreakers] = useState<DealbreakerId[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(list: T[], value: T, setList: (v: T[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function updateRange(idx: number, field: keyof DateRange, value: string) {
    setDateRanges((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function addRange() {
    setDateRanges((prev) => [...prev, emptyRange()]);
  }

  function removeRange(idx: number) {
    setDateRanges((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const budgetNum = Number(maxBudget);
    if (!name.trim()) return setError("Enter your name.");
    if (!maxBudget || Number.isNaN(budgetNum) || budgetNum <= 0) return setError("Enter a valid budget.");
    const validRanges = dateRanges.filter((r) => r.start && r.end);
    if (validRanges.length === 0) return setError("Add at least one available date range.");
    for (const r of validRanges) {
      if (r.end < r.start) return setError("Each date range's end must be after its start.");
    }
    if (destinationTypes.length === 0) return setError("Pick at least one destination type you'd enjoy.");

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        maxBudget: budgetNum,
        dateRanges: validRanges,
        destinationTypes,
        dealbreakers,
      });
    } catch (err) {
      console.error(err);
      setError("Couldn't save your response. Please try again.");
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

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">Max budget per person (₹)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className="rounded-lg border border-gray-300 px-3 py-2"
          placeholder="e.g. 15000"
          value={maxBudget}
          onChange={(e) => setMaxBudget(e.target.value)}
          required
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Dates you&apos;re available</span>
        {dateRanges.map((r, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="date"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              value={r.start}
              onChange={(e) => updateRange(idx, "start", e.target.value)}
              required
            />
            <span className="text-gray-400">–</span>
            <input
              type="date"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              value={r.end}
              onChange={(e) => updateRange(idx, "end", e.target.value)}
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
              onClick={() => toggle(destinationTypes, t, setDestinationTypes)}
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

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Dealbreakers — things you won&apos;t do</span>
        <div className="flex flex-col gap-2">
          {DEALBREAKERS.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={dealbreakers.includes(d.id)}
                onChange={() => toggle(dealbreakers, d.id, setDealbreakers)}
                className="h-4 w-4 rounded border-gray-300"
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

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
