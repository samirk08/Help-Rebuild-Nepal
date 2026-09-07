-- Migration 016 — Situation Room assignment overlay and activity log.
--
-- Run in the Supabase SQL editor after 015. Safe to re-run.
--
-- The Situation Room is the single list of what needs a human next. Most of
-- that list is derived from existing tables on every page load: a need sitting
-- in `submitted` is awaiting verification whether or not anyone remembered to
-- file a ticket. A parallel table that coordinators had to populate by hand
-- would drift, and a queue that lies is worse than no queue.
--
-- So this migration stores only what cannot be derived: who owns the item, an
-- explicit due date, a priority override, snooze/resolve state, and an
-- append-only activity log. The derived key (`item_key`) is stable across
-- recomputes, which is why an assignment survives the item being rebuilt.

-- ---------------------------------------------------------------------------
-- 1. Assignment overlay
-- ---------------------------------------------------------------------------

create table if not exists queue_assignments (
  item_key      text primary key
                check (item_key ~ '^[a-z_]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  owner_id      uuid references auth.users(id) on delete set null,
  due_at        timestamptz,
  priority      text not null default 'normal'
                check (priority in ('urgent','high','normal','low')),
  state         text not null default 'open'
                check (state in ('open','snoozed','resolved')),
  snoozed_until timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists queue_assignments_owner_idx
  on queue_assignments (owner_id);
create index if not exists queue_assignments_state_idx
  on queue_assignments (state, due_at);

-- ---------------------------------------------------------------------------
-- 2. Append-only activity log
-- ---------------------------------------------------------------------------

create table if not exists queue_events (
  id         uuid primary key default gen_random_uuid(),
  item_key   text not null,
  actor_id   uuid references auth.users(id) on delete set null,
  event      text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists queue_events_item_idx
  on queue_events (item_key, created_at desc);

-- An audit log that can be edited proves nothing — including by the service
-- role, which is the only role this app ever uses.
create or replace function queue_events_append_only() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'queue_events is append-only.';
end $$;

drop trigger if exists queue_events_no_update on queue_events;
create trigger queue_events_no_update before update or delete on queue_events
  for each row execute function queue_events_append_only();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table queue_assignments enable row level security;
alter table queue_events enable row level security;
revoke all on queue_assignments from public, anon, authenticated;
revoke all on queue_events from public, anon, authenticated;
grant all on queue_assignments to service_role;
grant all on queue_events to service_role;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------

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
    ('014',     'table',  'request_events',         'Requester workspace',     false),
    ('015',     'column', 'matching_invitations.attempt', 'Invitation attempts', false),
    ('016',     'table',  'queue_assignments',      'Situation Room',          false)
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
