import { NextResponse } from "next/server";
import { retryGeneration, toApiResponse } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

// Manual recovery path for a session whose gate has closed but a prior
// Gemini attempt failed both tries. Not part of "normal operation" — see
// lib/sessionDb.ts for why this doesn't run automatically.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const view = await retryGeneration(params.id);
  if (!view) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(toApiResponse(view));
}
