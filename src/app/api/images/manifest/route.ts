import { NextResponse } from "next/server";
import { getImageManifest } from "@/lib/imageManifest";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getImageManifest());
}
