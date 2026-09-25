import { computeShortlist, DestinationScore, ParticipantResponse } from "./scoring";
import { getShortlist, listParticipantsWithResponses, saveShortlist } from "./db";
import { getDestination } from "./destinations";

export const MIN_RESPONSES = 3; // "once enough people have submitted" — tune as needed

export interface ShortlistState {
  ready: boolean;
  respondedCount: number;
  totalParticipants: number;
  scores: DestinationScore[];
}

/**
 * Computes (or reuses a previously stored) shortlist for a trip. Storing it
 * means everyone who opens /confirm or /results sees the same 2-3 options,
 * even if someone submits a late response afterward.
 */
export async function getOrComputeShortlist(tripId: string): Promise<ShortlistState> {
  const participants = await listParticipantsWithResponses(tripId);
  const responded = participants.filter((p) => p.response);
  const respondedCount = responded.length;
  const totalParticipants = participants.length;

  const existing = await getShortlist(tripId);
  if (existing) {
    const responsesForFits: ParticipantResponse[] = responded.map((p) => ({
      participantId: p.id,
      participantName: p.name,
      response: p.response!,
    }));
    const scores = existing.destination_ids
      .map((id) => getDestination(id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => computeShortlist(responsesForFits, 20).find((s) => s.destination.id === d.id))
      .filter((s): s is DestinationScore => !!s);
    return { ready: true, respondedCount, totalParticipants, scores };
  }

  if (respondedCount < MIN_RESPONSES) {
    return { ready: false, respondedCount, totalParticipants, scores: [] };
  }

  const responsesForFits: ParticipantResponse[] = responded.map((p) => ({
    participantId: p.id,
    participantName: p.name,
    response: p.response!,
  }));
  const topN = responded.length >= 5 ? 3 : 2;
  const scores = computeShortlist(responsesForFits, topN);
  await saveShortlist(
    tripId,
    scores.map((s) => s.destination.id)
  );
  return { ready: true, respondedCount, totalParticipants, scores };
}
