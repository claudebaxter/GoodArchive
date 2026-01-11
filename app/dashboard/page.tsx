import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { approveEntry, rejectEntry } from "./actions";
import LogoutButton from "@/components/auth/LogoutButton";
import { createClient } from "@supabase/supabase-js";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: roleRow, error: roleErr } = await admin
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .maybeSingle();

if (roleErr || !roleRow || (roleRow.role !== "owner" && roleRow.role !== "moderator")) {
  redirect("/login");
}


  const { data: pending } = await supabase
    .from("entries")
    .select("id, platform, public_handle, permalink, screenshot_url, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <LogoutButton />
      </div>
      <p>Welcome, {user.email}</p>

      <section style={{ marginTop: "2rem" }}>
        <h2>Pending entries</h2>
        {!pending || pending.length === 0 ? (
          <p>No pending entries.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pending.map((e) => (
              <li
                key={e.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "0.75rem",
                  marginTop: "0.75rem",
                  display: "grid",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{e.platform}</strong>
                  <span>@{e.public_handle}</span>
                  <a href={e.permalink} target="_blank" rel="noreferrer">
                    View
                  </a>
                  <span style={{ color: "#666", marginLeft: "auto" }}>
                    {new Date(e.created_at as any).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <form action={approveEntry.bind(null, e.id)}>
                    <button type="submit">Approve</button>
                  </form>
                  <form action={rejectEntry.bind(null, e.id)}>
                    <button type="submit">Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

