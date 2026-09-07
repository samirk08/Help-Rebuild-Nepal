-- Migration 017 — clarification questions, and a worker heartbeat.
--
-- Run in the Supabase SQL editor after 016. Safe to re-run.
--
-- THE GAP. `lib/matching/engine.ts` already returns a `question` on every check
-- it cannot answer — "Can you offer structural engineering for this role?",
-- "Are you available from 10 through 23 September?". Nothing stored, sent or
-- answered them. A coordinator read the question on screen, retyped it into an
-- email, and the reply never came back into the system. That is also why the
-- Situation Room has no "unanswered question" item: there was nothing to
-- derive one from.

-- ---------------------------------------------------------------------------
-- 1. Questions
-- ---------------------------------------------------------------------------

create table if not exists matching_questions (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references submissions(id) on delete cascade,
  role_id       uuid references matching_roles(id) on delete set null,
  -- The engine's own check key: 'skill:engineering', 'dates', 'hours'. Keeping
  -- the engine's vocabulary means an answer can be matched back to the check
  -- that was blocked, rather than to a free-text guess.
  check_key     text not null,
  question      text not null,
  asked_by      uuid references auth.users(id) on delete set null,
  asked_at      timestamptz not null default now(),
  token_hash    text not null unique,
  expires_at    timestamptz not null default now() + interval '14 days',
  answer        text,
  answered_at   timestamptz,
  state         text not null default 'open'
                check (state in ('open', 'answered', 'withdrawn'))
);

create index if not exists matching_questions_volunteer_idx
  on matching_questions (volunteer_id, state);

-- History is kept — a question asked, answered, and asked again later is three
-- facts, not one — but only one may be outstanding for the same check at the
-- same time. Without this a coordinator clicking twice emails the volunteer
-- the same question twice, and the Situation Room shows it as two jobs.
create unique index if not exists matching_questions_one_open_uidx
  on matching_questions (volunteer_id, coalesce(role_id, '00000000-0000-0000-0000-000000000000'::uuid), check_key)
  where state = 'open';

-- Same guard migrations 010 and 013 put on their volunteer references.
create or replace function matching_question_kind() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from submissions where id = new.volunteer_id and kind = 'volunteer') then
    raise exception 'A clarification question requires a volunteer registration.';
  end if;
  return new;
end $$;

drop trigger if exists matching_question_kind on matching_questions;
create trigger matching_question_kind before insert or update on matching_questions
  for each row execute function matching_question_kind();

-- Answering is a single deliberate write, and never a GET. Same shape as
-- `matching_respond`: the token is hashed, the row is locked, and a second
-- submission of the same token returns the answer already recorded rather than
-- overwriting it.
create or replace function matching_answer_question(p_token_hash text, p_answer text)
returns text language plpgsql set search_path = public as $$
declare q matching_questions;
begin
  select * into q from matching_questions where token_hash = p_token_hash for update;
  if not found then raise exception 'This question is no longer available'; end if;
  if q.state = 'withdrawn' then raise exception 'This question is no longer available'; end if;
  if q.expires_at < now() and q.state = 'open' then raise exception 'This question is no longer available'; end if;

  -- Idempotent: a retried submit gets the same answer back, not a second one.
  if q.state = 'answered' then return q.answer; end if;

  if p_answer is null or length(btrim(p_answer)) = 0 then
    raise exception 'An answer is required';
  end if;

  update matching_questions
     set answer = left(btrim(p_answer), 4000), answered_at = now(), state = 'answered'
   where id = q.id;

  return left(btrim(p_answer), 4000);
end $$;

-- NOTE ON PROVENANCE. Answering deliberately does NOT write into
-- `matching_profiles.facts`. A sentence typed into an email is not the same
-- evidence as a volunteer confirming their own profile, and the product
-- decision that field provenance is preserved is explicit in the plan. A
-- coordinator reads the answer and, if they are satisfied, updates the profile
-- through the existing editor — where it is recorded as a confirmed fact with
-- a `confirmed_at` behind it.

-- ---------------------------------------------------------------------------
-- 2. Delivering a question through the existing outbox
-- ---------------------------------------------------------------------------

-- Nothing in this app sends mail outside `matching_email_outbox`; that
-- invariant is the only reason no message has ever been double-sent. A
-- question is not tied to an invitation, so the outbox has to admit a second
-- kind of subject rather than a second sender.
alter table matching_email_outbox alter column invitation_id drop not null;
alter table matching_email_outbox
  add column if not exists question_id uuid references matching_questions(id) on delete cascade;

alter table matching_email_outbox drop constraint if exists matching_email_outbox_kind_check;
alter table matching_email_outbox add constraint matching_email_outbox_kind_check
  check (kind in ('invitation', 'volunteer-introduction', 'requester-introduction', 'clarification'));

-- Exactly one subject. A row with neither is unsendable; a row with both is
-- ambiguous about what it is delivering.
alter table matching_email_outbox drop constraint if exists matching_email_outbox_subject_check;
alter table matching_email_outbox add constraint matching_email_outbox_subject_check
  check ((invitation_id is not null) <> (question_id is not null));

create unique index if not exists matching_outbox_question_uidx
  on matching_email_outbox (question_id, kind) where question_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Worker heartbeat
-- ---------------------------------------------------------------------------

-- "Last successful worker run" could not be answered at all: a worker that
-- stopped six hours ago and a worker with nothing to do produce identical
-- outbox state. Without this, a silent queue is indistinguishable from a
-- healthy one.
create table if not exists worker_runs (
  id          uuid primary key default gen_random_uuid(),
  worker      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  claimed     integer not null default 0,
  sent        integer not null default 0,
  failed      integer not null default 0,
  error       text
);

create index if not exists worker_runs_recent_idx on worker_runs (worker, started_at desc);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table matching_questions enable row level security;
alter table worker_runs enable row level security;
revoke all on matching_questions, worker_runs from public, anon, authenticated;
grant all on matching_questions, worker_runs to service_role;

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
    ('017',     'table',  'matching_questions',     'Clarification questions', false)
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
