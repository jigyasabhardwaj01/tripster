"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DestinationCard from "@/components/DestinationCard";
import { getOrComputeShortlist, MIN_RESPONSES, ShortlistState } from "@/lib/shortlist";
import { addMyTrip } from "@/lib/myTrips";
import { listConfirmations, setConfirmation, updateTripStatus, getTrip } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Confirmation, Participant, Trip } from "@/lib/types";

export default function ConfirmPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [state, setState] = useState<ShortlistState | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const t = await getTrip(tripId);
      if (!t) {
        setNotFound(true);
        return;
      }
      setTrip(t);
      const [shortlistState, confs] = await Promise.all([
        getOrComputeShortlist(tripId),
        listConfirmations(tripId),
      ]);
      setState(shortlistState);
      setConfirmations(confs);

      if (shortlistState.ready && t.status === "collecting") {
        await updateTripStatus(tripId, "confirming");
      }

      const storedId =
        typeof window !== "undefined" ? window.localStorage.getItem(`tripster:${tripId}:participantId`) : null;
      if (storedId) {
        const { data } = await supabase.from("participants").select().eq("id", storedId).maybeSingle();
        if (data) setParticipant(data as Participant);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function findParticipant(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    const { data, error } = await supabase
      .from("participants")
      .select()
      .eq("trip_id", tripId)
      .ilike("name", nameInput.trim())
      .maybeSingle();
    if (error || !data) {
      setLookupError("No response found under that name. Submit your preferences first.");
      return;
    }
    setParticipant(data as Participant);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`tripster:${tripId}:participantId`, (data as Participant).id);
      window.localStorage.setItem(`tripster:${tripId}:participantName`, (data as Participant).name);
    }
  }

  const myConfirmations = useMemo(() => {
    if (!participant) return new Map<string, boolean>();
    return new Map(
      confirmations
        .filter((c) => c.participant_id === participant.id)
        .map((c) => [c.destination_id, c.confirmed])
    );
  }, [confirmations, participant]);

  async function respond(destinationId: string, confirmed: boolean) {
    if (!participant) return;
    await setConfirmation(tripId, participant.id, destinationId, confirmed);
    setConfirmations((prev) => [
      ...prev.filter((c) => !(c.participant_id === participant.id && c.destination_id === destinationId)),
      {
        id: `${participant.id}:${destinationId}`,
        trip_id: tripId,
        participant_id: participant.id,
        destination_id: destinationId,
        confirmed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound)
    return (
      <main className="flex flex-1 items-center justify-center text-center text-gray-600">Trip not found.</main>
    );

  if (!state?.ready) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">Still collecting responses</p>
        <p className="text-sm text-gray-600">
          {state?.respondedCount ?? 0} of {state?.totalParticipants ?? 0} submitted so far — need at least{" "}
          {MIN_RESPONSES} responses before matching destinations. Check back once more of the group has responded.
        </p>
      </main>
    );
  }

  if (!participant) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-6">
        <div>
          <h1 className="text-2xl font-bold">{trip?.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            The shortlist is ready. Enter your name to review and confirm.
          </p>
        </div>
        <form onSubmit={findParticipant} className="flex flex-col gap-3">
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
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">{trip?.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Hi {participant.name} — here&apos;s the shortlist. The group&apos;s poll fell apart once before, so confirm
          each option still works for you (or say it doesn&apos;t).
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {state.scores.map((score) => {
          const myAnswer = myConfirmations.get(score.destination.id);
          return (
            <DestinationCard
              key={score.destination.id}
              score={score}
              footer={
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(score.destination.id, true)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                      myAnswer === true
                        ? "bg-brand-500 text-white"
                        : "border border-brand-500 text-brand-700"
                    }`}
                  >
                    Still in ✓
                  </button>
                  <button
                    onClick={() => respond(score.destination.id, false)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                      myAnswer === false
                        ? "bg-gray-700 text-white"
                        : "border border-gray-400 text-gray-600"
                    }`}
                  >
                    Not for me
                  </button>
                </div>
              }
            />
          );
        })}
      </div>

      <button
        onClick={() => router.push(`/trip/${tripId}/results`)}
        className="rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white shadow-sm"
      >
        View group comparison
      </button>
    </main>
  );
}
