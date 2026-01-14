import Link from "next/link";
import { getSignedScreenshotUrl } from "@/lib/supabase/signedUrl";
import { getAdminClient } from "@/lib/supabaseServer";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp?.page || 1) || 1);
  const limit = 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Use admin read here to avoid any RLS/session edge cases for the public feed.
  const admin = getAdminClient();
  const { data: rows } = await admin
    .from("entries")
    .select("id, platform, public_handle, display_name, permalink, created_at, tags, screenshot_url")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(from, to);

  const withSigned = await Promise.all(
    (rows || []).map(async (e: any) => ({
      ...e,
      screenshotSigned: await getSignedScreenshotUrl(e.screenshot_url),
    }))
  );

  console.log("[/feed] params", { page, limit, got: withSigned.length });

  return (
    <main>
      <h1 className="page-title">Approved feed</h1>
      {withSigned.length === 0 ? (
        <p className="muted">No approved entries yet.</p>
      ) : (
        <div>
          {withSigned.map((e) => (
            <div key={e.id} className="card">
              <div className="card-header">
                <strong>{e.platform}</strong>
                <span>{e.public_handle}</span>
                {e.display_name && <span>({e.display_name})</span>}
                <a href={e.permalink} target="_blank" rel="noreferrer">Link</a>
                <span className="muted" style={{ marginLeft: "auto" }}>
                  {new Date(e.created_at as any).toLocaleString()}
                </span>
              </div>
              {e.screenshotSigned && <img className="entry-image" src={e.screenshotSigned} alt="screenshot" />}
              {!!e.tags?.length && (
                <div className="muted" style={{ marginTop: "0.5rem" }}>tags: {(e.tags as string[]).join(", ")}</div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="actions" style={{ marginTop: "1rem" }}>
        {page > 1 && <Link href={`/feed?page=${page - 1}`}>Previous</Link>}
        {(withSigned.length || 0) === limit && <Link href={`/feed?page=${page + 1}`}>Next</Link>}
      </div>
    </main>
  );
}

