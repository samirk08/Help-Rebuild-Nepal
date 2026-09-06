-- Migration 011 — intake integrity and a readable migration ledger.
--
-- Run in the Supabase SQL editor after 010. Written to be safely re-runnable:
-- every statement is `if not exists` or an idempotent replace, so applying it
-- twice is a no-op rather than an error.
--
-- Three things happen here, all of them corrections to guarantees the
-- application was previously only pretending to have.
--
-- 1. DUPLICATE SUBMISSIONS. The API deduplicated by fetching the last 25 rows
--    of a kind and comparing their payloads in JavaScript. That is not a
--    concurrency control: two requests that arrive together both read a state
--    without the other, both find no match, and both insert. It also silently
--    stopped working past 25 concurrent submissions of the same kind, which is
--    exactly the load a real emergency produces. A unique index makes the
--    database refuse the second write, which is the only place the decision can
--    actually be made atomically.
--
-- 2. DUPLICATE DOCUMENT ROWS. `/api/uploads/confirm` inserted unconditionally,
--    so a retried confirm — a flaky connection, a double-tap, the retry this
--    release adds — recorded the same stored object twice. The form then
--    reported more attachments than exist.
--
-- 3. MIGRATION STATE. Diagnostics answered "has this migration run?" by
--    INSERTing a probe row into `submissions` and deleting it again, on a GET.
--    A GET that writes is a GET that can be replayed by a link prefetcher, and
--    a delete that fails leaves a fake registration in the middle of real ones.
--    The view at the bottom answers the same question by reading catalogs.

-- ---------------------------------------------------------------------------
-- 1. Idempotency keys
-- ---------------------------------------------------------------------------

-- Client-generated, unique per intended submission, resent unchanged on retry.
-- Nullable because every row written before this migration has no key, and
-- because an idempotency key is a courtesy the caller extends, not something
-- the database can require of an old browser tab.
alter table submissions add column if not exists idempotency_key text;
alter table pledges add column if not exists idempotency_key text;

-- Partial, so the many pre-existing NULL rows do not collide with each other.
-- (In Postgres NULLs are distinct in a unique index anyway; the WHERE clause
-- also keeps the index small, which is the reason worth stating.)
create unique index if not exists submissions_idempotency_key_uidx
  on submissions (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists pledges_idempotency_key_uidx
  on pledges (idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- 2. One document row per stored object
-- ---------------------------------------------------------------------------

-- The storage path already contains the submission id and a millisecond
-- timestamp, so it is unique per upload attempt. Making it unique in the table
-- turns a retried confirm into a no-op instead of a duplicate.
--
-- Any duplicates already recorded are collapsed first, keeping the earliest
-- row, or the index cannot be built.
delete from documents d
using documents keep
where d.storage_path = keep.storage_path
  and (d.created_at, d.id) > (keep.created_at, keep.id);

create unique index if not exists documents_storage_path_uidx
  on documents (storage_path);

-- ---------------------------------------------------------------------------
-- 3. Migration state, readable without writing
-- ---------------------------------------------------------------------------

-- Each migration is identified by one object it is the sole creator of. This
-- reports what is actually present in the database rather than what is present
-- in the repository, which is the distinction that matters: a migration file
-- committed to git is not a migration that has been run.
create or replace view migration_state as
with expected(migration, object_kind, object_name, detail) as (
  values
    ('schema',  'table',  'submissions',        'Core intake tables'),
    ('002',     'column', 'submissions.skills', 'Public board columns and interests'),
    ('004',     'table',  'admin_allowlist',    'Admin allowlist'),
    ('005',     'view',   'volunteer_skill_counts', 'Tracker breakdown views'),
    ('007',     'column', 'interests.user_id',  'Interest ownership'),
    ('008',     'table',  'bug_reports',        'Bug reports'),
    ('009',     'table',  'network_members',    'Skill network membership'),
    ('010',     'table',  'matching_invitations', 'Matching engine'),
    ('011',     'column', 'submissions.idempotency_key', 'Intake idempotency')
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
  end as applied
from expected e;

comment on view migration_state is
  'Read-only migration ledger for the admin diagnostics page. Reports whether '
  'each migration''s distinguishing object exists. Never written to.';

-- Answers the question the deleted write probe was really asking — would the
-- public form's INSERT be refused? — from the GRANT layer rather than by
-- performing the insert. `permission denied for table submissions` was the
-- single most common failure this project hit, and it is a privilege fact, so
-- it can be read as one.
create or replace function has_submissions_insert()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select has_table_privilege('service_role', 'public.submissions', 'INSERT');
$$;

comment on function has_submissions_insert() is
  'Diagnostics helper: whether service_role may INSERT into submissions. '
  'Read-only; replaces the diagnostic write probe that inserted and deleted a '
  'fake registration on every GET.';

-- New objects need the same explicit grant migration 003 makes, since default
-- privileges only cover objects created after that statement ran.
grant select on migration_state to service_role;
grant execute on function has_submissions_insert() to service_role;
