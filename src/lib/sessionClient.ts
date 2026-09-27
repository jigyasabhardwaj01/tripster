"use client";

// Thin fetch wrappers around /api/sessions/**. This system never talks to
// Supabase directly for preference data or recommendations — those are
// mediated by the API routes using the service-role key (see
// lib/supabaseAdmin.ts). The one exception is the `participants` table
// (name + timestamp only, never preferences), which is safe to read
// directly via Realtime — see lib/supabase.ts.

export interface DateRangeInput {
  start_date: string;
  exit_date: string;
}

export interface SubmissionInput {
  name: string;
  budget_min: number;
  budget_max: number;
  date_ranges: DateRangeInput[];
  destination_types: string[];
  preferred_locations: string[];
  dealbreakers: string;
}

export interface BudgetEstimate {
  transport: string;
  stay: string;
  food: string;
  activities: string;
  note: string;
}

export interface SuggestedWindow {
  start_date: string;
  end_date: string;
  season: string;
}

export interface Recommendation {
  destination: string;
  summary: string;
  suggested_window: SuggestedWindow;
  budget_estimate: BudgetEstimate;
  attractions: string[];
}

export interface RecommendationsResponse {
  fromPicks: Recommendation | null;
  discovered: Recommendation | null;
  discoveredVerified: boolean;
}

export type SubmissionStatus = "collecting" | "ready_for_analysis" | "generating" | "complete";
export type RecommendationStatus = "not_started" | "in_progress" | "complete" | "failed";
export type DurationUnit = "minutes" | "hours" | "days";

export interface SessionViewResponse {
  id: string;
  title: string;
  organizerName: string;
  deadline: string;
  expectedParticipantCount: number;
  submissionStatus: SubmissionStatus;
  recommendationStatus: RecommendationStatus;
  locked: boolean;
  submittedNames: string[];
  submittedCount: number;
  includedCount: number | null;
  missingNames: string[] | null;
  recommendations: RecommendationsResponse | null;
  recommendationFailed: boolean;
  mostCommonDestinationType: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body?.message || body?.error || `Request failed (${res.status})`, res.status, body?.error);
  }
  return body;
}

export async function createSession(
  title: string,
  organizerName: string,
  durationValue: number,
  durationUnit: DurationUnit,
  expectedParticipantCount: number,
  expectedNames: string[] | null
): Promise<{ session: { id: string } }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, organizerName, durationValue, durationUnit, expectedParticipantCount, expectedNames }),
  });
  return parseJsonOrThrow(res);
}

export async function getSessionView(sessionId: string): Promise<SessionViewResponse> {
  const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
  if (res.status === 404) throw new ApiError("Session not found", 404, "not_found");
  return parseJsonOrThrow(res);
}

export async function submitResponse(sessionId: string, input: SubmissionInput): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/submissions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseJsonOrThrow(res);
}

export async function retrySession(sessionId: string): Promise<SessionViewResponse> {
  const res = await fetch(`/api/sessions/${sessionId}/retry`, { method: "POST" });
  return parseJsonOrThrow(res);
}

export async function extendDeadline(
  sessionId: string,
  durationValue: number,
  durationUnit: DurationUnit
): Promise<SessionViewResponse> {
  const res = await fetch(`/api/sessions/${sessionId}/organizer-action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "extend_deadline", durationValue, durationUnit }),
  });
  return parseJsonOrThrow(res);
}

export async function removeNonRespondingParticipant(sessionId: string): Promise<SessionViewResponse> {
  const res = await fetch(`/api/sessions/${sessionId}/organizer-action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "remove_participant" }),
  });
  return parseJsonOrThrow(res);
}
