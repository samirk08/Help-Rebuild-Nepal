-- Migration 020 — completing a need closes the work behind it.
--
-- Run in the Supabase SQL editor after 019. Safe to re-run.
--
-- Marking a need `completed` wrote one column and stopped there. Everything
-- attached to that need carried on as if the request were still live: the
-- project stayed at `recruiting`, so the public board counted finished work
-- under "Team roster still open, coordinator assigned"; and the matching roles
-- stayed active, so the dashboard kept computing recommendations and offering
-- an Invite button for a request nobody could still join. The invitations
-- themselves were already cancelled by `matching_need_changed` in 010, which
-- makes the gap sharper rather than softer — half the closing was automatic and
-- the visible half was not.
--
-- So completion cascades from here: the need is the thing an admin actually
-- marks, and the project and the roles follow it.
--
-- This also removes 019's rule that a project could not be completed without an
-- outcome recorded first. That rule and this cascade cannot both hold: the
-- cascade would raise on every need whose outcome had not been written yet, and
-- the failure would land on the status update, leaving an admin unable to close
-- the need at all. Recording an outcome is now prompted in the dashboard rather
-- than enforced by the database. The trade is deliberate and worth stating: a
-- completed project may now say nothing about what it achieved.

begin;

-- ---------------------------------------------------------------------------
-- 1. Completion is no longer gated on an outcome
-- ---------------------------------------------------------------------------

drop trigger if exists projects_require_outcome on projects;
drop function if exists projects_require_outcome();

-- The mirror of the same rule, and it goes with it. This guard existed only to
-- stop a completed project being left "with nothing behind it" — which is now a
-- state the schema permits by design. Keeping it would refuse a correction on
-- grounds the schema no longer holds. `recordProjectOutcome` upserts, so
-- correcting an outcome never needed the delete anyway.
drop trigger if exists project_outcomes_guard_delete on project_outcomes;
drop function if exists project_outcomes_guard_delete();

-- ---------------------------------------------------------------------------
-- 2. The cascade
-- ---------------------------------------------------------------------------

-- Two closings, with deliberately different triggers.
--
-- The project follows `completed` only. `rejected` already takes the project
-- off every public surface through the need it hangs from (see
-- `project_public_progress` and isPublicProject in lib/publication.ts), and
-- recording rejected work as completed work would be a plain falsehood.
--
-- The roles follow `completed` and `rejected` alike, because both mean nobody
-- should be recruited for this any more. `filled` is deliberately absent: a full
-- roster can empty again when someone withdraws, and deactivating the role
-- definition would silently discard the requirements an admin wrote.
create or replace function submissions_close_project() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind is distinct from 'need' then return new; end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    -- `draft` is excluded: a draft project is one deliberately kept off the
    -- public page, and completing it would publish it. The stage guard also
    -- makes this idempotent.
    update projects set stage = 'completed'
      where need_id = new.id and stage not in ('completed', 'draft');
  end if;

  -- Migration 010 is optional, so this cannot assume `matching_roles` exists.
  -- plpgsql binds table names at execution, not at creation, so an unguarded
  -- reference would create cleanly here and then fail on the first status
  -- change in an install that never applied 010.
  if new.status in ('completed', 'rejected')
     and old.status is distinct from new.status
     and to_regclass('public.matching_roles') is not null then
    execute 'update matching_roles set active = false where need_id = $1 and active'
      using new.id;
  end if;

  return new;
end $$;

-- AFTER, so the need's own row is already written and a failure in the cascade
-- cannot silently rewrite the status the admin chose.
drop trigger if exists submissions_close_project on submissions;
create trigger submissions_close_project after update on submissions
  for each row execute function submissions_close_project();

-- ---------------------------------------------------------------------------
-- 3. The needs already closed before this existed
-- ---------------------------------------------------------------------------

-- Without this the migration only fixes needs completed from now on, and every
-- need already marked completed keeps its project on the public board under
-- "Recruiting" — which is the state that prompted the change.
--
-- Ordered after the drop in section 1 on purpose: run against 019's guard, this
-- statement would raise on the first project with no outcome.
update projects p set stage = 'completed'
  from submissions s
  where s.id = p.need_id
    and s.kind = 'need'
    and s.status = 'completed'
    and p.stage not in ('completed', 'draft');

do $backfill$
begin
  if to_regclass('public.matching_roles') is not null then
    execute $q$
      update matching_roles r set active = false
        from submissions s
        where s.id = r.need_id and s.status in ('completed', 'rejected') and r.active
    $q$;
  end if;
end $backfill$;

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
    ('016',     'table',  'queue_assignments',      'Situation Room',          false),
    ('017',     'table',  'matching_questions',     'Clarification questions', false),
    ('018',     'table',  'item_need_events',       'Relief delivery stages',  false),
    ('019',     'table',  'project_outcomes',       'Project outcomes',        false),
    -- A trigger rather than a table: 020 adds behaviour, not storage. Reporting
    -- it as applied because 019's table exists would be the ledger's one job
    -- done wrong.
    ('020',     'trigger', 'submissions.submissions_close_project',
                           'Completing a need closes its project and roles', false)
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
    when e.object_kind = 'trigger' then exists (
      select 1 from pg_trigger g
      join pg_class c on c.oid = g.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not g.tgisinternal
        and c.relname = split_part(e.object_name, '.', 1)
        and g.tgname = split_part(e.object_name, '.', 2)
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

commit;
