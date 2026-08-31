-- Migration 007 — attribute an expression of interest to an account.
--
-- Run once in the Supabase SQL editor, after 006. Safe to re-run.
--
-- The problem this fixes: `interests` predates volunteer accounts, so it
-- recorded only the free-text contact someone typed. The profile page matched
-- those rows to a registration by normalising that contact and comparing it to
-- the registration's email and phone — which meant two people who registered
-- with the same phone number, common where a household shares one, would each
-- see the other's interests on their own profile.
--
-- Nothing sensitive was exposed by that (need ids are public, and no contact
-- details were rendered), but "these are the needs you offered to help with"
-- has to be true of the person reading it, not of anyone reachable on the same
-- number.
--
-- Deliberately NOT backfilled. The only way to attribute the existing rows is
-- the same fuzzy contact match being removed here, and guessing once into
-- stored data is worse than guessing at render time: it would look like fact
-- afterwards. Rows written before this stay unattributed and simply do not
-- appear on anyone's profile.
--
-- on delete set null, for the same reason as submissions.user_id: deleting an
-- account must never destroy the record of who offered to help, which is what
-- the coordination team works from.

alter table interests
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists interests_user_id_idx on interests (user_id);
