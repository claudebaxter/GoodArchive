import "server-only";
import { getAdminClient } from "@/lib/supabaseServer";

const BUCKET = "screenshots";

export async function getSignedScreenshotUrl(key?: string | null, expiresInSec = 3600) {
  if (!key) return null;
  const admin = getAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(key, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

