-- Migration 018 — a relief item request that can actually be delivered.
--
-- Run in the Supabase SQL editor after 017. Safe to re-run.
--
-- Until now the supplies side had exactly two facts: how much was asked for,
-- and how much had been offered. Everything between an offer and a box
-- arriving somewhere was carried by hand, and the most important number in
-- the whole system — how much actually turned up — did not exist anywhere.
--
-- That gap is not cosmetic. A board showing "200 of 200 pledged" against a
-- request where nothing has shipped tells a coordinator to stop looking for
-- tarpaulins. It is the "second disaster" written into a progress bar: supply
-- that looks committed, is not, and displaces the search for supply that is.
--
-- So this migration separates the four quantities that were being conflated:
--
--   pledged    someone has offered it
--   reserved   a coordinator accepted the offer and arranged a delivery
--   dispatched it has left the donor
--   received   the recipient confirmed it arrived, in the amount that arrived
--
-- Only the last one reduces what is still needed.

-- ---------------------------------------------------------------------------
-- 1. The demand side gets a lifecycle
-- ---------------------------------------------------------------------------

-- `verified` said whether a request was publishable. It never said whether the
-- request was still live, so the only way to express "closed" was for pledges
-- to add up to the quantity — which app/api/submissions/route.ts had to do in
-- application code, and which cannot express "solved another way" or "the
-- deadline passed and this is now the wrong item".
alter table item_needs add column if not exists status text not null default 'requested';

do $$ begin
  alter table item_needs add constraint item_needs_status_check
    check (status in ('requested', 'closed', 'cancelled'));
exception when duplicate_object then null;
end $$;

alter table item_needs add column if not exists closed_at timestamptz;
alter table item_needs add column if not exists closed_reason text;
alter table item_needs add column if not exists updated_at timestamptz not null default now();

-- Public delivery arrangements: when and where goods can be dropped. This is
-- the part a donor needs before offering, so it is safe to publish.
alter table item_needs add column if not exists delivery_window text;
alter table item_needs add column if not exists delivery_address text;

-- Private delivery contacts. A named person with a phone number, published on
-- an open board next to a location and a shortage, is how a request for
-- tarpaulins becomes a stream of calls to a ward officer at midnight — and how
-- an aid diversion attempt finds its target. These columns are never selected
-- by any public read; `item_needs_public` below is the shape the public site
-- is allowed to see, so a future `select *` on the wrong table cannot leak
-- them by accident.
alter table item_needs add column if not exists contact_name text;
alter table item_needs add column if not exists contact_phone text;
alter table item_needs add column if not exists contact_email text;

create or replace function item_needs_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists item_needs_touch on item_needs;
create trigger item_needs_touch before update on item_needs
  for each row execute function item_needs_touch();

-- ---------------------------------------------------------------------------
-- 2. A pledge becomes a delivery with stages
-- ---------------------------------------------------------------------------

-- `status` (submitted/verified/rejected) answers "do we believe this offer is
-- real?". `stage` answers "where are the goods?". They were the same column,
-- which is why a verified pledge and a delivered pledge were indistinguishable.
alter table pledges add column if not exists stage text not null default 'offered';

do $$ begin
  alter table pledges add constraint pledges_stage_check
    check (stage in ('offered', 'reserved', 'dispatched', 'received', 'cancelled'));
exception when duplicate_object then null;
end $$;

-- The whole point of the migration. A pledge of 200 tarpaulins where 140
-- arrive is the ordinary case, not an error case, and the 60 must go back into
-- what is still needed rather than quietly disappearing.
alter table pledges add column if not exists received_quantity int not null default 0;

do $$ begin
  alter table pledges add constraint pledges_received_quantity_check
    check (received_quantity >= 0 and received_quantity <= quantity);
exception when duplicate_object then null;
end $$;

alter table pledges add column if not exists reserved_at timestamptz;
alter table pledges add column if not exists dispatched_at timestamptz;
alter table pledges add column if not exists received_at timestamptz;
alter table pledges add column if not exists cancelled_at timestamptz;

-- How the donor intends to get it there, and who at the receiving end put
-- their name to the confirmation. `received_by` is what makes a receipt a
-- record rather than a checkbox: someone is accountable for it.
alter table pledges add column if not exists delivery_note text;
alter table pledges add column if not exists received_by text;

