import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Next.js 16: cookies() is async
  const cookieStore = await cookies();

  let accessToken: string | undefined;
  try {
    const projectRef = new URL(url).host.split(".")[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const raw = cookieStore.get(cookieName)?.value;
    if (raw) {
      let jsonText = raw;
      if (raw.startsWith("base64-")) {
        const b64 = raw.slice("base64-".length);
        jsonText = Buffer.from(b64, "base64").toString("utf8");
      }
      const parsed = JSON.parse(jsonText);
      if (parsed?.access_token && typeof parsed.access_token === "string") {
        accessToken = parsed.access_token;
      } else if (Array.isArray(parsed) && parsed[0]?.access_token) {
        accessToken = parsed[0].access_token;
      } else if (parsed?.currentSession?.access_token) {
        accessToken = parsed.currentSession.access_token;
      }
    }
  } catch {
    // treat as unauthenticated if parsing fails
    accessToken = undefined;
  }

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

