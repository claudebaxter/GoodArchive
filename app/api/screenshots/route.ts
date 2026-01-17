import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { uploadScreenshotBlob } from "@/lib/storage";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "deprecated" }, { status: 410 });
}

