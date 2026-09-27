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

function defaultExtendedDeadlineLocal(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
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
  const [extendDeadlineLocal, setExtendDeadlineLocal] = useState(defaultExtendedDeadlineLocal());

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
  // participants table (name + timestamp only — never preference data,
  // that table has no anon read access) for this session, and just re-fetch
  // the session view whenever it changes. A slow poll stays as a fallback
  // in case Realtime isn't reachable (e.g. blocked websockets).
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
    if (!extendDeadlineLocal) return;
    setOrganizerActionPending(true);
    setOrganizerActionError(null);
    try {
      const v = await extendDeadline(sessionId, new Date(extendDeadlineLocal).toISOString());
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
  const showOrganizerActions = view != null && !view.locked && deadlinePassed && remainingCount > 0;

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound || !view)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Session not found</p>
        <p className="text-sm text-gray-600">Check the link you were sent.</p>
      </main>
    );

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/session/${sessionId}` : "";

  if (view.locked) {
    return (
      <main className="flex flex-1 flex-col gap-5 py-2">
        <div>
          <h1 className="text-2xl font-bold">{view.title}</h1>
          <p className="mt-1 text-sm text-gray-600">Organized by {view.organizerName}</p>
        </div>

        {view.recommendations && <RecommendationResults recommendations={view.recommendations} />}

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
            Everyone&apos;s submitted — finalizing your trip…
          </p>
        )}
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
          The trip is finalized — and nobody sees any result — the moment everyone above has submitted. That&apos;s
          intentional: it&apos;s what stops a single early vote from being treated as final. The deadline is just a
          target, not what triggers it.
        </p>
      </div>

      {showOrganizerActions && isOrganizer && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            The deadline passed with {remainingCount} {remainingCount === 1 ? "person" : "people"} still to submit.
          </p>
          <p className="text-xs text-gray-600">
            Nothing happens automatically — pick one: extend the deadline, or drop a non-responding person from the
            expected count (this can finalize the trip immediately if everyone else has submitted).
          </p>
          <form onSubmit={handleExtendDeadline} className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={extendDeadlineLocal}
              onChange={(e) => setExtendDeadlineLocal(e.target.value)}
            />
            <button
              type="submit"
              disabled={organizerActionPending}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Extend deadline
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
            Thanks{myName ? `, ${myName}` : ""}. You can still edit your answer below until everyone&apos;s submitted.
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
