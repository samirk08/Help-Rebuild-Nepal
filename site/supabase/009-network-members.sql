-- Migration 009 — real network membership.
--
-- Run once in the Supabase SQL editor, after 008. Safe to re-run.
--
-- Until now "joining a network" was not a thing anyone could do: the button
-- linked back to the volunteer registration form, and the member count was
-- derived from each volunteer's primary skill. That was honest while no join
-- action existed, but it sent people with a profile through sign-up again.
--
-- A member is now a row here: one account, one network, joined at a moment in
-- time. Keyed on the auth user (an account property, not a registration
-- property), and cascading on delete — if an account is removed there is no
-- longer anyone to be a member. The registration itself is untouched by that,
-- exactly as submissions.user_id promises.
--
-- `network` is the network's display name from NETWORKS in lib/site-data.ts.
-- No CHECK constraint pins the list, deliberately: networks are defined in
-- code, and adding one should not require a migration. The join API validates
-- the name against NETWORKS before anything is written.

create table if not exists network_members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  network    text not null,
  created_at timestamptz not null default now(),
  unique (user_id, network)
);

create index if not exists network_members_network_idx on network_members (network);
create index if not exists network_members_user_id_idx on network_members (user_id);

alter table network_members enable row level security;

-- Explicit rather than relying on the default privileges set in 003, which
-- only apply to tables created by the same role.
grant all privileges on table network_members to service_role;

-- Backfill: every claimed registration already counts toward its primary-skill
-- network on the public page, so make those people actual members. Without
-- this, someone who claimed their registration before this migration would see
-- an unpressed "Join" button on the very network whose count includes them.
-- The skill -> network mapping mirrors NETWORKS in lib/site-data.ts verbatim.
insert into network_members (user_id, network)
select s.user_id, m.network
from submissions s
join (values
  ('Engineering (structural / civil)', 'Engineering network'),
  ('Architecture',                     'Architecture network'),
  ('Health & medical',                 'Medical network'),
  ('Water & sanitation (WASH)',        'WASH network'),
  ('Logistics & transport',            'Logistics network')
) as m(skill, network)
  on s.fields->>'s03-primary-skill' = m.skill
where s.kind = 'volunteer'
  and s.user_id is not null
on conflict (user_id, network) do nothing;
