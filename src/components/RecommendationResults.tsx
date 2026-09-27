"use client";

import { useEffect, useState } from "react";
import { Recommendation, RecommendationsResponse } from "@/lib/sessionClient";
import { ImageManifest, matchDestinationImage } from "@/lib/imageMatching";

/** "Goa, India" -> { name: "Goa", region: "India" }. No comma in the source text -> no region line, never a fabricated one. */
function splitNameAndRegion(destination: string): { name: string; region: string | null } {
  const commaIndex = destination.indexOf(",");
  if (commaIndex === -1) return { name: destination, region: null };
  return { name: destination.slice(0, commaIndex).trim(), region: destination.slice(commaIndex + 1).trim() };
}

function useDestinationImage(destination: string, mostCommonDestinationType: string | null): string | null {
  const [manifest, setManifest] = useState<ImageManifest | null>(null);
  useEffect(() => {
    fetch("/api/images/manifest")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);
  if (!manifest) return null;
  return matchDestinationImage(destination, mostCommonDestinationType, manifest)?.path ?? null;
}

function BoardingPassCard({ recommendation, mostCommonDestinationType }: { recommendation: Recommendation; mostCommonDestinationType: string | null }) {
  const { name, region } = splitNameAndRegion(recommendation.destination);
  const image = useDestinationImage(recommendation.destination, mostCommonDestinationType);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-cardBorder bg-white shadow-[0_14px_30px_-10px_rgba(139,111,71,0.45)] transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{
        borderTop: "3px solid #E8823C",
        borderStyle: "dashed",
        borderWidth: "1px",
        borderTopWidth: "3px",
        borderTopStyle: "solid",
      }}
    >
      {/* Ticket-stub notch, punched into the left edge. */}
      <span className="pointer-events-none absolute left-0 top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cardBorder bg-paper" />
      <span className="absolute left-3 top-3 z-10 rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold text-white">
        From your picks
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-44 w-full object-cover" />
      )}
      <div className="p-5">
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">Your pick</span>
        <h2 className="mt-3 font-headline text-3xl font-medium text-ink">{name}</h2>
        {region && <p className="text-sm text-ink/60">{region}</p>}
        <p className="mt-3 text-sm leading-relaxed text-ink/80">{recommendation.summary}</p>

        <div className="mt-4 rounded-xl bg-paper p-3 text-sm">
          <p className="font-semibold text-ink">Suggested window</p>
          <p className="mt-1 text-ink/70">
            {recommendation.suggested_window.start_date} to {recommendation.suggested_window.end_date}
          </p>
          <p className="mt-1 text-ink/60">{recommendation.suggested_window.season}</p>
        </div>

        <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
          <p className="font-semibold text-ink">Budget estimate, per person</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-ink/70">
            <dt>Transport</dt>
            <dd>{recommendation.budget_estimate.transport}</dd>
            <dt>Stay</dt>
            <dd>{recommendation.budget_estimate.stay}</dd>
            <dt>Food</dt>
            <dd>{recommendation.budget_estimate.food}</dd>
            <dt>Activities</dt>
            <dd>{recommendation.budget_estimate.activities}</dd>
          </dl>
          <p className="mt-2 text-xs text-ink/50">{recommendation.budget_estimate.note}</p>
        </div>

        <div className="mt-3">
          <p className="text-sm font-semibold text-ink">Top attractions</p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink/70">
            {recommendation.attractions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PlainDestinationCard({
  recommendation,
  mostCommonDestinationType,
  badge,
}: {
  recommendation: Recommendation;
  mostCommonDestinationType: string | null;
  badge: { text: string; tone: "verified" | "unverified" };
}) {
  const { name, region } = splitNameAndRegion(recommendation.destination);
  const image = useDestinationImage(recommendation.destination, mostCommonDestinationType);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cardBorder bg-white shadow-sm">
      <span className="absolute left-3 top-3 z-10 rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold text-white">
        Discovered for you
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-36 w-full object-cover" />
      )}
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              badge.tone === "verified" ? "bg-teal-50 text-teal" : "bg-paper text-ink/50"
            }`}
          >
            {badge.text}
          </span>
        </div>
        <h2 className="mt-2 font-headline text-2xl font-medium text-ink">{name}</h2>
        {region && <p className="text-sm text-ink/60">{region}</p>}
        <p className="mt-3 text-sm leading-relaxed text-ink/80">{recommendation.summary}</p>

        <div className="mt-4 rounded-xl bg-paper p-3 text-sm">
          <p className="font-semibold text-ink">Suggested window</p>
          <p className="mt-1 text-ink/70">
            {recommendation.suggested_window.start_date} to {recommendation.suggested_window.end_date}
          </p>
          <p className="mt-1 text-ink/60">{recommendation.suggested_window.season}</p>
        </div>

        <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
          <p className="font-semibold text-ink">Budget estimate, per person</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-ink/70">
            <dt>Transport</dt>
            <dd>{recommendation.budget_estimate.transport}</dd>
            <dt>Stay</dt>
            <dd>{recommendation.budget_estimate.stay}</dd>
            <dt>Food</dt>
            <dd>{recommendation.budget_estimate.food}</dd>
            <dt>Activities</dt>
            <dd>{recommendation.budget_estimate.activities}</dd>
          </dl>
          <p className="mt-2 text-xs text-ink/50">{recommendation.budget_estimate.note}</p>
        </div>

        <div className="mt-3">
          <p className="text-sm font-semibold text-ink">Top attractions</p>
          <ul className="mt-1 list-inside list-disc text-sm text-ink/70">
            {recommendation.attractions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Calm placeholder shown while the AI finalizes the trip, shaped like the
// real result cards so the wait doesn't feel like a dead spinner.
export function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse-slow overflow-hidden rounded-2xl border border-cardBorder bg-white">
          <div className="h-40 w-full bg-paper" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-4 w-24 rounded-full bg-paper" />
            <div className="h-6 w-2/3 rounded bg-paper" />
            <div className="h-3 w-full rounded bg-paper" />
            <div className="h-3 w-5/6 rounded bg-paper" />
            <div className="h-16 w-full rounded-xl bg-paper" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecommendationResults({
  recommendations,
  mostCommonDestinationType,
}: {
  recommendations: RecommendationsResponse;
  mostCommonDestinationType: string | null;
}) {
  const { fromPicks, discovered, discoveredVerified } = recommendations;
  return (
    <div className="flex flex-col gap-5">
      {fromPicks && (
        <BoardingPassCard recommendation={fromPicks} mostCommonDestinationType={mostCommonDestinationType} />
      )}
      {discovered && (
        <PlainDestinationCard
          recommendation={discovered}
          mostCommonDestinationType={mostCommonDestinationType}
          badge={
            discoveredVerified
              ? { text: "Web-search verified", tone: "verified" }
              : { text: "AI-suggested, not independently verified", tone: "unverified" }
          }
        />
      )}
    </div>
  );
}
