"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ShareLink from "@/components/ShareLink";
import { findOrCreateParticipant, getResponseForParticipant, upsertResponse } from "@/lib/db";
import { getTrip } from "@/lib/db";
import { addMyTrip } from "@/lib/myTrips";
import { maybeAdvanceAfterResponse } from "@/lib/tripLifecycle";
import { DateRange, DEALBREAKERS, DealbreakerId, DESTINATION_TYPES, DestinationType, Trip } from "@/lib/types";

function emptyRange(): DateRange {
  return { start: "", end: "" };
}

export default function SubmitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = params.id;
  const showShare = searchParams.get("share") === "1";

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [maxBudget, setMaxBudget] = useState("");
  const [dateRanges, setDateRanges] = useState<DateRange[]>([emptyRange()]);
  const [destinationTypes, setDestinationTypes] = useState<DestinationType[]>([]);
  const [dealbreakers, setDealbreakers] = useState<DealbreakerId[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await getTrip(tripId);
        if (!t) {
          setNotFound(true);
        } else {
          setTrip(t);
        }
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

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
      const participant = await findOrCreateParticipant(tripId, name.trim());
      const existing = await getResponseForParticipant(participant.id);
      await upsertResponse(tripId, participant.id, {
        maxBudget: budgetNum,
        dateRanges: validRanges,
        destinationTypes,
        dealbreakers,
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(`tripster:${tripId}:participantId`, participant.id);
        window.localStorage.setItem(`tripster:${tripId}:participantName`, name.trim());
      }
      if (trip) addMyTrip({ tripId, tripName: trip.name, role: "participant" });
      await maybeAdvanceAfterResponse(tripId);
      setSubmitted(true);
      void existing; // existing response, if any, was just overwritten — fine, resubmission is allowed
    } catch (err) {
      console.error(err);
      setError("Couldn't save your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Trip not found</p>
        <p className="text-sm text-gray-600">Check the link you were sent.</p>
      </main>
    );

  if (submitted) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">You&apos;re in ✅</h1>
          <p className="mt-2 text-gray-600">
            Thanks, {name.trim()}. We&apos;ll match destinations once enough of the group has responded.
          </p>
        </div>
        <button
          className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm"
          onClick={() => setSubmitted(false)}
        >
          Edit my response
        </button>
        <a href={`/trip/${tripId}/status`} className="text-sm text-brand-700 underline">
          See who else has submitted
        </a>
        <a href={`/trip/${tripId}/results`} className="text-sm text-brand-700 underline">
          Check if results are ready
        </a>
      </main>
    );
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/trip/${tripId}/submit` : "";

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">{trip?.name}</h1>
        <p className="mt-1 text-sm text-gray-600">Organized by {trip?.organizer_name}</p>
      </div>

      {showShare && shareUrl && (
        <ShareLink url={shareUrl} label="Share this link with the group" />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">
            Your name{showShare && " (you're the organizer — this is how the group will see you)"}
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
    </main>
  );
}
