import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  const platform = (sp?.platform || "").trim();
  const tag = (sp?.tag || "").trim();
  const page = Math.max(1, Number(sp?.page || 1) || 1);
  const limit = 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("entries")
    .select("id, platform, public_handle, display_name, permalink, created_at, tags, screenshot_url")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    // ilike over handle OR display_name
    query = query.or(
      `public_handle.ilike.%${q}%,display_name.ilike.%${q}%`
    );
  }
  if (platform) {
    query = query.eq("platform", platform);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data: rows } = await query;
  const withSigned = await Promise.all(
    (rows || []).map(async (e: any) => ({
      ...e,
      screenshotSigned: await getSignedScreenshotUrl(e.screenshot_url),
    }))
  );

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <nav style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem" }}>
        <Link href="/">Submit</Link>
        <Link href="/feed">Feed</Link>
        <Link href="/search">Search</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
      <h1>Search</h1>
      <form method="get" style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
        <input name="q" placeholder="Query" defaultValue={q} />
        <input name="platform" placeholder="Platform (optional)" defaultValue={platform} />
        <input name="tag" placeholder="Tag (optional)" defaultValue={tag} />
        <button type="submit">Search</button>
      </form>

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
        {withSigned.map((e) => (
          <li key={e.id} style={{ borderBottom: "1px solid #eee", padding: "0.75rem 0" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <strong>{e.platform}</strong>
              <span>@{e.public_handle}</span>
              {e.display_name && <span>({e.display_name})</span>}
              <a href={e.permalink} target="_blank" rel="noreferrer">Link</a>
              <span style={{ marginLeft: "auto", color: "#666" }}>
                {new Date(e.created_at as any).toLocaleString()}
              </span>
            </div>
            {e.screenshotSigned && (
              <div style={{ marginTop: "0.5rem" }}>
                <img src={e.screenshotSigned} alt="screenshot" style={{ maxWidth: "100%", height: "auto", border: "1px solid #eee" }} />
              </div>
            )}
            {!!e.tags?.length && (
              <div style={{ color: "#555" }}>tags: {(e.tags as string[]).join(", ")}</div>
            )}
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
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

