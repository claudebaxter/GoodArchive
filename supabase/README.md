# Supabase schema and RLS

This folder contains SQL migrations for the database schema and Row Level Security (RLS) used by goodarchive.

Highlights:
- Entries use a strict `entry_status` enum (`pending`, `approved`, `rejected`).
- Sensitive metadata (like `ip_hash`) is stored in `entry_secrets`, separate from `entries`.
- Moderator access is explicit via `user_roles` (`owner`, `moderator`).
- Users can request moderator access via `moderator_requests` (only the owner can approve/reject).
- Reports are visible to staff; reporters can only see their own.
- Audit logs record staff actions (status changes, role grants, etc.).

Security model:
- RLS is enabled on all tables.
- Public can only read `entries` where `status = 'approved'`.
- Inserts:
  - `entries`: anyone can submit; new rows must be `pending`.
  - `reports`: anyone can report; `reporter_id` must be null or match the caller.
  - `moderator_requests`: only authenticated users can request.
- Updates/deletes:
  - Staff (`owner` or `moderator`) can update `entries` and `reports`.
  - Only the `owner` can delete `entries` and `reports`, and manage roles.
- `entry_secrets` is owner-readable only.

Apply locally (no secrets required):

```bash
# Using Supabase CLI (recommended)
supabase db push
# or, if you prefer manual psql:
# psql \"$SUPABASE_DB_URL\" -f supabase/migrations/20260111_init.sql
```

Seeding an initial owner:

```sql
-- Replace with your Supabase user UUID
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000000', 'owner')
on conflict (user_id) do update set role = excluded.role;
```

Notes:
- Do not commit any secrets. Local Supabase `.env` and generated branches are already excluded via `.gitignore`.
- Frontend should use the anon key only. Any privileged actions should be executed via server code (service role) with explicit checks.

