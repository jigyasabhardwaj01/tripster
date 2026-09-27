import "server-only";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { generateRecommendations, RecommendationSet, SubmissionForMatching } from "./gemini";
import { DateRange, validateDateRanges } from "./dateRangeValidation";
import { decrementExpectedParticipantCount, RecommendationStatus, shouldCloseGate, SubmissionStatus } from "./sessionGate";

export type { DateRange } from "./dateRangeValidation";
export { InvalidDateRangeError } from "./dateRangeValidation";

export interface Session {
  id: string;
  title: string;
  organizer_name: string;
  deadline: string; // informational only — never triggers generation
  created_at: string;
  locked: boolean;
  expected_participant_count: number;
  submission_status: SubmissionStatus;
  recommendation_status: RecommendationStatus;
}

export interface Submission {
  id: string;
  session_id: string;
  name: string;
  budget_min: number;
  budget_max: number;
  date_ranges: DateRange[];
  destination_types: string[];
  preferred_locations: string[];
  dealbreakers: string;
  submitted_at: string;
}

export class SessionLockedError extends Error {
  constructor(
    message = "Submissions for this trip are closed — every expected participant has already submitted."
  ) {
    super(message);
    this.name = "SessionLockedError";
  }
}

export async function createSession(
  title: string,
  organizerName: string,
  deadlineIso: string,
  expectedParticipantCount: number
): Promise<Session> {
  const { data, error } = await getSupabaseAdmin()
    .from("sessions")
    .insert({
      title,
      organizer_name: organizerName,
      deadline: deadlineIso,
      expected_participant_count: expectedParticipantCount,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Session;
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await getSupabaseAdmin().from("sessions").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Session | null;
}

/** Safe pre-lock view: just who's submitted (name + when), never their actual answers. */
export async function listParticipantNames(sessionId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("session_participants")
    .select("name")
    .eq("session_id", sessionId)
    .order("submitted_at");
  if (error) throw error;
  return (data as { name: string }[]).map((r) => r.name);
}

async function countParticipants(sessionId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("session_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if (error) throw error;
  return count ?? 0;
}

async function listSubmissions(sessionId: string): Promise<Submission[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .select()
    .eq("session_id", sessionId)
    .order("submitted_at");
  if (error) throw error;
  return data as Submission[];
}

export interface RecommendationsRow {
  primary: RecommendationSet["primary"];
  alternative: RecommendationSet["alternative"];
}

export async function getRecommendations(sessionId: string): Promise<RecommendationsRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("recommendations")
    .select()
    .eq("session_id", sessionId);
  if (error) throw error;
  const rows = data as { recommendation_type: "primary" | "alternative"; [k: string]: unknown }[];
  if (rows.length === 0) return null;

  const primaryRow = rows.find((r) => r.recommendation_type === "primary");
  const alternativeRow = rows.find((r) => r.recommendation_type === "alternative");
  if (!primaryRow) return null;

  const toRecommendation = (r: typeof primaryRow) => ({
    destination: r.destination as string,
    summary: r.summary as string,
    suggested_window: r.suggested_window as RecommendationSet["primary"]["suggested_window"],
    budget_estimate: r.budget_estimate as RecommendationSet["primary"]["budget_estimate"],
    attractions: r.attractions as string[],
  });

  return {
    primary: toRecommendation(primaryRow),
    alternative: alternativeRow ? toRecommendation(alternativeRow) : null,
  };
}

export interface UpsertSubmissionInput {
  name: string;
  budgetMin: number;
  budgetMax: number;
  dateRanges: DateRange[];
  destinationTypes: string[];
  preferredLocations: string[];
  dealbreakers: string;
}

/**
 * Throws SessionLockedError once the gate has closed (submission_status is
 * no longer "collecting") — the deadline never blocks this, only the gate
 * does. Throws InvalidDateRangeError if any range is bad.
 */
export async function upsertSubmission(sessionId: string, input: UpsertSubmissionInput): Promise<Submission> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.submission_status !== "collecting") {
    throw new SessionLockedError();
  }
  validateDateRanges(input.dateRanges);

  const name = input.name.trim();
  const row = {
    session_id: sessionId,
    name,
    budget_min: input.budgetMin,
    budget_max: input.budgetMax,
    date_ranges: input.dateRanges,
    destination_types: input.destinationTypes,
    preferred_locations: input.preferredLocations,
    dealbreakers: input.dealbreakers,
    submitted_at: new Date().toISOString(),
  };

  // Case-insensitive "same person, edit their answer" matching — the
  // uniqueness constraint is on lower(name), an expression index, which
  // PostgREST's onConflict can't target by plain column names.
  const { data: existing, error: findErr } = await getSupabaseAdmin()
    .from("submissions")
    .select("id")
    .eq("session_id", sessionId)
    .ilike("name", name)
    .maybeSingle();
  if (findErr) throw findErr;

  const query = existing
    ? getSupabaseAdmin().from("submissions").update(row).eq("id", existing.id)
    : getSupabaseAdmin().from("submissions").insert(row);

  const { data, error } = await query.select().single();
  if (error) throw error;

  await upsertParticipant(sessionId, name);
  await tryCloseGateAndGenerate(sessionId);

  return data as Submission;
}

