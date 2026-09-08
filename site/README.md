# Help Rebuild Nepal

A coordination layer between people who want to help and the communities,
municipalities and organizations that need help.

This is the production site built from the approved Claude Design prototype
(`../Help Rebuild Nepal.dc.html`). Every screen, string and colour in it comes
from that design.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**, strict mode
- **Plain CSS** with design tokens in `app/globals.css` — no CSS framework, so
  the design's exact values survive
- `next/font` for Archivo, Public Sans and Noto Sans Devanagari (self-hosted at
  build time, no third-party font requests at runtime)

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```

## Deploying

Hosted on **Vercel**, not GitHub Pages — an earlier version of this project
briefly moved to a static export for Pages, but a static host cannot run the
database-backed submission API or the admin dashboard below, so that path was
retired. Vercel builds this repo's `site/` directory as a normal Next.js
server app: import the repo in the Vercel dashboard, add the environment
variables from **Backend and database** below, and every push to `main`
deploys automatically. Adding a custom domain is a Vercel dashboard step
(Domains tab); it shows the exact DNS records your registrar needs.

## Routes

Every page lives under a language segment; `/` redirects to `/en`.

| Screen | Route |
| --- | --- |
| Home | `/[lang]` |
| Register as a volunteer | `/[lang]/volunteer` |
| Post a need | `/[lang]/post` |
| Needs dashboard | `/[lang]/needs` |
| Need detail | `/[lang]/needs/[id]` |
| Live impact tracker | `/[lang]/tracker` |
| Relief items board | `/[lang]/relief` |
| Relief item request | `/[lang]/relief/[id]` |
| Offer relief items | `/[lang]/relief/offer` |
| Projects | `/[lang]/projects` |
| Skill networks | `/[lang]/networks` |
| Volunteer profile | `/[lang]/profile` |
| For partners | `/[lang]/partners` |
| Admin dashboard | `/admin` (login at `/admin/login`) |
| Situation Room | `/admin/situation` |

`lang` is `en` or `np`. Both are prerendered at build time, and the language
switch preserves whatever page you are on. `/admin` sits outside the language
segment on purpose — it's an internal tool for the coordination team, not
public bilingual copy.

## Language handling

The design splits its copy two ways, and the site keeps that split:

- **UI strings** live in `STR.en` / `STR.np` in `lib/content.ts` and are read
  through `dict(lang)`. Both languages carry the same 120 keys.
- **Data tables** (form labels, dropdown options, column headings) are written
  in English once and translated at render through `translator(lang)`, backed by
  the 441-entry `NP_MAP`. Anything without an entry falls back to the English
  source rather than rendering blank.

`lib/content.ts` is **generated** from the design file. To pull in copy changes
after the design is updated:

```bash
node scripts/gen-content.js
```

The generator also guards the transfer: it fails if the two languages fall out
of key parity, and it reports duplicate keys instead of letting JavaScript's
last-wins rule quietly drop content.

## Backend and database

Submissions are real: all three forms (volunteer registration, post-a-need,
relief-item offers) write to a Postgres database on **Supabase**, including
uploaded damage photos and documents. The coordination team reviews, verifies
and exports everything from `/admin`.

**Environment variables** (Vercel project settings; see `.env.local.example`):

| Variable | Used by | Exposed to the browser? |
| --- | --- | --- |
| `SUPABASE_URL` | `lib/supabase.ts` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.ts` | **Never** — bypasses every access rule |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase-server.ts`, `lib/supabase-browser.ts` | Yes — safe, it's just the endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | Yes — safe by design, rate-limited, no RLS policies grant it anything (see below) |
| `NEXT_PUBLIC_ALLOW_DEMO` | `lib/metrics.ts` | Yes — set to `1` only for stakeholder walkthroughs |

**Schema:** `supabase/schema.sql`, run once in the Supabase SQL editor. Shape,
in short: `submissions` (volunteers and needs) holds a handful of indexed
columns — `status`, `district`, `province`, `urgency`, contact info — plus the
complete raw form payload in a `fields` jsonb column. That split is
deliberate: `content.ts` regenerates from the design file and can change
field names again, so a rigid column-per-field table would break on the next
regeneration, while `fields` cannot. Relief-item offers are structurally
different (they target a specific `item_needs` row) and live in their own
`pledges` table instead — see the schema file's comments for the rest
(`documents`, `item_needs`, `matches`, `projects`).

A pledge carries two separate facts, and conflating them is the mistake
migration 018 exists to correct. `status` says whether we believe the offer is
real; `stage` (`offered` → `reserved` → `dispatched` → `received`) says where
the goods are. Only `received` — with the quantity that actually turned up,
which may be less than was promised — reduces what a request still needs. Read
the four quantities from `item_need_progress`, never by summing pledges, and
read anything public from `item_needs_public`, which has no delivery contact
columns in it. `project_public_progress` is the same idea for projects: it
carries milestone counts and the latest non-internal update, and no task
assignees.

**Access control is the login gate, not Row Level Security.** Every table has
RLS enabled with zero policies — the service role key
(`lib/supabase.ts`, server-only) bypasses RLS by design and is what every
read and write actually goes through. RLS here is defense in depth (an anon
key accidentally used against these tables would see and change nothing),
not the access boundary. The boundary is `middleware.ts`, which requires a
signed-in Supabase Auth session for `/admin/**` and `/api/admin/**`, checked
again inside every mutation in `lib/admin-actions.ts` and the export route —
a Server Action or route handler can in principle be invoked directly, so the
identity check has to live there too, not only in middleware.

**File uploads never pass through a Vercel function.** A submission is
created first to get its id, then each file is uploaded straight from the
browser to a private Supabase Storage bucket via a short-lived signed URL
(`app/api/uploads/sign/route.ts` mints it; `lib/uploads.ts` does the upload).
That's what lets an 8-file, 10MB-each upload — already promised in
`FileUpload.tsx`'s UI — clear serverless payload-size limits entirely. Viewing
a document in `/admin` mints a separate short-lived signed *read* URL at view
time (`lib/admin-documents.ts`); the bucket is never public.

**Admin login is per-person**, via Supabase Auth — invite teammates from the
Supabase dashboard (Auth -> Users). There is no public sign-up. A verification
action records the actual signed-in user in `submissions.verified_by`, not a
shared identity.

**Counts on the public site are real**, from `lib/metrics.ts` — every figure
on `/[lang]/tracker`, both the five headline tiles and the three cards under
them ("Skills registered", "Registered from", "What is needed"). The two
breakdown cards need a `GROUP BY`, which PostgREST cannot express, so they read
three views created by `supabase/005-tracker-breakdowns.sql` rather than
counting every volunteer row in JavaScript. If those views are missing the
cards fall back to zeros and the page still renders — an unapplied migration
must not take the tracker down.

Two exceptions are stated plainly rather than guessed:

- Two of the five tracker labels ("On the ground, need logistics" /
  "self-supported") describe a split the volunteer form has no field for, and
  stay at zero rather than being estimated from a proxy that might
  misrepresent what someone actually said.
- "Registered from" lists districts, not countries as the design drew it. The
  form asks where a volunteer is based and offers the 77 districts plus one
  "Outside Nepal" entry — it never asks which country — so this reports the
  places people actually gave. Percentages on both breakdown cards are of the
  people who answered that question, so a skipped answer is never counted as
  an answer.

Set `NEXT_PUBLIC_ALLOW_DEMO=1` and append `?demo` to the home page or tracker
to render the design's sample figures for a stakeholder walkthrough instead —
the env flag exists so nobody on the public deployment can open `?demo` and
screenshot a fake full register.

**Still gaps, stated plainly:**

- **Relief item needs have no public creation form.** Nothing in the site lets
  a municipality post "we need 200 tarpaulins" directly — the relief board
  shows demand, but today a staff member creates that row from `/admin/relief`
  until a public form exists.
- **Matching and project promotion are manual**, by design — an admin picks a
  volunteer for a need, or promotes a need to a standing project, from that
  need's `/admin/needs/[id]` page. There is no automated matching engine.
- **Need detail on the public site** (`/needs/[id]`) still resolves only the
  one worked example (`/needs/example`); browsing real published needs is the
  needs board's job, not that route's, and remains a smaller follow-up.

Money is deliberately out of scope: financial contributions hand off to the
Prime Minister Disaster Relief Fund at `pmdrf.nchl.com.np`. This site never
collects or holds donations.

### Account-side setup (do this once)

Code changes alone don't make the backend live — these steps need an actual
Supabase/Vercel account and can't be scripted from here:

1. Create a Supabase project (the free tier is enough at this scale). Copy the
   project URL, anon key and service role key from Project Settings -> API.
2. Paste `supabase/schema.sql` into the Supabase SQL editor and run it once,
   then each numbered migration beside it in order (`002-public-board.sql`
   through `019-project-outcomes.sql`). Every migration is safe to
   re-run, so running the whole set again on an existing project is fine.
   Admin -> Diagnostics reports which ones this deployment actually has;
   a migration file existing in the repository is not evidence it has run.
3. Create a **private** Storage bucket named `submissions` (Storage -> New
   bucket -> uncheck "Public bucket").
3a. Configure Auth email — three settings, none of them optional. The claim
   flow and password recovery both stop working if any is missed, and two of
   them fail in ways that look like a code bug rather than a config gap. See
   "Auth email prerequisites" below.
4. Invite each teammate in Auth -> Users -> Invite user.
5. Import this repo into Vercel; add the five environment variables above in
   the project's Settings -> Environment Variables.
6. Buy a domain from any registrar; add it in Vercel's Domains tab and update
   the DNS records it shows you.
7. If a GitHub Pages source was ever configured for this repo (Settings ->
   Pages), turn it off — Vercel is the only deploy target now.

## Intake, accounts and uploads

Three rules govern everything that writes to the database. They are stated here
because each replaced something that looked like a safeguard but was not.

**Claiming an account is proved by the mailbox, not by holding an id.** A
registration is attached to an `auth.users` row only after a one-time code sent
to the address on that registration comes back. Submission ids travel in URLs
and forwarded links, so they are not secrets; the previous flow created an
`email_confirm: true` account for anyone who had one. Because mailbox control
is now the actual control, there is no time limit on claiming — someone
returning to a months-old registration can claim it rather than registering
again. `/api/account/claim/start` answers identically whether the submission is
unknown, belongs to a different mailbox, or is already claimed, so it cannot be
walked to discover which addresses have accounts. `lib/account-claim.ts` holds
the rules; `lib/account-claim-ports.ts` wires them to Supabase.

**Uploading requires a capability, not an existing row.** `/api/submissions`
returns a short-lived signed ticket (`lib/upload-tickets.ts`) bound to the row
it created; an authenticated owner's session works too and is preferred. Both
upload routes check one of those before signing anything. After the bytes land,
`/api/uploads/confirm` fetches the object's first 32 bytes through a signed URL
and identifies the file from them — a `.png` extension and an `image/png`
declaration are both caller-supplied and neither is checked against the
content. Limits: 8 files, 10MB each, 40MB per submission, counted against what
the submission already holds so a second request cannot reset them.

**Duplicate submissions are prevented by a unique index.** Each form generates
one idempotency key and resends it unchanged on retry, so a dropped response
resolves to the row that already exists. The previous approach compared the
last 25 rows in JavaScript, which two simultaneous requests both pass.

### Mission teams

Nine mission teams (migration 013), seeded with titles only. Purpose, current
task, lead and next check-in are deliberately empty: a mission page that shows
an invented "current task" sends a volunteer to work that does not exist, so
each field says "not set yet" until a coordinator fills it in.

A volunteer chooses **at most two**, and that cap is a database trigger, not a
form check — a limit enforced only in the browser holds until someone opens two
tabs. Selection order carries no meaning; nothing downstream ranks them.

Missions are deliberately separate from the skill networks in migration 009. A
skill network is a professional community — you are an engineer whether or not
you are working on anything. A mission is a capped, reversible statement of
interest in one piece of work. `mission_members` is the source of truth, and a
trigger keeps `matching_profiles.mission_ids` / `.mission_only` in step so the
matching engine sees changes without a second write path.

Choosing a mission does **not** narrow who gets invited to what. Only the
explicit "only invite me to needs within my missions" switch does that, and it
is off by default and reversible in one click.

### Situation Room

The coordinator action queue at `/admin/situation`. Items are **derived** from
existing tables on every load — a need in `submitted` is awaiting verification
whether or not anyone filed a ticket. `queue_assignments` and `queue_events`
(migration 016) store only what cannot be derived: owner, due date, priority
override, snooze/resolve, and an append-only activity log. Resolving a row
records that a human dealt with the queue entry; it does not verify the need,
confirm the invitation, or otherwise mutate the underlying record.

Unanswered matching clarification questions are not in the queue yet. The
engine already produces the question text, but nothing stores an asked
question and its answer.

### Auth email prerequisites

Three Supabase settings the claim and recovery flows depend on. Each one fails
in a way that looks like an application bug, so they are written down here.

**1. The Magic Link template must emit a code, not a link.** `signInWithOtp`
sends a magic link by default, even though the method is named "OTP". The claim
form asks for a six-digit code, so Auth -> Emails -> Magic Link must include
`{{ .Token }}` in its body. Without this, people receive a link, the form they
are looking at asks for a code they were never sent, and clicking the link
signs them in *without linking their registration* — they land on the profile
page being told they have not registered. Nothing in the code can detect this;
the template is the only place it can be fixed.

**2. Custom SMTP is required before any real volunteer uses this.** Supabase's
built-in email service sends about two messages per hour across the whole
project and refuses addresses that are not on the project team. It is for
development. Set a provider under Auth -> Emails -> SMTP Settings, then raise
the ceiling on the Rate Limits page — the default there is 30 messages per
hour, which a registration drive will exceed.

**3. `/{lang}/account/reset` must be on the redirect allow-list.** Auth ->
URL Configuration. `resetPasswordForEmail` is called with that path, and
Supabase rejects a `redirectTo` that is not listed. The existing entry covers
`/admin/auth/callback` only, so this is a new one — add `/en/account/reset` and
`/np/account/reset`, or a wildcard covering both.

### Verifying a migration actually applied

Admin -> Diagnostics reads the ledger and reports each migration, or in the SQL
editor directly:

```sql
select migration, detail, applied from migration_state order by migration;
```

Every row should read `applied = true`. Migration 011 also de-duplicates
`documents` by `storage_path` before adding its unique index; if that table had
repeats from retried confirms, those rows are gone and the earliest of each set
was kept.

### Running the checks

From `site/`:

```bash
npm run typecheck    # tsc --noEmit
npm test             # compiles tests/ then runs node --test
npm run build        # next build
```

`npm test` runs the files one at a time (`--test-concurrency=1`). Three of them
start an in-memory Postgres through PGlite, and running those in parallel makes
them fight over memory: the same suite takes about 4 seconds serially and over
80 in parallel, on a machine sitting at 28% CPU the whole time. Remove the flag
and the wall time grows with every database test added.

`npm test` needs no Supabase project and sends no mail. Everything with a rule
in it — intake validation, the claim rules, upload policy and tickets, the
publication rule — is a pure module tested against fakes (`tests/helpers.ts`).
Anything whose guarantee is the *database's* — idempotency, document
uniqueness, the migration ledger — runs against a real Postgres in-process via
PGlite (`tests/intake-db.test.ts`, `tests/matching-db.test.ts`), because a
constraint can only be tested by the thing that enforces it.

### Email in development

No test or local run sends production mail.

- The matching worker keeps every outbound message in the `matching_email_outbox`
  table and only delivers when `MATCHING_EMAIL_ENABLED=1`. Left at `0`, messages
  queue and can be inspected; `tests/matching.test.ts` asserts that a mocked
  provider still cannot send while it is off.
- The account claim and password recovery go through Supabase Auth's own email
  provider, so they send only from an environment with real Supabase
  credentials. The claim rules are tested against a fake mailbox instead.

### Diagnostics

Admin -> Diagnostics reports configuration and migration state, and is
read-only. It used to insert a fake volunteer registration and delete it again
to test whether writes worked — on a GET, which anything that follows links can
replay, and which left a row named "Diagnostic probe" among real registrations
whenever the delete failed. It now reads the `migration_state` view and asks
the grant layer whether `service_role` holds INSERT, which is what the probe
was really testing.

## Additions beyond the design

The design was a prototype, and using it surfaced gaps. These were added on top:

**Filling in what the prototype stubbed**

- **All 77 districts** (`lib/districts.ts`), grouped by province, behind a
  searchable combobox. The design shipped ten districts plus "Other", which
  meant a municipality outside those ten could not state where it was.
- **Real file upload** for damage photographs, assessments and permits. The
  design asked people to paste a link, which assumes they already have their
  photos hosted — an unreasonable ask from a ward office mid-disaster. Files
  upload straight to private Supabase Storage — see **Backend and database**.
- **Coordinate parsing** (`lib/geo.ts`) for "exact location". Accepts a bare
  pair, a Google Maps link, an OpenStreetMap link or a `geo:` URI, tells the
  person what it understood, and warns when a point falls outside Nepal.
  Landmark descriptions stay text — "Ward 7, 40 houses" must not parse as a
  coordinate, and it does not.
- **Status timeline** replacing the flat dot legend. A request has an order;
  showing the connection is the point of publishing it.
- **Stepper completion** on the form rail, so it reports which sections have
  entries rather than only which panel is open.

**Relief items** (`lib/relief.ts`, `/[lang]/relief`)

Physical supplies — tarpaulins, blankets, rice, hygiene kits — with a
deliberate design constraint: **it is needs-driven, not supply-driven.**

Humanitarian logistics has a name for the alternative, the "second disaster":
unsolicited goods arrive, fill the warehouses and block the roads that needed
goods travel on, and absorb the volunteer labour required elsewhere. Used
clothing is the classic case, which is why every clothing category here is
new-only.

So the offer form asks *which published request are you supplying* first, and
that field is required. Offering unrequested items is still possible — refusing
it would only push the offer off-platform where nobody can see it — but it warns
plainly and the listing carries an `UNREQUESTED` label, mirroring how the design
already labels community-reported needs as unverified.

Every category carries a **unit**, because that is what makes a quantity
matchable: "some blankets" cannot be matched, "200 tarpaulins, 4×6m, Melamchi,
by 15 September" can.

The platform **never takes custody of goods**, exactly as it never takes custody
of money. It records who needs what and who can supply it; the two parties
arrange the handover. There is no warehousing and no chain of custody.

For diaspora donors the honest answer is usually not to ship: international
freight normally costs more than buying the same items in Nepal, relief
consignments need customs clearance that can hold them for weeks, and local
procurement supports Nepali suppliers. That guidance is on the board rather than
buried.

**Motion, without an animation library**

- **Accordion height** transitions via `grid-template-rows: 0fr → 1fr`. The
  9-section request form previously snapped open and shut with no height
  transition and no exit. This is the one thing CSS historically could not do,
  and the usual reason to add a JS animation library — it now does it natively.
- **Reveal on scroll** replacing reveal on mount. The old `.rise` ran during
  first paint for everything, including cards 1,500px down that had finished
  animating before anyone scrolled to them.
- **Exit animations** for the toast and dialog via `@starting-style` and a
  closing state, so they leave rather than vanish.

Easing comes from `--spring-settle`, a `bounce: 0` spring generated with
Motion's CSS tool. Nothing on this site overshoots — Motion's own guidance is
that serious interfaces should not bounce, and this is a disaster platform.

**Deliberately not added: an animation library.** Motion's `motion` component is
34 kB and cannot tree-shake below it. The audience is volunteers and
municipalities in Nepal on low-end Android and metered data, and CSS covers
every animation the site actually has. First Load JS stayed at 103 kB. The
trigger to revisit is the needs board getting rows: FLIP reordering genuinely
is not doable in CSS, and at that point the right shape is `m` + `LazyMotion`
with `domMax` lazy-loaded, not a plain `motion` import.

**Tried and rejected: view transitions on the language switch.** React 19 stable
has no `ViewTransition` component (experimental channel only, not a reasonable
dependency here). Driving `document.startViewTransition` by hand navigated
correctly, but left `updateCallbackDone`, `ready` and `finished` all unsettled
after 3 seconds — the transition hung until the browser aborted it, holding a
full-page snapshot. Reverted to plain links. Worth revisiting when React ships
`ViewTransition` in a stable release.

## Where things live

```
app/
  [lang]/              one folder per screen; layout.tsx is the root layout
  admin/               internal dashboard — outside [lang], its own login
    (dashboard)/       sidebar chrome; login page is a sibling, so it has none
  api/
    submissions/       form intake -> submissions or pledges
    uploads/sign/       mints a signed Storage upload URL
    uploads/confirm/    records a document row after upload
    admin/export/       CSV export, admin-only
  globals.css          design tokens + every component style
components/            Header, Footer, forms, dialog, toast, counters
supabase/
  schema.sql           run once in the Supabase SQL editor
  00*.sql              numbered migrations, run in order after it
lib/
  content.ts           GENERATED — strings, form schemas, translation map
  site-data.ts         presentational tables from the design's render pass
  districts.ts         all 77 districts by province  ← NEEDS NEPALI REVIEW
  added-strings.ts     copy for controls the design did not have  ← NEEDS NEPALI REVIEW
  form-schema.ts       upgrades specific design fields to richer controls; fieldKey()
  geo.ts               coordinate parsing for pasted map links
  relief.ts            relief item categories and the ItemNeed/pledge shapes
  i18n.ts              dictionary + translator + language-aware paths
  routes.ts            screen -> route map
  metrics.ts           every tracker figure, backed by real queries
  supabase.ts          service-role client — server-only, bypasses RLS
  supabase-server.ts   session-aware client for Server Components (anon key)
  supabase-browser.ts  the one browser Supabase client — admin login only
  uploads.ts           browser-side sign -> PUT -> confirm upload flow
  admin-actions.ts     every admin mutation, as Server Actions
  admin-render.ts      renders a submission's raw fields against its form schema
  admin-documents.ts   signed read URLs for uploaded documents
  situation/           Situation Room derivation, loader and coordinator actions
scripts/
  gen-content.js       regenerates lib/content.ts from the design file
```

## Notes on the port

The prototype drew everything with inline styles and `<div onClick>`. Those
became real semantics on the way over, without changing how anything looks:

- Clickable divs are now `<button>` and `<Link>`, so the site is keyboard
  navigable and links can be opened in a new tab.
- Form controls have associated labels; chip and radio sets are labelled groups.
- The needs board is a real `<table>` with `aria-sort` on its headers.
- The example dialog traps Escape, restores focus to whatever opened it, and
  locks background scroll.
- The toast is a polite live region.
- Collapsed form sections use `aria-expanded` / `aria-controls`.
- Motion respects `prefers-reduced-motion`.
