import "server-only";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { generateDiscovered, generateFromPicks, Recommendation, SubmissionForMatching } from "./gemini";
import { DateRange, validateDateRanges } from "./dateRangeValidation";
import { buildItineraryPdfData } from "./itineraryPdfData";
import { renderItineraryPdf } from "./itineraryPdf";
import { mostCommonDestinationType } from "./imageMatching";
import {
  computeDeadline,
  computeMissingNames,
  decrementExpectedParticipantCount,
  DurationUnit,
  RecommendationStatus,
  shouldCloseGate,
  SubmissionStatus,
} from "./sessionGate";

const ITINERARY_BUCKET = "itineraries";

export type { DateRange } from "./dateRangeValidation";
export { InvalidDateRangeError } from "./dateRangeValidation";

export interface Session {
  id: string;
  title: string;
  organizer_name: string;
  deadline: string; // hard cutoff: generation fires here even if some are still missing, as long as >=1 submitted
  created_at: string;
  locked: boolean;
  expected_participant_count: number;
  expected_names: string[] | null; // optional — only set if the organizer listed names at creation
  included_count: number | null; // set once generation runs: how many were actually included
  missing_names: string[] | null; // set once generation runs, only if expected_names was given
  submission_status: SubmissionStatus;
  recommendation_status: RecommendationStatus;
  itinerary_pdf_path: string | null; // storage object path, set once the combined PDF has been generated
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
  constructor(message = "Submissions for this trip are closed — recommendations have already been generated.") {
    super(message);
    this.name = "SessionLockedError";
  }
}

