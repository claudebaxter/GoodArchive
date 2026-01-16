import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseServer";
import { submissionSchema } from "@/lib/validation";
import { z } from "zod";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Basic rate limit
    const ip = getClientIp(req);
    const rl = await checkRateLimit(ip, { keyPrefix: "entries", limit: 10, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await req.json();

    // hCaptcha verification (if configured)
    const hcaptchaSecret = process.env.HCAPTCHA_SECRET;
    const hcaptchaSitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;
    if (hcaptchaSitekey && !hcaptchaSecret) {
      return NextResponse.json({ error: "captcha_misconfigured" }, { status: 500 });
    }
    if (hcaptchaSecret) {
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
    }

    // Accept optional screenshot_path (storage key) and screenshot_url (URL) with proper zod types
    const createEntrySchema = submissionSchema.extend({
      screenshot_url: z.string().url().optional(),
      screenshot_path: z.string().min(1).max(2048).optional(),
    });
    const parsed = createEntrySchema.safeParse(body);
    if (!parsed.success) {
      // Extra debug info for local dev
      const dbg = {
        received: {
          platform: body?.platform,
          public_handle: body?.public_handle,
          permalink: body?.permalink,
          tags: Array.isArray(body?.tags) ? body.tags.length : undefined,
          note_len: typeof body?.note === "string" ? body.note.length : undefined,
          screenshot_path_len:
            typeof body?.screenshot_path === "string" ? body.screenshot_path.length : undefined,
          screenshot_url_len:
            typeof body?.screenshot_url === "string" ? body.screenshot_url.length : undefined,
        },
      };
      console.error("[/api/entries] validation_error", {
        issues: parsed.error.issues,
        ...dbg,
      });
      return NextResponse.json(
        { error: "validation_error", details: parsed.error.flatten(), ...dbg },
        { status: 422 }
      );
    }

    const supabase = getAdminClient();

    const { data: entry, error } = await supabase
      .from("entries")
      .insert({
        platform: parsed.data.platform,
        public_handle: parsed.data.public_handle,
        display_name: parsed.data.display_name ?? null,
        permalink: parsed.data.permalink,
        // Store storage key (preferred) or provided URL if present
        screenshot_url:
          parsed.data.screenshot_path ?? parsed.data.screenshot_url ?? null,
        posted_at: parsed.data.posted_at ?? null,
        tags: parsed.data.tags ?? [],
        note: parsed.data.note ?? null,
        status: "pending",
        submitted_by: null,
      })
      .select("id")
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }

    return NextResponse.json({ id: entry.id, status: "pending" }, { status: 201 });
  } catch (err: any) {
    console.error("[api/entries] server_error", err?.message, err?.stack ?? err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }  
}

