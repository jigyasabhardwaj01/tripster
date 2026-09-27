import { NextResponse } from "next/server";
import { loadSessionView, toApiResponse } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

// Read-only: no triggering happens here. Generation fires from the
// submissions route (the moment the last expected participant submits) or
// the organizer-action route (removing a non-responder can also close the
// gate) — see lib/sessionDb.ts. Before the gate closes, this response
// contains only the deadline and who's submitted (name only), never
// preference data or recommendations.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const view = await loadSessionView(params.id);
  if (!view) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(toApiResponse(view));
}
