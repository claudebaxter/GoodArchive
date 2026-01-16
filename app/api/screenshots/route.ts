import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { uploadScreenshotBlob } from "@/lib/storage";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(ip, { keyPrefix: "screenshots", limit: 6, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "unsupported_content_type" }, { status: 415 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file_required" }, { status: 400 });
    }
    const key = await uploadScreenshotBlob(file);
    return NextResponse.json({ key }, { status: 201 });
  } catch (e: any) {
    if (e?.message === "file_too_large") {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }
    if (e?.message === "unsupported_media_type") {
      return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
    }
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}

