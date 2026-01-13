-- RPC for flexible search over approved entries
create or replace function public.search_entries(
  p_q text default null,
  p_platform text default null,
  p_tag text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns setof public.entries
language sql
stable
as $$
  select *
  from public.entries e
  where e.status = 'approved'
    and (p_platform is null or lower(e.platform) = lower(p_platform))
    and (
      p_q is null
      or e.public_handle ilike '%' || p_q || '%'
      or coalesce(e.display_name, '') ilike '%' || p_q || '%'
      or e.permalink ilike '%' || p_q || '%'
      or coalesce(e.note, '') ilike '%' || p_q || '%'
      or array_to_string(e.tags, ',') ilike '%' || p_q || '%'
    )
    and (
      p_tag is null
      or array_to_string(e.tags, ',') ilike '%' || p_tag || '%'
    )
  order by e.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

