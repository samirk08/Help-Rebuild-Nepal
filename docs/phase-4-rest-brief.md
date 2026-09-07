# Build brief — rest of Phase 4

**Repo:** `samirk08/Help-Rebuild-Nepal` · work inside `site/`
**Branch from:** `main`
**Spec:** sections 4.1 and 4.3 of `docs/claude-code-implementation-plan.md`
**Migration number:** next is **017**

Phase 4.2 (Situation Room) is done and merged. Two pieces remain.

**Read `docs/situation-room-brief.md` sections 3 and 7 first.** Every convention
and every past mistake listed there still applies — migrations re-declaring the
`migration_state` ledger, `--test-concurrency=1`, relative imports in tests,
PGlite for database guarantees, the wiring test, and the rule that unknown /
unavailable / zero are three different states. Do not re-read them here; they
are not repeated.

---

## Part A — Clarification questions (4.1)

### The gap

`lib/matching/engine.ts` already returns a `question` string on every check
whose result is `unknown` — "Can you offer structural engineering for this
role?", "Are you available from 10 through 23 September?". Nothing stores,
sends, or answers them. A coordinator sees the question on screen and has to
copy it into an email by hand, and the answer never comes back into the system.

That is why the Situation Room has no "unanswered clarification questions"
item: there was nothing to derive it from. Adding that is the point of this
work.

### Build

**Migration 017** — a table for asked questions and their answers:

```sql
create table if not exists matching_questions (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references submissions(id) on delete cascade,
  role_id       uuid references matching_roles(id) on delete set null,
  -- The engine's own check key, e.g. 'skill:engineering', 'dates', 'hours'.
  check_key     text not null,
  question      text not null,
  asked_by      uuid references auth.users(id) on delete set null,
  asked_at      timestamptz not null default now(),
  answer        text,
  answered_at   timestamptz,
  -- 'open' | 'answered' | 'withdrawn'
  state         text not null default 'open'
                check (state in ('open','answered','withdrawn'))
);
```

Decide and justify in the PR:

- whether a repeat of the same `check_key` for the same volunteer should be one
  row updated or a second row (history vs noise — there is a real argument
  either way);
- whether answering should write back into `matching_profiles.facts`, or only
  record the answer for a human to apply. **Recommendation: record only.** An
  answer typed into an email is not the same evidence as a volunteer confirming
  their own profile, and the plan is explicit that provenance matters. If you
  disagree, argue it.

**Kind guard:** `volunteer_id` must be a volunteer submission. Copy the trigger
pattern from `mission_member_kind()` in `013-missions.sql`.

**Asking a question** — a coordinator action from the existing matching panel
(`components/MatchingPanel.tsx`, `lib/matching/actions.ts`). It should offer the
questions the engine already generated for that volunteer/role rather than a
blank box, because those are the ones that actually unblock a match.

**Delivering it** — reuse `matching_email_outbox`. Note its
`unique(invitation_id, kind)` constraint and that `kind` is a CHECK list of
three values; you will need to extend that list, and questions are not tied to
an invitation. Work out the cleanest change and say what you chose. Do **not**
send mail outside the outbox — `MATCHING_EMAIL_ENABLED` gating and the
idempotent worker are the only reason nothing has been double-sent.

**Answering** — the volunteer answers from a token link, exactly like
`matching_respond`. **A GET must never record an answer.** That rule is already
enforced for invitation responses; hold it here too, and test it.

**Then wire it into the Situation Room:** add an `unanswered_question` item kind
to `lib/situation/keys.ts` and derive it in `lib/situation/derive.ts` from
`matching_questions where state = 'open'`. Follow the existing kinds exactly.

---

## Part B — Email worker safety and monitoring (4.3)

Most of this already exists and is tested. Do not rebuild it:

- every outbound message goes through `matching_email_outbox`
- retries are idempotent, with a lease (`locked_until`) and a failure path
- `matching_respond` is the only way to accept or decline, and GET cannot reach
  it
- delivery events are recorded idempotently, out-of-order safe

**What is missing is visibility.** Build:

1. **A worker health read model** — `lib/matching/health.ts`, returning a
   `ReadResult` (see `lib/publication.ts`):
   - oldest `pending` item and its age
   - counts by status: pending, sending, failed, cancelled
   - failed deliveries (`delivery_status` like `email.bounced`) in the last 7 days
   - webhook failures
   - last successful worker run — **you will need somewhere to record a
     heartbeat**, because nothing does today. A `worker_runs` table in migration
     017 is the obvious answer.
2. **Surface it on Admin → Diagnostics**, in the existing check-row format
   (`app/admin/(dashboard)/diagnostics/page.tsx`). Follow the `critical` vs
   optional distinction already there: a stuck queue is not the same as an
   unapplied optional migration, and the banner must not cry wolf.
3. **Situation Room already derives `email_stuck`.** Make sure your health
   numbers and that queue item agree; two screens disagreeing about whether
   mail is flowing is worse than one.

**Do not** add alerting, external monitoring, or a cron. Read models and the
existing pages only.

---

## Definition of done

- `npm run typecheck`, `npm test`, `npm run build` pass from `site/`.
- Tests cover, at minimum:
  - a question can be asked, appears as `open`, and is answerable exactly once;
  - **a GET cannot record an answer**;
  - answering does not silently rewrite `matching_profiles.facts` (or, if you
    argued otherwise, that it records provenance when it does);
  - `matching_questions` kind guard rejects a non-volunteer;
  - the Situation Room derives an `unanswered_question` item and stops deriving
    it once answered;
  - worker health reports unavailable — not zero — when the read fails;
  - migration 017 is re-runnable and appears in `migration_state`.
- README updated: migration range, plus a short note on the question lifecycle.
- One PR against `main`. State what you deferred and why.

---

## Review

Reviewed against the definition of done above, plus section 3.7 of the
Situation Room brief. Two things get looked at hardest:

1. **Nothing sends mail outside the outbox.** That invariant is why no message
   has ever been double-sent here.
2. **A recorded answer is not the same as a confirmed fact.** Provenance is a
   stated product decision, not a detail.

Flag anything in this brief you think is wrong — several calls here are
judgement, and a good argument beats the brief.
