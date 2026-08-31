-- Migration 003 — give service_role table privileges.
--
-- Run once in the Supabase SQL editor, after 002. Safe to re-run.
--
-- The bug this fixes: every read returned nothing and every write failed with
--
--   [42501] permission denied for table submissions
--
-- which is easy to misread as a row-level-security rejection. It is not. RLS
-- refusals say "new row violates row-level security policy". "permission denied
-- for table" is the *GRANT* layer, one level below RLS, and the two are
-- independent:
--
--   * service_role has BYPASSRLS, so no RLS policy can ever block it.
--   * BYPASSRLS grants nothing. A role still needs SELECT/INSERT/UPDATE/DELETE
--     privileges on each table before it may touch it at all.
--
-- Supabase normally hands service_role those privileges through default
-- privileges on the public schema, so tables created in the dashboard pick them
-- up automatically. That did not happen for this project's tables, so the
-- grants are made explicit here rather than relying on it.
--
-- Only service_role is granted anything. anon and authenticated are deliberately
-- left with no privileges on these tables: the browser never queries them
-- directly (it only ever calls this app's own API routes), so any grant to those
-- roles would widen the attack surface for no benefit. Combined with RLS enabled
-- and no policies, that is two independent layers keeping public keys away from
-- submitted personal data.

grant usage on schema public to service_role;

-- Covers every table and view created by schema.sql and 002, including the
-- item_need_pledged view.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- So a table added by a later migration is not silently unreadable again.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
