"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMySessions, MySessionEntry } from "@/lib/mySessions";

export default function MySessionsPage() {
  const [sessions, setSessions] = useState<MySessionEntry[] | null>(null);

  useEffect(() => {
    setSessions(getMySessions());
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-5 py-2">
      <div>
        <h1 className="text-2xl font-bold">My trips</h1>
        <p className="mt-1 text-sm text-gray-600">
          Trips you&apos;ve created or submitted to on this device. No login, so this list is saved to this browser
          only.
        </p>
      </div>

      {sessions === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-600">No trips yet on this device.</p>
          <Link href="/session/new" className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white">
            Start a trip
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <div key={s.sessionId} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold">{s.title}</h3>
              <Link
                href={`/session/${s.sessionId}`}
                className="mt-3 block rounded-lg bg-brand-500 px-3 py-1.5 text-center text-sm font-medium text-white"
              >
                Open trip
              </Link>
            </div>
          ))}
        </div>
      )}

      <Link href="/session/new" className="text-center text-sm font-medium text-brand-700">
        + Start another trip
      </Link>
    </main>
  );
}
