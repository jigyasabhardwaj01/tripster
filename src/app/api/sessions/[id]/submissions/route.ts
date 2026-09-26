import { NextResponse } from "next/server";
import { SessionLockedError, upsertSubmission } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const budgetMin = Number(body?.budgetMin);
  const budgetMax = Number(body?.budgetMax);
  const dateRanges = Array.isArray(body?.dateRanges) ? body.dateRanges : [];
  const destinationTypes = Array.isArray(body?.destinationTypes) ? body.destinationTypes : [];
  const dealbreakers = typeof body?.dealbreakers === "string" ? body.dealbreakers : "";

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin > budgetMax) {
    return NextResponse.json({ error: "budgetMin/budgetMax must be numbers with min <= max" }, { status: 400 });
  }

  try {
    const submission = await upsertSubmission(params.id, {
      name,
      budgetMin,
      budgetMax,
      dateRanges,
      destinationTypes,
      dealbreakers,
    });
    return NextResponse.json({ submission }, { status: 200 });
  } catch (err) {
    if (err instanceof SessionLockedError) {
      // Explicit, clear "locked" response — never fail silently, per spec.
      return NextResponse.json({ error: "locked", message: err.message }, { status: 423 });
    }
    if (err instanceof Error && err.message === "Session not found") {
      return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
