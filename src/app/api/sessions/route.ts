import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const organizerName = typeof body?.organizerName === "string" ? body.organizerName.trim() : "";
  const deadline = typeof body?.deadline === "string" ? body.deadline : "";

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!organizerName) return NextResponse.json({ error: "organizerName is required" }, { status: 400 });
  if (!deadline || Number.isNaN(new Date(deadline).getTime())) {
    return NextResponse.json({ error: "deadline must be a valid ISO date string" }, { status: 400 });
  }

  const session = await createSession(title, organizerName, deadline);
  return NextResponse.json({ session }, { status: 201 });
}
