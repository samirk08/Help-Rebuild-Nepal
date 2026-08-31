-- Migration 005 — aggregates behind the public "Live numbers" tracker.
--
-- Run once in the Supabase SQL editor, after 004. Safe to re-run.
--
-- Why this exists: the five headline tiles on /[lang]/tracker have been real
-- since lib/metrics.ts shipped, but the three cards under them — "Skills
-- registered", "Registered from" and "What is needed" — were still the
-- design's static tables, hard-coded to 0% and 0. They sat next to live
-- numbers and read as live numbers, which is the one thing a page called
-- "Live numbers" must not do.
--
-- Two of the three need a GROUP BY, and PostgREST cannot express one. Doing it
-- in the app would mean selecting every volunteer row and counting in
-- JavaScript — unbounded work that grows with the register, for three small
-- numbers. A view keeps the aggregation in the database where it belongs and
-- returns at most one row per bucket.
--
-- security_invoker makes each view run with the privileges of whoever selects
-- from it rather than its owner's, so RLS on `submissions` still applies
-- underneath (service_role bypasses RLS and reads everything; anyone else sees
-- nothing). It needs Postgres 15 or newer — every current Supabase project. On
-- an older one, drop the WITH clause: the explicit grants below are what
-- actually keeps these away from public keys.

-- ------------------------------------------------- Skills registered

-- One row per distinct "Primary skill" answer, plus one null row counting the
-- volunteers who left it blank. lib/metrics.ts folds the twelve skill options
-- into the seven buckets the design's card shows, and uses the null row to keep
-- unanswered registrations out of the percentages rather than silently filing
-- them under "Other".
create or replace view volunteer_skill_counts
  with (security_invoker = true) as
  select
    nullif(btrim(fields->>'s03-primary-skill'), '') as skill,
    count(*)::int                                   as volunteers
  from submissions
  where kind = 'volunteer'
  group by 1;

-- ------------------------------------------------- Registered from

-- One row per place volunteers registered from. `district` holds a district
-- name or the "Outside Nepal" entry from lib/districts.ts — the volunteer form
-- has no country question, so this is the finest-grained honest answer to
-- "registered from" the data supports.
create or replace view volunteer_origin_counts
  with (security_invoker = true) as
  select
    nullif(btrim(district), '') as origin,
    count(*)::int               as volunteers
  from submissions
  where kind = 'volunteer'
  group by 1;

-- ------------------------------------------------- What is needed

-- The demand side, as one row. The status split is the same vocabulary the
-- rest of the app uses (STATUSES in lib/site-data.ts): a request is active
-- while it is still looking for people, and met once it is not.
--
-- people_needed sums only active requests, and is a sum of a nullable column:
-- "how many people" is an open question, so a request that answered it in
-- words contributes nothing here rather than a guessed number.
create or replace view need_demand_totals
  with (security_invoker = true) as
  select
    (count(*) filter (where status in ('verified', 'recruiting')))::int          as active_requests,
    (coalesce(sum(people_needed) filter (where status in ('verified', 'recruiting')), 0))::int
                                                                                as people_needed,
    (count(*) filter (where status in ('filled', 'completed')))::int             as needs_met
  from submissions
  where kind = 'need';

-- ------------------------------------------------- Grants

-- Same rule as migration 003: service_role only. These views aggregate a table
-- of personal data, and although nothing but counts leaves them, the browser
-- has no reason to reach them — it reads these numbers from this app's own
-- server-rendered page. The revoke is explicit because Supabase's default
-- privileges on `public` can grant new objects to anon and authenticated.
revoke all on volunteer_skill_counts, volunteer_origin_counts, need_demand_totals
  from anon, authenticated;

grant select on volunteer_skill_counts, volunteer_origin_counts, need_demand_totals
  to service_role;
