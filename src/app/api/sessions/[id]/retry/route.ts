import { NextResponse } from "next/server";
import { retryScoring } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

// Manual recovery path for the one scenario loadSessionView won't retry on
// its own: a session that's locked but has no results because a prior
// Gemini attempt failed both tries. Not part of "normal operation" — see
// lib/sessionDb.ts for why this doesn't run automatically on every load.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const view = await retryScoring(params.id);
  if (!view) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { session, submittedNames, results, scoringFailed } = view;
  return NextResponse.json({
    id: session.id,
    title: session.title,
    deadline: session.deadline,
    locked: session.locked,
    submittedNames,
    results: session.locked ? results?.options ?? null : null,
    scoringFailed,
  });
}
