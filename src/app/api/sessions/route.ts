import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/sessionDb";
import { computeDeadline, DurationUnit } from "@/lib/sessionGate";

export const dynamic = "force-dynamic";

const DURATION_UNITS: DurationUnit[] = ["minutes", "hours", "days"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const organizerName = typeof body?.organizerName === "string" ? body.organizerName.trim() : "";
  const durationValue = Number(body?.durationValue);
  const durationUnit = body?.durationUnit;
  const expectedNamesRaw = body?.expectedNames;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!organizerName) return NextResponse.json({ error: "organizerName is required" }, { status: 400 });
  if (!Number.isFinite(durationValue) || durationValue <= 0) {
    return NextResponse.json({ error: "durationValue must be a positive number" }, { status: 400 });
  }
  if (!DURATION_UNITS.includes(durationUnit)) {
    return NextResponse.json({ error: "durationUnit must be one of minutes, hours, days" }, { status: 400 });
  }

  // Optional: if the organizer lists expected names, expectedParticipantCount
  // is derived from that list (so the two can never disagree); otherwise a
  // plain count is required.
  let expectedNames: string[] | null = null;
  if (Array.isArray(expectedNamesRaw)) {
    const cleaned = expectedNamesRaw.map((n) => (typeof n === "string" ? n.trim() : "")).filter(Boolean);
    if (cleaned.length > 0) expectedNames = cleaned;
  }

  const expectedParticipantCount = expectedNames ? expectedNames.length : Number(body?.expectedParticipantCount);
  if (!Number.isInteger(expectedParticipantCount) || expectedParticipantCount < 1) {
    return NextResponse.json(
      { error: "expectedParticipantCount must be a whole number of at least 1 (or provide expectedNames)" },
      { status: 400 }
    );
  }

  const deadline = computeDeadline(new Date(), durationValue, durationUnit);
  const session = await createSession(title, organizerName, deadline.toISOString(), expectedParticipantCount, expectedNames);
  return NextResponse.json({ session }, { status: 201 });
}
