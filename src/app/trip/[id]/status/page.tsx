"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ShareLink from "@/components/ShareLink";
import { getTrip, listParticipantsWithResponses } from "@/lib/db";
import { MIN_RESPONSES } from "@/lib/shortlist";
import { ParticipantWithResponse, Trip } from "@/lib/types";

// Organizer-facing view: who's submitted, who's still pending, and whether
// matching is ready. Pending names come from the invitee list the organizer
// optionally entered at trip creation — without it, we only know who's
// already submitted, since no-login means there's no roster otherwise.
export default function TripStatusPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/trip/${tripId}/submit`);
    }
    (async () => {
      try {
        const t = await getTrip(tripId);
        if (!t) {
          setNotFound(true);
          return;
        }
        setTrip(t);
        setParticipants(await listParticipantsWithResponses(tripId));
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  if (loading) return <main className="flex flex-1 items-center justify-center text-gray-500">Loading…</main>;
  if (notFound)
    return <main className="flex flex-1 items-center justify-center text-gray-600">Trip not found.</main>;

  const submitted = participants.filter((p) => p.response);
  const submittedNames = new Set(submitted.map((p) => p.name.toLowerCase()));
  const invitees = trip?.invitees ?? [];
  const pendingInvitees = invitees.filter((name) => !submittedNames.has(name.toLowerCase()));
  const extraSubmitted = submitted.filter((p) => !invitees.some((name) => name.toLowerCase() === p.name.toLowerCase()));
  const ready = submitted.length >= MIN_RESPONSES;

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">{trip?.name}</h1>
        <p className="mt-1 text-sm text-gray-600">Organized by {trip?.organizer_name}</p>
      </div>

      {shareUrl && <ShareLink url={shareUrl} label="Share this link with anyone who hasn't submitted" />}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">
            {submitted.length} of {invitees.length > 0 ? invitees.length : "?"} submitted
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              ready ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {ready ? "Ready to match" : `Need ${MIN_RESPONSES - submitted.length} more`}
          </span>
        </div>

        {invitees.length === 0 && submitted.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nobody&apos;s opened the link yet.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">
            {invitees.map((name) => {
              const isSubmitted = submittedNames.has(name.toLowerCase());
              return (
                <div
                  key={name}
                  className={`flex items-center gap-2 text-sm ${isSubmitted ? "" : "text-gray-400"}`}
                >
                  <span className={isSubmitted ? "text-green-600" : ""}>{isSubmitted ? "✓" : "○"}</span>
                  <span>
                    {name}
                    {!isSubmitted && " — pending"}
                  </span>
                </div>
              );
            })}
            {extraSubmitted.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-green-600">✓</span>
                <span>
                  {p.name}
                  {invitees.length > 0 && <span className="text-gray-400"> (not on your list)</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {pendingInvitees.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Still waiting on: {pendingInvitees.join(", ")}
          </p>
        )}
      </div>

      {ready ? (
        <Link
          href={`/trip/${tripId}/confirm`}
          className="rounded-xl bg-brand-500 px-6 py-3 text-center font-semibold text-white shadow-sm"
        >
          View shortlist
        </Link>
      ) : (
        <p className="text-center text-sm text-gray-500">
          Matching starts automatically once {MIN_RESPONSES} people have submitted.
        </p>
      )}
    </main>
  );
}
