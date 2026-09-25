import { NextRequest, NextResponse } from "next/server";
import { finalizeAllExpiredTrips } from "@/lib/tripLifecycle";

export const dynamic = "force-dynamic"; // always hit the DB live, never statically cached

// Scheduled via vercel.json crons (see repo root). Also mirrored by a lazy,
// per-page check (maybeFinalizeTrip in lib/tripLifecycle.ts) since Vercel's
// Hobby-tier cron only runs once a day — nowhere near tight enough to catch a
// 48-hour deadline promptly on its own.
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
