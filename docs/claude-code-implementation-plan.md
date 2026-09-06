# HRN platform implementation plan for Claude Code

**Project:** Help Rebuild Nepal  
**Repository:** `/Users/samirkadariya/Developer/HRN`  
**Date:** 6 September 2026  
**Status:** Ready for implementation planning and phased execution

## Copy-paste brief for Claude Code

You are working in the Help Rebuild Nepal repository. Implement the plan in this document in small, reviewable phases. Preserve existing behavior unless this plan explicitly changes it. Inspect the current source, migrations, tests, and README before editing. Do not invent production data, do not send real emails during local tests, and do not weaken authentication or authorization to make a flow easier.

The product goal is to move a person from registration or request intake to a safe, explainable, confirmed contribution:

```text
volunteer registration → verified profile → mission interest or suitable need
need intake → verification → role brief → explainable recommendations
volunteer response → both-party confirmation → active work → outcome feedback
```

Start with Phase 0 and Phase 1. At the end of each phase, run the stated checks, update the migration and test notes, and stop for review before beginning the next phase. Use the existing HRN visual language and bilingual routing. The interactive concept at `.lavish/hrn-platform-preview.html` shows the intended journeys and copy; it is a design reference, not production UI code.

## Product decisions that are already made

1. Use a rules-based, explainable matching engine. Do not add machine learning, embeddings, or opaque percentage weights in this implementation.
2. A mandatory requirement evaluates as `pass`, `fail`, or `unknown`. `unknown` means “ask for clarification,” not “qualified” and not “rejected.”
3. A recommendation is not an assignment. A volunteer may accept or decline; the requester and volunteer must both confirm before the connection becomes active.
4. Mission selection is an interest signal. It does not prove professional competence. A volunteer can select one or two missions and remains eligible for wider suitable opportunities unless they explicitly enable mission-only invitations.
5. Preserve original submissions and show field provenance where a value may have been a browser default, legacy repair, self-report, admin confirmation, or credential verification.
6. Never publish personal phone numbers or email addresses by default. Share approved contact details only after the relevant coordination step.
7. Keep `unknown`, unavailable data, and zero as separate states in UI, metrics, and APIs.
8. No production email is sent by tests or local development. Use an outbox fake, fixture sender, or dry-run mode.

## Current system to preserve and extend

- Next.js 15, React 19, TypeScript, Supabase, and the existing server-side service-role data access.
- Public routes live under `site/app/[lang]`; admin routes live under `site/app/admin`.
- Core submission intake: `site/app/api/submissions/route.ts`.
- Existing forms: `site/components/RequestForm.tsx`, `site/lib/form-schema.ts`, `site/lib/content.ts`.
- Existing matching modules: `site/lib/matching/engine.ts`, `data.ts`, `actions.ts`, `email.ts`, `worker.ts`, `webhook.ts`, `validation.ts`.
- Existing profile read model: `site/lib/volunteer-profile.ts`.
- Existing public read models: `site/lib/community.ts`, `site/lib/public-needs.ts`, `site/lib/relief-data.ts`, `site/lib/metrics.ts`.
- Existing admin pages: `site/app/admin/(dashboard)/needs`, `volunteers`, `relief`, `diagnostics`, and `team`.
- Existing database migrations are in `site/supabase`. Inspect the latest migration before creating a new one; do not assume a migration is deployed merely because it exists in the repository.

## Phase 0 — baseline and implementation guardrails

### Tasks

- Read `site/README.md`, `site/package.json`, the latest Supabase migrations, and the existing matching tests.
- Record the current output of `npm test`, `npm run typecheck`, and `npm run build` from `site`.
- Add or update a short `site/README.md` section describing the matching worker, email outbox, required environment variables, and local dry-run behavior.
- Add a test helper for authenticated and unauthenticated requests. It must be possible to test ownership rules without using a production Supabase project.
- Add a migration ledger/check to diagnostics that reads migration state without writing a probe during a GET request.

### Exit criteria

