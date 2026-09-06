-- Apply after 009. Additive and rerunnable. No existing profiles or matches
-- are guessed, verified, or emailed by this migration.
begin;

alter table submissions add column if not exists matching_contact_approved boolean not null default false;

create table if not exists matching_profiles (
  volunteer_id uuid primary key references submissions(id) on delete cascade,
  facts jsonb not null default '{}'::jsonb,
  paused boolean not null default false,
  mission_ids text[] not null default '{}',
  mission_only boolean not null default false,
  verified_qualifications text[] not null default '{}',
  confirmed_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  revision integer not null default 1
);
create table if not exists matching_roles (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references submissions(id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  headcount integer not null check (headcount between 1 and 1000),
  config jsonb not null,
  active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists matching_roles_need_idx on matching_roles(need_id);
create table if not exists matching_invitations (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references matching_roles(id) on delete cascade,
  need_id uuid not null references submissions(id) on delete cascade,
  volunteer_id uuid not null references submissions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','sent','accepted','declined','expired','cancelled','confirmed')),
  token_hash text not null unique,
  snapshot jsonb not null,
  role_revision integer not null,
  profile_revision integer not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  responded_at timestamptz,
  unique (role_id, volunteer_id)
);
create index if not exists matching_invitations_volunteer_idx on matching_invitations(volunteer_id);
create table if not exists matching_email_outbox (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references matching_invitations(id) on delete cascade,
  kind text not null check (kind in ('invitation','volunteer-introduction','requester-introduction')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','cancelled')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique(invitation_id, kind)
);
create index if not exists matching_outbox_pending_idx on matching_email_outbox(status, available_at);
alter table matching_email_outbox add column if not exists delivery_status text;
create index if not exists matching_outbox_provider_idx on matching_email_outbox(provider_id);
create table if not exists matching_email_events (
  id text primary key,
  provider_id text not null,
  event_type text not null,
  created_at timestamptz not null
);
create index if not exists matching_email_events_provider_idx on matching_email_events(provider_id);
create table if not exists matching_commitments (
  match_id uuid primary key references matches(id) on delete cascade,
  role_id uuid not null references matching_roles(id),
  invitation_id uuid unique references matching_invitations(id),
  start_date date not null,
  end_date date not null,
  hours_per_week integer not null,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz not null default now()
);

-- Revisions provide optimistic concurrency and invalidate old invitations.
create or replace function matching_revision() returns trigger language plpgsql set search_path = public as $$
begin
  new.revision := old.revision + 1;
  if tg_table_name = 'matching_profiles' then
    -- Pausing notifications or verifying a qualification is not a fresh
    -- availability confirmation. The profile form supplies confirmed_at.
    if new.facts is distinct from old.facts then new.confirmed_at := now(); end if;
  else
    update matching_invitations set status = 'cancelled'
      where role_id = old.id and status in ('queued','sent','accepted');
  end if;
  return new;
end $$;

create or replace function matching_need_changed() returns trigger language plpgsql set search_path = public as $$
begin
  if new.kind='need' and (new.status not in ('verified','recruiting') or new.contact_email is distinct from old.contact_email or new.matching_contact_approved is distinct from old.matching_contact_approved) then
    update matching_invitations set status='cancelled' where need_id=new.id and status in ('queued','sent','accepted');
  end if;
  return new;
end $$;
drop trigger if exists matching_need_changed on submissions;
create trigger matching_need_changed after update on submissions for each row execute function matching_need_changed();
drop trigger if exists matching_profile_revision on matching_profiles;
create trigger matching_profile_revision before update on matching_profiles for each row execute function matching_revision();
drop trigger if exists matching_role_revision on matching_roles;
create trigger matching_role_revision before update on matching_roles for each row execute function matching_revision();

create or replace function matching_validate_kind() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'matching_profiles' then
    if not exists (select 1 from submissions where id = new.volunteer_id and kind = 'volunteer') then raise exception 'Matching profile requires a volunteer'; end if;
  else
    if not exists (select 1 from submissions where id = new.need_id and kind = 'need') then raise exception 'Matching role requires a need'; end if;
  end if;
  return new;
end $$;
drop trigger if exists matching_profile_kind on matching_profiles;
create trigger matching_profile_kind before insert or update on matching_profiles for each row execute function matching_validate_kind();
drop trigger if exists matching_role_kind on matching_roles;
create trigger matching_role_kind before insert or update on matching_roles for each row execute function matching_validate_kind();

-- Atomic queueing serializes on the role and volunteer: no oversubscribed slots
-- or multiple simultaneous invitations to the same person across roles.
create or replace function matching_queue_invitation(
  p_role uuid, p_volunteer uuid, p_role_revision integer, p_profile_revision integer,
  p_token_hash text, p_snapshot jsonb, p_email jsonb, p_actor uuid
) returns uuid language plpgsql set search_path = public as $$
declare r matching_roles; v submissions; p matching_profiles; new_id uuid; occupied integer;
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
  select count(*) into occupied from matching_invitations where role_id=p_role and (status='confirmed' or (status in ('queued','sent','accepted') and expires_at > now()));
  if occupied >= r.headcount then raise exception 'No open slots remain'; end if;
  insert into matching_invitations(role_id,need_id,volunteer_id,token_hash,snapshot,role_revision,profile_revision,created_by)
    values(p_role,r.need_id,p_volunteer,p_token_hash,p_snapshot,p_role_revision,p_profile_revision,p_actor) returning id into new_id;
  insert into matching_email_outbox(invitation_id,kind,payload) values(new_id,'invitation',p_email);
  return new_id;
end $$;

-- GETs never change invitation state. Only a deliberate response calls this.
create or replace function matching_respond(p_token_hash text, p_response text, p_pause boolean default false)
returns text language plpgsql set search_path = public as $$
declare i matching_invitations; r matching_roles;
begin
  select * into i from matching_invitations where token_hash=p_token_hash;
  if not found then raise exception 'Invitation unavailable'; end if;
  select * into r from matching_roles where id=i.role_id for update;
  select * into i from matching_invitations where id=i.id for update;
  if i.status in ('accepted','declined','confirmed') then return i.status; end if;
  if i.status not in ('queued','sent') or i.expires_at <= now() or not r.active or r.revision <> i.role_revision
     or not exists(select 1 from submissions where id=i.need_id and status in ('verified','recruiting')) then raise exception 'Invitation is no longer active'; end if;
  if p_response not in ('accepted','declined') then raise exception 'Invalid response'; end if;
  update matching_invitations set status=p_response, responded_at=now(),
    expires_at=case when p_response='accepted' then now()+interval '72 hours' else expires_at end where id=i.id;
  if p_pause then update matching_profiles set paused=true where volunteer_id=i.volunteer_id; end if;
  return p_response;
end $$;

-- Called after the admin re-evaluates the latest facts and records agreement
-- from BOTH parties. Schedule snapshots survive later changes to the role.
create or replace function matching_confirm(p_invitation uuid, p_profile_revision integer, p_actor uuid, p_volunteer_email jsonb, p_requester_email jsonb)
returns uuid language plpgsql set search_path = public as $$
declare i matching_invitations; r matching_roles; p matching_profiles; mid uuid; used integer; peak integer;
begin
  select * into i from matching_invitations where id=p_invitation;
  if not found then raise exception 'Invitation unavailable'; end if;
  select * into r from matching_roles where id=i.role_id for update;
  perform 1 from submissions where id=i.volunteer_id for update;
  select * into i from matching_invitations where id=p_invitation for update;
  if i.status='confirmed' then select match_id into mid from matching_commitments where invitation_id=i.id; return mid; end if;
  if i.status <> 'accepted' or i.expires_at <= now() or not r.active or r.revision <> i.role_revision then raise exception 'Invitation changed or expired'; end if;
  if not exists(select 1 from submissions where id=i.need_id and status in ('verified','recruiting')) then raise exception 'Need is closed'; end if;
  if not exists(select 1 from submissions where id=i.volunteer_id and status in ('verified','recruiting','filled','completed')) then raise exception 'Volunteer review required'; end if;
  select * into p from matching_profiles where volunteer_id=i.volunteer_id for update;
  if not found or p.paused or p.revision <> p_profile_revision or p.confirmed_at < now()-interval '30 days' then raise exception 'Profile changed; refresh recommendations'; end if;
  if exists(select 1 from matches where need_id=i.need_id and volunteer_id=i.volunteer_id and status in ('verified','recruiting','filled','completed')) then raise exception 'Already committed to this need'; end if;
  select count(*) into used from matching_invitations where role_id=i.role_id and status='confirmed';
  if used >= r.headcount then raise exception 'Role is already filled'; end if;
  if exists(select 1 from matches m left join matching_commitments c on c.match_id=m.id where m.volunteer_id=i.volunteer_id and m.need_id<>i.need_id and m.status in ('verified','recruiting','filled') and c.match_id is null) then raise exception 'Review the schedule of an existing commitment'; end if;
  select coalesce(max(load),0) into peak from (
    select sum(c.hours_per_week) as load from (
      select (r.config->>'startDate')::date as day
      union select c.start_date from matching_commitments c join matches m on m.id=c.match_id
        where m.volunteer_id=i.volunteer_id and m.status in ('verified','recruiting','filled')
          and c.start_date between (r.config->>'startDate')::date and (r.config->>'endDate')::date
    ) d join matching_commitments c on d.day between c.start_date and c.end_date
    join matches m on m.id=c.match_id where m.volunteer_id=i.volunteer_id and m.status in ('verified','recruiting','filled') group by d.day
  ) loads;
  if p.facts->>'hoursPerWeek' is null or peak+(r.config->>'hoursPerWeek')::integer > (p.facts->>'hoursPerWeek')::integer then raise exception 'Insufficient weekly capacity'; end if;
  insert into matches(need_id,volunteer_id,status) values(i.need_id,i.volunteer_id,'verified')
    on conflict(need_id,volunteer_id) do update set status='verified' returning id into mid;
  insert into matching_commitments(match_id,role_id,invitation_id,start_date,end_date,hours_per_week,confirmed_by)
    values(mid,r.id,i.id,(r.config->>'startDate')::date,(r.config->>'endDate')::date,(r.config->>'hoursPerWeek')::integer,p_actor);
  update matching_invitations set status='confirmed' where id=i.id;
  insert into matching_email_outbox(invitation_id,kind,payload) values
    (i.id,'volunteer-introduction',p_volunteer_email),(i.id,'requester-introduction',p_requester_email);
  return mid;
end $$;

-- Completing releases weekly capacity but keeps the place fulfilled. Withdrawal
-- releases both the place and weekly capacity, preserving the invitation audit.
create or replace function matching_finish(p_invitation uuid, p_outcome text)
returns uuid language plpgsql set search_path = public as $$
declare i matching_invitations; mid uuid;
begin
  if p_outcome not in ('completed','withdrawn') then raise exception 'Invalid outcome'; end if;
  select * into i from matching_invitations where id=p_invitation;
  if not found then raise exception 'Connection unavailable'; end if;
  perform 1 from matching_roles where id=i.role_id for update;
  perform 1 from submissions where id=i.volunteer_id for update;
  select * into i from matching_invitations where id=p_invitation for update;
  if i.status<>'confirmed' then raise exception 'Connection is no longer active'; end if;
  select match_id into mid from matching_commitments where invitation_id=i.id;
  update matches set status=case when p_outcome='completed' then 'completed'::submission_status else 'rejected'::submission_status end
    where id=mid and status in ('verified','recruiting','filled');
  if not found then raise exception 'Connection has already ended'; end if;
  if p_outcome='withdrawn' then update matching_invitations set status='cancelled' where id=i.id; end if;
  update matching_email_outbox set status='cancelled' where invitation_id=i.id and status in ('pending','sending');
  return i.need_id;
end $$;

-- Apply signed delivery events even when they arrive before the send response.
create or replace function matching_apply_delivery(p_provider text)
returns void language plpgsql set search_path=public as $$
declare event text;
begin
  select event_type into event from matching_email_events where provider_id=p_provider
    order by case when event_type in ('email.bounced','email.complained','email.failed','email.suppressed') then 0 else 1 end, created_at desc limit 1;
  if event is null then return; end if;
  update matching_email_outbox set delivery_status=event where provider_id=p_provider;
  if event in ('email.bounced','email.complained','email.suppressed') then
    update matching_profiles p set paused=true from matching_invitations i, matching_email_outbox o, submissions v
      where o.provider_id=p_provider and o.kind<>'requester-introduction' and i.id=o.invitation_id
        and p.volunteer_id=i.volunteer_id and v.id=p.volunteer_id and lower(v.contact_email)=lower(o.payload->>'to') and not p.paused;
  end if;
end $$;
create or replace function matching_record_delivery(p_id text,p_provider text,p_type text,p_created timestamptz)
returns void language plpgsql set search_path=public as $$
begin
  insert into matching_email_events(id,provider_id,event_type,created_at) values(p_id,p_provider,p_type,p_created) on conflict(id) do nothing;
  perform matching_apply_delivery(p_provider);
end $$;
create or replace function matching_record_sent(p_job uuid,p_provider text)
returns void language plpgsql set search_path=public as $$
declare job matching_email_outbox;
begin
  update matching_email_outbox set status='sent',provider_id=p_provider,locked_until=null,last_error=null where id=p_job returning * into job;
  if job.kind='invitation' then update matching_invitations set status='sent' where id=job.invitation_id and status='queued'; end if;
  perform matching_apply_delivery(p_provider);
end $$;

create or replace function matching_claim_emails(p_limit integer default 5)
returns setof matching_email_outbox language plpgsql set search_path = public as $$
begin
  update matching_invitations set status='expired' where status in ('queued','sent','accepted') and expires_at<=now();
  update matching_email_outbox o set status='cancelled' from matching_invitations i
    where o.invitation_id=i.id and o.status in ('pending','sending') and i.status in ('expired','declined','cancelled');
  -- Provider idempotency expires at 24 hours. Ambiguous sends after 23 hours
  -- require reconciliation, never an automatic duplicate.
  update matching_email_outbox set status='failed',last_error='Send outcome uncertain; reconcile with provider before retrying'
    where status in ('pending','sending') and attempts>0 and created_at < now()-interval '23 hours';
  return query with picked as (
    select id from matching_email_outbox where (status='pending' or (status='sending' and locked_until<now()))
      and available_at<=now() order by created_at for update skip locked limit greatest(1,least(p_limit,10))
  ) update matching_email_outbox o set status='sending',locked_until=now()+interval '2 minutes',attempts=attempts+1
    from picked where o.id=picked.id returning o.*;
end $$;

alter table matching_profiles enable row level security;
alter table matching_roles enable row level security;
alter table matching_invitations enable row level security;
alter table matching_email_outbox enable row level security;
alter table matching_commitments enable row level security;
alter table matching_email_events enable row level security;
revoke all on matching_profiles,matching_roles,matching_invitations,matching_email_outbox,matching_commitments,matching_email_events from public,anon,authenticated;
grant all on matching_profiles,matching_roles,matching_invitations,matching_email_outbox,matching_commitments,matching_email_events to service_role;
revoke all on function matching_revision(),matching_need_changed(),matching_validate_kind(),matching_queue_invitation(uuid,uuid,integer,integer,text,jsonb,jsonb,uuid),matching_respond(text,text,boolean),matching_confirm(uuid,integer,uuid,jsonb,jsonb),matching_claim_emails(integer),matching_finish(uuid,text),matching_apply_delivery(text),matching_record_delivery(text,text,text,timestamptz),matching_record_sent(uuid,text) from public,anon,authenticated;
grant execute on function matching_queue_invitation(uuid,uuid,integer,integer,text,jsonb,jsonb,uuid),matching_respond(text,text,boolean),matching_confirm(uuid,integer,uuid,jsonb,jsonb),matching_claim_emails(integer),matching_finish(uuid,text),matching_apply_delivery(text),matching_record_delivery(text,text,text,timestamptz),matching_record_sent(uuid,text) to service_role;
commit;
