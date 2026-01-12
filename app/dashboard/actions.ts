"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/supabaseServer";
import { isStaff } from "@/lib/roles";

const REJECT_BEHAVIOR: "status" | "delete" = "delete";

export async function approveEntry(entryId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("approveEntry: not authenticated");
    return;
  }
  const allowed = await isStaff(user.id);
  if (!allowed) {
    console.error("approveEntry: not staff");
    return;
  }

  const admin = getAdminClient();
  const { error } = await admin.from("entries").update({ status: "approved" }).eq("id", entryId);

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  revalidatePath("/search");

  if (error) console.error("approveEntry error:", error.message);
}

export async function rejectEntry(entryId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("rejectEntry: not authenticated");
    return;
  }
  const allowed = await isStaff(user.id);
  if (!allowed) {
    console.error("rejectEntry: not staff");
    return;
  }

  const admin = getAdminClient();
  let error = null as any;
  if (REJECT_BEHAVIOR === "delete") {
    const resp = await admin.from("entries").delete().eq("id", entryId);
    error = resp.error;
  } else {
    const resp = await admin.from("entries").update({ status: "rejected" }).eq("id", entryId);
    error = resp.error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/feed");
  revalidatePath("/search");

  if (error) console.error("rejectEntry error:", error.message);
}
