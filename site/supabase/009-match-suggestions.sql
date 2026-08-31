-- Migration 009 — record what the matching engine thought of a match.
--
-- Run once in the Supabase SQL editor, after 008. Safe to re-run.
--
-- Until now `matches` recorded only that an admin picked someone, which was
-- all there was to record: the picking was done from an alphabetical dropdown.
-- lib/matching.ts now ranks the register against a need and explains why, and
-- the moment a suggestion exists there is a second thing worth writing down —
-- what the engine said about the pairing a person actually accepted.
--
-- That is the only way the weights in DIMENSION_WEIGHTS ever become more than
-- a starting guess. Three columns, all nullable, none of them load-bearing:
--
--   source            where the decision came from. 'suggested' means an admin
--                     clicked a ranked suggestion; 'manual' means they chose
--                     someone the engine had not put in front of them, which
--                     is the more interesting signal of the two — a match the
--                     ranking missed is a rule that needs looking at.
--   suggested_score   the 0-100 fit score at the moment of the click. Stored,
--                     not recomputed, because the answer changes as people
--                     update their registrations and the question being asked
--                     is what the engine believed when the human agreed or
--                     disagreed with it.
--   suggested_rank    1-based position in the list it was picked from. A
--                     coordinator reaching past ten better-ranked people says
--                     something the score on its own does not.
--
-- Nothing reads these to make a decision. They exist so that a later session
-- can ask "of the matches this team accepted, where did the engine put them"
-- and answer it from data rather than from an opinion. Nothing is backfilled:
-- matches made before this migration were made without an engine, and giving
-- them a score after the fact would invent exactly the evidence being
-- collected.

alter table matches
  add column if not exists source text
    check (source is null or source in ('manual', 'suggested'));

alter table matches
  add column if not exists suggested_score int
    check (suggested_score is null or (suggested_score >= 0 and suggested_score <= 100));

alter table matches
  add column if not exists suggested_rank int
    check (suggested_rank is null or suggested_rank > 0);

-- Same rule as migration 003: grant explicitly rather than trusting default
-- privileges, which only cover tables created by the same role. Adding columns
-- does not change the table's grants, so this is belt and braces — and it is
-- cheap next to another round of "permission denied for table matches".
grant all privileges on table matches to service_role;
