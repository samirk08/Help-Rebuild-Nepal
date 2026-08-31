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
npm test           # the matching engine's rules, via node --test
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
| Matching queue | `/admin/matching` |

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
(`documents`, `item_needs`, `matches`, `projects`). `matches` also records
where a match came from and what the engine scored the pairing at the moment a
person accepted it — see **Matching**.

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
- **Project promotion is manual** — an admin promotes a need to a standing
  project from that need's `/admin/needs/[id]` page. Volunteer matching is no
  longer manual; see **Matching** below.
- **The engine ranks; it never assigns.** Nothing writes a match by itself —
  see **Matching** below for why that is the design and not caution.

## Matching

Volunteers are ranked against needs by `lib/matching.ts`. It replaces the part
of the coordination job that does not scale — reading the whole register
against every request — and none of the part that should not be automated.

**It suggests; a person decides.** `createMatch` in `lib/admin-actions.ts` is
still the only thing that records a match, and it still runs from a button a
coordinator clicks. That is the design, not caution about a new feature:
sending someone to a site turns on things the platform cannot see — who is
actually reachable, what the ward office already arranged, whether a person is
safe to send — and a coordination desk that assigns people automatically is a
desk nobody can be held responsible for.

**Rules, not a model.** There is nothing to learn from — `matches` holds the
handful of decisions made by hand, not a labelled training set — and a
suggestion has to be arguable to a coordinator dispatching someone and to the
volunteer deciding whether to travel. Every score decomposes into named
dimensions with the answers behind them. This is also where the humanitarian
tools that already do this land: Sahana Eden, the most widely deployed
disaster-management platform, matches through structured search over skills,
availability and location.

**How a score is built.** Two stages, kept apart:

1. **Hard gates** decide whether a pairing is possible at all. Someone who said
   they cannot leave their district is not a weak match for work two provinces
   away, they are not a match. Every gate is something a person actually
   stated, never an inference, and blockers are returned rather than swallowed
   — the ruled-out list is on screen, because "nobody matched" and "eleven
   people matched and every one said they cannot travel" need different things
   from a coordinator.

2. **Seven weighted dimensions** rank what is left: skill 30, location 22,
   availability 16, experience 12, commitment 10, resources 6, language 4. Each
   returns a 0–1 ratio, or **null when the answer it needs was never given**.
   Nulls drop out of both halves of the average rather than scoring zero — the
   register is full of half-filled optional sections and a blank is not a bad
   answer — and what that costs is reported as `confidence` instead of hidden.

Location carries real weight on evidence rather than intuition: the UNDP review
of the 2015 Gorkha earthquake found local volunteers, who knew the ward and
could be there the same day, were what made the response work. Distance comes
from district-headquarters coordinates in `lib/districts.ts`, banded rather
than reported — a straight line between two towns in this country can be a
ridge, and it is never shown to anyone as a travel distance.

**Skill sets a ceiling, not just a share.** The dimensions are not independent:
six of them ask how easily someone could do the work, and skill asks whether
they can do it at all. Before that was separated out, a doctor who lived in the
ward, was free all month and spoke the language scored 66 against a request for
a structural engineer — sixth on the shortlist, above people who could do the
job. A skill ratio now caps the whole score as well as contributing its 30
points.

**Urgency and workload are not in the fit score.** A request being urgent does
not make anyone a better match for it, and how busy a volunteer is does not
either. Both belong to ranking, along with confidence and whether a
registration has been verified — all four reorder lists without touching the
number shown beside a name. The workload term is the cheapest form of an
objective the volunteer-assignment literature treats as standing: without it,
the same few well-filled registrations get suggested for everything until those
people stop answering, while requests they cannot take sit empty next to a
register full of people nobody contacted.

**Safeguarding is a rule, not a weight.** Work on health, psychosocial support
or child support puts a volunteer next to people who cannot protect themselves
from them, and the convergence literature is blunt about what disasters draw
alongside the people who come to help. A pairing on one of those skills cannot
be called a strong fit until a person has verified the volunteer, whatever the
arithmetic says. It still appears — hiding it would only mean nobody knows to
check them — with the reason stated. Nothing bridges an adjacent skill into
that work either: those are qualifications, not neighbourhoods.

