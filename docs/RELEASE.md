# Release and staging

What has to be true before this platform writes to real people, and how to
check it. Written to be worked through in order rather than read.

---

## Environments

Three, distinguished by `HRN_ENV` (or Vercel's own `VERCEL_ENV`, which is
already set on Vercel and needs no configuration):

| | `HRN_ENV` | Supabase project | Email |
| --- | --- | --- | --- |
| Production | `production` | production | delivered to anyone |
| Staging | `preview` or `staging` | **a separate project** | only to `MATCHING_TEST_RECIPIENTS` |
| Local | unset | your own, or none | only to `MATCHING_TEST_RECIPIENTS` |

An unlabelled deployment is treated as **development**, not production. Guessing
the other way would switch the safety below off on a box nobody configured.

### The safety that matters

A staging pilot has to send real email to be a real test, so
`MATCHING_EMAIL_ENABLED=1` gets set there. At that moment a deployment pointed
at a copy of production data can invite an actual volunteer to work that does
not exist.

That is one environment variable away at all times, and no amount of care in a
runbook prevents it. So it is decided in code (`lib/env.ts`): **outside
production, a message is only delivered to an address explicitly listed in
`MATCHING_TEST_RECIPIENTS`.** Anything else is cancelled in the outbox with the
reason recorded, and logged as `email_blocked_outside_production`.

```
MATCHING_TEST_RECIPIENTS=pilot@example.org,@your-coordination-domain.np
```

An entry is either a whole address or an `@domain` suffix. An empty list sends
nothing at all — a staging pilot that delivers no mail is an afternoon of
confusion; one that emails four hundred volunteers is not recoverable.

**Staging must use its own Supabase project.** Not a schema, not a prefix: a
separate project with its own keys. Two reasons — the guard above is the last
line of defence and not the only one that should exist, and a migration run
against the wrong project is the failure this whole document is trying to
prevent.

---

## Before a release

Run in order. Anything that fails stops the release.

### 1. The automated checks

```bash
cd site
npm run typecheck
npm test
npm run build
```

These also run on every pull request. Running them locally before a release
catches the case where `main` is green but your working tree is not what CI saw.

### 2. Migrations

Migrations are numbered and idempotent, and each one re-declares the ledger. Run
any that are new **in order**, in the target project's SQL editor.

Then confirm the deployment agrees, from **Admin → Diagnostics**:

- every migration row reads *Applied*;
- no row is both **critical** and unapplied.

A migration file existing in the repository is not evidence that it has run.
Diagnostics reads the database catalogs, so it is.

Run migrations on **staging first**, and only against production once the pilot
below has completed.

### 3. Accessibility and small screens

```bash
npm run dev
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --remote-debugging-port=9333 --user-data-dir=/tmp/a11y about:blank
node scripts/a11y-audit.mjs 320 /en/volunteer /en/request /en/relief/offer /np/request
```

Expect zero overflow, zero unnamed controls, zero targets under 24px. This is a
manual step because it needs a browser and a running app;
`tests/accessibility.test.ts` covers the statically decidable half on every pull
request.

### 4. Health

```bash
curl -s https://<deployment>/api/health | jq
```

`status` must be `ok`. A non-200 is what an external monitor watches — point one
at this URL so a stopped worker is noticed on Friday rather than on Monday,
when a volunteer says they never got the email.

### 5. Backups, verified by restoring

Supabase takes automatic backups. **An unrestored backup is a belief, not a
backup**, so once before the first production release and once a quarter after:

1. Create a scratch Supabase project.
2. Restore the most recent production backup into it.
3. Point a local checkout at it (`.env.local`) and run:
   ```bash
   npm run dev
   ```
4. Confirm from Diagnostics that the migration ledger is complete, and that the
   volunteer and needs counts match production within the backup window.
5. Delete the scratch project.

Record the date and the row counts somewhere durable. The point of the exercise
is knowing how long a restore takes before the day you need it.

---

## Before the first production pilot

Everything above, plus:

- [ ] **A Nepali speaker has read every translated string.** The Nepali in
      `lib/added-strings.ts` is machine-supplied and marked as such. This is the
      single largest untested assumption in the product. Outbound mail is
      English only and needs no review pass.
- [ ] **Test data is gone from production.** Any registration or need created
      while walking the flows.
- [ ] **Supabase auth email rate limit raised** above the default 30/hour, or
      the first registration drive silently stops sending confirmations.
- [ ] **`MATCHING_EMAIL_ENABLED` is unset or `0` on every non-production
      deployment**, so the allowlist is the second line of defence rather than
      the first.
- [ ] **One complete cycle observed on staging by a coordinator**: a need
      posted, verified, matched, invited, accepted, confirmed by both sides,
      and closed with outcome feedback.
- [ ] **No automatic invitation sending is switched on for a new role** until
      that cycle has been watched. This is the plan's own condition and it is
      the one most easily skipped under time pressure.

---

## When something is wrong

**Read the logs as data.** Every log line is a JSON object with a stable
`event` name (`lib/log.ts`), so filter on the field rather than grepping prose:

| `event` | Means |
| --- | --- |
| `public_read_failed` | a public page could not read; it shows *unavailable*, never zero |
| `email_send_failed` | a delivery attempt failed; `terminal` says whether it will retry |
| `email_blocked_outside_production` | working as intended on staging; a misconfiguration in production |
| `email_worker_run` | one line per run — claimed, sent, failed, cancelled, blocked |
| `health_degraded` | the health endpoint returned 503, with which checks failed |

**Then check, in this order:** Admin → Diagnostics (configuration and
migrations), `/api/health?verbose=1` (queue and worker), the outbox counts on
Diagnostics (whether mail is moving).

A stuck queue does not stop a form saving. Diagnostics distinguishes the two
deliberately, because a banner that claims public forms are failing when they
are not is a banner people learn to ignore.
