"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveEntry(entryId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("entries")
    .update({ status: "approved" })
    .eq("id", entryId);
  revalidatePath("/dashboard");
  if (error) {
    console.error("approveEntry error:", error.message);
  }
}

export async function rejectEntry(entryId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("entries")
    .update({ status: "rejected" })
    .eq("id", entryId);
  revalidatePath("/dashboard");
  if (error) {
    console.error("rejectEntry error:", error.message);
  }
}

