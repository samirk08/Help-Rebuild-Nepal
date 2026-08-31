-- Migration 004 — volunteer accounts, and a real admin allowlist.
--
-- Run once in the Supabase SQL editor, after 003. Safe to re-run.
--
-- Two changes that have to land together.
--
-- 1. submissions.user_id lets a volunteer claim the registration they made and
--    see it again later. Nullable, and nothing backfills it: registrations that
--    already exist stay exactly as they are, unclaimed, and keep working. On
--    delete it is set null rather than cascading — losing an account must never
--    destroy the registration behind it, which is the record the coordination
--    team actually works from.
--
-- 2. admin_users is the allowlist for the dashboard. Until now the gate only
--    asked "is anyone signed in", never "who" — fine while the only accounts
--    were invited admins, and a full data breach the moment volunteers can sign
--    in too, because a volunteer session would satisfy that check. The
--    allowlist has to exist before any volunteer account does.
--
-- The seed below is the important part: every account that exists today was
-- created by inviting an admin, so all of them are grandfathered in. Without it
-- this migration would lock the whole team out of their own dashboard.

alter table submissions
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists submissions_user_id_idx on submissions (user_id);

create table if not exists admin_users (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);

alter table admin_users enable row level security;

-- 003 set default privileges for service_role, but only for tables created by
-- the same role — so grant explicitly rather than depend on that holding.
grant all privileges on table admin_users to service_role;

-- Grandfather in everyone who can already sign in. Every existing account was
-- created by inviting an admin; volunteers have never had accounts.
-- Review this table afterwards and delete any row that should not be an admin.
insert into admin_users (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;
