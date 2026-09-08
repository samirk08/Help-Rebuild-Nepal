-- Migration 019 — a project that says what it did.
--
-- Run in the Supabase SQL editor after 018. Safe to re-run.
--
-- A project today is four columns: which need it came from, a stage, a
-- coordinator's name, and a date. That is enough to put a card on the
-- community page and nothing else. There is no way to say what the work is,
-- who is doing it, what has happened lately, or — the one that matters — what
-- came of it.
--
-- The last omission is the serious one. `stage = 'completed'` is currently a
-- dropdown value with nothing behind it. A platform that asks people to give
-- their time and then records the result as a word in a select box has not
-- closed the loop; it has closed the ticket. So completion here requires an
-- outcome record, enforced by the database rather than by remembering.

-- ---------------------------------------------------------------------------
-- 1. One project per need
-- ---------------------------------------------------------------------------

-- `promoteToProject` inserts unconditionally, so a double-submit or a second
-- coordinator produced two projects for one need — two cards on the public
-- page describing the same work, diverging from then on.
--
-- Existing duplicates are collapsed to the oldest rather than refused, so this
-- migration cannot fail on a project that is already live.
delete from projects p
using projects older
where p.need_id = older.need_id
  and (older.created_at, older.id) < (p.created_at, p.id);

create unique index if not exists projects_need_id_uidx on projects (need_id);

-- ---------------------------------------------------------------------------
-- 2. What the project actually is
-- ---------------------------------------------------------------------------

-- `draft` was already the stage lib/publication.ts refuses to publish, but the
-- check constraint made it impossible to set — so the guard was unreachable and
-- every project went public the instant it was created. `paused` exists because
-- work stopping is not the same as work finishing, and reporting a stalled
-- project as `in_progress` is the kind of small lie that makes a public
-- dashboard worthless.
alter table projects drop constraint if exists projects_stage_check;
alter table projects add constraint projects_stage_check
  check (stage in ('draft', 'recruiting', 'in_progress', 'paused', 'completed'));

alter table projects add column if not exists lead text;
alter table projects add column if not exists title text;
alter table projects add column if not exists title_np text;
alter table projects add column if not exists summary text;
alter table projects add column if not exists summary_np text;
alter table projects add column if not exists started_at timestamptz;
alter table projects add column if not exists completed_at timestamptz;
alter table projects add column if not exists updated_at timestamptz not null default now();

create or replace function projects_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.stage = 'in_progress' and old.stage is distinct from 'in_progress' then
    new.started_at := coalesce(new.started_at, now());
  end if;
  if new.stage = 'completed' and old.stage is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end $$;

drop trigger if exists projects_touch on projects;
create trigger projects_touch before update on projects
  for each row execute function projects_touch();

-- ---------------------------------------------------------------------------
-- 3. Tasks and milestones
-- ---------------------------------------------------------------------------

-- One table, not two. A milestone is a task people agreed to treat as a
-- checkpoint; modelling them separately means keeping two lists in step and
-- discovering they disagree.
--
-- `assignee` is the roster, and the roster is private. Publishing "Ram Bahadur
-- is surveying houses in Ward 4 on Thursday" tells anyone reading where a named
-- person will be — which is a safety question before it is a privacy one.
create table if not exists project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null,
  title_np    text,
  detail      text,
  status      text not null default 'todo'
              check (status in ('todo', 'doing', 'done', 'dropped')),
  is_milestone boolean not null default false,
  due_on      date,
  assignee    text,
  -- Some work is not for the public board at all: safeguarding follow-ups,
  -- anything naming a household.
  public      boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists project_tasks_project_idx
  on project_tasks (project_id, position, created_at);

create or replace function project_tasks_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists project_tasks_touch on project_tasks;
create trigger project_tasks_touch before update on project_tasks
  for each row execute function project_tasks_touch();

-- ---------------------------------------------------------------------------
-- 4. Updates and outputs
-- ---------------------------------------------------------------------------

-- "Latest update" as rows rather than a column on the project. A single column
-- would mean each new note destroys the one before it, and the history of a
-- project is most of what makes it worth reading.
create table if not exists project_updates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  body        text not null check (length(btrim(body)) > 0),
  body_np     text,
  author      text,
  -- Internal notes stay in the dashboard. Without this the only safe update is
  -- a bland one, and coordinators stop writing them.
  internal    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists project_updates_project_idx
  on project_updates (project_id, created_at desc);

-- Photos, reports, a municipality's own page. Constrained to http(s) because a
-- javascript: or data: URL rendered as a link on a public page is a stored XSS
-- vector, and validating this in one place beats validating it in every render.
create table if not exists project_outputs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  label       text not null check (length(btrim(label)) > 0),
  url         text not null check (url ~* '^https?://'),
  created_at  timestamptz not null default now()
);

