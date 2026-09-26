import { FinalizedResult as FinalizedResultData } from "@/lib/sessionClient";

// Per spec: show ONLY the finalized destination, its reason, and two short
// checklists. No ranked alternatives, no raw submissions — this is the one
// finalized answer, not a comparison.
function CheckRow({ name, pass, note }: { name: string; pass: boolean; note: string | null }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={pass ? "text-green-600" : "text-red-600"}>{pass ? "✓" : "✕"}</span>
      <span>
        {name}
        {!pass && note && <span className="text-gray-500"> — {note}</span>}
      </span>
    </div>
  );
}

export default function FinalizedResult({ result }: { result: FinalizedResultData }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Finalized trip</p>
        <h2 className="mt-1 text-3xl font-bold text-brand-700">{result.finalized_trip}</h2>
        <p className="mt-3 text-sm text-gray-700">{result.reason}</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-gray-700">Who&apos;s within budget</p>
        <div className="flex flex-col gap-1.5">
          {result.budget_check.map((b) => (
            <CheckRow key={b.name} name={b.name} pass={b.within_budget} note={b.note} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-gray-700">Whose dates work</p>
        <div className="flex flex-col gap-1.5">
          {result.calendar_check.map((c) => (
            <CheckRow key={c.name} name={c.name} pass={c.dates_work} note={c.note} />
          ))}
        </div>
      </div>
    </div>
  );
}
