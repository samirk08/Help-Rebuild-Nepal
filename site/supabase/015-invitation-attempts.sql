-- Migration 015 — let a cancelled invitation be reconsidered.
--
-- Run in the Supabase SQL editor after 014. Safe to re-run.
--
-- THE BUG. `matching_invitations` carried `unique (role_id, volunteer_id)`, so
-- a volunteer could be invited to a given role exactly once, ever. That was
-- harmless while the only way an invitation ended was the volunteer answering
-- it. Migration 014 changed that: rewriting what a request asks for now
-- cancels its outstanding invitations, on purpose, so nobody is confirmed into
-- work they did not agree to.
--
-- The two together are a trap. A requester corrects their description, every
-- invitation is cancelled for re-review, and the coordinator can no longer
-- re-invite any of those people — the insert dies on a duplicate key with a
-- raw Postgres error. The better the requester behaves, the more volunteers
-- they permanently lock out of their own request.
--
-- THE FIX. Invitations are numbered attempts. A second attempt is a new row,
-- so the history of what was offered and when survives, which a plain upsert
-- would have destroyed.
--
-- WHAT MUST NOT CHANGE. That unique constraint was also, accidentally, the
-- only thing stopping someone who declined from being asked again. Loosening
-- it without saying so would turn "no thank you" into "ask me every week", so
-- the refusal is now written down as its own rule rather than being a
-- side-effect of an index.

alter table matching_invitations add column if not exists attempt integer not null default 1;

-- The old constraint's name depends on how the table was created, so it is
-- found rather than guessed.
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'matching_invitations'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (role_id, volunteer_id)';
  if c is not null then
    execute format('alter table matching_invitations drop constraint %I', c);
  end if;
end $$;

create unique index if not exists matching_invitations_attempt_uidx
  on matching_invitations (role_id, volunteer_id, attempt);

create or replace function matching_queue_invitation(
  p_role uuid, p_volunteer uuid, p_role_revision integer, p_profile_revision integer,
  p_token_hash text, p_snapshot jsonb, p_email jsonb, p_actor uuid
) returns uuid language plpgsql set search_path = public as $$
declare r matching_roles; v submissions; p matching_profiles; new_id uuid; occupied integer; next_attempt integer;
begin
  select * into r from matching_roles where id=p_role for update;
  if not found or not r.active or r.revision <> p_role_revision then raise exception 'Role changed; refresh recommendations'; end if;
  select * into v from submissions where id=p_volunteer and kind='volunteer' for update;
  if not found or v.status not in ('verified','recruiting','filled','completed') then raise exception 'Volunteer review required'; end if;
  select * into p from matching_profiles where volunteer_id=p_volunteer for update;
  if not found or p.paused or p.revision <> p_profile_revision or p.confirmed_at < now()-interval '30 days' then raise exception 'Profile changed; refresh recommendations'; end if;
  if not exists(select 1 from submissions where id=r.need_id and status in ('verified','recruiting') and matching_contact_approved and contact_email is not null) then raise exception 'Need must be open with approved requester contact'; end if;
  if exists(select 1 from matches where volunteer_id=p_volunteer and need_id=r.need_id and status in ('verified','recruiting','filled','completed')) then raise exception 'Already committed to this need'; end if;
  if exists(select 1 from matching_invitations where volunteer_id=p_volunteer and status in ('queued','sent','accepted') and expires_at > now()) then raise exception 'Volunteer already has an outstanding invitation'; end if;

  -- Previously enforced only by the unique constraint this migration removes.
  -- Someone who said no to this role is not asked again: a declined
  -- invitation is an answer, and re-sending it would make declining costly.
  if exists(select 1 from matching_invitations where role_id=p_role and volunteer_id=p_volunteer and status in ('declined','confirmed')) then
    raise exception 'This volunteer has already answered for this role';
  end if;

  select count(*) into occupied from matching_invitations where role_id=p_role and (status='confirmed' or (status in ('queued','sent','accepted') and expires_at > now()));
  if occupied >= r.headcount then raise exception 'No open slots remain'; end if;

  -- A cancelled or expired attempt leaves the place open and the history
  -- intact. The next offer is a new row rather than an overwrite, so "we
  -- asked, the request changed, we asked again" is still readable afterwards.
  select coalesce(max(attempt),0)+1 into next_attempt
    from matching_invitations where role_id=p_role and volunteer_id=p_volunteer;

  insert into matching_invitations(role_id,need_id,volunteer_id,token_hash,snapshot,role_revision,profile_revision,created_by,attempt)
    values(p_role,r.need_id,p_volunteer,p_token_hash,p_snapshot,p_role_revision,p_profile_revision,p_actor,next_attempt) returning id into new_id;
  insert into matching_email_outbox(invitation_id,kind,payload) values(new_id,'invitation',p_email);
  return new_id;
end $$;

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
    ('015',     'column', 'matching_invitations.attempt', 'Invitation attempts', false)
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
