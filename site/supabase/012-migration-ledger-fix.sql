-- Migration 012 — correct the migration ledger, and say which gaps matter.
--
-- Run in the Supabase SQL editor after 011. Safe to re-run.
--
-- Two faults in the view 011 introduced.
--
-- 1. WRONG TABLE NAME. Migration 004 creates `admin_users`; the ledger looked
--    for `admin_allowlist` and so reported an applied migration as missing.
--    The diagnostics page then contradicted itself on one screen — "Migration
--    004 — Not applied" directly above "Admin allowlist (migration 004) — 4
--    accounts may use this dashboard". A checker that cries wolf is worse than
--    no checker: the next real failure gets read as another false alarm.
--
-- 2. NO SENSE OF PROPORTION. Every unapplied migration counted the same, and
--    the page's summary said "Public forms are likely returning errors right
--    now" whenever anything failed. A missing bug-reports table does not stop
--    a single form from saving. `critical` marks the migrations without which
--    intake or admin access is actually broken, so the page can tell an outage
--    apart from an unused feature.
--
-- Dropped rather than replaced, so this file works whether it meets the
-- three-column view from 011 or its own four-column one from a previous run.
drop view if exists migration_state;

create view migration_state as
with expected(migration, object_kind, object_name, detail, critical) as (
  values
    ('schema',  'table',  'submissions',            'Core intake tables',      true),
    ('002',     'column', 'submissions.skills',     'Public board columns and interests', true),
    -- Migration 004 creates admin_users. The previous name was simply wrong.
    ('004',     'table',  'admin_users',            'Admin allowlist',         true),
    ('005',     'view',   'volunteer_skill_counts', 'Tracker breakdown views', false),
    ('007',     'column', 'interests.user_id',      'Interest ownership',      false),
    ('008',     'table',  'bug_reports',            'Bug reports',             false),
    ('009',     'table',  'network_members',        'Skill network membership', false),
    ('010',     'table',  'matching_invitations',   'Matching engine',         false),
    ('011',     'column', 'submissions.idempotency_key', 'Intake idempotency', true),
    ('012',     'column', 'migration_state.critical',    'Migration ledger fix', false)
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
