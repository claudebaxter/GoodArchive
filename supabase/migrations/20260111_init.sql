-- Supabase migration: initial schema and RLS for goodarchive
-- Security-first, least-privilege design.
-- This script is idempotent when re-run on an empty/new database.

-- Extensions
create extension if not exists pgcrypto;

-- ======================
-- Types
-- ======================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'entry_status') then
    create type entry_status as enum ('pending','approved','rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type report_status as enum ('open','resolved','dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'mod_request_status') then
    create type mod_request_status as enum ('pending','approved','rejected');
  end if;
end$$;

-- ======================
-- Helper functions
-- ======================
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  -- owners are implicitly moderators
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('owner','moderator')
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.is_moderator();
$$;

-- ======================
-- Tables
-- ======================

-- Minimal roles table (owner/moderator). Seed the first owner manually via SQL or Supabase dashboard.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','moderator')),
  created_at timestamptz not null default now()
);

-- Moderator access requests
create table if not exists public.moderator_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  status mod_request_status not null default 'pending',
  note text,
  decision_by uuid references auth.users(id),
  decision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure only one pending request per user
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='uniq_pending_mod_request_per_user') then
    create unique index uniq_pending_mod_request_per_user
      on public.moderator_requests (requester_id)
      where status = 'pending';
  end if;
end$$;

-- Entries: stores only non-sensitive fields
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  public_handle text not null,
  display_name text,
  permalink text not null,
  screenshot_url text,
  posted_at timestamptz,
  tags text[] not null default '{}',
  note text,
  status entry_status not null default 'pending',
  submitted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Secrets separated from entries to avoid accidental exposure.
create table if not exists public.entry_secrets (
  entry_id uuid primary key references public.entries(id) on delete cascade,
  ip_hash text
);

-- Reports submitted about entries
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  reporter_id uuid references auth.users(id),
  reason text not null check (char_length(reason) <= 2000),
  status report_status not null default 'open',
  resolution_note text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit logs for staff actions
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid references auth.users(id),
  target_table text not null,
  target_id uuid,
  description text,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_entries_status_created on public.entries (status, created_at desc);
create index if not exists idx_entries_platform_handle on public.entries (platform, public_handle);
create index if not exists idx_entries_tags_gin on public.entries using gin (tags);
create index if not exists idx_reports_status on public.reports (status, created_at desc);

-- ======================
-- Triggers
-- ======================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='set_entries_updated_at') then
    create trigger set_entries_updated_at
      before update on public.entries
      for each row
      execute procedure public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='set_reports_updated_at') then
    create trigger set_reports_updated_at
      before update on public.reports
      for each row
      execute procedure public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='set_modreq_updated_at') then
    create trigger set_modreq_updated_at
      before update on public.moderator_requests
      for each row
      execute procedure public.set_updated_at();
  end if;
end$$;

