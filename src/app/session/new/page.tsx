"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMySession } from "@/lib/mySessions";
import { createSession } from "@/lib/sessionClient";

function defaultDeadlineLocal(): string {
  // Datetime-local input wants "YYYY-MM-DDTHH:mm" in the browser's local time.
  const d = new Date(Date.now() + 48 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState(defaultDeadlineLocal());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !deadlineLocal) return;
    setSubmitting(true);
    setError(null);
    try {
      const deadlineIso = new Date(deadlineLocal).toISOString();
      const { session } = await createSession(title.trim(), deadlineIso);
      addMySession({ sessionId: session.id, title: title.trim() });
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error(err);
      setError("Couldn't create the trip. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">Start a trip</h1>
        <p className="mt-1 text-sm text-gray-600">
          You&apos;ll get one link to send the group. Everyone submits their budget, dates, and preferences until the
          deadline — then AI picks one destination for the whole group.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Trip name</span>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2"
            placeholder="e.g. Goa-or-bust 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Submission deadline</span>
          <input
            type="datetime-local"
            className="rounded-lg border border-gray-300 px-3 py-2"
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
            required
          />
          <span className="text-xs text-gray-500">
            Defaults to 48 hours from now. Nobody sees results before this passes.
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
