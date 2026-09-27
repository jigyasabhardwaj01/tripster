"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoSlideshow from "@/components/PhotoSlideshow";
import { allSlideshowImages, ImageManifest } from "@/lib/imageMatching";
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
  const [slideshowImages, setSlideshowImages] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/images/manifest")
      .then((r) => r.json())
      .then((manifest: ImageManifest) => setSlideshowImages(allSlideshowImages(manifest)))
      .catch(() => setSlideshowImages([]));
  }, []);

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
      setError("Enter how long the trip stays open, a positive number.");
      return;
    }
    const count = usingNamedList ? names.length : Number(expectedParticipantCount);
    if (!Number.isInteger(count) || count < 1) {
      setError("Enter how many people, including you, are expected, at least 1.");
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
    <main className="flex flex-1 flex-col">
      <div className="relative -mx-4 -mt-6 flex h-screen items-end overflow-hidden">
        <PhotoSlideshow images={slideshowImages} />
        <h1 className="relative px-6 pb-8 font-headline text-4xl font-medium leading-tight text-white sm:text-5xl">
          Let&apos;s plan the trip
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Trip name</span>
          <input
            className="rounded-lg border border-cardBorder bg-white px-3 py-2.5 text-ink outline-none focus:border-teal"
            placeholder="Goa or bust 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Your name</span>
          <input
            className="rounded-lg border border-cardBorder bg-white px-3 py-2.5 text-ink outline-none focus:border-teal"
            placeholder="Karan"
            value={organizerName}
            onChange={(e) => setOrganizerName(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Duration</span>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="w-24 rounded-lg border border-cardBorder bg-white px-3 py-2.5 text-ink outline-none focus:border-teal"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              required
            />
            <select
              className="flex-1 rounded-lg border border-cardBorder bg-white px-3 py-2.5 text-ink outline-none focus:border-teal"
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </label>

        {!usingNamedList && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Expected participants</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="rounded-lg border border-cardBorder bg-white px-3 py-2.5 text-ink outline-none focus:border-teal"
              value={expectedParticipantCount}
              onChange={(e) => setExpectedParticipantCount(e.target.value)}
              required
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink/70">
            Who&apos;s coming, optional
          </span>
          <input
            className="rounded-lg border border-cardBorder bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
            placeholder="Karan, Priya, Rahul"
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
          />
          <span className="text-xs text-ink/50">
            {usingNamedList
              ? `Expecting ${names.length} ${names.length === 1 ? "person" : "people"}.`
              : "Name people here if you want them called out by name later, in case someone misses the deadline."}
          </span>
        </label>

        {error && <p className="text-sm text-attention">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-teal px-6 py-3.5 font-semibold text-white shadow-sm disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create trip link"}
        </button>
      </form>
    </main>
  );
}
