import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseServer";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rateLimit";
import { createSubmissionToken } from "@/lib/uploadToken";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "screenshots";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

async function ensureBucket() {
  const supabase = getAdminClient();
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (!existing) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_SIZE,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(ip, { keyPrefix: "upload_url", limit: 6, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await req.json();
    const hcaptchaSecret = process.env.HCAPTCHA_SECRET;
    if (!hcaptchaSecret) {
      return NextResponse.json({ error: "captcha_misconfigured" }, { status: 500 });
    }
    const token = body?.hcaptcha_token;
    if (!token) {
      return NextResponse.json({ error: "captcha_required" }, { status: 400 });
    }
    try {
      const verifyRes = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: hcaptchaSecret,
          response: token,
          remoteip: ip,
        }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyJson.success) {
        return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "captcha_error" }, { status: 500 });
    }

    const mime = typeof body?.mime === "string" ? body.mime : "";
    const size = typeof body?.size === "number" ? body.size : 0;
    const ext = ALLOWED[mime];
    if (!ext) return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
    if (size > MAX_SIZE) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

    await ensureBucket();
    const supabase = getAdminClient();
    const now = new Date();
    const path = `${now.getUTCFullYear()}/${now.toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "upload_url_failed" }, { status: 500 });
    }

    const submissionToken = await createSubmissionToken(ip);
    if (!submissionToken) {
      return NextResponse.json({ error: "token_store_unavailable" }, { status: 500 });
    }

    return NextResponse.json({
      path,
      signedUrl: data.signedUrl,
      submission_token: submissionToken,
    });
  } catch (err: any) {
    console.error("[api/upload-url] server_error", err?.message, err?.stack ?? err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }  
}

