import { NextResponse } from "next/server";
import { extendDeadline, removeNonRespondingParticipant, toApiResponse } from "@/lib/sessionDb";
import { DurationUnit } from "@/lib/sessionGate";

export const dynamic = "force-dynamic";

const DURATION_UNITS: DurationUnit[] = ["minutes", "hours", "days"];

// Organizer actions, available any time pre-lock (not gated behind the
// deadline passing — with the deadline now a real hard cutoff, generation
// closes the gate on its own the moment it passes with >=1 submission, so
// these are for finishing early or buying more time, not for unsticking a
// stalled trip). Both are no-ops once the gate has already closed.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action === "extend_deadline") {
    const durationValue = Number(body?.durationValue);
    const durationUnit = body?.durationUnit;
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      return NextResponse.json({ error: "durationValue must be a positive number" }, { status: 400 });
    }
    if (!DURATION_UNITS.includes(durationUnit)) {
      return NextResponse.json({ error: "durationUnit must be one of minutes, hours, days" }, { status: 400 });
    }
    const view = await extendDeadline(params.id, durationValue, durationUnit);
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