create index if not exists project_outputs_project_idx
  on project_outputs (project_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. The outcome, and why completion depends on it
-- ---------------------------------------------------------------------------

-- One per project. `requester_confirmed` is the part that makes this an outcome
-- rather than a self-assessment: the organisation that asked for help is the
-- only party who can say whether it arrived. A project may be completed without
-- that confirmation — chasing it can take weeks and the work is still done —
-- but the record then says plainly that it is unconfirmed, instead of implying
-- agreement nobody gave.
create table if not exists project_outcomes (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null unique references projects(id) on delete cascade,
  summary             text not null check (length(btrim(summary)) > 0),
  summary_np          text,
  households_reached  int check (households_reached >= 0),
  people_involved     int check (people_involved >= 0),
  requester_confirmed boolean not null default false,
  requester_confirmed_at timestamptz,
  requester_note      text,
  recorded_by         uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Handles INSERT as well as UPDATE: an outcome recorded already-confirmed
-- would otherwise carry `requester_confirmed = true` with no date behind it,
-- which is the same shape of unsourced claim the confirmation exists to avoid.
-- OLD is unassigned during an INSERT, so TG_OP guards every reference to it.
create or replace function project_outcomes_touch() returns trigger
language plpgsql set search_path = public as $$
declare
  was_confirmed boolean := false;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    was_confirmed := coalesce(old.requester_confirmed, false);
  end if;

  if new.requester_confirmed and not was_confirmed then
    new.requester_confirmed_at := coalesce(new.requester_confirmed_at, now());
  elsif not new.requester_confirmed then
    new.requester_confirmed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists project_outcomes_touch on project_outcomes;
create trigger project_outcomes_touch before insert or update on project_outcomes
  for each row execute function project_outcomes_touch();

-- The acceptance criterion, stated where it cannot be bypassed by a stray
-- UPDATE from the dashboard, a script, or the SQL editor.
create or replace function projects_require_outcome() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stage = 'completed' and old.stage is distinct from 'completed' then
    if not exists (select 1 from project_outcomes where project_id = new.id) then
      raise exception 'Record what this project achieved before completing it.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists projects_require_outcome on projects;
create trigger projects_require_outcome before update on projects
  for each row execute function projects_require_outcome();

-- And the other direction: the outcome cannot be deleted out from under a
-- completed project, which would leave it completed with nothing behind it —
-- precisely the state the trigger above exists to prevent.
create or replace function project_outcomes_guard_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from projects where id = old.project_id and stage = 'completed') then
    raise exception 'This project is completed. Correct the outcome rather than removing it.';
  end if;
  return old;
end $$;

drop trigger if exists project_outcomes_guard_delete on project_outcomes;
create trigger project_outcomes_guard_delete before delete on project_outcomes
  for each row execute function project_outcomes_guard_delete();

-- ---------------------------------------------------------------------------
-- 6. Redacted public progress
-- ---------------------------------------------------------------------------

-- A project is exactly as public as the need behind it. lib/publication.ts
-- states that rule for the code path that reads projects; this states it for
-- anything else that ever reads them, and drops the private columns on the way
-- through so a `select *` cannot publish a roster.
drop view if exists project_public_progress;
create view project_public_progress as
  select
    p.id,
    p.need_id,
    p.stage,
    p.title,
    p.title_np,
    p.summary,
    p.summary_np,
    p.lead,
    p.coordinator,
    p.started_at,
    p.completed_at,
    p.updated_at,
    p.created_at,
    (select count(*) from project_tasks t
      where t.project_id = p.id and t.public) as tasks_total,
    (select count(*) from project_tasks t
      where t.project_id = p.id and t.public and t.status = 'done') as tasks_done,
    (select count(*) from project_tasks t
      where t.project_id = p.id and t.public and t.is_milestone) as milestones_total,
    (select count(*) from project_tasks t
      where t.project_id = p.id and t.public and t.is_milestone and t.status = 'done')
      as milestones_done,
    (select u.body from project_updates u
      where u.project_id = p.id and not u.internal
      order by u.created_at desc limit 1) as latest_update,
    (select u.body_np from project_updates u
      where u.project_id = p.id and not u.internal
      order by u.created_at desc limit 1) as latest_update_np,
    (select u.created_at from project_updates u
      where u.project_id = p.id and not u.internal
      order by u.created_at desc limit 1) as latest_update_at,
    o.summary            as outcome_summary,
    o.summary_np         as outcome_summary_np,
    o.households_reached as outcome_households,
    o.people_involved    as outcome_people,
    o.requester_confirmed as outcome_confirmed,
    -- Carried through rather than embedded from `submissions` by the caller.
    -- PostgREST can only follow a foreign key it can detect, and it cannot
    -- reliably detect one through a view — so joining here keeps the public
    -- read a single query with no relationship inference in it. These are the
    -- three fields the board already publishes about a need; nothing new is
    -- exposed by moving where they are read from.
    s.org_or_name  as need_org_or_name,
    s.district     as need_district,
    s.skills       as need_skills,
    s.people_needed as need_people_needed,
    s.kind         as need_kind,
    s.status       as need_status
  from projects p
  join submissions s on s.id = p.need_id
  left join project_outcomes o on o.project_id = p.id
  where p.stage <> 'draft'
    and s.kind = 'need'
    and s.status in ('verified', 'recruiting', 'filled', 'completed');

comment on view project_public_progress is
  'Projects as the public site may see them: milestone counts and the latest '
  'non-internal update, never the task roster, assignees or update authors. '
  'Visibility follows the parent need, matching isPublicProject in '
  'lib/publication.ts.';

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table project_tasks enable row level security;
alter table project_updates enable row level security;
alter table project_outputs enable row level security;
alter table project_outcomes enable row level security;

revoke all on project_tasks, project_updates, project_outputs, project_outcomes
  from public, anon, authenticated;
grant all on project_tasks, project_updates, project_outputs, project_outcomes
  to service_role;

revoke all on project_public_progress from public, anon, authenticated;
grant select on project_public_progress to service_role;

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
    ('019',     'table',  'project_outcomes',       'Project outcomes',        false)
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
