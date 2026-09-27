// Pure data-assembly for the combined itinerary PDF — split out from the
// actual @react-pdf/renderer document so the "what goes on the page and in
// what order" logic is unit-testable without pulling in the renderer.

import { Recommendation } from "./geminiMatching";

export interface ItineraryPdfData {
  title: string;
  /** e.g. "Based on 4 of 5 responses — Karan didn't submit in time." Null when everyone was included. */
  basedOnNote: string | null;
  fromPicks: Recommendation | null;
  discovered: Recommendation;
  discoveredVerified: boolean;
}

export interface ItineraryPdfSessionInput {
  title: string;
  expectedParticipantCount: number;
  includedCount: number | null;
  missingNames: string[] | null;
}

export interface ItineraryPdfRecommendationsInput {
  fromPicks: Recommendation | null;
  discovered: Recommendation | null;
  discoveredVerified: boolean;
}

/** Same honesty rule as the on-screen results: only note it when someone was actually left out, name them when we can. */
export function buildBasedOnNote(session: ItineraryPdfSessionInput): string | null {
  if (session.includedCount === null || session.includedCount >= session.expectedParticipantCount) return null;
  const base = `Based on ${session.includedCount} of ${session.expectedParticipantCount} responses`;
  if (session.missingNames && session.missingNames.length > 0) {
    return `${base} — ${session.missingNames.join(", ")} didn't submit in time.`;
  }
  return `${base}.`;
}

/** Null when there's nothing to render yet (discovered is required; from_picks is optional). */
export function buildItineraryPdfData(
  session: ItineraryPdfSessionInput,
  recommendations: ItineraryPdfRecommendationsInput
): ItineraryPdfData | null {
  if (!recommendations.discovered) return null;
  return {
    title: session.title,
    basedOnNote: buildBasedOnNote(session),
    fromPicks: recommendations.fromPicks,
    discovered: recommendations.discovered,
    discoveredVerified: recommendations.discoveredVerified,
  };
}
