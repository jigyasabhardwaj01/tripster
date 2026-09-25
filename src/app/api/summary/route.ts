import { NextRequest, NextResponse } from "next/server";
import { getShortlistScores } from "@/lib/shortlist";
import { summarizeDestinationFit } from "@/lib/summary";

export const dynamic = "force-dynamic";

// AI SUMMARY INTEGRATION POINT (not called from the UI yet — see lib/summary.ts
// and the comments in src/app/trip/[id]/page.tsx). Takes an already-computed
// destination score (by id) and returns a one-line plain-language summary.
// Never decides anything — see lib/scoring.ts for why.
export async function POST(req: NextRequest) {
  const { tripId, destinationId } = await req.json();
  if (!tripId || !destinationId) {
    return NextResponse.json({ error: "tripId and destinationId are required" }, { status: 400 });
  }

  const scores = await getShortlistScores(tripId);
  const match = scores?.find((s) => s.destination.id === destinationId);
  if (!match) {
    return NextResponse.json({ error: "Destination not in this trip's shortlist" }, { status: 404 });
  }

  const summary = await summarizeDestinationFit(match);
  return NextResponse.json({ summary });
}