**Where it shows up**

| Screen | What it does |
| --- | --- |
| `/admin/matching` | The queue. Every open request that still has room, ordered by urgency against how far short it is, each with the people to offer it to. Requests nobody fits are listed separately — that is what recruiting has to go and find. |
| `/admin/needs/[id]` | The register ranked against one request, with each score broken into its dimensions, its reasons and the cautions to check before making contact. The full alphabetical list stays underneath: someone who spoke to the ward office knows things no form asked about. |
| `/admin/volunteers/[id]` | The same engine read the other way — what open requests this person fits. |
| `/[lang]/profile` | "Needs that fit you", bilingual, published needs only. No score number: a volunteer reading a handful of suggestions does not need one, and it would invite a reading it does not deserve. Long shots are filtered out here and kept on the admin side, where a coordinator is choosing between everyone. |

**Tuning it later.** The weights are a starting point, not a finding. Migration
009 records, for every match a person accepts, where it came from and what the
engine scored it at the time — including when a coordinator reached past the
ranking entirely, which is the more interesting signal of the two. Nothing
reads those columns to make a decision; they exist so the weights can stop
being a guess on evidence rather than opinion.

**Tests.** `npm test` runs the engine's rules through `node --test` — no test
framework, no database, no new dependency, because the engine is a pure
function of two plain objects. `tests/scenario.ts` is a hand-run sanity check
that prints a whole ranking for a person to look at; it is what caught the
doctor sitting sixth on the engineering shortlist, which every individual rule
passed.

**Scale.** Candidates are scored in the app, capped at 1,000 rows per query. At
hundreds to a few thousand registrations that is a few milliseconds on a query
that had to run anyway. The move if the register outgrows it is a Postgres
prefilter (district and skills are already indexed, skills with GIN) narrowing
the pool before it reaches the engine — not a rewrite.

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
   through `009-match-suggestions.sql`). Every migration is safe to
   re-run, so running the whole set again on an existing project is fine.
3. Create a **private** Storage bucket named `submissions` (Storage -> New
   bucket -> uncheck "Public bucket").
4. Invite each teammate in Auth -> Users -> Invite user.
5. Import this repo into Vercel; add the five environment variables above in
   the project's Settings -> Environment Variables.
6. Buy a domain from any registrar; add it in Vercel's Domains tab and update
   the DNS records it shows you.
7. If a GitHub Pages source was ever configured for this repo (Settings ->
   Pages), turn it off — Vercel is the only deploy target now.

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
tests/
  matching.test.ts     the engine's rules; `npm test`
  scenario.ts          prints a whole ranking to eyeball, not a test
supabase/
  schema.sql           run once in the Supabase SQL editor
  00*.sql              numbered migrations, run in order after it
lib/
  content.ts           GENERATED — strings, form schemas, translation map
  site-data.ts         presentational tables from the design's render pass
  districts.ts         all 77 districts by province, with HQ coordinates
                       for matching  ← NEEDS NEPALI REVIEW
  added-strings.ts     copy for controls the design did not have  ← NEEDS NEPALI REVIEW
  form-schema.ts       upgrades specific design fields to richer controls; fieldKey()
  geo.ts               coordinate parsing for pasted map links
  relief.ts            relief item categories and the ItemNeed/pledge shapes
  i18n.ts              dictionary + translator + language-aware paths
  routes.ts            screen -> route map
  metrics.ts           every tracker figure, backed by real queries
  matching.ts          the scoring engine — pure, no database, no clock
  match-suggestions.ts the read layer: rows in, ranked suggestions out
  match-copy.ts        signal codes -> sentences, en/np  ← NEEDS NEPALI REVIEW
  supabase.ts          service-role client — server-only, bypasses RLS
  supabase-server.ts   session-aware client for Server Components (anon key)
  supabase-browser.ts  the one browser Supabase client — admin login only
  uploads.ts           browser-side sign -> PUT -> confirm upload flow
  admin-actions.ts     every admin mutation, as Server Actions
  admin-render.ts      renders a submission's raw fields against its form schema
  admin-documents.ts   signed read URLs for uploaded documents
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
