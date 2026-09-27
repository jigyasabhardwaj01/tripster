import { NextResponse } from "next/server";
import { ensureItineraryPdf, getSession } from "@/lib/sessionDb";

export const dynamic = "force-dynamic";

// Serves the one combined-itinerary PDF for this trip. Generated once
// (either right after both destinations finished generating, or lazily
// here on first request if that best-effort step failed) and cached in
// Supabase Storage — never regenerated per click, never triggers a new AI
// call. 404 before the trip has actually completed.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(params.id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const pdf = await ensureItineraryPdf(params.id);
  if (!pdf) return NextResponse.json({ error: "not_ready", message: "This trip hasn't finalized yet." }, { status: 404 });

  const filename = `${session.title.replace(/[^a-z0-9-_ ]/gi, "").trim() || "trip"}-itinerary.pdf`;
  return new NextResponse(new Blob([Uint8Array.from(pdf)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(pdf.length),
    },
  });
}
