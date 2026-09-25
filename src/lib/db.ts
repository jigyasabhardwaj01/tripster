import { supabase } from "./supabase";
import {
  Confirmation,
  DateRange,
  DealbreakerId,
  DestinationType,
  Participant,
  ParticipantWithResponse,
  Response,
  Shortlist,
  Trip,
} from "./types";

export interface CreateTripOptions {
  invitees?: string[];
  expectedParticipantCount?: number;
  confirmationWindowHours?: number;
}

export async function createTrip(
  name: string,
  organizerName: string,
  options: CreateTripOptions = {}
): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .insert({
      name,
      organizer_name: organizerName,
      invitees: options.invitees ?? [],
      ...(options.expectedParticipantCount != null && {
        expected_participant_count: options.expectedParticipantCount,
      }),
      ...(options.confirmationWindowHours != null && {
        confirmation_window_hours: options.confirmationWindowHours,
      }),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Trip; // includes the server-generated creator_token — caller is responsible for stashing it
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase.from("trips").select().eq("id", tripId).maybeSingle();
  if (error) throw error;
  return data as Trip | null;
}

export async function updateTripStatus(tripId: string, status: Trip["status"]): Promise<void> {
  const { error } = await supabase.from("trips").update({ status }).eq("id", tripId);
  if (error) throw error;
}

export async function listParticipantsWithResponses(
  tripId: string
): Promise<ParticipantWithResponse[]> {
  const [{ data: participants, error: pErr }, { data: responses, error: rErr }] = await Promise.all([
    supabase.from("participants").select().eq("trip_id", tripId).order("created_at"),
    supabase.from("responses").select().eq("trip_id", tripId),
  ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  const byParticipant = new Map((responses as Response[]).map((r) => [r.participant_id, r]));
  return (participants as Participant[]).map((p) => ({
    ...p,
    response: byParticipant.get(p.id) ?? null,
  }));
}

/** Finds an existing participant by (trip, name) or creates one. Names identify people — no login. */
export async function findOrCreateParticipant(tripId: string, name: string): Promise<Participant> {
  const trimmed = name.trim();
  const { data: existing, error: findErr } = await supabase
    .from("participants")
    .select()
    .eq("trip_id", tripId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing as Participant;

  const { data, error } = await supabase
    .from("participants")
    .insert({ trip_id: tripId, name: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data as Participant;
}

export interface ResponseInput {
  maxBudget: number;
  dateRanges: DateRange[];
  destinationTypes: DestinationType[];
  dealbreakers: DealbreakerId[];
}

export async function upsertResponse(
  tripId: string,
  participantId: string,
  input: ResponseInput
): Promise<Response> {
  const { data, error } = await supabase
    .from("responses")
    .upsert(
      {
        trip_id: tripId,
        participant_id: participantId,
        max_budget: input.maxBudget,
        date_ranges: input.dateRanges,
        destination_types: input.destinationTypes,
        dealbreakers: input.dealbreakers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "participant_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Response;
}

export async function getResponseForParticipant(participantId: string): Promise<Response | null> {
  const { data, error } = await supabase
    .from("responses")
    .select()
    .eq("participant_id", participantId)
    .maybeSingle();
  if (error) throw error;
  return data as Response | null;
}

export async function saveShortlist(tripId: string, destinationIds: string[]): Promise<void> {
  const { error } = await supabase
    .from("shortlists")
    .upsert(
      { trip_id: tripId, destination_ids: destinationIds, computed_at: new Date().toISOString() },
      { onConflict: "trip_id" }
    );
  if (error) throw error;
}

export async function getShortlist(tripId: string): Promise<Shortlist | null> {
  const { data, error } = await supabase.from("shortlists").select().eq("trip_id", tripId).maybeSingle();
  if (error) throw error;
  return data as Shortlist | null;
}

export async function setConfirmation(
  tripId: string,
  participantId: string,
  destinationId: string,
  confirmed: boolean
): Promise<void> {
  const { error } = await supabase.from("confirmations").upsert(
    {
      trip_id: tripId,
      participant_id: participantId,
      destination_id: destinationId,
      confirmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trip_id,participant_id,destination_id" }
  );
  if (error) throw error;
}

export async function listConfirmations(tripId: string): Promise<Confirmation[]> {
  const { data, error } = await supabase.from("confirmations").select().eq("trip_id", tripId);
  if (error) throw error;
  return data as Confirmation[];
}
