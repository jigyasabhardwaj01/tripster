"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTrip } from "@/lib/db";
import { addMyTrip } from "@/lib/myTrips";
import { storeCreatorToken } from "@/lib/tripLifecycle";

export default function NewTripPage() {
  const router = useRouter();
  const [tripName, setTripName] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [inviteeNames, setInviteeNames] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tripName.trim() || !organizerName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const invitees = inviteeNames
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      const trip = await createTrip(tripName.trim(), organizerName.trim(), { invitees });
      addMyTrip({ tripId: trip.id, tripName: trip.name, role: "organizer" });
      storeCreatorToken(trip.id, trip.creator_token);
      router.push(`/trip/${trip.id}/submit?share=1&name=${encodeURIComponent(organizerName.trim())}`);
    } catch (err) {
      console.error(err);
      setError("Couldn't create the trip. Check your Supabase setup and try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-bold">Start a trip</h1>
        <p className="mt-1 text-sm text-gray-600">
          You&apos;ll get one link to send the group. Everyone submits their own budget, dates,
          and preferences there.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Trip name</span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. Goa-or-bust 2026"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
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
          <span className="text-sm font-medium text-gray-700">
            Who&apos;s in the group? <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. Priya, Rohan, Meera, Arjun"
            value={inviteeNames}
            onChange={(e) => setInviteeNames(e.target.value)}
          />
          <span className="text-xs text-gray-500">
            Comma-separated. Lets you track who&apos;s submitted vs. still pending — skip it if you&apos;d rather
            just count responses as they come in.
          </span>
        </label>

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
