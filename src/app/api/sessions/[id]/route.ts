import { NextResponse } from "next/server";
import { loadSessionView } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

// This is where "on-demand when the session page loads" lock + scoring
// happens — see loadSessionView in lib/sessionDb.ts. Before lock, the
// response contains only the deadline and who's submitted (name only).
// After lock, it contains the AI-generated options — never raw submissions.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const view = await loadSessionView(params.id);
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
