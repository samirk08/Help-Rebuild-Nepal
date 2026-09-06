-- Migration 011 — optimize admin team listing with a join view.
--
-- Run once in the Supabase SQL editor, after 010. Safe to re-run.

create or replace view admin_team_with_auth with (security_invoker = true) as
  select
    a.user_id,
    a.email as admin_email,
    a.added_at,
    u.email as auth_email,
    u.last_sign_in_at
  from admin_users a
  left join auth.users u on a.user_id = u.id;

revoke all on admin_team_with_auth from public;
revoke all on admin_team_with_auth from anon, authenticated;
grant select on admin_team_with_auth to service_role;