create index if not exists pledges_stage_idx on pledges (stage);

-- ---------------------------------------------------------------------------
-- 3. What is actually still needed
-- ---------------------------------------------------------------------------

-- The existing view is kept, because lib/relief-data.ts and the admin relief
-- page both read it, but a cancelled offer must stop counting the moment it is
-- cancelled. Before this, cancelling a pledge left its quantity on the fill bar
-- forever.
drop view if exists item_need_pledged;
create view item_need_pledged as
  select item_need_id, sum(quantity) as pledged
  from pledges
  where item_need_id is not null and status = 'verified' and stage <> 'cancelled'
  group by item_need_id;

comment on view item_need_pledged is
  'Verified, uncancelled offers against each item need. This is what has been '
  'promised, NOT what has arrived — see item_need_progress.received.';

-- The four quantities, side by side, so no reader has to reconstruct them.
--
-- `remaining` counts received goods and goods a coordinator has actually
-- committed to (reserved or dispatched). A bare offer does not reduce it: an
-- offer nobody has accepted is a lead, and treating leads as supply is exactly
-- the failure this migration exists to prevent.
-- Dropped before item_need_progress because it selects from it; Postgres
-- refuses to drop a view something else depends on, so a re-run of this file
-- would fail here otherwise.
drop view if exists item_needs_public;
drop view if exists item_need_progress;
create view item_need_progress as
  select
    n.id as item_need_id,
    n.quantity,
    n.status,
    coalesce(sum(p.quantity) filter (
      where p.status = 'verified' and p.stage <> 'cancelled'
    ), 0)::int as pledged,
    coalesce(sum(p.quantity) filter (where p.stage = 'reserved'), 0)::int as reserved,
    coalesce(sum(p.quantity) filter (where p.stage = 'dispatched'), 0)::int as dispatched,
    coalesce(sum(p.received_quantity) filter (where p.stage = 'received'), 0)::int as received,
    coalesce(sum(p.quantity) filter (
      where p.stage in ('reserved', 'dispatched')
    ), 0)::int as committed,
    greatest(
      n.quantity
        - coalesce(sum(p.received_quantity) filter (where p.stage = 'received'), 0)
        - coalesce(sum(p.quantity) filter (where p.stage in ('reserved', 'dispatched')), 0),
      0
    )::int as remaining
  from item_needs n
  left join pledges p on p.item_need_id = n.id
  group by n.id, n.quantity, n.status;

comment on view item_need_progress is
  'Pledged, reserved, dispatched and received quantities per item need, plus '
  'the demand still unmet. Received is the only one that means goods exist at '
  'the destination.';

-- Everything the public site may read about an item need. The private contact
-- columns are absent by construction rather than by remembering to omit them.
drop view if exists item_needs_public;
create view item_needs_public as
  select
    n.id, n.category, n.quantity, n.district, n.municipality, n.ward,
    n.needed_by, n.requester, n.verified, n.detail, n.detail_np,
    n.status, n.delivery_window, n.delivery_address, n.created_at,
    g.pledged, g.received, g.committed, g.remaining
  from item_needs n
  join item_need_progress g on g.item_need_id = n.id
  where n.verified = true;

comment on view item_needs_public is
  'Item needs as the public site may see them. Deliberately excludes '
  'contact_name, contact_phone and contact_email — a named person and a phone '
  'number next to a location and a shortage is not public information.';

-- ---------------------------------------------------------------------------
-- 4. A closed or fully allocated request stops taking offers
-- ---------------------------------------------------------------------------

-- route.ts already refused an offer once pledges covered the quantity, and it
-- can keep doing so to produce a decent error message. But the check lived in
-- one code path out of any number that can insert a pledge, and it compared
-- against the wrong number (offers, not commitments). The database is the only
-- place this can be true everywhere.
create or replace function pledges_guard_demand() returns trigger
language plpgsql set search_path = public as $$
declare
  need   record;
  filled int;