-- Audit helper
create or replace function public.log_audit(
  p_event_type text,
  p_target_table text,
  p_target_id uuid,
  p_description text,
  p_meta jsonb
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.audit_logs (event_type, actor_id, target_table, target_id, description, meta)
  values (p_event_type, auth.uid(), p_target_table, p_target_id, p_description, p_meta);
$$;

-- Log moderation decisions on entries (status changes)
create or replace function public.audit_entry_status()
returns trigger
language plpgsql
as $$
begin
  -- Guard: only staff actions are audited
  if not public.is_staff() then
    return new;
  end if;
  if new.status is distinct from old.status then
    perform public.log_audit(
      'entry_status_changed',
      'entries',
      new.id,
      format('status %s -> %s', old.status, new.status),
      jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='audit_entries_status') then
    create trigger audit_entries_status
      after update on public.entries
      for each row
      execute procedure public.audit_entry_status();
  end if;
end$$;

-- Log moderation decisions on reports
create or replace function public.audit_report_update()
returns trigger
language plpgsql
as $$
begin
  -- Guard: only staff actions are audited
  if not public.is_staff() then
    return new;
  end if;
  if (new.status is distinct from old.status)
     or (new.resolution_note is distinct from old.resolution_note) then
    perform public.log_audit(
      'report_updated',
      'reports',
      new.id,
      'report updated',
      jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='audit_reports_update') then
    create trigger audit_reports_update
      after update on public.reports
      for each row
      execute procedure public.audit_report_update();
  end if;
end$$;

-- Log moderator request decisions
create or replace function public.audit_mod_request_decision()
returns trigger
language plpgsql
as $$
begin
  -- Guard: only staff actions are audited
  if not public.is_staff() then
    return new;
  end if;
  if new.status is distinct from old.status then
    perform public.log_audit(
      'mod_request_decision',
      'moderator_requests',
      new.id,
      format('mod request %s -> %s', old.status, new.status),
      jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='audit_mod_request_update') then
    create trigger audit_mod_request_update
      after update on public.moderator_requests
      for each row
      execute procedure public.audit_mod_request_decision();
  end if;
end$$;

-- Log role changes
create or replace function public.audit_user_roles()
returns trigger
language plpgsql
as $$
begin
  -- Guard: only staff actions are audited
  if not public.is_staff() then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    perform public.log_audit('role_granted','user_roles', new.user_id, 'role granted', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    perform public.log_audit('role_revoked','user_roles', old.user_id, 'role revoked', to_jsonb(old));
  end if;
  return coalesce(new, old);
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='audit_user_roles_changes') then
    create trigger audit_user_roles_changes
      after insert or delete on public.user_roles
      for each row
      execute procedure public.audit_user_roles();
  end if;
end$$;

-- ======================
-- RLS
-- ======================
alter table public.user_roles enable row level security;
alter table public.moderator_requests enable row level security;
alter table public.entries enable row level security;
alter table public.entry_secrets enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- user_roles
drop policy if exists roles_select on public.user_roles;
create policy roles_select on public.user_roles
for select
using (
  is_owner() or user_id = auth.uid()
);

drop policy if exists roles_modify on public.user_roles;
create policy roles_modify on public.user_roles
for all
to authenticated
using (is_owner())
with check (is_owner());

-- moderator_requests
drop policy if exists modreq_select on public.moderator_requests;
create policy modreq_select on public.moderator_requests
for select
using (
  is_staff() or requester_id = auth.uid()
);

drop policy if exists modreq_insert on public.moderator_requests;
create policy modreq_insert on public.moderator_requests
for insert
to authenticated
with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists modreq_update on public.moderator_requests;
create policy modreq_update on public.moderator_requests
for update
to authenticated
using (is_owner())
with check (is_owner());

-- entries
drop policy if exists entries_read_public on public.entries;
create policy entries_read_public on public.entries
for select
using (status = 'approved' or is_staff());

drop policy if exists entries_insert_any on public.entries;
create policy entries_insert_any on public.entries
for insert
with check (
  status = 'pending' and (submitted_by is null or submitted_by = auth.uid())
);

drop policy if exists entries_update_staff on public.entries;
create policy entries_update_staff on public.entries
for update
to authenticated
using (is_staff())
with check (is_staff());

drop policy if exists entries_delete_owner on public.entries;
create policy entries_delete_owner on public.entries
for delete
to authenticated
using (is_owner());

-- entry_secrets (OWNER ONLY for all operations)
drop policy if exists entry_secrets_owner_select on public.entry_secrets;
drop policy if exists entry_secrets_staff_write on public.entry_secrets;
drop policy if exists entry_secrets_owner_insert on public.entry_secrets;
drop policy if exists entry_secrets_owner_update on public.entry_secrets;
drop policy if exists entry_secrets_owner_delete on public.entry_secrets;

create policy entry_secrets_owner_select on public.entry_secrets
for select
to authenticated
using (is_owner());

create policy entry_secrets_owner_insert on public.entry_secrets
for insert
to authenticated
with check (is_owner());

create policy entry_secrets_owner_update on public.entry_secrets
for update
to authenticated
using (is_owner())
with check (is_owner());

create policy entry_secrets_owner_delete on public.entry_secrets
for delete
to authenticated
using (is_owner());

-- reports
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
for select
using (
  is_staff() or reporter_id = auth.uid()
);

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
for insert
with check (reporter_id is null or reporter_id = auth.uid());

drop policy if exists reports_update_staff on public.reports;
create policy reports_update_staff on public.reports
for update
to authenticated
using (is_staff())
with check (is_staff());

drop policy if exists reports_delete_owner on public.reports;
create policy reports_delete_owner on public.reports
for delete
to authenticated
using (is_owner());

-- audit_logs (staff readable; staff write via triggers or direct server actions)
drop policy if exists audit_select_staff on public.audit_logs;
create policy audit_select_staff on public.audit_logs
for select
to authenticated
using (is_staff());

drop policy if exists audit_insert_staff on public.audit_logs;
create policy audit_insert_staff on public.audit_logs
for insert
to authenticated
with check (is_staff());

-- ======================
-- Grants (minimal - Supabase manages role grants; rely on RLS for access control)
-- No explicit grants here to keep defaults. RLS guards access.