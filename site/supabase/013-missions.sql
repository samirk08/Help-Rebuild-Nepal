-- Migration 013 — mission teams.
--
-- Run in the Supabase SQL editor after 012. Safe to re-run.
--
-- Migration 010 gave `matching_profiles` a `mission_ids` array and a
-- `mission_only` flag, and the engine already reads both: missions break ties
-- between equally-qualified people, and `mission_only` narrows someone's scope
-- to the missions they picked. Nothing could ever set either one —
-- `saveMatchingProfile` does not write those columns and no table held the
-- missions themselves. This migration is the missing half.
--
-- Two decisions worth stating.
--
-- SEPARATE FROM SKILL NETWORKS. `network_members` (migration 009) is not
-- reused. A skill network is a professional community — you are an engineer
-- whether or not you are working on anything. A mission is a statement of
-- interest in one piece of work, capped at two, and reversible. Collapsing
-- them would mean someone's profession silently enrolled them in a team, or
-- leaving a team implied they had stopped being an engineer.
--
-- THE CAP IS A DATABASE RULE. "At most two missions" is enforced here, not in
-- the form. A limit checked only in the browser is a limit that holds until
-- the first person opens two tabs.

-- ---------------------------------------------------------------------------
-- Missions
-- ---------------------------------------------------------------------------

create table if not exists missions (
  id            text primary key,          -- stable slug: 'housing', 'wash', …
  title         text not null,
  summary       text not null default '',
  -- Lead, purpose and current task are deliberately empty at seed time. A
  -- mission page that invents a "current task" is worse than one that admits
  -- it has none: a volunteer joins expecting work that does not exist.
  purpose       text,
  current_task  text,
  lead_user_id  uuid references auth.users(id) on delete set null,
  meeting_link  text,
  next_check_in timestamptz,
  status        text not null default 'active'
                check (status in ('active', 'paused', 'closed')),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membership and preference
-- ---------------------------------------------------------------------------

create table if not exists mission_members (
  volunteer_id     uuid not null references submissions(id) on delete cascade,
  mission_id       text not null references missions(id) on delete cascade,
  -- `mission_only` here means "these are the only needs to invite me to".
  -- Explicit and reversible; the default leaves someone in the wider pool.
  preference_state text not null default 'interested'
                   check (preference_state in ('interested', 'mission_only')),
  -- How this was recorded. A reply to the launch email is a different kind of
  -- evidence from a click, and a coordinator entering it on someone's behalf
  -- is a third. Provenance is kept because it is the difference between "they
  -- chose this" and "we believe they chose this".
  source           text not null default 'self_selected'
                   check (source in ('email_reply', 'self_selected', 'admin_recorded')),
  recorded_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (volunteer_id, mission_id)
);

create index if not exists mission_members_mission_idx on mission_members (mission_id);

-- Only a volunteer registration may hold a membership, mirroring the kind
-- guards migration 010 puts on matching_profiles and matching_roles.
create or replace function mission_member_kind() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from submissions where id = new.volunteer_id and kind = 'volunteer') then
    raise exception 'Mission membership requires a volunteer registration.';
  end if;
  return new;
end $$;

drop trigger if exists mission_member_kind on mission_members;
create trigger mission_member_kind before insert or update on mission_members
  for each row execute function mission_member_kind();

-- At most two missions per volunteer.
--
-- The volunteer's own row is locked first, which is what makes this hold under
-- concurrency: two simultaneous joins serialise behind the lock instead of
-- both counting one existing row and both inserting. Counting without the lock
-- would be the same mistake the old submission de-duplication made.
create or replace function mission_member_cap() returns trigger
language plpgsql set search_path = public as $$
declare taken integer;
begin
  perform 1 from submissions where id = new.volunteer_id for update;
  select count(*) into taken from mission_members where volunteer_id = new.volunteer_id;
  if taken > 2 then
    raise exception 'A volunteer may select at most two missions.';
  end if;
  return null;
end $$;

drop trigger if exists mission_member_cap on mission_members;
create trigger mission_member_cap after insert on mission_members
  for each row execute function mission_member_cap();

-- ---------------------------------------------------------------------------
-- Keep the matching engine's view in step
-- ---------------------------------------------------------------------------

-- `matching_profiles.mission_ids` and `.mission_only` are what the engine
-- reads. Rather than ask every write path to remember to update them, the
-- membership table is the single source of truth and this keeps the profile in
-- step. The existing `matching_profile_revision` trigger bumps the revision as
-- a result, so an invitation computed under a wider scope is not silently
-- confirmed after the volunteer narrows it.
--
-- Only an existing profile row is touched. A volunteer with no matching
-- profile has no facts to match on either, so creating one here would invent a
-- `confirmed_at` for answers nobody has given.
create or replace function mission_members_sync() returns trigger
language plpgsql set search_path = public as $$
declare who uuid;
begin
  who := coalesce(new.volunteer_id, old.volunteer_id);

  update matching_profiles set
    mission_ids = coalesce(
      (select array_agg(mission_id order by mission_id) from mission_members where volunteer_id = who),
      '{}'
    ),
    mission_only = exists (
      select 1 from mission_members where volunteer_id = who and preference_state = 'mission_only'
    )
  where volunteer_id = who;

  return null;
end $$;

drop trigger if exists mission_members_sync on mission_members;
create trigger mission_members_sync after insert or update or delete on mission_members
  for each row execute function mission_members_sync();

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------

-- The nine missions, in the order the design shows them. Titles only:
-- purpose, current task and lead are left for a coordinator to fill in, so
-- nothing on a mission page is a claim nobody made.
--
-- `on conflict do nothing` so re-running this file never overwrites content a
-- coordinator has since entered.
insert into missions (id, title, summary, sort_order) values
  ('housing',    'Low-cost & efficient housing',        '', 1),
  ('health',     'Health support & camps',              '', 2),
  ('wellbeing',  'Mental health & well-being',          '', 3),
  ('resilience', 'Flood-resilient communities',         '', 4),
  ('wash',       'Water, sanitation & public health',   '', 5),
  ('operations', 'Operations & IT',                     '', 6),
  ('story',      'Story & advocacy',                    '', 7),
  ('situation',  'Situation Room',                      '', 8),
  ('shelter',    'Temporary shelter challenge',         '', 9)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

-- Same posture as every other table here: the browser never queries directly,
-- so anon and authenticated get nothing and RLS is on with no policies.
alter table missions enable row level security;
alter table mission_members enable row level security;

revoke all on missions, mission_members from public, anon, authenticated;
grant all on missions, mission_members to service_role;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------

-- The newest migration owns `migration_state`, so each one adds its own row
-- and re-declares the ones before it. Running the files in order — which is
-- what the README says to do — always ends with the most complete list. A
-- migration that did not do this would simply never be reported, and an
-- unreported migration is the thing this ledger exists to prevent.
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
    ('013',     'table',  'mission_members',        'Mission teams',           false)
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
