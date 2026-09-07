-- Migration 014 — the requester's own view of their request.
--
-- Run in the Supabase SQL editor after 013. Safe to re-run.
--
-- Today a person files a need and hears nothing. They cannot see whether it
-- was verified, cannot correct a mistake, cannot close it when the problem is
-- solved another way, and cannot tell us whether the help that arrived was any
-- use. Every one of those is a message a coordinator currently has to carry by
-- hand, and the ones nobody carries are simply lost.
--
-- Three things here.

-- ---------------------------------------------------------------------------
-- 1. A version, so two people editing cannot silently overwrite each other
-- ---------------------------------------------------------------------------

-- A requester correcting their description and a coordinator setting a status
-- are ordinary concurrent events. Without a version the later write wins
-- whole-record, and the coordinator's decision disappears with no trace that
-- it ever happened.
alter table submissions add column if not exists version integer not null default 1;

create or replace function submission_version_bump() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Bumped for every change, not only requester edits: the point is to detect
  -- that the row moved underneath whoever is holding an older copy of it.
  new.version := coalesce(old.version, 1) + 1;
  return new;
end $$;

drop trigger if exists submission_version_bump on submissions;
create trigger submission_version_bump before update on submissions
  for each row execute function submission_version_bump();

-- ---------------------------------------------------------------------------
-- 2. An append-only record of who did what
-- ---------------------------------------------------------------------------

-- "Requester close/reopen is auditable" is an acceptance criterion, and a
-- status column alone cannot satisfy it: it holds the current state and no
-- history. A closed-then-reopened request is indistinguishable from one that
-- was never closed, which matters when someone asks why work stopped.
create table if not exists request_events (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  -- Who acted. Null for a system event; the auth user otherwise. The `actor`
  -- text says which side they were acting as, because a coordinator and a
  -- requester can both close a request and the reason differs.
  actor         text not null check (actor in ('requester', 'coordinator', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  event         text not null,
  detail        text,
  created_at    timestamptz not null default now()
);

create index if not exists request_events_submission_idx
  on request_events (submission_id, created_at desc);

-- Append-only in the literal sense: nothing may rewrite or remove history,
-- including the service role. An audit log that can be edited is a log that
-- proves nothing.
create or replace function request_events_append_only() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'request_events is append-only.';
end $$;

drop trigger if exists request_events_no_update on request_events;
create trigger request_events_no_update before update or delete on request_events
  for each row execute function request_events_append_only();

-- ---------------------------------------------------------------------------
-- 3. Material edits reconsider outstanding invitations
-- ---------------------------------------------------------------------------

-- Migration 010 already cancels invitations when a need leaves an open status
-- or its contact details change. It does not notice the request itself being
-- rewritten — so a volunteer could accept an invitation describing one job and
-- confirm into a different one.
--
-- "Material" is deliberately narrow: what the work is, where it is, and how
-- soon. Fixing a typo in the title does not throw away someone's invitation,
-- because that would make requesters afraid to correct their own request.
create or replace function need_material_fields(f jsonb) returns text
language sql immutable set search_path = public as $$
  select coalesce(f->>'n3-detail', f->>'s04-exactly-what-needs-to-be-done', '')
      || '|' || coalesce(f->>'n3-district', f->>'s02-district', '')
      || '|' || coalesce(f->>'n3-work-mode', f->>'s07-where-the-work-happens', '')
      || '|' || coalesce(f->>'n3-urgency', f->>'s08-how-urgent-is-this', '');
$$;

create or replace function matching_need_changed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind = 'need' and (
       new.status not in ('verified', 'recruiting')
    or new.contact_email is distinct from old.contact_email
    or new.matching_contact_approved is distinct from old.matching_contact_approved
    -- Added in 014: the request itself was rewritten.
    or need_material_fields(new.fields) is distinct from need_material_fields(old.fields)
    or new.district is distinct from old.district
    or new.urgency is distinct from old.urgency
  ) then
    update matching_invitations set status = 'cancelled'
    where need_id = new.id and status in ('queued', 'sent', 'accepted');
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table request_events enable row level security;
revoke all on request_events from public, anon, authenticated;
grant all on request_events to service_role;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------

-- Each migration re-declares the ledger and adds its own row; running the
-- files in order always ends with the most complete list.
drop view if exists migration_state;

create view migration_state as
with expected(migration, object_kind, object_name, detail, critical) as (
  values
    ('schema',  'table',  'submissions',            'Core intake tables',      true),
    ('002',     'column', 'submissions.skills',     'Public board columns and interests', true),
    ('004',     'table',  'admin_users',            'Admin allowlist',         true),
    ('005',     'view',   'volunteer_skill_counts', 'Tracker breakdown views', false),
    ('007',     'column', 'interests.user_id',      'Interest ownership',      false),
    ('008',     'table',  'bug_reports',            'Bug reports',             false),
    ('009',     'table',  'network_members',        'Skill network membership', false),
    ('010',     'table',  'matching_invitations',   'Matching engine',         false),
    ('011',     'column', 'submissions.idempotency_key', 'Intake idempotency', true),
    ('012',     'column', 'migration_state.critical',    'Migration ledger fix', false),
    ('013',     'table',  'mission_members',        'Mission teams',           false),
    ('014',     'table',  'request_events',         'Requester workspace',     false)
)
select
  e.migration,
  e.detail,
  case
    when e.object_kind = 'table' then exists (
      select 1 from information_schema.tables t
      where t.table_schema = 'public' and t.table_name = e.object_name
        and t.table_type = 'BASE TABLE'
    )
    when e.object_kind = 'view' then exists (
      select 1 from information_schema.views v
      where v.table_schema = 'public' and v.table_name = e.object_name
    )
    else exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = split_part(e.object_name, '.', 1)
        and c.column_name = split_part(e.object_name, '.', 2)
    )
  end as applied,
  e.critical
from expected e;

comment on view migration_state is
  'Read-only migration ledger for the admin diagnostics page. Reports whether '
  'each migration''s distinguishing object exists, and whether its absence '
  'actually breaks intake or admin access. Never written to.';

grant select on migration_state to service_role;
