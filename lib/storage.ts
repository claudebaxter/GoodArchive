import "server-only";
import { getAdminClient } from "./supabaseServer";
import { randomUUID } from "crypto";

const BUCKET = "screenshots";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function ensureScreenshotsBucket() {
  const supabase = getAdminClient();
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (!existing) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_SIZE,
    });
  }
}

export async function uploadScreenshotBlob(file: Blob): Promise<string> {
  if (file.size > MAX_SIZE) {
    throw new Error("file_too_large");
  }
  const mime = file.type || "";
  const ext = ALLOWED[mime];
  if (!ext) {
    throw new Error("unsupported_media_type");
  }
  await ensureScreenshotsBucket();
  const supabase = getAdminClient();
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${now.toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: mime, upsert: false });
  if (error) {
    throw new Error("upload_failed");
  }
  // Return the private storage key
  return key;
}

