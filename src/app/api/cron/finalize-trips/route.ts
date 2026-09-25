import { NextRequest, NextResponse } from "next/server";
import { finalizeAllExpiredTrips } from "@/lib/tripLifecycle";

export const dynamic = "force-dynamic"; // always hit the DB live, never statically cached

// Not scheduled. Finalization is purely on-demand: `maybeFinalizeTrip` in
// lib/tripLifecycle.ts runs whenever anyone loads a trip past its deadline,
// which covers every case that actually matters (someone comes back to look).
// This route is kept as a manual/optional trigger — e.g. hit it by hand, or
// wire up a cron later — for the edge case of a trip nobody ever revisits.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const finalizedTripIds = await finalizeAllExpiredTrips();
  return NextResponse.json({ finalizedCount: finalizedTripIds.length, finalizedTripIds });
}
