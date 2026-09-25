"use client";

import { buildNudgeWhatsAppLink } from "@/lib/nudge";
import { ParticipantWithResponse } from "@/lib/types";

// Live "X of Y submitted" counter, visible to everyone (organizer and
// participants alike). Nudge buttons are organizer-only — nudging someone
// else's group isn't your call to make.
export default function StatusPanel({
  tripName,
  shareUrl,
  invitees,
  participants,
  expectedCount,
  isOrganizer,
}: {
  tripName: string;
  shareUrl: string;
  invitees: string[];
  participants: ParticipantWithResponse[];
  expectedCount: number;
  isOrganizer: boolean;
}) {
  const submitted = participants.filter((p) => p.response);
  const submittedNames = new Set(submitted.map((p) => p.name.toLowerCase()));
  const pendingInvitees = invitees.filter((name) => !submittedNames.has(name.toLowerCase()));
  const extraSubmitted = submitted.filter(
    (p) => !invitees.some((name) => name.toLowerCase() === p.name.toLowerCase())
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="font-semibold">
        {submitted.length} of {expectedCount} submitted
      </p>

      {(invitees.length > 0 || extraSubmitted.length > 0) && (
        <div className="mt-3 flex flex-col gap-1.5">
          {invitees.map((name) => {
            const isSubmitted = submittedNames.has(name.toLowerCase());
            return (
              <div
                key={name}
                className={`flex items-center justify-between gap-2 text-sm ${
                  isSubmitted ? "" : "text-gray-400"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={isSubmitted ? "text-green-600" : ""}>{isSubmitted ? "✓" : "○"}</span>
                  <span>{name}</span>
                </span>
                {!isSubmitted && isOrganizer && (
                  <a
                    href={buildNudgeWhatsAppLink(tripName, shareUrl, name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                  >
                    Remind
                  </a>
                )}
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
        <p className="mt-3 text-xs text-gray-500">Still waiting on: {pendingInvitees.join(", ")}</p>
      )}
    </div>
  );
}
