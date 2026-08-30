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

`lang` is `en` or `np`. Both are prerendered at build time, and the language
switch preserves whatever page you are on.

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

## What is not wired up yet

The design is explicit that this is a register opening from zero, and the build
keeps that honest rather than showing invented activity:

- **Forms** POST to `app/api/submissions/route.ts`, which validates the payload
  and acknowledges it but does not store it — it returns `persisted: false`.
  Every form therefore carries a standing `NotConnectedBanner` above it saying
  so. **Do not remove that banner until submissions actually persist**: someone
  can spend ten minutes on a nine-section form believing they have registered,
  and in a disaster that is the one way this site could do real harm. Wiring a
  database is a change to that one route file; the fields already arrive named
  and structured.
- **Counts** are zero everywhere, from `lib/metrics.ts`. Set
  `NEXT_PUBLIC_ALLOW_DEMO=1` and append `?demo` to the home page or tracker to
  render the design's sample figures for a stakeholder walkthrough. The env flag
  exists so that nobody on a public deployment can open `?demo` and screenshot
  1,284 registered volunteers as though the register were full.
- **The needs board** has no rows. Its sort and filter controls are wired and
  the table is ready for the first verified request.
- **Need detail** resolves only `/needs/example`, the one worked example the
  design ships. It is marked `noindex`, as is the profile preview.

Money is deliberately out of scope: financial contributions hand off to the
Prime Minister Disaster Relief Fund at `pmdrf.nchl.com.np`. This site never
collects or holds donations.

## Additions beyond the design

The design was a prototype, and using it surfaced gaps. These were added on top:

**Filling in what the prototype stubbed**

- **All 77 districts** (`lib/districts.ts`), grouped by province, behind a
  searchable combobox. The design shipped ten districts plus "Other", which
  meant a municipality outside those ten could not state where it was.
- **Real file upload** for damage photographs, assessments and permits. The
  design asked people to paste a link, which assumes they already have their
  photos hosted — an unreasonable ask from a ward office mid-disaster. There is
  no object storage yet, so the submitted payload is the file manifest; the
  picked files stay client-side ready to hand to an upload call.
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
  [lang]/            one folder per screen; layout.tsx is the root layout
  api/submissions/   form intake
  globals.css        design tokens + every component style
components/          Header, Footer, forms, dialog, toast, counters
lib/
  content.ts         GENERATED — strings, form schemas, translation map
  site-data.ts       presentational tables from the design's render pass
  districts.ts       all 77 districts by province  ← NEEDS NEPALI REVIEW
  added-strings.ts   copy for controls the design did not have  ← NEEDS NEPALI REVIEW
  form-schema.ts     upgrades specific design fields to richer controls
  geo.ts             coordinate parsing for pasted map links
  i18n.ts            dictionary + translator + language-aware paths
  routes.ts          screen -> route map
  metrics.ts         headline counts (currently zero)
scripts/
  gen-content.js     regenerates lib/content.ts from the design file
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
