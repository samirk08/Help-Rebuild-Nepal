-- Help Rebuild Nepal — database schema.
--
-- Run once against a new Supabase project, in the SQL editor
-- (Supabase dashboard -> SQL Editor -> New query -> paste this file -> Run).
-- Safe to re-run on a fresh project; not written to be idempotent against a
-- half-applied previous run — if you need to reset, drop the tables/types
-- first.
--
-- See README.md for the account-side setup checklist this fits into, and the
-- Context section of the original plan for why the schema is shaped this way
-- (short version: `fields jsonb` holds the complete raw submission because
-- the form schema it mirrors is auto-generated from a design file and can
-- change shape; the handful of real columns alongside it are only what the
-- admin dashboard actually filters or searches by).

create extension if not exists pgcrypto;

create type submission_kind as enum ('volunteer', 'need', 'relief-offer');

-- Shared vocabulary with STATUSES in lib/site-data.ts — the public site and
-- the admin dashboard must never disagree about what a status means.
create type submission_status as enum (
  'submitted', 'under_review', 'verified', 'recruiting', 'filled', 'completed', 'rejected'
);

create table submissions (
  id            uuid primary key default gen_random_uuid(),
  kind          submission_kind not null,
  status        submission_status not null default 'submitted',
  lang          text not null check (lang in ('en', 'np')),
  org_or_name   text,          -- organization_name (need) or full_name (volunteer/relief-offer)
  contact_phone text,
  contact_email text,
  district      text,
  province      text,
  urgency       text,          -- need-only: Immediate / Urgent / Upcoming / Reconstruction
  fields        jsonb not null,-- complete raw {fieldKey: value} payload as posted
  notes         text,          -- internal verifier notes, never shown publicly
  verified_by   uuid references auth.users(id),
  verified_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index submissions_kind_idx on submissions (kind);
create index submissions_status_idx on submissions (status);
create index submissions_district_idx on submissions (district);
create index submissions_created_at_idx on submissions (created_at desc);

create table documents (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  storage_path  text not null,     -- path inside the private "submissions" Storage bucket
  original_name text not null,
  mime_type     text not null,
  size_bytes    int not null,
  created_at    timestamptz not null default now()
);

create index documents_submission_id_idx on documents (submission_id);

-- The relief-item demand side (lib/relief.ts's ItemNeed, now real rows
-- instead of a static empty array). Nothing in the public site currently
-- creates these — they start as staff-entered records from the admin
-- dashboard until a public "post an item need" form exists.
create table item_needs (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,      -- matches RELIEF_CATEGORIES[].id in lib/relief.ts
  quantity     int not null check (quantity > 0),
  district     text not null,
  municipality text not null,
  ward         text,
  needed_by    date not null,
  requester    text not null,
  verified     boolean not null default false,
  detail       text not null,
  detail_np    text not null,
  created_at   timestamptz not null default now()
);

-- Offers against an item need. item_need_id is null for an unmatched offer —
-- see the "UNREQUESTED" labelling already built into the relief UI.
create table pledges (
  id              uuid primary key default gen_random_uuid(),
  item_need_id    uuid references item_needs(id),
  category        text not null,   -- required when item_need_id is null
  quantity        int not null check (quantity > 0),
  district        text,
  available_from  text,
  delivery_method text,
  contact         text,
  status          submission_status not null default 'submitted',
  created_at      timestamptz not null default now()
);

create index pledges_item_need_id_idx on pledges (item_need_id);

-- Pledged quantity is derived, never hand-incremented, so it can't drift from
-- the pledges that actually back it. Only verified pledges count toward the
-- fill bar — an unconfirmed offer should not make a request look answered.
create view item_need_pledged as
  select item_need_id, sum(quantity) as pledged
  from pledges
  where item_need_id is not null and status = 'verified'
  group by item_need_id;

-- Volunteer <-> need matching and project promotion. Deliberately minimal:
-- these record a decision an admin made manually, not the output of a
-- matching algorithm.
create table matches (
  id           uuid primary key default gen_random_uuid(),
  need_id      uuid not null references submissions(id),
  volunteer_id uuid not null references submissions(id),
  status       submission_status not null default 'submitted',
  created_at   timestamptz not null default now()
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  need_id     uuid not null references submissions(id),
  stage       text not null default 'recruiting' check (stage in ('recruiting', 'in_progress', 'completed')),
  coordinator text,
  created_at  timestamptz not null default now()
);

-- Row Level Security: enabled everywhere, with no policies. Every read and
-- write in this app goes through the service role key (lib/supabase.ts),
-- which bypasses RLS by design — access to that data is controlled by the
-- /admin login gate in middleware.ts, not by RLS. Enabling RLS with no
-- policies means that even if the anon key were ever used against these
-- tables by mistake, it would see and change nothing: defense in depth, not
-- the primary access control.
alter table submissions enable row level security;
alter table documents enable row level security;
alter table item_needs enable row level security;
alter table pledges enable row level security;
alter table matches enable row level security;
alter table projects enable row level security;
