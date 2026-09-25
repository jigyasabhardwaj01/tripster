"use client";

import { DestinationScore } from "@/lib/scoring";

function CriterionPill({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
        pass ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {pass ? "✓" : "✕"} {label}
    </span>
  );
}

export default function DestinationCard({
  score,
  summary,
  footer,
}: {
  score: DestinationScore;
  summary?: string;
  footer?: React.ReactNode;
}) {
  const { destination, participantFits, score: total, maxScore } = score;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">{destination.name}</h3>
          <p className="text-xs text-gray-500">
            {destination.region} · {destination.type} · ~{destination.typicalLengthDays} days · from ₹
            {destination.costPerPerson.toLocaleString("en-IN")}/person
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
          {total}/{maxScore} fit
        </span>
      </div>

      {summary && <p className="mt-2 text-sm text-gray-700">{summary}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {participantFits.map((f) => (
          <div key={f.participantId} className="rounded-lg bg-gray-50 p-2">
            <p className="text-sm font-medium">{f.participantName}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <CriterionPill pass={f.budget.pass} label={f.budget.detail} />
              <CriterionPill pass={f.dates.pass} label={f.dates.detail} />
              <CriterionPill pass={f.destinationType.pass} label={f.destinationType.detail} />
              <CriterionPill pass={f.dealbreakers.pass} label={f.dealbreakers.detail} />
            </div>
          </div>
        ))}
      </div>

      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
