"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DestinationCard from "@/components/DestinationCard";
import { getOrComputeShortlist, MIN_RESPONSES, ShortlistState } from "@/lib/shortlist";
import { listConfirmations, getTrip } from "@/lib/db";
import { Confirmation, Trip } from "@/lib/types";

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [state, setState] = useState<ShortlistState | null>(null);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
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

        if (shortlistState.ready) {
          shortlistState.scores.forEach((score) => {
            fetch("/api/summary", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ tripId, destinationId: score.destination.id }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data?.summary) {
                  setSummaries((prev) => ({ ...prev, [score.destination.id]: data.summary }));
                }
              })
              .catch(() => {
                /* optional AI summary — silently skip on failure, the fit breakdown below still shows */
              });
          });
        }
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  const confirmationsByDestination = useMemo(() => {
    const map = new Map<string, Confirmation[]>();
    for (const c of confirmations) {
      const list = map.get(c.destination_id) ?? [];
      list.push(c);
      map.set(c.destination_id, list);
    }
    return map;
  }, [confirmations]);

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound)
    return <main className="flex flex-1 items-center justify-center text-gray-600">Trip not found.</main>;

  if (!state?.ready) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="font-semibold">No shortlist yet</p>
        <p className="text-sm text-gray-600">
          {state?.respondedCount ?? 0} of {state?.totalParticipants ?? 0} have submitted so far — need at least{" "}
          {MIN_RESPONSES} before destinations can be matched.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">{trip?.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Full comparison — nobody&apos;s been picked for you. Decide as a group from here.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {state.scores.map((score) => {
          const confs = confirmationsByDestination.get(score.destination.id) ?? [];
          const stillIn = confs.filter((c) => c.confirmed);
          const droppedOut = confs.filter((c) => !c.confirmed);
          return (
            <DestinationCard
              key={score.destination.id}
              score={score}
              summary={summaries[score.destination.id]}
              footer={
                confs.length > 0 ? (
                  <div className="rounded-lg border border-gray-200 p-2 text-xs text-gray-600">
                    <p>
                      <span className="font-semibold text-green-700">{stillIn.length} still in:</span>{" "}
                      {stillIn.map((c) => score.participantFits.find((f) => f.participantId === c.participant_id)?.participantName).join(", ") || "—"}
                    </p>
                    {droppedOut.length > 0 && (
                      <p className="mt-1">
                        <span className="font-semibold text-red-700">{droppedOut.length} opted out:</span>{" "}
                        {droppedOut.map((c) => score.participantFits.find((f) => f.participantId === c.participant_id)?.participantName).join(", ")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No confirmations yet.</p>
                )
              }
            />
          );
        })}
      </div>
    </main>
  );
}