- Baseline checks are recorded and passing, or existing failures are documented before implementation.
- No diagnostic GET writes or deletes a database fixture.
- Tests can exercise API authorization and matching state transitions with fake email delivery.

## Phase 1 — protect data and make public states accurate

This phase is a release blocker for all later coordination work.

### 1.1 Verified ownership for volunteer account claims

**Implement:**

- Replace automatic `email_confirm: true` account linking with a single-use claim flow.
- A claim request must prove mailbox ownership using a Supabase email OTP or magic link before attaching the submission to `auth.users`.
- Store only a hashed, expiring claim token if a custom token is needed. Do not place a raw submission UUID in a reusable claim URL.
- Handle old registrations and already-claimed registrations without telling an unauthenticated caller whether another person has an account.
- Add password recovery for returning users.

**Relevant files:** `site/app/api/account/create/route.ts`, `site/app/admin/auth/callback/page.tsx`, `site/components/ClaimAccountForm.tsx`, auth helpers, and a new migration if token storage is required.

**Acceptance tests:** wrong mailbox cannot claim; expired token fails; token is single-use; a verified owner can claim; already claimed submission cannot be claimed by another user; no account is marked verified before mailbox proof.

### 1.2 Authorized, verifiable uploads

**Implement:**

- Issue an upload capability only as part of an authorized submission flow, or require an authenticated owner/verified requester session.
- Enforce maximum file count, total bytes, per-file bytes, and an allowlist of actual file types.
- Check object existence, size, content type, and file signature before inserting into `documents`.
- Reject paths outside the submission’s authorized namespace.
- Return per-file status to the form. A failed attachment must not turn the entire request into an unexplained success or force a duplicate resubmission.

**Relevant files:** `site/app/api/uploads/sign/route.ts`, `site/app/api/uploads/confirm/route.ts`, `site/lib/uploads.ts`, `site/components/RequestForm.tsx`.

**Acceptance tests:** another submission ID cannot be used; a forged MIME type fails; oversize/count-limit files fail; a missing storage object is not recorded; one failed file can be retried; successful retry does not create a duplicate request.

### 1.3 Shared intake validation and idempotency

**Implement:**

- Define a single typed schema shared by client and server for volunteer, need, and relief-offer payloads.
- Validate required identity/contact fields, bounded text lengths, dates, enumerations, quantities, consent, and relief target state on the server.
- Return structured field errors and focus the first invalid field in the form.
- Add an idempotency key with a database uniqueness guarantee. Do not rely on the last 25 rows and a time window to prevent concurrent duplicates.
- Add request size limits, abuse throttling, and upload quotas at the application boundary.

**Relevant files:** `site/app/api/submissions/route.ts`, `site/lib/form-schema.ts`, `site/lib/api.ts`, new validation helpers, migration for idempotency if needed.

**Acceptance tests:** malformed JSON returns 400; missing required fields return field errors; two concurrent identical submissions produce one persisted record; a corrected resubmission is accepted; relief offers cannot target closed/ineligible needs.

### 1.4 Accurate public states and shared publication policy

**Implement:**

- Replace fabricated defaults in real need details with `Not specified` / `Not collected`.
- Disable interest actions on filled, completed, rejected, or unpublished needs.
- Define one server-side `isPublicNeed` / `isPublicProject` rule and use it in boards, details, projects, counts, and public exports.
- Separate query failure from an empty successful query. Include `lastUpdated` or an unavailable state where appropriate.

**Relevant files:** `site/app/[lang]/needs/[id]/page.tsx`, public board components, `site/lib/community.ts`, `site/lib/public-needs.ts`, `site/lib/metrics.ts`.

**Acceptance tests:** missing urgency/headcount never renders as an invented value; public rejected needs disappear everywhere; a filled request cannot collect new interest; failed reads show unavailable state rather than zero.

## Phase 2 — volunteer return journey and nine mission teams

### 2.1 Verified volunteer workspace

Create a secure volunteer workspace with:

