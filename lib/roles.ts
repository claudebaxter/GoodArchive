import "server-only";
import { getAdminClient } from "./supabaseServer";

export async function isStaff(userId: string): Promise<boolean> {
  if (!userId) return false;
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === "owner" || data.role === "moderator";
}

