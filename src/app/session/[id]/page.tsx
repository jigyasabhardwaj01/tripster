"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CountdownTimer from "@/components/CountdownTimer";
import RecommendationResults, { ResultsSkeleton } from "@/components/RecommendationResults";
import ShareLink from "@/components/ShareLink";
import SessionSubmissionForm, { SessionSubmissionFormValues } from "@/components/SessionSubmissionForm";
import { initials } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";
import { addMySession, getMyName, storeMyName } from "@/lib/mySessions";
import {
  ApiError,
  DurationUnit,
  extendDeadline,
  getSessionView,
  removeNonRespondingParticipant,
  retrySession,
  SessionViewResponse,
  submitResponse,
} from "@/lib/sessionClient";

const MY_VALUES_KEY = (sessionId: string) => `tripster:session:${sessionId}:myValues`;

function Avatar({ name, filled }: { name: string; filled: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
        filled ? "bg-teal text-white" : "border border-cardBorder text-ink/40"
      }`}
    >
      {filled ? initials(name) : "?"}
    </span>
  );
}

function loadMyValues(sessionId: string): Partial<SessionSubmissionFormValues> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(MY_VALUES_KEY(sessionId));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function storeMyValues(sessionId: string, values: SessionSubmissionFormValues) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MY_VALUES_KEY(sessionId), JSON.stringify(values));
  } catch {
    // non-fatal
  }
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const [view, setView] = useState<SessionViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [organizerActionPending, setOrganizerActionPending] = useState(false);
  const [organizerActionError, setOrganizerActionError] = useState<string | null>(null);
  const [extendValue, setExtendValue] = useState("30");
  const [extendUnit, setExtendUnit] = useState<DurationUnit>("minutes");

  const load = useCallback(async () => {
    try {
      const v = await getSessionView(sessionId);
      setView(v);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view?.title) document.title = `${view.title} · Tripster`;
  }, [view?.title]);

  // Live "X of Y submitted" without a manual refresh: subscribe to the
  // session_participants table (name + timestamp only — never preference
  // data, that table has no anon read access) for this session, and just
  // re-fetch the session view whenever it changes. A slow poll stays as a
  // fallback in case Realtime isn't reachable (e.g. blocked websockets),
  // and also so the frontend eventually notices the deadline has passed
  // even with nobody else acting on the trip.
  useEffect(() => {
    const channel = supabase
      .channel(`session_participants:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_participants", filter: `session_id=eq.${sessionId}` },
        () => load()
      )
      .subscribe();

    const interval = setInterval(() => {
      setView((current) => {
        if (current && current.submissionStatus === "collecting") load();
        return current;
      });
    }, 20000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionId, load]);

  async function handleSubmit(values: SessionSubmissionFormValues) {
    await submitResponse(sessionId, values);
    storeMyName(sessionId, values.name);
    storeMyValues(sessionId, values);
    if (view) addMySession({ sessionId, title: view.title });
    setJustSubmitted(true);
    await load();
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const v = await retrySession(sessionId);
      setView(v);
    } catch (err) {
      console.error(err);
    } finally {
      setRetrying(false);
    }
  }

  async function handleExtendDeadline(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(extendValue);
    if (!Number.isFinite(value) || value <= 0) return;
    setOrganizerActionPending(true);
    setOrganizerActionError(null);
    try {
      const v = await extendDeadline(sessionId, value, extendUnit);
      setView(v);
      setDeadlinePassed(false);
    } catch (err) {
      setOrganizerActionError(err instanceof Error ? err.message : "Couldn't extend the deadline.");
    } finally {
      setOrganizerActionPending(false);
    }
  }

  async function handleRemoveParticipant() {
    setOrganizerActionPending(true);
    setOrganizerActionError(null);
    try {
      const v = await removeNonRespondingParticipant(sessionId);
      setView(v);
    } catch (err) {
      setOrganizerActionError(err instanceof Error ? err.message : "Couldn't update the participant count.");
    } finally {
      setOrganizerActionPending(false);
    }
  }

  const myName = getMyName(sessionId);
  const alreadySubmitted = useMemo(
    () => justSubmitted || (view && myName ? view.submittedNames.includes(myName) : false),
    [justSubmitted, view, myName]
  );
  const isOrganizer = view != null && myName === view.organizerName;
  const remainingCount = view ? Math.max(view.expectedParticipantCount - view.submittedCount, 0) : 0;
  const noResponsesAtDeadline = view != null && !view.locked && deadlinePassed && view.submittedCount === 0;

  if (loading) return <main className="flex flex-1 items-center justify-center text-ink/60">Loading…</main>;
  if (notFound || !view)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Session not found</p>
        <p className="text-sm text-ink/60">Check the link you were sent.</p>
      </main>
    );

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/session/${sessionId}` : "";
  const showBasedOnBanner = view.includedCount !== null && view.includedCount < view.expectedParticipantCount;

  if (view.locked) {
    return (
      <main className="flex flex-1 flex-col gap-5 py-2">
        <div>
          <h1 className="font-headline text-2xl font-medium text-ink">{view.title}</h1>
          <p className="mt-1 text-sm text-ink/60">Organized by {view.organizerName}</p>
        </div>

        {showBasedOnBanner && (
          <div className="rounded-2xl border border-cardBorder bg-white p-4">
            <p className="font-semibold text-ink">
              Based on {view.includedCount} of {view.expectedParticipantCount} responses.
              {view.missingNames && view.missingNames.length > 0
                ? ` ${view.missingNames.join(", ")} didn't submit in time.`
                : ""}
            </p>
            {!(view.missingNames && view.missingNames.length > 0) && (
              <p className="mt-1 text-sm text-ink/60">
                The trip window closed before everyone submitted. This trip wasn&apos;t set up with a named list, so
                only the count is known, not who.
              </p>
            )}
          </div>
        )}

        {view.recommendations && (
          <>
            <RecommendationResults
              recommendations={view.recommendations}
              mostCommonDestinationType={view.mostCommonDestinationType}
            />
            <a
              href={`/api/sessions/${sessionId}/itinerary`}
              className="self-center rounded-xl border border-teal-100 bg-white px-5 py-2.5 text-sm font-semibold text-teal shadow-sm"
            >
              Download itinerary (PDF)
            </a>
          </>
        )}

        {view.recommendationFailed && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-attention/30 bg-white p-5 text-center">
            <p className="font-semibold text-attention">Something went wrong finalizing this trip</p>
            <p className="text-sm text-ink/60">
              The AI matching step failed. You can try again, nothing submitted has been lost.
            </p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="rounded-xl bg-teal px-6 py-3 font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}

        {!view.recommendations && !view.recommendationFailed && (
          <>
            <p className="text-center text-sm text-ink/60">Finalizing your trip…</p>
            <ResultsSkeleton />
          </>
        )}
      </main>
    );
  }

  if (noResponsesAtDeadline) {
    return (
      <main className="flex flex-1 flex-col gap-5 py-2">
        <div>
          <h1 className="font-headline text-2xl font-medium text-ink">{view.title}</h1>
          <p className="mt-1 text-sm text-ink/60">Organized by {view.organizerName}</p>
        </div>
        <div className="rounded-2xl border border-cardBorder bg-white p-5 text-center">
          <p className="font-semibold text-ink">No responses were submitted before the deadline</p>
          <p className="mt-1 text-sm text-ink/60">
            Nothing was generated. There&apos;s nothing to base a recommendation on. Submitting now will immediately
            finalize the trip using just your response, since the window has already closed.
          </p>
        </div>
        <SessionSubmissionForm
          initialValues={loadMyValues(sessionId) ?? (myName ? { name: myName } : undefined)}
          nameHint={isOrganizer ? "you're the organizer, this is how the group will see you" : undefined}
          onSubmit={handleSubmit}
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="font-headline text-2xl font-medium text-ink">{view.title}</h1>
        <p className="mt-1 text-sm text-ink/60">Organized by {view.organizerName}</p>
      </div>

      <ShareLink url={shareUrl} label="Share this link with the group" />
      <CountdownTimer deadline={view.deadline} onExpire={() => setDeadlinePassed(true)} />

      <div className="rounded-2xl border border-cardBorder bg-white p-4 shadow-sm">
        <p className="font-semibold">
          {view.submittedCount} of {view.expectedParticipantCount} submitted
        </p>
        {view.submittedNames.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2 text-sm text-ink/70">
            {view.submittedNames.map((n) => (
              <li key={n} className="flex items-center gap-2.5">
                <Avatar name={n} filled />
                {n}
              </li>
            ))}
            {Array.from({ length: remainingCount }).map((_, i) => (
              <li key={`pending-${i}`} className="flex items-center gap-2.5 text-ink/40">
                <Avatar name="" filled={false} />
                Waiting on a response
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-cardBorder pt-3 text-xs text-ink/60">
          The trip finalizes the moment everyone above has submitted, or when the window below runs out with at
          least one response in, whichever happens first. A late arrival after the window closes can itself
          trigger the result, using just what&apos;s been submitted so far.
        </p>
      </div>

      {isOrganizer && remainingCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-cardBorder bg-white p-4">
          <p className="text-sm font-semibold text-ink">
            {remainingCount} {remainingCount === 1 ? "person" : "people"} still to submit.
          </p>
          <p className="text-xs text-ink/60">
            Want to finish early, or need more time? Drop a non-responder from the count, can finalize immediately
            if everyone else is in, or add more time to the window.
          </p>
          <form onSubmit={handleExtendDeadline} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink/60">Add</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="w-20 rounded-lg border border-cardBorder px-2 py-2 text-sm"
              value={extendValue}
              onChange={(e) => setExtendValue(e.target.value)}
            />
            <select
              className="rounded-lg border border-cardBorder px-2 py-2 text-sm"
              value={extendUnit}
              onChange={(e) => setExtendUnit(e.target.value as DurationUnit)}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
            <button
              type="submit"
              disabled={organizerActionPending}
              className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Extend
            </button>
          </form>
          <button
            onClick={handleRemoveParticipant}
            disabled={organizerActionPending}
            className="self-start rounded-lg border border-cardBorder px-4 py-2 text-sm font-semibold text-teal disabled:opacity-60"
          >
            Remove one non-responding participant
          </button>
          {organizerActionError && <p className="text-xs text-attention">{organizerActionError}</p>}
        </div>
      )}

      {alreadySubmitted ? (
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-center">
          <p className="font-semibold text-teal-700">You&apos;re in ✅</p>
          <p className="mt-1 text-sm text-ink/60">
            Thanks{myName ? `, ${myName}` : ""}. You can still edit your answer below until the trip finalizes.
          </p>
        </div>
      ) : null}

      <h2 className="font-headline text-2xl font-medium text-ink">Where do you want to go?</h2>

      <SessionSubmissionForm
        initialValues={loadMyValues(sessionId) ?? (myName ? { name: myName } : undefined)}
        nameHint={isOrganizer ? "you're the organizer, this is how the group will see you" : undefined}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
