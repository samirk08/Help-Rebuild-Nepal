# Build brief — Phase 4.2, the Situation Room

**Repo:** `samirk08/Help-Rebuild-Nepal` · work inside `site/`
**Branch from:** `main` (Phases 0–3 are merged; PR #22 for 4.1 may or may not be)
**Spec:** section 4.2 of `docs/claude-code-implementation-plan.md`

Read this whole brief before writing code. It contains conventions this
codebase enforces with tests — several of them will fail your build if you
guess instead of following them.

---

## 1. What you are building

One action queue for coordinators, at `/admin/situation`. Today a coordinator
has to open five different screens and hold the state in their head. The
Situation Room is the single list of *what needs a human next*.

It covers, per the plan:

- needs awaiting verification
- unanswered clarification questions
- stale volunteer profiles
- accepted invitations awaiting coordination
- delivery follow-ups
- unresolved requester or volunteer feedback
- overdue tasks

Every item must carry **`owner`, `next_action`, `due_at`, `priority`** and an
**append-only activity log**. Add search, filters (mission / skill / status),
pagination, a handover view, and queue-age metrics.

---

## 2. The single most important design decision

**Most queue items are derived, not stored.** "This need is awaiting
verification" is a fact about `submissions.status`, not a row someone should
have to remember to create. If you build a table that a coordinator must
populate by hand, it will drift out of date within a week and the queue will
start lying — which is worse than no queue.

So:

- **Derive** the item list from existing tables (see §4 for exactly which).
- **Store** only what cannot be derived: assignment (`owner`), an explicit
  `due_at`, an explicit `priority` override, snooze/resolve state, and the
  activity log.

Suggested shape (adjust if you have a better one, but justify it in the PR):

```sql
create table if not exists queue_assignments (
  item_key    text primary key,   -- stable id, e.g. 'need_verify:<uuid>'
  owner_id    uuid references auth.users(id) on delete set null,
  due_at      timestamptz,
  priority    text not null default 'normal'
              check (priority in ('urgent','high','normal','low')),
  state       text not null default 'open'
              check (state in ('open','snoozed','resolved')),
  snoozed_until timestamptz,
  updated_at  timestamptz not null default now()
);

create table if not exists queue_events (   -- append-only
  id         uuid primary key default gen_random_uuid(),
  item_key   text not null,
  actor_id   uuid references auth.users(id) on delete set null,
  event      text not null,
  detail     text,
  created_at timestamptz not null default now()
);
```

`item_key` is a derived string so an assignment survives even though the
underlying item is recomputed on every page load. Make the key format explicit
and test it.

---

## 3. Conventions this repo enforces — read carefully

These are not style preferences. Several are checked by tests that will fail.

### 3.1 Migrations

- Next number is **016** (015 exists). File: `site/supabase/016-<name>.sql`.
- Must be **idempotent and safe to re-run** — `if not exists`, `create or
  replace`, `on conflict do nothing`. There is a test that runs each migration
  twice.
- **Every migration re-declares the `migration_state` view and adds its own
  row.** Copy the block from the bottom of `015-invitation-attempts.sql`, add
  `('016','table','queue_assignments','Situation Room', false)`. A migration
  that skips this is silently invisible to Admin → Diagnostics. There is a test
  for this in `tests/missions-db.test.ts` and `tests/requester-db.test.ts`.
- End with RLS + grants, matching every other migration:
  ```sql
  alter table queue_assignments enable row level security;
  revoke all on queue_assignments from public, anon, authenticated;
  grant all on queue_assignments to service_role;
  ```
- If a table is an audit log, block UPDATE/DELETE with a trigger — see
  `request_events_append_only()` in `014-requester-workspace.sql`. "The app
  promises not to edit it" is not an audit log.

### 3.2 Data access and auth

- **All data access goes through `supabaseAdmin()`** (`lib/supabase.ts`,
  service role). The browser never queries Supabase directly. There are no RLS
  policies — RLS is on with nothing granted, and the service role bypasses it.
- **Identity comes from `supabaseServerClient()`** (`lib/supabase-server.ts`,
  cookie-bound), never from a request body. An id in a form is a claim, never
  an authorisation.
- `/admin/**` is gated by `middleware.ts` against the `admin_users` allowlist.
  Your page is under `/admin`, so it is already gated — but **still check
  admin status in every server action**, because actions are POST endpoints
  reachable independently. Copy the `actor()` helper from
  `lib/matching/actions.ts`.

### 3.3 Server actions and forms

- Pattern: `"use server"` module exporting
  `(state: ActionState, form: FormData) => Promise<ActionState>` where
  `ActionState = { error?: string; success?: string }`
  (`lib/matching/validation.ts`).
- Render with `<MatchingActionForm action={...} label={...} lang={...}>`
  (`components/MatchingActionForm.tsx`). Do **not** hand-roll `useActionState`.
- Call `revalidatePath` for affected routes after a write.

### 3.4 There is a wiring test and it will fail you

`tests/wiring.test.ts` asserts that **any component calling `fetch("/api/…")`
is imported by some page**, and separately that specific pages reference the
actions that matter. This exists because we shipped a join button, a mission
data model and a diagnostics ledger that were all correct and all referenced by
nothing — typecheck, tests and build cannot see dead wiring.

If you add a component that talks to the backend, render it. If you add server
actions for the queue, add an assertion to `wiring.test.ts` that the Situation
Room page references them.

### 3.5 Tests

- Location `site/tests/*.test.ts`, compiled by `tsc -p tests/tsconfig.json`
  into `.test-build/`, run with `node --test --test-concurrency=1`.
- **Use relative imports in tests** (`../lib/foo`), not the `@/` alias — the
  test build uses CommonJS/Node resolution and `@/` will not resolve.
- **A test that only reaches a module through a runtime `require` will not
  compile that module into the build.** Import it statically too. This exact
  mistake shipped once.
- **Database guarantees are tested against a real Postgres** via PGlite
  in-process — see `tests/requester-db.test.ts` for the setup pattern (create
  `auth` schema and roles, load `schema.sql`, then the migrations you need).
  Anything the *database* enforces must be tested there, not against a mock.
- Pure logic is tested against fakes with no Supabase — see `tests/helpers.ts`.
- Do not remove `--test-concurrency=1` from `package.json`. Parallel PGlite
  instances thrash: the suite goes from ~5s to ~90s.

### 3.6 Strings and language

- Every user-facing string lives in `lib/added-strings.ts` and **must have both
  an `en` and an `np` value**. The type makes this a compile error, which is
  deliberate.
- Admin-only screens may be English-only *if* you follow the existing admin
  pages, which are. Do not half-translate.

### 3.7 House rules from the plan — these are judged in review

- **`unknown`, unavailable, and zero are three different states.** Never render
  a failed read as `0` or as an empty list. See `lib/publication.ts`
  (`ReadResult`) for the pattern already in use.
- **Never invent a value.** If a field was not collected, say "Not specified".
- **Never publish personal contact details by default.** Contact is exchanged
  only at both-party confirmation.
- A recommendation is not an assignment; a mission is not a qualification.

---

## 4. Where each queue item comes from

Derive these. Do not create a parallel source of truth.

| Item | Source | Condition |
| --- | --- | --- |
| Need awaiting verification | `submissions` | `kind='need' and status in ('submitted','under_review')` |
| Accepted invitation awaiting coordination | `matching_invitations` | `status='accepted'` |
| Invitation about to expire | `matching_invitations` | `status in ('queued','sent') and expires_at < now() + 24h` |
| Stale volunteer profile | `matching_profiles` | `confirmed_at < now() - 30 days` and not `paused` |
| Unresolved requester feedback | `request_events` | latest `event like 'outcome_%'` with no later coordinator event |
| Requester closed/reopened | `request_events` | `event in ('request_closed','request_reopened')` unacknowledged |
| Requester decision on a proposal | `request_events` | `event in ('proposal_confirmed','proposal_declined')` unacknowledged |
| Failed or stuck email | `matching_email_outbox` | `status='failed'`, or `pending` and `created_at < now() - 1h` |
| Relief item need with no pledges | `item_needs` + `item_need_pledged` | pledged `< quantity` and `needed_by` near |

`request_events` and `matching_email_outbox` already exist. `matching_profiles`,
`matching_invitations`, `matching_roles`, `matching_commitments` come from
migration 010. Read `supabase/010-matching-engine.sql` before touching any of
them.

**Clarification questions:** the matching engine (`lib/matching/engine.ts`)
already produces a `question` string on every `unknown` check. Nothing records
or sends them yet. If you want to include "unanswered clarification questions"
as a real queue item you will need somewhere to store an asked question and its
answer — that is legitimately part of 4.1 and it is **acceptable to defer it**,
provided you say so explicitly in the PR rather than faking the row.

---

## 5. Required behaviour

1. **One page**, `/admin/situation`, added to the admin nav in
   `app/admin/(dashboard)/layout.tsx` (the `NAV` array near the top).
2. Each row shows: what it is, which record it concerns (linked), **owner**,
   **next action**, **due date**, **priority**, and **how long it has been
   waiting**.
3. Actions per item: assign to a coordinator, set due date, set priority,
   snooze, resolve. Each writes a `queue_events` row.
4. **Search** across the item's subject text.
5. **Filters**: type, owner, priority, state, and mission or skill where the
   underlying record has one.
6. **Pagination** — do not render 500 rows.
7. **Handover view**: everything currently assigned to one coordinator, in one
   list, readable in a single screen.
8. **Queue-age metrics** at the top: how many open, oldest item age, count
   overdue. If a read fails, say so — do not show `0`.
9. Resolving an item **must not** mutate the underlying record. Resolving
   "need awaiting verification" does not verify the need; it records that a
   human dealt with the queue entry. Verification stays where it is.

---

## 6. Definition of done

- `npm run typecheck`, `npm test`, `npm run build` all pass from `site/`.
- New tests cover, at minimum:
  - the derived item list produces the right items for a seeded database
    (PGlite);
  - an assignment survives the item being recomputed;
  - `queue_events` cannot be updated or deleted;
  - migration 016 is safely re-runnable and appears in `migration_state`;
  - resolving a queue item does not change the underlying record's status;
  - a failed read renders an unavailable state, not zero.
- `wiring.test.ts` extended for the new page and its actions.
- README updated: migration range, and a short section on how the queue derives
  its items.
- One PR against `main`, with a body that states what you deferred and why.

---

## 7. Things that have already gone wrong here

Offered so you do not repeat them:

1. **Dead wiring.** A correct component, a correct API route, and no page that
   renders it. Shipped three times. This is why `wiring.test.ts` exists.
2. **A checker that cried wolf.** The migration ledger looked for a table by
   the wrong name and reported an applied migration as missing, on a page that
   also said "public forms are likely returning errors". Be exact about names,
   and distinguish "broken" from "optional feature absent".
3. **Constraints that were load-bearing by accident.** A unique index was the
   only thing preventing a declined volunteer being re-invited. Removing it
   would have silently changed behaviour. If you drop or loosen a constraint,
   work out what it was actually doing first.
4. **A failed read rendered as an empty success.** "No items in the queue" and
   "we cannot reach the database" must never look the same.

---

## 8. Review

I will review this against §5 and §6 specifically, plus the house rules in
§3.7. Flag anything in this brief you think is wrong — several decisions here
are judgement calls and a good argument beats the brief.
