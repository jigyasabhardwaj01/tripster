import { NextRequest, NextResponse } from "next/server";
import { getOrComputeShortlist } from "@/lib/shortlist";
import { summarizeDestinationFit } from "@/lib/summary";

// Optional-AI endpoint: takes an already-computed destination score (by id)
// and returns a one-line plain-language summary. Never decides anything —
// see lib/summary.ts and lib/scoring.ts for why.
export async function POST(req: NextRequest) {
  const { tripId, destinationId } = await req.json();
  if (!tripId || !destinationId) {
    return NextResponse.json({ error: "tripId and destinationId are required" }, { status: 400 });
  }

  const state = await getOrComputeShortlist(tripId);
  const match = state.scores.find((s) => s.destination.id === destinationId);
  if (!match) {
    return NextResponse.json({ error: "Destination not in this trip's shortlist" }, { status: 404 });
  }

  const summary = await summarizeDestinationFit(match);
  return NextResponse.json({ summary });
}
