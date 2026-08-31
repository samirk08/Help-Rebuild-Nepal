-- Migration 008 — bug reports, with screenshots.
--
-- Run once in the Supabase SQL editor, after 007. Safe to re-run.
--
-- A place to write down what is broken the moment it is noticed, with the
-- screenshot attached, rather than losing it to a chat scroll-back. The status
-- vocabulary is deliberately tiny: a bug is open, fixed, or deliberately not
-- being fixed. Anything richer is process this team does not need.
--
-- Screenshots live in the existing private `submissions` bucket under a
-- `bugs/` prefix rather than in a new one, so nobody has to create and secure
-- a second bucket by hand. Same privacy properties: private, read only through
-- a short-lived signed URL minted server-side.

create table if not exists bug_reports (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  detail            text,
  -- Where it happened. Free text because a bug is often described by a path
  -- and a state ("/en/needs after filtering by Kaski") rather than a bare URL.
  page_url          text,
  severity          text not null default 'normal'
                      check (severity in ('blocking', 'normal', 'minor')),
  status            text not null default 'open'
                      check (status in ('open', 'fixed', 'wontfix')),
  -- Who filed it. set null on delete: removing someone's account must not
  -- delete the bugs they found.
  reported_by       uuid references auth.users(id) on delete set null,
  reported_by_email text,
  -- Captured from the browser that FILED the report, which is not necessarily
  -- the one that hit the bug. Recorded because it is right far more often than
  -- not, and the form says to mention the device if it differs.
  reported_from     text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index if not exists bug_reports_status_idx on bug_reports (status);
create index if not exists bug_reports_created_at_idx on bug_reports (created_at desc);

create table if not exists bug_attachments (
  id            uuid primary key default gen_random_uuid(),
  bug_id        uuid not null references bug_reports(id) on delete cascade,
  storage_path  text not null,
  original_name text not null,
  mime_type     text not null,
  size_bytes    int not null,
  created_at    timestamptz not null default now()
);

create index if not exists bug_attachments_bug_id_idx on bug_attachments (bug_id);

alter table bug_reports enable row level security;
alter table bug_attachments enable row level security;

-- Explicit rather than relying on the default privileges set in 003, which
-- only apply to tables created by the same role. Getting this wrong is what
-- made every read return nothing and every write fail once already.
grant all privileges on table bug_reports to service_role;
grant all privileges on table bug_attachments to service_role;
