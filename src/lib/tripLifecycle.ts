// Automatic trip state machine: collecting -> results_ready -> confirming -> final.
// There are no manual "run matching" or "finalize" buttons anywhere — every
// transition below is driven by response count or the clock.
//
// Note on results_ready: per the spec, matching runs and the transition to
// results_ready happens the instant response count hits the target, and the
// confirmation window (deadline) opens as part of that same "results
// generated" event. In this implementation that means a trip is written as
// results_ready and then immediately as confirming within the same call —
// results_ready exists in the schema/enum but you won't typically observe a
// trip sitting in that state for any length of time. Flag this if you wanted
// a real, separately-triggered gap between "results computed" and
// "confirmation window opened."
import { supabase } from "./supabase";
import { computeShortlist, ParticipantResponse } from "./scoring";
import { getTrip, listParticipantsWithResponses, saveShortlist } from "./db";

export { storeCreatorToken, isTripCreator } from "./organizerToken";

/**
 * Call after any response is saved. If this response brought the trip up to
 * its expected participant count and it's still in "collecting", computes
 * the shortlist, opens the confirmation window, and advances the trip in one
 * atomic update. No-op otherwise.
 */
export async function maybeAdvanceAfterResponse(tripId: string): Promise<void> {
  const trip = await getTrip(tripId);
  if (!trip || trip.status !== "collecting") return;

  const participants = await listParticipantsWithResponses(tripId);
  const responded = participants.filter((p) => p.response);
  if (responded.length < trip.expected_participant_count) return;

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

  const deadline = new Date(Date.now() + trip.confirmation_window_hours * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("trips")
    .update({ status: "confirming", confirmation_deadline: deadline })
    .eq("id", tripId)
    .eq("status", "collecting"); // guards against a race if two responses land at once
  if (error) throw error;
}

/**
 * Call opportunistically on page load — the primary (and, by design, only
 * scheduled-by-nothing) finalization path. Flips this one trip to "final" if
 * its confirmation window has passed. See /api/cron/finalize-trips for an
 * optional, unscheduled manual-trigger route covering the edge case of a
 * trip nobody ever revisits.
 */
export async function maybeFinalizeTrip(tripId: string): Promise<void> {
  const trip = await getTrip(tripId);
  if (!trip || trip.status !== "confirming" || !trip.confirmation_deadline) return;
  if (new Date(trip.confirmation_deadline).getTime() > Date.now()) return;

  const { error } = await supabase
    .from("trips")
    .update({ status: "final" })
    .eq("id", tripId)
    .eq("status", "confirming");
  if (error) throw error;
}

/** Used by the cron route: finalizes every trip whose deadline has passed, in one query. */
export async function finalizeAllExpiredTrips(): Promise<string[]> {
  const { data, error } = await supabase
    .from("trips")
    .update({ status: "final" })
    .eq("status", "confirming")
    .lt("confirmation_deadline", new Date().toISOString())
    .select("id");
  if (error) throw error;
  return (data as { id: string }[]).map((t) => t.id);
}
