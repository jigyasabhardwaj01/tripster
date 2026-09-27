"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMySession, storeMyName } from "@/lib/mySessions";
import { ApiError, createSession, DurationUnit } from "@/lib/sessionClient";

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [durationValue, setDurationValue] = useState("48");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");
  const [expectedParticipantCount, setExpectedParticipantCount] = useState("2");
  const [namesText, setNamesText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = namesText
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const usingNamedList = names.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const duration = Number(durationValue);
    if (!title.trim() || !organizerName.trim()) return;
    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Enter how long the trip stays open — a positive number.");
      return;
    }
    const count = usingNamedList ? names.length : Number(expectedParticipantCount);
    if (!Number.isInteger(count) || count < 1) {
      setError("Enter how many people (including you) are expected — at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      const { session } = await createSession(
        title.trim(),
        organizerName.trim(),
        duration,
        durationUnit,
        count,
        usingNamedList ? names : null
      );
      addMySession({ sessionId: session.id, title: title.trim() });
      storeMyName(session.id, organizerName.trim());
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof ApiError && err.status < 500
          ? err.message
          : "Couldn't create the trip. Check your Supabase/Gemini setup and try again.";
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">Start a trip</h1>
        <p className="mt-1 text-sm text-gray-600">
          You&apos;ll get one link to send the group. AI picks a destination the moment everyone submits — or, if the
          trip window runs out first, from whoever did.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Trip name</span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. Goa-or-bust 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Your name</span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. Karan"
            value={organizerName}
            onChange={(e) => setOrganizerName(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Trip window stays open for</span>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              required
            />
            <select
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
          <span className="text-xs text-gray-500">
            A hard cutoff, not just a target: the deadline is created_at + this duration. Generation fires the
            moment everyone submits, or when this runs out with at least one response in — whichever comes first.
            5 minutes is fine for testing.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">
            Who&apos;s coming? <span className="font-normal text-gray-400">(optional, comma-separated)</span>
          </span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. Karan, Priya, Rahul"
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
          />
          <span className="text-xs text-gray-500">
            {usingNamedList
              ? `Expecting ${names.length} ${names.length === 1 ? "person" : "people"} — if the deadline hits early, we can name exactly who didn't make it.`
              : "Leave blank to just set a headcount below — if the deadline hits early, we'll only be able to say how many were missing, not who."}
          </span>
        </label>

        {!usingNamedList && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">How many people, including you?</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="rounded-lg border border-gray-300 px-3 py-2"
              value={expectedParticipantCount}
              onChange={(e) => setExpectedParticipantCount(e.target.value)}
              required
            />
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create trip & get link"}
        </button>
      </form>
    </main>
  );
}