- current profile values and source/provenance;
- skill confirmation and optional secondary skills;
- remote/on-site preference, travel scope, dates, hours, contact preference;
- one control to pause/resume new invitations;
- “Ready for invitations” with only the missing matching facts;
- active invitations, accepted connections, and current commitments;
- privacy and contact-sharing controls.

Do not make historical optional fields a hard matching gate. Do not fall back from a database error to “please register again.”

**Relevant files:** `site/lib/volunteer-profile.ts`, account routes, profile components, matching profile tables/actions, and new migration(s).

### 2.2 Mission data model and UI

Create a configurable `missions` table seeded with the nine missions from the email, plus a membership/preferences table containing:

- `volunteer_id`, `mission_id`, `preference_state` (`interested`/`mission_only`), source (`email_reply`/`self_selected`/`admin_recorded`), and timestamps;
- optional `lead_user_id`, purpose, current task, meeting link, and status.

Do not overload the existing skill-network membership table. Existing skill networks remain professional communities; mission membership is explicit interest.

Build:

- mission picker allowing one or two selections;
- real Join/Leave actions with authorization;
- mission detail page with lead, purpose, current task, complementary skills, and next check-in;
- admin ability to record an email reply with source and timestamp;
- mission-only toggle that is explicit and reversible.

**Acceptance tests:** selection is limited to two; order does not imply rank; joining does not grant admin access; mission-only changes matching scope; legacy skill membership does not silently create mission membership; non-replied volunteers stay in the wider pool.

## Phase 3 — shorter intake and requester workspace

### 3.1 Assisted, three-step need intake

Refactor the need flow into:

1. Need: type, short title, description, location/remote, urgency.
2. Contact: name/organization, separate email and phone, consent, optional photos.
3. Review: clear summary, submit, save draft, or request phone assistance.

Keep detailed role requirements in the verification workflow. Complete Nepali translations for labels, hints, errors, confirmation, and email links. Use a phone/WhatsApp-assisted path that records source and consent.

### 3.2 Secure requester management

Provide a verified requester link or account that can:

- view status, reference, assigned coordinator, and questions;
- update the request and trigger re-review for material changes;
- close and reopen the request;
- view proposed volunteer summaries;
- confirm or decline a proposed connection;
- record whether support met the need.

Use optimistic concurrency/version numbers so edits cannot silently overwrite a newer coordinator update.

**Acceptance tests:** requester can recover access through verified contact; public pages never expose management controls; material edits pause/review affected invitations; requester close/reopen is auditable; phone-assisted requests have the same state model.

## Phase 4 — matching operations and Situation Room

### 4.1 Matching behavior

Keep the current explainable engine, extending it with:

- field-level unknown reasons and clarification questions;
- versioned invitation attempts so cancelled/expired invitations can be reconsidered after a material change;
- current availability freshness and refresh requests;
- explicit mission preference scope;
- separate capacity for role slots and volunteer commitments;
- stable, fair tie-breaking with a stored seed;
- no hidden reputation score and no demographic proxy features.

Use three admin sections: `Ready for invitation`, `Needs confirmation`, and `Not currently suitable`. Show every pass/fail/unknown reason.

### 4.2 Situation Room

Create one action queue covering:

- needs awaiting verification;
- unanswered clarification questions;
- stale volunteer profiles;
- accepted invitations awaiting coordination;
- delivery follow-ups;
- unresolved requester or volunteer feedback;
- overdue tasks.

Every item needs `owner`, `next_action`, `due_at`, `priority`, and an append-only activity log. Add search, mission/skill/status filters, pagination, handover view, and queue-age metrics.

### 4.3 Email worker safety

- Keep all outbound messages in an outbox.
- Make worker retries idempotent and visible.
- Monitor oldest queued item, failed deliveries, webhook failures, and last successful worker heartbeat.
- GET requests must never accept/decline an invitation or consume a token.
- Send requester contact details only after the volunteer expresses interest and the sharing scope is approved.

