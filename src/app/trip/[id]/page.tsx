"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DestinationCard from "@/components/DestinationCard";
import ShareLink from "@/components/ShareLink";
import StatusPanel from "@/components/StatusPanel";
import SubmissionForm, { SubmissionFormValues } from "@/components/SubmissionForm";
import {
  findOrCreateParticipant,
  findParticipantByName,
  getParticipant,
  getResponseForParticipant,
  getTrip,
  listConfirmations,
  listParticipantsWithResponses,
  setConfirmation,
  upsertResponse,
} from "@/lib/db";
import { formatDeadline } from "@/lib/format";
import { addMyTrip } from "@/lib/myTrips";
import { DestinationScore } from "@/lib/scoring";
import { getShortlistScores } from "@/lib/shortlist";
import { isTripCreator, maybeAdvanceAfterResponse, maybeFinalizeTrip } from "@/lib/tripLifecycle";
import { Confirmation, Participant, Response, Trip } from "@/lib/types";

const PARTICIPANT_ID_KEY = (tripId: string) => `tripster:${tripId}:participantId`;
const PARTICIPANT_NAME_KEY = (tripId: string) => `tripster:${tripId}:participantName`;

export default function TripPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Awaited<ReturnType<typeof listParticipantsWithResponses>>>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [myResponse, setMyResponse] = useState<Response | null>(null);
  const [scores, setScores] = useState<DestinationScore[] | null>(null);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function loadAll() {
    try {
      // Opportunistic finalize check — see lib/tripLifecycle.ts. Cheap no-op
      // if the trip isn't in "confirming" or its deadline hasn't passed.
      await maybeFinalizeTrip(tripId);

      const t = await getTrip(tripId);
      if (!t) {
        setNotFound(true);
        return;
      }
      setTrip(t);

      const ps = await listParticipantsWithResponses(tripId);
      setParticipants(ps);

      const storedId = typeof window !== "undefined" ? window.localStorage.getItem(PARTICIPANT_ID_KEY(tripId)) : null;
      if (storedId) {
        const [p, r] = await Promise.all([getParticipant(storedId), getResponseForParticipant(storedId)]);
        setMyParticipant(p);
        setMyResponse(r);
      }

      if (t.status === "confirming" || t.status === "final") {
        const [s, c] = await Promise.all([getShortlistScores(tripId), listConfirmations(tripId)]);
        setScores(s);
        setConfirmations(c);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const isOrganizer = useMemo(() => (trip ? isTripCreator(tripId, trip) : false), [trip, tripId]);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/trip/${tripId}` : "";

  const myConfirmations = useMemo(() => {
    if (!myParticipant) return new Map<string, boolean>();
    return new Map(
      confirmations.filter((c) => c.participant_id === myParticipant.id).map((c) => [c.destination_id, c.confirmed])
    );
  }, [confirmations, myParticipant]);

  async function handleSubmitResponse(values: SubmissionFormValues) {
    const participant = await findOrCreateParticipant(tripId, values.name);
    await upsertResponse(tripId, participant.id, {
      maxBudget: values.maxBudget,
      dateRanges: values.dateRanges,
      destinationTypes: values.destinationTypes,
      dealbreakers: values.dealbreakers,
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PARTICIPANT_ID_KEY(tripId), participant.id);
      window.localStorage.setItem(PARTICIPANT_NAME_KEY(tripId), values.name);
    }
    addMyTrip({ tripId, tripName: trip?.name ?? "", role: isOrganizer ? "organizer" : "participant" });
    await maybeAdvanceAfterResponse(tripId); // no-op unless this response hits the expected count
    await loadAll();
  }

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    const found = await findParticipantByName(tripId, nameInput);
    if (!found) {
      setLookupError("No response found under that name.");
      return;
    }
    setMyParticipant(found);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PARTICIPANT_ID_KEY(tripId), found.id);
      window.localStorage.setItem(PARTICIPANT_NAME_KEY(tripId), found.name);
    }
  }

  async function handleConfirm(destinationId: string, confirmed: boolean) {
    if (!myParticipant) return;
    await setConfirmation(tripId, myParticipant.id, destinationId, confirmed);
    setConfirmations((prev) => [
      ...prev.filter((c) => !(c.participant_id === myParticipant.id && c.destination_id === destinationId)),
      {
        id: `${myParticipant.id}:${destinationId}`,
        trip_id: tripId,
        participant_id: myParticipant.id,
        destination_id: destinationId,
        confirmed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound || !trip)
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Trip not found</p>
        <p className="text-sm text-gray-600">Check the link you were sent.</p>
      </main>
    );

  function confirmationSummaryFor(destinationId: string) {
    const confs = confirmations.filter((c) => c.destination_id === destinationId);
    const stillIn = confs.filter((c) => c.confirmed);
    const droppedOut = confs.filter((c) => !c.confirmed);
    const nameFor = (participantId: string) =>
      scores?.flatMap((s) => s.participantFits).find((f) => f.participantId === participantId)?.participantName;
    if (confs.length === 0) return <p className="text-xs text-gray-400">No confirmations yet.</p>;
    return (
      <div className="rounded-lg border border-gray-200 p-2 text-xs text-gray-600">
        <p>
          <span className="font-semibold text-green-700">{stillIn.length} still in:</span>{" "}
          {stillIn.map((c) => nameFor(c.participant_id)).join(", ") || "—"}
        </p>
        {droppedOut.length > 0 && (
          <p className="mt-1">
            <span className="font-semibold text-red-700">{droppedOut.length} opted out:</span>{" "}
            {droppedOut.map((c) => nameFor(c.participant_id)).join(", ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">{trip.name}</h1>
        <p className="mt-1 text-sm text-gray-600">Organized by {trip.organizer_name}</p>
      </div>

      {isOrganizer && trip.status === "collecting" && (
        <ShareLink url={shareUrl} label="Share this link with the group" />
      )}

      {trip.status === "collecting" && (
        <>
          {myResponse ? (
            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center">
              <p className="font-semibold text-brand-700">You&apos;re in ✅</p>
              <p className="mt-1 text-sm text-gray-600">
                Thanks, {myParticipant?.name}. We&apos;ll match destinations automatically once enough of the group
                has responded.
              </p>
            </div>
          ) : (
            <SubmissionForm
              initialName={isOrganizer ? trip.organizer_name : ""}
              nameHint={isOrganizer ? "you're the organizer — this is how the group will see you" : undefined}
              onSubmit={handleSubmitResponse}
            />
          )}
          <StatusPanel
            tripName={trip.name}
            shareUrl={shareUrl}
            invitees={trip.invitees}
            participants={participants}
            expectedCount={trip.expected_participant_count}
            isOrganizer={isOrganizer}
          />
        </>
      )}

      {trip.status === "confirming" && (
        <>
          <StatusPanel
            tripName={trip.name}
            shareUrl={shareUrl}
            invitees={trip.invitees}
            participants={participants}
            expectedCount={trip.expected_participant_count}
            isOrganizer={false} // collecting is closed — nudging to submit no longer applies
          />
          {trip.confirmation_deadline && (
            <p className="rounded-xl bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800">
              {formatDeadline(trip.confirmation_deadline)}
            </p>
          )}

          {!myParticipant && (
            <form onSubmit={handleIdentify} className="flex flex-col gap-3">
              <p className="text-sm text-gray-600">Enter your name to review and confirm the shortlist.</p>
              <input
                className="rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Your name (as submitted)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
              />
              {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}
              <button type="submit" className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white">
                Continue
              </button>
            </form>
          )}

          <div className="flex flex-col gap-4">
            {(scores ?? []).map((score) => {
              const myAnswer = myConfirmations.get(score.destination.id);
              return (
                <DestinationCard
                  key={score.destination.id}
                  score={score}
                  // AI SUMMARY INTEGRATION POINT (not wired up — see lib/summary.ts):
                  // pass a `summary` string here once a real model call is plugged in.
                  footer={
                    <div className="flex flex-col gap-2">
                      {myParticipant && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirm(score.destination.id, true)}
                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                              myAnswer === true
                                ? "bg-brand-500 text-white"
                                : "border border-brand-500 text-brand-700"
                            }`}
                          >
                            Still in ✓
                          </button>
                          <button
                            onClick={() => handleConfirm(score.destination.id, false)}
                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                              myAnswer === false ? "bg-gray-700 text-white" : "border border-gray-400 text-gray-600"
                            }`}
                          >
                            Not for me
                          </button>
                        </div>
                      )}
                      {confirmationSummaryFor(score.destination.id)}
                    </div>
                  }
                />
              );
            })}
          </div>
        </>
      )}

      {trip.status === "final" && (
        <>
          <p className="rounded-xl bg-gray-100 px-4 py-2 text-center text-sm font-medium text-gray-700">
            🔒 Finalized —{" "}
            {trip.confirmation_deadline ? formatDeadline(trip.confirmation_deadline) : "confirmation window closed"}
          </p>
          <div className="flex flex-col gap-4">
            {(scores ?? []).map((score) => (
              <DestinationCard
                key={score.destination.id}
                score={score}
                // AI SUMMARY INTEGRATION POINT (not wired up — see lib/summary.ts)
                footer={confirmationSummaryFor(score.destination.id)}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
