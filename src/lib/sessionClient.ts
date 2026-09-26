"use client";

// Thin fetch wrappers around /api/sessions/**. This system never talks to
// Supabase directly from the browser — everything is mediated by the API
// routes using the service-role key (see lib/supabaseAdmin.ts), which is
// what makes pre-lock visibility rules actually enforceable.

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

export interface BudgetCheck {
  name: string;
  within_budget: boolean;
  note: string | null;
}

export interface CalendarCheck {
  name: string;
  dates_work: boolean;
  note: string | null;
}

export interface FinalizedResult {
  finalized_trip: string;
  reason: string;
  budget_check: BudgetCheck[];
  calendar_check: CalendarCheck[];
}

export interface SessionViewResponse {
  id: string;
  title: string;
  deadline: string;
  locked: boolean;
  submittedNames: string[];
  results: FinalizedResult | null;
  scoringFailed: boolean;
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

export async function createSession(title: string, deadlineIso: string): Promise<{ session: { id: string } }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, deadline: deadlineIso }),
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
