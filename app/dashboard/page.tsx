import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { approveEntry, rejectEntry } from "./actions";
import LogoutButton from "@/components/auth/LogoutButton";
import { createClient } from "@supabase/supabase-js";
import ActionButton from "@/components/dashboard/ActionButton";
import { getSignedScreenshotUrl } from "@/lib/supabase/signedUrl";

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


  // Use admin for listing pending to avoid RLS false-negatives;
  // page access is already restricted to staff above.
  const { data: pending } = await admin
    .from("entries")
    .select("id, platform, public_handle, permalink, screenshot_url, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const withSigned = await Promise.all(
    (pending || []).map(async (e: any) => ({
      ...e,
      screenshotSigned: await getSignedScreenshotUrl(e.screenshot_url),
    }))
  );

  return (
    <main>
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
          <p className="muted" style={{ marginTop: "0.25rem" }}>Welcome, {user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <section style={{ marginTop: "1rem" }}>
        <h2 style={{ margin: "0.5rem 0" }}>Pending entries</h2>
        {!withSigned || withSigned.length === 0 ? (
          <p className="muted">No pending entries.</p>
        ) : (
          <div>
            {withSigned.map((e) => (
              <div key={e.id} className="card">
                <div className="card-header">
                  <strong>{e.platform}</strong>
                  <span>{e.public_handle}</span>
                  <a href={e.permalink} target="_blank" rel="noreferrer">
                    View
                  </a>
                  <span className="muted" style={{ marginLeft: "auto" }}>
                    {new Date(e.created_at as any).toLocaleString()}
                  </span>
                </div>
                {e.screenshotSigned && (
                  <img className="entry-image" src={e.screenshotSigned} alt="screenshot" />
                )}
                <div className="actions" style={{ marginTop: "0.5rem" }}>
                  <form action={approveEntry.bind(null, e.id)}>
                    <ActionButton pendingText="Approving…"><span className="btn btn-primary">Approve</span></ActionButton>
                  </form>
                  <form action={rejectEntry.bind(null, e.id)}>
                    <ActionButton pendingText="Rejecting…"><span className="btn btn-danger">Reject</span></ActionButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