**Acceptance tests:** no email is sent before admin approval; accept/decline requires POST; duplicate worker runs do not duplicate sends; bounced mail creates a follow-up; accepted response produces coordinator action; both-party confirmation is required before active connection.

## Phase 5 — relief delivery and project outcomes

### 5.1 Supplies

Add an explicit item-need intake and stages: `requested`, `pledged`, `reserved`, `dispatched`, `received`, `closed`. Support partial quantities, remaining demand, delivery arrangements, recipient confirmation, and private delivery contacts.

### 5.2 Projects

Give every project a lead, task list, milestones, latest update, output links, requester confirmation, and redacted public progress. Prevent duplicate promotion and ensure project visibility follows its parent need.

**Acceptance tests:** pledged and received quantities are different; partial receipt updates remaining demand; closed/fully allocated needs cannot collect misleading pledges; project completion requires an outcome record; sensitive roster/contact data remains private.

## Phase 6 — quality, localization, mobile, and operations

- Complete English/Nepali translations across forms, emails, matching, errors, and response pages.
- Test at 320px/desktop widths, keyboard navigation, focus order, zoom, screen reader labels, and touch targets.
- Add draft saving, compressed photo uploads, retryable uploads, and clear saved/queued/sent states.
- Add CI for typecheck, tests, build, migration checks, and critical browser flows.
- Add PostgreSQL integration tests for ownership, concurrent idempotency, invitation lifecycle, and role capacity contention.
- Add structured logs and alerting for queue age, delivery failure, stale data, and public read failures.
- Add safe staging/production separation, migration deployment checks, backup restoration verification, and a release checklist.

## Required test matrix

At minimum, automated tests must cover:

| Area | Scenarios |
| --- | --- |
| Ownership | wrong email, expired claim, reused claim, already claimed record |
| Uploads | unauthorized submission, forged type, oversize, missing object, partial retry |
| Intake | malformed body, missing required field, corrected retry, concurrent duplicate |
| Matching | pass/fail/unknown, stale availability, mission-only, paused volunteer, role capacity |
| Invitations | admin approval, POST response, GET prefetch, expiry, cancellation, retry, bounce |
| Requester | update, re-review, close, reopen, both-party confirmation, outcome feedback |
| Relief | pledge, partial receipt, remaining quantity, closed item need |
| Public reads | rejected parent need, query failure, unknown value, filled need |
| Accessibility | keyboard form completion, focus on errors, bilingual labels, mobile layout |

## Definition of done

The implementation is ready for a pilot only when:

- an existing volunteer can securely reclaim and update their profile without duplicate registration;
- a volunteer can select up to two missions and control whether invitations are mission-only;
- a real or assisted need can be submitted, verified, matched, accepted/declined, confirmed by both sides, and closed with outcome feedback;
- the coordinator can see every pending action, owner, due date, and activity history;
- public pages show only eligible records and never invent unknown values;
- no unauthorized account claim, upload, export, or contact disclosure succeeds;
- the email worker is idempotent, observable, and dry-run tested;
- `npm test`, `npm run typecheck`, `npm run build`, migration checks, and critical browser flows pass;
- English and Nepali journeys have been manually reviewed on mobile and desktop;
- staging has completed one end-to-end pilot before production rollout.

## Suggested Claude Code execution sequence

```text
1. Inspect repository, migrations, tests, and current implementation.
2. Run and record the baseline checks.
3. Implement Phase 1. Add tests and migration. Run all checks.
4. Implement Phase 2. Add mission seed data and tests. Run all checks.
5. Implement Phase 3. Test requester and assisted intake flows.
6. Implement Phase 4. Test matching, queue, and email lifecycle.
7. Implement Phase 5. Test supplies and project outcomes.
8. Implement Phase 6. Run mobile, bilingual, accessibility, and release checks.
9. Prepare a staging pilot report with unresolved risks and evidence.
```

Do not begin Phase 2 until Phase 1 has passed review. Do not enable automatic invitation sending for a new role until one complete pilot has been observed by a coordinator.
