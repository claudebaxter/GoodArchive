import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabaseServer";
import { getSignedScreenshotUrl } from "@/lib/supabase/signedUrl";

type SearchParams = {
  q?: string;
  platform?: string;
  tag?: string;
  page?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp?.q || "").trim();
  const platform = (sp?.platform || "").trim().toLowerCase();
  const tag = (sp?.tag || "").trim();
  const page = Math.max(1, Number(sp?.page || 1) || 1);
  const limit = 20;
  const from = (page - 1) * limit;

  const supabase = await createServerSupabaseClient();
  const noFilters = !q && !platform && !tag;
  let rows: any[] | null = null;
  const admin = getAdminClient();
  if (noFilters) {
    const { data } = await admin
      .from("entries")
      .select("id, platform, public_handle, display_name, permalink, created_at, tags, screenshot_url")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);
    rows = data ?? [];
  } else {
    // Use admin client for RPC to avoid any RLS/session edge cases
    const { data, error } = await admin.rpc("search_entries", {
      p_q: q || null,
      p_platform: platform || null,
      p_tag: tag || null,
      p_limit: limit,
      p_offset: from,
    });
    if (error) {
      console.error("[/search] rpc error", error);
    }
    rows = data ?? [];
  }
  const withSigned = await Promise.all(
    (rows || []).map(async (e: any) => ({
      ...e,
      screenshotSigned: await getSignedScreenshotUrl(e.screenshot_url),
    }))
  );

  console.log("[/search] params", { q, platform, tag, page, limit, got: (withSigned || []).length });

  return (
    <main>
      <h1 className="page-title">Search</h1>
      <form method="get" className="form-grid" style={{ marginTop: "1rem" }}>
        <input name="q" placeholder="Query" defaultValue={q} />
        <input name="platform" placeholder="Platform (optional)" defaultValue={platform} />
        <input name="tag" placeholder="Tag (optional)" defaultValue={tag} />
        <div className="actions">
          <button className="btn btn-primary" type="submit">Search</button>
        </div>
      </form>

      <div style={{ marginTop: "1rem" }}>
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
      <div className="actions" style={{ marginTop: "1rem" }}>
        {page > 1 && (
          <Link href={`/search?q=${encodeURIComponent(q)}&platform=${encodeURIComponent(platform)}&tag=${encodeURIComponent(tag)}&page=${page - 1}`}>
            Previous
          </Link>
        )}
        {(rows?.length || 0) === limit && (
          <Link href={`/search?q=${encodeURIComponent(q)}&platform=${encodeURIComponent(platform)}&tag=${encodeURIComponent(tag)}&page=${page + 1}`}>
            Next
          </Link>
        )}
      </div>
    </main>
  );
}

