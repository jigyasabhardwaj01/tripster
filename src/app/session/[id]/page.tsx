"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CountdownTimer from "@/components/CountdownTimer";
import FinalizedResult from "@/components/FinalizedResult";
import ShareLink from "@/components/ShareLink";
import SessionSubmissionForm, { SessionSubmissionFormValues } from "@/components/SessionSubmissionForm";
import { addMySession, getMyName, storeMyName } from "@/lib/mySessions";
import { ApiError, getSessionView, retrySession, SessionViewResponse, submitResponse } from "@/lib/sessionClient";

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
    // Poll while the session is still collecting, so the countdown, who's-
    // submitted list, and (once the deadline passes) the finalized result
    // all show up without a manual refresh.
    const interval = setInterval(() => {
      setView((current) => {
        if (current && !current.locked) load();
        return current;
      });
    }, 20000);
    return () => clearInterval(interval);
  }, [load]);

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

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound || !view)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Session not found</p>
        <p className="text-sm text-gray-600">Check the link you were sent.</p>
      </main>
    );

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/session/${sessionId}` : "";
  const myName = getMyName(sessionId);
  const alreadySubmitted = justSubmitted || (myName ? view.submittedNames.includes(myName) : false);

  if (view.locked) {
    return (
      <main className="flex flex-1 flex-col gap-5 py-2">
        <div>
          <h1 className="text-2xl font-bold">{view.title}</h1>
        </div>

        {view.results && <FinalizedResult result={view.results} />}

        {view.scoringFailed && (
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
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">{view.title}</h1>
      </div>

      <ShareLink url={shareUrl} label="Share this link with the group" />
      <CountdownTimer deadline={view.deadline} onExpire={load} />

      {alreadySubmitted ? (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center">
          <p className="font-semibold text-brand-700">You&apos;re in ✅</p>
          <p className="mt-1 text-sm text-gray-600">
            Thanks{myName ? `, ${myName}` : ""}. You can still edit your answer below until the deadline.
          </p>
        </div>
      ) : null}

      <SessionSubmissionForm
        initialValues={loadMyValues(sessionId) ?? (myName ? { name: myName } : undefined)}
        onSubmit={handleSubmit}
      />

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="font-semibold">{view.submittedNames.length} submitted so far</p>
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
      </div>
    </main>
  );
}
