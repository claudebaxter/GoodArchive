import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";
import { hashIp } from "@/lib/crypto";
import { submissionSchema, type SubmissionInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr;
  // Next.js doesn't expose remoteAddress in a portable way
  return null;
}

async function ensureBucket() {
  const supabase = getAdminClient();
  const name = "screenshots";
  const { data: existing } = await supabase.storage.getBucket(name);
  if (!existing) {
    await supabase.storage.createBucket(name, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    });
  }
}

async function handleMultipart(
  req: NextRequest
): Promise<{ data: SubmissionInput; fileUrl?: string }> {
  const form = await req.formData();
  const payload = {
    platform: String(form.get("platform") ?? ""),
    public_handle: String(form.get("public_handle") ?? ""),
    display_name:
      form.get("display_name") != null
        ? String(form.get("display_name"))
        : undefined,
    permalink: String(form.get("permalink") ?? ""),
    posted_at:
      form.get("posted_at") != null ? String(form.get("posted_at")) : undefined,
    tags:
      form.getAll("tags")?.map((t) => String(t)) ??
      (String(form.get("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as string[]),
    note: form.get("note") != null ? String(form.get("note")) : undefined,
  };

  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Response(
      JSON.stringify({ error: "validation_error", details: parsed.error.flatten() }),
      { status: 422 }
    );
  }

  const file = form.get("screenshot");
  if (file && file instanceof Blob) {
    if (file.size > 10 * 1024 * 1024) {
      throw new Response(JSON.stringify({ error: "file_too_large" }), {
        status: 413,
      });
    }
    await ensureBucket();
    const supabase = getAdminClient();
    const ext =
      (file.type && file.type.split("/")[1]) ||
      "bin";
    const key = `${new Date().getUTCFullYear()}/${new Date()
      .toISOString()
      .slice(0, 10)}/${randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("screenshots")
      .upload(key, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      throw new Response(JSON.stringify({ error: "upload_failed" }), {
        status: 500,
      });
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("screenshots").getPublicUrl(key);
    return { data: parsed.data, fileUrl: publicUrl };
  }

  return { data: parsed.data };
}

async function handleJson(req: NextRequest): Promise<{ data: SubmissionInput }> {
  const body = await req.json();
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    throw new Response(
      JSON.stringify({ error: "validation_error", details: parsed.error.flatten() }),
      { status: 422 }
    );
  }
  return { data: parsed.data };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let parsed:
      | { data: SubmissionInput; fileUrl?: string }
      | { data: SubmissionInput };
    if (contentType.includes("multipart/form-data")) {
      parsed = await handleMultipart(req);
    } else if (contentType.includes("application/json")) {
      parsed = await handleJson(req);
    } else {
      return NextResponse.json(
        { error: "unsupported_content_type" },
        { status: 415 }
      );
    }

    const supabase = getAdminClient();
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    const { data: entry, error: insertErr } = await supabase
      .from("entries")
      .insert({
        platform: parsed.data.platform,
        public_handle: parsed.data.public_handle,
        display_name: parsed.data.display_name ?? null,
        permalink: parsed.data.permalink,
        screenshot_url: "fileUrl" in parsed ? parsed.fileUrl ?? null : null,
        posted_at: parsed.data.posted_at ?? null,
        tags: parsed.data.tags ?? [],
        note: parsed.data.note ?? null,
        status: "pending",
        submitted_by: null,
      })
      .select("id")
      .single();

    if (insertErr || !entry) {
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }

    // Store ip hash in owner-only table (null if secret not set)
    if (ipHash) {
      await supabase.from("entry_secrets").insert({
        entry_id: entry.id,
        ip_hash: ipHash,
      });
    }

    return NextResponse.json(
      { id: entry.id, status: "pending" },
      { status: 201 }
    );
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