begin
  if new.item_need_id is null then
    return new;  -- An unrequested offer has no demand to overrun.
  end if;

  -- Locked, so two donors submitting at the same moment cannot both read the
  -- same remaining figure and both be admitted past it.
  select id, quantity, status into need
  from item_needs where id = new.item_need_id for update;

  if not found then
    raise exception 'That item need is no longer listed.';
  end if;

  if need.status <> 'requested' then
    raise exception 'That item need is closed and is not taking new offers.';
  end if;

  select coalesce(sum(received_quantity) filter (where stage = 'received'), 0)
       + coalesce(sum(quantity) filter (where stage in ('reserved', 'dispatched')), 0)
    into filled
  from pledges where item_need_id = new.item_need_id and id is distinct from new.id;

  if filled >= need.quantity then
    raise exception 'That item need is already fully allocated and is not taking new offers.';
  end if;

  return new;
end $$;

drop trigger if exists pledges_guard_demand on pledges;
create trigger pledges_guard_demand before insert on pledges
  for each row execute function pledges_guard_demand();

-- ---------------------------------------------------------------------------
-- 5. History
-- ---------------------------------------------------------------------------

-- Append-only, for the same reason request_events is: "who said these arrived,
-- and when" is the question asked after goods go missing, and a log that can be
-- rewritten cannot answer it.
create table if not exists item_need_events (
  id            uuid primary key default gen_random_uuid(),
  item_need_id  uuid not null references item_needs(id) on delete cascade,
  pledge_id     uuid references pledges(id) on delete set null,
  event         text not null,
  detail        text,
  quantity      int,
  actor         text not null default 'coordinator'
                check (actor in ('coordinator', 'requester', 'donor', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists item_need_events_need_idx
  on item_need_events (item_need_id, created_at desc);

create or replace function item_need_events_append_only() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'item_need_events is append-only.';
end $$;

drop trigger if exists item_need_events_no_update on item_need_events;
create trigger item_need_events_no_update before update or delete on item_need_events
  for each row execute function item_need_events_append_only();

-- ---------------------------------------------------------------------------
-- 6. Moving a delivery along
-- ---------------------------------------------------------------------------

-- One function, so the legal transitions are stated once. Doing this with a
-- plain UPDATE from the dashboard would let a pledge jump from `offered`
-- straight to `received` — recording an arrival for goods nobody ever agreed
-- to collect.
create or replace function relief_advance_pledge(
  p_pledge_id uuid,
  p_stage     text,
  p_quantity  int      default null,
  p_note      text     default null,
  p_actor     uuid     default null,
  p_by        text     default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  -- The marker that distinguishes a request this function closed because the
  -- numbers added up from one a person closed for a reason of their own.
  DEMAND_MET constant text := 'Demand met';
  p         record;
  received  int;
  filled    int;
  need_qty  int;
begin
  select * into p from pledges where id = p_pledge_id for update;
  if not found then
    raise exception 'That offer is no longer available.';
  end if;

  -- Idempotent: a retried submit on the stage already recorded is not an
  -- error, exactly as answering a clarification twice is not.
  if p.stage = p_stage then
    return p.stage;
  end if;

  if p_stage not in ('reserved', 'dispatched', 'received', 'cancelled') then
    raise exception 'Unknown delivery stage: %', p_stage;
  end if;

  -- Cancelling is allowed from anywhere except a completed delivery, because
  -- goods that have arrived cannot be un-arrived. Everything else moves one
  -- step forward at a time.
  if p_stage = 'cancelled' then
    if p.stage = 'received' then
      raise exception 'A delivery that has been received cannot be cancelled.';
    end if;
  elsif p_stage = 'reserved' then
    if p.stage <> 'offered' then
      raise exception 'Only an open offer can be reserved.';
    end if;
    -- Arranging a collection from an offer nobody has checked is how the
    -- platform ends up vouching for a donor it knows nothing about.
    if p.status <> 'verified' then
      raise exception 'Verify this offer before reserving it.';
    end if;
  elsif p_stage = 'dispatched' then
    if p.stage <> 'reserved' then
      raise exception 'Only a reserved delivery can be marked dispatched.';
    end if;
  elsif p_stage = 'received' then
    if p.stage not in ('reserved', 'dispatched') then
      raise exception 'Only an arranged delivery can be marked received.';
    end if;
    if p_quantity is null then
      raise exception 'Record how much actually arrived.';
    end if;
    if p_quantity < 1 or p_quantity > p.quantity then
      raise exception 'Received quantity must be between 1 and %.', p.quantity;
    end if;
  end if;

  received := case when p_stage = 'received' then p_quantity else 0 end;

  update pledges set
    stage             = p_stage,
    received_quantity = received,
    delivery_note     = coalesce(p_note, delivery_note),
    received_by       = case when p_stage = 'received' then p_by else received_by end,
    reserved_at       = case when p_stage = 'reserved'   then now() else reserved_at end,
    dispatched_at     = case when p_stage = 'dispatched' then now() else dispatched_at end,
    received_at       = case when p_stage = 'received'   then now() else received_at end,
    cancelled_at      = case when p_stage = 'cancelled'  then now() else cancelled_at end
  where id = p_pledge_id;

  if p.item_need_id is not null then
    insert into item_need_events(item_need_id, pledge_id, event, detail, quantity, actor_user_id)
    values (p.item_need_id, p_pledge_id, 'pledge_' || p_stage, p_note, nullif(received, 0), p_actor);

    -- A request whose demand is met closes itself. Leaving it open invites
    -- offers that will be refused, which reads to a donor as the platform
    -- wasting their time.
    select quantity into need_qty from item_needs where id = p.item_need_id;
    select coalesce(sum(received_quantity) filter (where stage = 'received'), 0)
         + coalesce(sum(quantity) filter (where stage in ('reserved', 'dispatched')), 0)
      into filled
    from pledges where item_need_id = p.item_need_id;

    if filled >= need_qty then
      update item_needs set status = 'closed', closed_at = now(),
             closed_reason = coalesce(closed_reason, DEMAND_MET)
      where id = p.item_need_id and status = 'requested';
    else
      -- And back open when demand reappears — which is the ordinary case, not
      -- an exception: a request closes on 200 reserved, 140 arrive, and the
      -- other 60 are needed by someone who currently cannot offer them.
      --
      -- Only a request this function closed is reopened. "The district sent a
      -- truck" is a decision a person made, and a late partial delivery must
      -- not quietly overturn it.
      update item_needs set status = 'requested', closed_at = null, closed_reason = null
      where id = p.item_need_id and status = 'closed' and closed_reason = DEMAND_MET;
    end if;
  end if;

  return p_stage;
end $$;

revoke all on function relief_advance_pledge(uuid, text, int, text, uuid, text)
  from public, anon, authenticated;
grant execute on function relief_advance_pledge(uuid, text, int, text, uuid, text) to service_role;

-- Closing and reopening by hand: "the district sent a truck", "winter passed
-- and blankets are the wrong ask now". Reopening is deliberately possible,
-- because a request closed in error otherwise has to be retyped and loses its
-- pledges.
create or replace function relief_set_item_need_status(
  p_need_id uuid,
  p_status  text,
  p_reason  text default null,
  p_actor   uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  n record;
begin
  if p_status not in ('requested', 'closed', 'cancelled') then
    raise exception 'Unknown item need status: %', p_status;
  end if;

  select * into n from item_needs where id = p_need_id for update;
  if not found then
    raise exception 'That item need is no longer listed.';
  end if;
  -- Idempotent on the whole decision, not just the status. Restating a closure
  -- with a different reason has to take effect: a request auto-closed as
  -- "Demand met" and then closed by hand as "the district sent a truck" must
  -- end up carrying the human reason, because relief_advance_pledge reopens
  -- only the automatic kind.
  if n.status = p_status and n.closed_reason is not distinct from p_reason then
    return n.status;
  end if;

  update item_needs set
    status        = p_status,
    closed_at     = case when p_status = 'requested' then null else now() end,
    closed_reason = case when p_status = 'requested' then null else p_reason end
  where id = p_need_id;

  insert into item_need_events(item_need_id, event, detail, actor_user_id)
  values (p_need_id, 'need_' || p_status, p_reason, p_actor);

  return p_status;
end $$;

revoke all on function relief_set_item_need_status(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function relief_set_item_need_status(uuid, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table item_need_events enable row level security;
revoke all on item_need_events from public, anon, authenticated;
grant all on item_need_events to service_role;

revoke all on item_need_progress from public, anon, authenticated;
revoke all on item_needs_public from public, anon, authenticated;
revoke all on item_need_pledged from public, anon, authenticated;
grant select on item_need_progress, item_needs_public, item_need_pledged to service_role;

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
    ('018',     'table',  'item_need_events',       'Relief delivery stages',  false)
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
