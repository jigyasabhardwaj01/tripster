"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyTrips, MyTripEntry } from "@/lib/myTrips";

export default function MyTripsPage() {
  const [trips, setTrips] = useState<MyTripEntry[] | null>(null);

  useEffect(() => {
    setTrips(getMyTrips());
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">My trips</h1>
        <p className="mt-1 text-sm text-gray-600">
          Trips you&apos;ve created or submitted a response for on this device. There&apos;s no login, so this list
          is saved to this browser only — it won&apos;t show up if you switch devices.
        </p>
      </div>

      {trips === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-600">No trips yet on this device.</p>
          <Link href="/trip/new" className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white">
            Start a trip
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trips.map((t) => (
            <div key={t.tripId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{t.tripName}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.role === "organizer" ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t.role === "organizer" ? "Organizer" : "Participant"}
                </span>
              </div>
              <div className="mt-3">
                <Link
                  href={`/trip/${t.tripId}`}
                  className="block rounded-lg bg-brand-500 px-3 py-1.5 text-center text-sm font-medium text-white"
                >
                  Open trip
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/trip/new" className="text-center text-sm font-medium text-brand-700">
        + Start another trip
      </Link>
    </main>
  );
}
