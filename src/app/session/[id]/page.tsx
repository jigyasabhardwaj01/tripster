"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import CountdownTimer from "@/components/CountdownTimer";
import RecommendationResults from "@/components/RecommendationResults";
import ShareLink from "@/components/ShareLink";
import SessionSubmissionForm, { SessionSubmissionFormValues } from "@/components/SessionSubmissionForm";
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

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound || !view)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Session not found</p>
        <p className="text-sm text-gray-600">Check the link you were sent.</p>
      </main>
    );

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/session/${sessionId}` : "";
  const showBasedOnBanner = view.includedCount !== null && view.includedCount < view.expectedParticipantCount;

  if (view.locked) {
    return (
      <main className="flex flex-1 flex-col gap-5 py-2">
        <div>
          <h1 className="text-2xl font-bold">{view.title}</h1>
          <p className="mt-1 text-sm text-gray-600">Organized by {view.organizerName}</p>
        </div>

        {showBasedOnBanner && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-800">
              Based on {view.includedCount} of {view.expectedParticipantCount} responses
            </p>
            <p className="mt-1 text-sm text-gray-700">
              The trip window closed before everyone submitted.
              {view.missingNames && view.missingNames.length > 0
                ? ` ${view.missingNames.join(", ")} didn't submit in time.`
                : " We don't have named who's missing — only the count, since this trip wasn't set up with a named list."}
            </p>
          </div>
        )}

        {view.recommendations && (
          <RecommendationResults recommendations={view.recommendations} />
        )}

        {view.recommendationFailed && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="font-semibold text-red-700">Something went wrong finalizing this trip</p>
            <p className="text-sm text-gray-600">
              The AI matching step failed. You can try again — nothing submitted has been lost.
            </p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}

        {!view.recommendations && !view.recommendationFailed && (
          <p className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-600">
            Finalizing your trip…
          </p>
        )}
      </main>
    );
  }

  if (noResponsesAtDeadline) {
    return (
      <main className="flex flex-1 flex-col gap-5 py-2">
        <div>
          <h1 className="text-2xl font-bold">{view.title}</h1>
          <p className="mt-1 text-sm text-gray-600">Organized by {view.organizerName}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
          <p className="font-semibold text-gray-800">No responses were submitted before the deadline</p>
          <p className="mt-1 text-sm text-gray-600">
            Nothing was generated — there&apos;s nothing to base a recommendation on. Submitting now will immediately
            finalize the trip using just your response, since the window has already closed.
          </p>
        </div>
        <SessionSubmissionForm
          initialValues={loadMyValues(sessionId) ?? (myName ? { name: myName } : undefined)}
          nameHint={isOrganizer ? "you're the organizer — this is how the group will see you" : undefined}
          onSubmit={handleSubmit}
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">{view.title}</h1>
        <p className="mt-1 text-sm text-gray-600">Organized by {view.organizerName}</p>
      </div>

      <ShareLink url={shareUrl} label="Share this link with the group" />
      <CountdownTimer deadline={view.deadline} onExpire={() => setDeadlinePassed(true)} />

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="font-semibold">
          {view.submittedCount} of {view.expectedParticipantCount} submitted
        </p>
        {view.submittedNames.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-700">
            {view.submittedNames.map((n) => (
              <li key={n} className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                {n}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          The trip finalizes the moment everyone above has submitted — or when the window below runs out with at
          least one response in, whichever happens first. A late arrival after the window closes can itself
          trigger the result, using just what&apos;s been submitted so far.
        </p>
      </div>

      {isOrganizer && remainingCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            {remainingCount} {remainingCount === 1 ? "person" : "people"} still to submit.
          </p>
          <p className="text-xs text-gray-600">
            Want to finish early, or need more time? Drop a non-responder from the count (can finalize immediately
            if everyone else is in), or add more time to the window.
          </p>
          <form onSubmit={handleExtendDeadline} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600">Add</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm"
              value={extendValue}
              onChange={(e) => setExtendValue(e.target.value)}
            />
            <select
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
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
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Extend
            </button>
          </form>
          <button
            onClick={handleRemoveParticipant}
            disabled={organizerActionPending}
            className="self-start rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60"
          >
            Remove one non-responding participant
          </button>
          {organizerActionError && <p className="text-xs text-red-600">{organizerActionError}</p>}
        </div>
      )}

      {alreadySubmitted ? (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center">
          <p className="font-semibold text-brand-700">You&apos;re in ✅</p>
          <p className="mt-1 text-sm text-gray-600">
            Thanks{myName ? `, ${myName}` : ""}. You can still edit your answer below until the trip finalizes.
          </p>
        </div>
      ) : null}

      <SessionSubmissionForm
        initialValues={loadMyValues(sessionId) ?? (myName ? { name: myName } : undefined)}
        nameHint={isOrganizer ? "you're the organizer — this is how the group will see you" : undefined}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