export async function createSession(
  title: string,
  organizerName: string,
  deadlineIso: string,
  expectedParticipantCount: number,
  expectedNames: string[] | null
): Promise<Session> {
  const { data, error } = await getSupabaseAdmin()
    .from("sessions")
    .insert({
      title,
      organizer_name: organizerName,
      deadline: deadlineIso,
      expected_participant_count: expectedParticipantCount,
      expected_names: expectedNames,
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
  fromPicks: Recommendation | null;
  discovered: Recommendation | null;
  discoveredVerified: boolean;
}

export async function getRecommendations(sessionId: string): Promise<RecommendationsRow | null> {
  const { data, error } = await getSupabaseAdmin().from("recommendations").select().eq("session_id", sessionId);
  if (error) throw error;
  const rows = data as { recommendation_type: "from_picks" | "discovered"; verified: boolean; [k: string]: unknown }[];
  if (rows.length === 0) return null;

  const fromPicksRow = rows.find((r) => r.recommendation_type === "from_picks");
  const discoveredRow = rows.find((r) => r.recommendation_type === "discovered");

  const toRecommendation = (r: NonNullable<typeof fromPicksRow>): Recommendation => ({
    destination: r.destination as string,
    summary: r.summary as string,
    suggested_window: r.suggested_window as Recommendation["suggested_window"],
    budget_estimate: r.budget_estimate as Recommendation["budget_estimate"],
    attractions: r.attractions as string[],
  });

  return {
    fromPicks: fromPicksRow ? toRecommendation(fromPicksRow) : null,
    discovered: discoveredRow ? toRecommendation(discoveredRow) : null,
    discoveredVerified: discoveredRow?.verified ?? false,
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
 * no longer "collecting"). A submission arriving after the deadline has
 * already passed is still accepted right up until that moment — per spec,
 * a late arrival can itself be the trigger that closes the gate (condition
 * b: deadline passed + at least one submission). Throws
 * InvalidDateRangeError if any range is bad.
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

/** Mirrors the submissions upsert into the minimal, publicly-readable session_participants table. */
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
 * submissions (or a submission racing the deadline): this UPDATE only ever
 * succeeds for the one caller who observes submission_status still
 * "collecting" AND (everyone's in OR the deadline has passed with >=1
 * submitted) at the moment Postgres evaluates+commits the row lock —
 * Postgres serializes concurrent UPDATEs to the same row, so a second
 * concurrent caller's WHERE clause re-evaluates against the already-flipped
 * row and matches zero rows.
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
  const deadlinePassed = new Date(session.deadline).getTime() <= Date.now();
  if (!shouldCloseGate(submittedCount, session.expected_participant_count, session.submission_status, deadlinePassed)) {
    return;
  }

  const claimed = await claimGate(sessionId);
  if (!claimed) return; // another concurrent caller already claimed it, or the condition no longer holds

  await runGenerationAndSave(sessionId);
}

async function runGenerationAndSave(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  const submittedNames = await listParticipantNames(sessionId);
  const missingNames = computeMissingNames(session.expected_names, submittedNames);

  await getSupabaseAdmin()
    .from("sessions")
    .update({
      submission_status: "generating",
      recommendation_status: "in_progress",
      included_count: submittedNames.length,
      missing_names: missingNames,
    })
    .eq("id", sessionId);

  try {
    const submissions = await listSubmissions(sessionId);
    const matchingInputs = submissions.map(toMatchingInput);

    const [fromPicks, discoveredResult] = await Promise.all([
      generateFromPicks(matchingInputs),
      generateDiscovered(matchingInputs),
    ]);

    const rows = [
      ...(fromPicks
        ? [{ session_id: sessionId, recommendation_type: "from_picks" as const, verified: true, ...toRecommendationRow(fromPicks) }]
        : []),
      {
        session_id: sessionId,
        recommendation_type: "discovered" as const,
        verified: discoveredResult.verified,
        ...toRecommendationRow(discoveredResult.recommendation),
      },
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

    // Best-effort: a PDF failure must never undo an otherwise-successful
    // generation. If this fails, ensureItineraryPdf's lazy path on first
    // download retries it exactly once more.
    try {
      await ensureItineraryPdf(sessionId);
    } catch (pdfErr) {
      console.error(`Itinerary PDF generation failed for session ${sessionId}:`, pdfErr);
    }
  } catch (err) {
    // submission_status stays "generating" (the gate has genuinely closed —
    // we do not reopen it or accept new submissions) but recommendation_status
    // flips to "failed", which the frontend surfaces with a retry action.
    // All submitted preference data is untouched.
    console.error(`Recommendation generation failed for session ${sessionId}:`, err);
    await getSupabaseAdmin().from("sessions").update({ recommendation_status: "failed" }).eq("id", sessionId);
  }
}

// App copy (including AI-generated text) never uses em dashes — the
// prompts already ask for periods/commas instead, but this is the
// backstop in case the model slips one in anyway. Applied once here, at
// the point every recommendation gets saved, so both the on-screen
// display and the PDF stay consistent without sanitizing in two places.
function stripEmDashes(s: string): string {
  return s.replace(/\s*—\s*/g, ", ").replace(/—/g, ",");
}

function toRecommendationRow(r: Recommendation) {
  return {
    destination: stripEmDashes(r.destination),
    summary: stripEmDashes(r.summary),
    suggested_window: {
      start_date: r.suggested_window.start_date,
      end_date: r.suggested_window.end_date,
      season: stripEmDashes(r.suggested_window.season),
    },
    budget_estimate: {
      transport: stripEmDashes(r.budget_estimate.transport),
      stay: stripEmDashes(r.budget_estimate.stay),
      food: stripEmDashes(r.budget_estimate.food),
      activities: stripEmDashes(r.budget_estimate.activities),
      note: stripEmDashes(r.budget_estimate.note),
    },
    attractions: r.attractions.map(stripEmDashes),
  };
}

export interface SessionView {
  session: Session;
  submittedNames: string[];
  submittedCount: number;
  recommendations: RecommendationsRow | null;
  recommendationFailed: boolean;
  /** A single aggregated tag (e.g. "beach"), never raw per-person preference data — used only for results-page image matching. */
  mostCommonDestinationType: string | null;
}

export async function loadSessionView(sessionId: string): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  // The deadline is a real trigger now (condition b), and nothing else
  // polls for it — a page load (or a fresh submission, or an organizer
  // action) is what actually notices it has passed and closes the gate.
  if (session.submission_status === "collecting") {
    await tryCloseGateAndGenerate(sessionId);
  }

  const freshSession = (await getSession(sessionId)) ?? session;
  const isComplete = freshSession.submission_status === "complete";
  const [submittedNames, recommendations, submissions] = await Promise.all([
    listParticipantNames(sessionId),
    isComplete ? getRecommendations(sessionId) : Promise.resolve(null),
    isComplete ? listSubmissions(sessionId) : Promise.resolve([]),
  ]);

  return {
    session: freshSession,
    submittedNames,
    submittedCount: submittedNames.length,
    recommendations,
    recommendationFailed: freshSession.recommendation_status === "failed",
    mostCommonDestinationType: mostCommonDestinationType(submissions.map((s) => s.destination_types)),
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
 * Organizer actions, available any time pre-lock: extend the deadline
 * (more time before the hard cutoff forces a partial result), or drop a
 * non-responder so the "everyone's in" condition can close the gate early
 * without waiting for the deadline.
 */
export async function extendDeadline(
  sessionId: string,
  durationValue: number,
  durationUnit: DurationUnit
): Promise<SessionView | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.submission_status !== "collecting") return loadSessionView(sessionId);

  // Extends from the CURRENT deadline, not from now — "add 30 more minutes"
  // means 30 minutes later than it was already set to, not 30 minutes from
  // whenever the organizer happens to click the button.
  const newDeadline = computeDeadline(new Date(session.deadline), durationValue, durationUnit);
  const { error } = await getSupabaseAdmin()
    .from("sessions")
    .update({ deadline: newDeadline.toISOString() })
    .eq("id", sessionId);
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

  // This is the one case besides a fresh submission (or the deadline
  // itself, on the next read) that can close the gate — re-check right
  // away so removing the last non-responder actually triggers generation
  // instead of waiting for another event.
  await tryCloseGateAndGenerate(sessionId);
  return loadSessionView(sessionId);
}

/**
 * Generates the combined-itinerary PDF exactly once and caches it in
 * Supabase Storage — every call after the first just downloads the saved
 * file. Never triggers a new AI call: it only renders recommendation data
 * that's already been generated and saved. Returns null when the trip
 * isn't complete yet (nothing to render).
 */
export async function ensureItineraryPdf(sessionId: string): Promise<Buffer | null> {
  const session = await getSession(sessionId);
  if (!session || session.submission_status !== "complete") return null;

  if (session.itinerary_pdf_path) {
    const { data, error } = await getSupabaseAdmin().storage.from(ITINERARY_BUCKET).download(session.itinerary_pdf_path);
    if (!error && data) return Buffer.from(await data.arrayBuffer());
    console.error(`Stored itinerary PDF unreadable for session ${sessionId}, regenerating:`, error);
  }

  const recommendations = await getRecommendations(sessionId);
  if (!recommendations) return null;
  const pdfData = buildItineraryPdfData(
    {
      title: session.title,
      expectedParticipantCount: session.expected_participant_count,
      includedCount: session.included_count,
      missingNames: session.missing_names,
    },
    recommendations
  );
  if (!pdfData) return null;

  const buffer = await renderItineraryPdf(pdfData);
  const path = `${sessionId}/itinerary.pdf`;
  const { error: uploadError } = await getSupabaseAdmin()
    .storage.from(ITINERARY_BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    console.error(`Itinerary PDF upload failed for session ${sessionId}:`, uploadError);
    return buffer; // still hand back the freshly rendered bytes even if caching to storage failed
  }

  await getSupabaseAdmin().from("sessions").update({ itinerary_pdf_path: path }).eq("id", sessionId);
  return buffer;
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
    includedCount: session.included_count,
    missingNames: session.missing_names,
    recommendations: session.submission_status === "complete" ? view.recommendations : null,
    recommendationFailed: view.recommendationFailed,
    mostCommonDestinationType: view.mostCommonDestinationType,
  };
}
