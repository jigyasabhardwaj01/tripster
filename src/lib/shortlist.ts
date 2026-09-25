import { computeShortlist, DestinationScore, ParticipantResponse } from "./scoring";
import { getShortlist, listParticipantsWithResponses } from "./db";
import { DESTINATIONS, getDestination } from "./destinations";

/**
 * Reads back the shortlist a trip already has stored (written once by
 * maybeAdvanceAfterResponse in tripLifecycle.ts, when responses hit
 * trip.expected_participant_count) and recomputes fresh per-person fit
 * breakdowns against current responses — so a late-edited response is still
 * reflected, even though the *set* of shortlisted destinations stays fixed.
 * Returns null if no shortlist has been computed yet for this trip.
 */
export async function getShortlistScores(tripId: string): Promise<DestinationScore[] | null> {
  const shortlist = await getShortlist(tripId);
  if (!shortlist) return null;

  const participants = await listParticipantsWithResponses(tripId);
  const responded = participants.filter((p) => p.response);
  const responsesForFits: ParticipantResponse[] = responded.map((p) => ({
    participantId: p.id,
    participantName: p.name,
    response: p.response!,
  }));

  // Score every candidate, not just the top N — the point is to re-fit the
  // *originally* shortlisted destinations against current responses, not to
  // let the shortlisted set silently drift if a late edit reshuffles rankings.
  const allScored = computeShortlist(responsesForFits, DESTINATIONS.length);
  return shortlist.destination_ids
    .map((id) => getDestination(id))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map((d) => allScored.find((s) => s.destination.id === d.id))
    .filter((s): s is DestinationScore => !!s);
}
