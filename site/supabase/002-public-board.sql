-- Migration 002 — publish verified needs, and let people express interest.
--
-- Run once in the Supabase SQL editor, after schema.sql. Safe to re-run: every
-- statement is guarded with "if not exists".
--
-- Why this exists: the public needs board and need detail pages were built
-- against the design but never read the database, so a verified need was
-- invisible to the volunteers it needed. Two things were missing to wire them
-- up honestly:
--
--   1. "How many people" and "Skills required" only existed inside the
--      `fields` jsonb blob. The board filters and sorts on both, and the
--      detail page needs a number to show "2 of 4 committed" against. Same
--      hybrid rule as the rest of the schema: promote to a real column only
--      what a query actually filters or counts by; the raw answer stays in
--      `fields` regardless, so nothing is lost if a label is renamed upstream.
--
--   2. There was nowhere to put an expression of interest. The button on the
--      detail page fired a toast that admitted nothing was recorded.

-- ---------------------------------------------------------------- Columns

alter table submissions add column if not exists people_needed int;
alter table submissions add column if not exists skills text[];

-- Free text, deliberately: the form asks "How many people" as an open
-- question and answers like "2-3" or "as many as can come" are legitimate.
-- Take the leading integer where there is one and leave it null otherwise —
-- a null reads as "not specified" everywhere downstream, which is honest,
-- whereas defaulting to 0 would render as "0 of 0 committed".
update submissions
   set people_needed = nullif(substring(fields->>'s04-how-many-people' from '\d+'), '')::int
 where kind = 'need'
   and people_needed is null;

-- normalizeChipFields() in app/api/submissions/route.ts guarantees chip groups
-- are arrays on the way in, but rows written before that guarantee (or by
-- hand) could hold a bare string, so handle both rather than error the
-- migration on one bad row.
update submissions
   set skills = case jsonb_typeof(fields->'s03-skills-required')
                  when 'array'  then array(select jsonb_array_elements_text(fields->'s03-skills-required'))
                  when 'string' then array[fields->>'s03-skills-required']
                  else null
                end
 where kind = 'need'
   and skills is null;

create index if not exists submissions_province_idx on submissions (province);
create index if not exists submissions_urgency_idx on submissions (urgency);
-- GIN, not btree: the board filters with `skills && array[...]` (overlap).
create index if not exists submissions_skills_idx on submissions using gin (skills);

-- ---------------------------------------------------------------- Interests

-- Someone saying "I can help with this" on a published need.
--
-- No volunteer accounts exist yet, so this deliberately does not reference a
-- user: it captures just enough for the requester to make contact, which is
-- the direction the design's own copy promises ("The requester contacts you
-- first"). Contact details here are private — they are never rendered on a
-- public page, only in the admin review screens.
create table if not exists interests (
  id         uuid primary key default gen_random_uuid(),
  need_id    uuid not null references submissions(id) on delete cascade,
  name       text not null,
  contact    text not null,
  message    text,
  status     submission_status not null default 'submitted',
  created_at timestamptz not null default now()
);

create index if not exists interests_need_id_idx on interests (need_id);
create index if not exists interests_created_at_idx on interests (created_at desc);

alter table interests enable row level security;

-- ---------------------------------------------------------------- Integrity

-- createMatch() inserted unconditionally, so clicking "Mark matched" twice
-- recorded the same volunteer against the same need twice — which would then
-- double-count against people_needed in the fill bar this migration enables.
delete from matches a
 using matches b
 where a.ctid > b.ctid
   and a.need_id = b.need_id
   and a.volunteer_id = b.volunteer_id;

create unique index if not exists matches_need_volunteer_key
  on matches (need_id, volunteer_id);