/** Mirrors the submissions upsert into the minimal, publicly-readable participants table. */
async function upsertParticipant(sessionId: string, name: string): Promise<void> {
  const { data: existing, error: findErr } = await getSupabaseAdmin()
    .from("session_participants")
    .select("id")
    .eq("session_id", sessionId)
    .ilike("name", name)
    .maybeSingle();
  if (findErr) throw findErr;

  const row = { session_id: sessionId, name, submission_status: "submitted", submitted_at: new Date().toISOString() };
  const query = existing
    ? getSupabaseAdmin().from("session_participants").update(row).eq("id", existing.id)
    : getSupabaseAdmin().from("session_participants").insert(row);
  const { error } = await query;
  if (error) throw error;
}

function toMatchingInput(s: Submission): SubmissionForMatching {
  return {
    name: s.name,
    budgetMin: s.budget_min,
    budgetMax: s.budget_max,
    dateRanges: s.date_ranges.map((r) => ({ startDate: r.start_date, exitDate: r.exit_date })),
    destinationTypes: s.destination_types,
    preferredLocations: s.preferred_locations,
    dealbreakers: s.dealbreakers,
  };
}

/**
 * The DB-level guard against firing generation twice under simultaneous
 * submissions: this UPDATE only ever succeeds for the one caller who
 * observes submission_status still "collecting" AND the count condition
 * true at the moment Postgres evaluates+commits the row lock — Postgres
 * serializes concurrent UPDATEs to the same row, so a second concurrent
 * caller's WHERE clause re-evaluates against the already-flipped row and
 * matches zero rows.
 */
async function claimGate(sessionId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().rpc("claim_session_gate", { p_session_id: sessionId });
  if (error) throw error;
  return Boolean(data);
}

async function tryCloseGateAndGenerate(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;
  const submittedCount = await countParticipants(sessionId);
  if (!shouldCloseGate(submittedCount, session.expected_participant_count, session.submission_status)) return;

  const claimed = await claimGate(sessionId);
  if (!claimed) return; // another concurrent caller already claimed it, or the count changed since our read

  await runGenerationAndSave(sessionId);
}

async function runGenerationAndSave(sessionId: string): Promise<void> {
  await getSupabaseAdmin()
    .from("sessions")
    .update({ submission_status: "generating", recommendation_status: "in_progress" })
    .eq("id", sessionId);

  try {
    const submissions = await listSubmissions(sessionId);
    const result = await generateRecommendations(submissions.map(toMatchingInput));

    const rows = [
      { session_id: sessionId, recommendation_type: "primary" as const, ...toRecommendationRow(result.primary) },
      ...(result.alternative
        ? [{ session_id: sessionId, recommendation_type: "alternative" as const, ...toRecommendationRow(result.alternative) }]
        : []),
    ];

    // Upsert (not insert) — a retry after a prior failed attempt must
    // overwrite any partial rows rather than colliding with them.
    const { error } = await getSupabaseAdmin()
      .from("recommendations")
      .upsert(rows, { onConflict: "session_id,recommendation_type" });
    if (error) throw error;

    await getSupabaseAdmin()
      .from("sessions")
      .update({ submission_status: "complete", recommendation_status: "complete" })
      .eq("id", sessionId);
  } catch (err) {
    // submission_status stays "generating" (the gate has genuinely closed —
    // we do not reopen it or accept new submissions) but recommendation_status
    // flips to "failed", which the frontend surfaces with a retry action.
    // All submitted preference data is untouched.
    console.error(`Recommendation generation failed for session ${sessionId}:`, err);
    await getSupabaseAdmin().from("sessions").update({ recommendation_status: "failed" }).eq("id", sessionId);
  }
}

