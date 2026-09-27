import { Recommendation, RecommendationsResponse } from "@/lib/sessionClient";

// Per spec: two destinations, sourced and labeled differently — "From your
// picks" (only ever a place someone actually named) and "Discovered for
// you" (real web-search-grounded, or honestly flagged when it isn't). No
// cafes/restaurants, no hour-by-hour itinerary in this version — see the
// (currently unused) itinerary_days column in the recommendations table for
// where that could be added later.
function RecommendationCard({
  recommendation,
  label,
  badge,
}: {
  recommendation: Recommendation;
  label: string;
  badge?: { text: string; tone: "verified" | "unverified" };
}) {
  const { destination, summary, suggested_window, budget_estimate, attractions } = recommendation;
  return (
    <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{label}</p>
          {badge && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                badge.tone === "verified" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-800"
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">{destination}</h2>
        <p className="mt-2 text-sm text-gray-700">{summary}</p>
      </div>

      <div className="rounded-xl bg-gray-50 p-3 text-sm">
        <p className="font-semibold text-gray-700">Suggested window</p>
        <p className="mt-1 text-gray-600">
          {suggested_window.start_date} – {suggested_window.end_date}
        </p>
        <p className="mt-1 text-gray-500">{suggested_window.season}</p>
      </div>

      <div className="rounded-xl bg-gray-50 p-3 text-sm">
        <p className="font-semibold text-gray-700">Budget estimate (per person)</p>
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600">
          <dt>Transport</dt>
          <dd>{budget_estimate.transport}</dd>
          <dt>Stay</dt>
          <dd>{budget_estimate.stay}</dd>
          <dt>Food</dt>
          <dd>{budget_estimate.food}</dd>
          <dt>Activities</dt>
          <dd>{budget_estimate.activities}</dd>
        </dl>
        <p className="mt-2 text-xs text-gray-400">{budget_estimate.note}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700">Top attractions</p>
        <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
          {attractions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function RecommendationResults({ recommendations }: { recommendations: RecommendationsResponse }) {
  const { fromPicks, discovered, discoveredVerified } = recommendations;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        {fromPicks
          ? "One destination from what your group actually suggested, and one AI found for you."
          : "Nobody named a specific place, so there's only a discovered destination this time."}
      </p>
      <div className="flex flex-col gap-4 md:flex-row">
        {fromPicks && <RecommendationCard recommendation={fromPicks} label="From your picks" />}
        {discovered && (
          <RecommendationCard
            recommendation={discovered}
            label="Discovered for you"
            badge={
              discoveredVerified
                ? { text: "Web-search verified", tone: "verified" }
                : { text: "AI-suggested, not independently verified", tone: "unverified" }
            }
          />
        )}
      </div>
    </div>
  );
}
