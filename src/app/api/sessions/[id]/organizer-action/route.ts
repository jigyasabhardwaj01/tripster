import { NextResponse } from "next/server";
import { extendDeadline, removeNonRespondingParticipant, toApiResponse } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

// The only two actions available once the deadline has passed with
// submissions still missing — see sessionGate.ts's
// deadlinePassedWithMissingSubmissions flag for when the frontend offers
// these. Neither fires automatically; both are no-ops once the gate has
// already closed (loadSessionView / the underlying functions just return
// the current view unchanged in that case).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "extend_deadline") {
    const deadline = typeof body?.deadline === "string" ? body.deadline : "";
    if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
      return NextResponse.json({ error: "deadline must be a valid ISO date string" }, { status: 400 });
    }
    const view = await extendDeadline(params.id, deadline);
    if (!view) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json(toApiResponse(view));
  }

  if (action === "remove_participant") {
    const view = await removeNonRespondingParticipant(params.id);
    if (!view) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json(toApiResponse(view));
  }

  return NextResponse.json({ error: "action must be 'extend_deadline' or 'remove_participant'" }, { status: 400 });
}