function toRecommendationRow(r: RecommendationSet["primary"]) {
  return {
    destination: r.destination,
    summary: r.summary,
    suggested_window: r.suggested_window,
    budget_estimate: r.budget_estimate,
    attractions: r.attractions,
  };
}

export interface SessionView {
  session: Session;
  submittedNames: string[];
  submittedCount: number;
  recommendations: RecommendationsRow | null;
  recommendationFailed: boolean;
}

export async function loadSessionView(sessionId: string): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const [submittedNames, recommendations] = await Promise.all([
    listParticipantNames(sessionId),
    session.submission_status === "complete" ? getRecommendations(sessionId) : Promise.resolve(null),
  ]);

  return {
    session,
    submittedNames,
    submittedCount: submittedNames.length,
    recommendations,
    recommendationFailed: session.recommendation_status === "failed",
  };
}

/**
 * Manual retry for a session whose gate has closed but generation failed.
 * Does not reclaim the gate (it's already closed) — just re-runs
 * generation. Guarded by re-checking recommendation_status is still
 * "failed" right before running, to keep duplicate Gemini calls to
 * genuinely rare simultaneous-retry clicks rather than routine operation.
 */
export async function retryGeneration(sessionId: string): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.submission_status !== "collecting" && session.recommendation_status === "failed") {
    await runGenerationAndSave(sessionId);
  }
  return loadSessionView(sessionId);
}

/**
 * Organizer-only actions for a session whose deadline has passed with
 * submissions still missing. Neither of these fires automatically — see
 * sessionGate.ts's computeGateState for the flag the frontend uses to
 * decide when to offer them.
 */
export async function extendDeadline(sessionId: string, newDeadlineIso: string): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.submission_status !== "collecting") return loadSessionView(sessionId);

  const { error } = await getSupabaseAdmin().from("sessions").update({ deadline: newDeadlineIso }).eq("id", sessionId);
  if (error) throw error;
  return loadSessionView(sessionId);
}

export async function removeNonRespondingParticipant(sessionId: string): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.submission_status !== "collecting") return loadSessionView(sessionId);

  const submittedCount = await countParticipants(sessionId);
  const nextExpected = decrementExpectedParticipantCount(session.expected_participant_count, submittedCount);

  const { error } = await getSupabaseAdmin()
    .from("sessions")
    .update({ expected_participant_count: nextExpected })
    .eq("id", sessionId);
  if (error) throw error;

  // This is the one case besides a fresh submission that can close the
  // gate — re-check right away so removing the last non-responder actually
  // triggers generation instead of waiting for another submission.
  await tryCloseGateAndGenerate(sessionId);
  return loadSessionView(sessionId);
}

/** Shared shape for every API route that returns a session view. */
export function toApiResponse(view: SessionView) {
  const { session } = view;
  return {
    id: session.id,
    title: session.title,
    organizerName: session.organizer_name,
    deadline: session.deadline,
    expectedParticipantCount: session.expected_participant_count,
    submissionStatus: session.submission_status,
    recommendationStatus: session.recommendation_status,
    locked: session.submission_status !== "collecting",
    submittedNames: view.submittedNames,
    submittedCount: view.submittedCount,
    recommendations: session.submission_status === "complete" ? view.recommendations : null,
    recommendationFailed: view.recommendationFailed,
  };
}
