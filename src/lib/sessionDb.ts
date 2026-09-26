import "server-only";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { matchDestinations, MatchResult, SubmissionForMatching } from "./gemini";
import { DateRange, validateDateRanges } from "./dateRangeValidation";

export type { DateRange } from "./dateRangeValidation";
export { InvalidDateRangeError } from "./dateRangeValidation";

export interface Session {
  id: string;
  title: string;
  deadline: string;
  created_at: string;
  locked: boolean;
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

export interface ResultsRow {
  id: string;
  session_id: string;
  generated_at: string;
  options: MatchResult;
}

export class SessionLockedError extends Error {
  constructor(message = "This session is locked — the deadline has passed and no further submissions are accepted.") {
    super(message);
    this.name = "SessionLockedError";
  }
}

export async function createSession(title: string, deadlineIso: string): Promise<Session> {
  const { data, error } = await getSupabaseAdmin()
    .from("sessions")
    .insert({ title, deadline: deadlineIso })
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

/** Safe pre-lock view: just who's submitted, never their actual answers. */
export async function listSubmittedNames(sessionId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .select("name")
    .eq("session_id", sessionId)
    .order("submitted_at");
  if (error) throw error;
  return (data as { name: string }[]).map((r) => r.name);
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

export async function getResults(sessionId: string): Promise<ResultsRow | null> {
  const { data, error } = await getSupabaseAdmin().from("results").select().eq("session_id", sessionId).maybeSingle();
  if (error) throw error;
  return data as ResultsRow | null;
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

/** Throws SessionLockedError if the deadline has passed, InvalidDateRangeError if any range is bad — never fails silently. */
export async function upsertSubmission(sessionId: string, input: UpsertSubmissionInput): Promise<Submission> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.locked || new Date(session.deadline).getTime() <= Date.now()) {
    throw new SessionLockedError();
  }
  validateDateRanges(input.dateRanges);

  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .upsert(
      {
        session_id: sessionId,
        name: input.name.trim(),
        budget_min: input.budgetMin,
        budget_max: input.budgetMax,
        date_ranges: input.dateRanges,
        destination_types: input.destinationTypes,
        preferred_locations: input.preferredLocations,
        dealbreakers: input.dealbreakers,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "session_id,name" } // matches the case-insensitive unique index at the DB level
    )
    .select()
    .single();
  if (error) throw error;
  return data as Submission;
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

export interface SessionView {
  session: Session;
  submittedNames: string[];
  results: ResultsRow | null;
  scoringFailed: boolean; // locked, but no results and scoring already attempted
}

/**
 * The single entry point the session page (or its API route) calls on every
 * load. If the deadline has just passed and nobody's claimed it yet, this is
 * also where the lock + one-shot Gemini call happens — see the atomic
 * `UPDATE ... WHERE locked = false` below, which guarantees only one
 * concurrent caller ever proceeds to score a given session.
 */
export async function loadSessionView(sessionId: string): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const pastDeadline = new Date(session.deadline).getTime() <= Date.now();

  if (!session.locked && pastDeadline) {
    const claimed = await claimLock(sessionId);
    if (claimed) {
      session.locked = true;
      await runScoringAndSave(sessionId); // errors are caught inside; never throws
    }
  }

  const [submittedNames, results] = await Promise.all([
    listSubmittedNames(sessionId),
    session.locked || pastDeadline ? getResults(sessionId) : Promise.resolve(null),
  ]);

  const freshSession = (await getSession(sessionId))!; // re-read: locked may have just flipped
  return {
    session: freshSession,
    submittedNames,
    results,
    scoringFailed: freshSession.locked && !results,
  };
}

/** Atomically claims the "I'm the one who locks and scores this session" slot. */
async function claimLock(sessionId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("sessions")
    .update({ locked: true })
    .eq("id", sessionId)
    .eq("locked", false)
    .select("id");
  if (error) throw error;
  return (data as { id: string }[]).length > 0;
}

async function runScoringAndSave(sessionId: string): Promise<void> {
  try {
    const submissions = await listSubmissions(sessionId);
    const result = await matchDestinations(submissions.map(toMatchingInput));
    const { error } = await getSupabaseAdmin()
      .from("results")
      .insert({ session_id: sessionId, options: result });
    if (error) throw error;
  } catch (err) {
    // Locked stays true (the deadline really did pass) but results stays
    // empty — surfaced to the frontend as scoringFailed, with retryScoring
    // below as the manual recovery path. We do NOT unlock or auto-retry here.
    console.error(`Scoring failed for session ${sessionId}:`, err);
  }
}

/**
 * Manual retry for a session that's locked but has no results (a prior
 * scoring attempt failed). Guarded by re-checking results is still empty
 * right before inserting, to keep duplicate Gemini calls to genuinely rare
 * simultaneous-retry clicks rather than routine operation.
 */
export async function retryScoring(sessionId: string): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session || !session.locked) return loadSessionView(sessionId);

  const existing = await getResults(sessionId);
  if (!existing) {
    await runScoringAndSave(sessionId);
  }
  return loadSessionView(sessionId);
}
