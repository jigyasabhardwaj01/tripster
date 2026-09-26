import { NextResponse } from "next/server";
import { InvalidDateRangeError, SessionLockedError, upsertSubmission } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

// Expects date ranges as { start_date, exit_date } (YYYY-MM-DD), matching the
// spec's field names exactly. Re-validates exit_date > start_date server-side
// even though the frontend also checks this — never trust the client alone.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const budgetMin = Number(body?.budget_min);
  const budgetMax = Number(body?.budget_max);
  const dateRanges = Array.isArray(body?.date_ranges) ? body.date_ranges : [];
  const destinationTypes = Array.isArray(body?.destination_types) ? body.destination_types : [];
  const preferredLocations = Array.isArray(body?.preferred_locations) ? body.preferred_locations : [];
  const dealbreakers = typeof body?.dealbreakers === "string" ? body.dealbreakers : "";

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin > budgetMax) {
    return NextResponse.json({ error: "budget_min/budget_max must be numbers with min <= max" }, { status: 400 });
  }

  try {
    const submission = await upsertSubmission(params.id, {
      name,
      budgetMin,
      budgetMax,
      dateRanges,
      destinationTypes,
      preferredLocations,
      dealbreakers,
    });
    return NextResponse.json({ submission }, { status: 200 });
  } catch (err) {
    if (err instanceof SessionLockedError) {
      // Explicit, clear "locked" response — never fail silently, per spec.
      return NextResponse.json({ error: "locked", message: err.message }, { status: 423 });
    }
    if (err instanceof InvalidDateRangeError) {
      return NextResponse.json({ error: "invalid_date_range", message: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message === "Session not found") {
      return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
