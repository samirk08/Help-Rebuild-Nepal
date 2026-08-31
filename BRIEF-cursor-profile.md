# Brief for Cursor — T3: the volunteer profile page

Repo: `Help-Rebuild-Nepal`. All paths below are relative to `site/`.
Branch off `main` as `feat/volunteer-profile`. **Do not** touch any file outside
the "Files you own" list — Codex is working in parallel on
`app/[lang]/account/`, `app/api/account/` and `components/ClaimAccountForm.tsx`.

## The problem

`/profile` currently renders a fake skeleton: "Your name", every field an em
dash, "Profile completeness 0%", behind a banner reading "Preview of the profile
you get after registering." It looks broken rather than empty, and it shows the
same thing to everyone because it reads no data at all.

## Goal

Two real states.

**Signed out** — not a dash-filled mock. A short page: what a profile is for,
a "Sign in" button to `/[lang]/account/login`, and "Not registered yet?" linking
to the volunteer form. No fake rows.

**Signed in** — their actual registration:
- Name, district, primary skill from their submission
- **Status**, prominently: Submitted → Under review → Verified. This is the
  single most valuable thing on the page. Right now someone registers and hears
  nothing ever again. Reuse `components/StatusTimeline.tsx`.
- Expertise, availability, deployment, resources — read from `fields` jsonb
- Anything they've expressed interest in (`interests` table, by `need_id`)
- Real profile completeness: fraction of `VOLUNTEER_SECTIONS` fields answered

## Hard requirements

1. **Server component. Never trust a client-supplied id.** Read the session
   user server-side, then query with `supabaseAdmin()` filtered by
   `user_id = <session user id>`. A user must never be able to request someone
   else's profile by changing a parameter.
2. **Do not add RLS policies and do not grant `anon`/`authenticated` table
   access.** Reads stay server-side through the service key. See the header
   comment in `supabase/003-service-role-grants.sql`.
3. **`export const dynamic = "force-dynamic"`** — it reads live rows. Without
   it the build tries to query Supabase with no credentials and fails.
4. **Unclaimed registrations must keep working.** Two volunteers registered
   before accounts existed; their rows have `user_id = NULL`. Nothing you write
   may modify, hide, or break them. The profile simply has nothing to show for
   a user who has not claimed one — handle that as its own state, not an error.
5. Render field labels via `renderSubmissionFields()` in `lib/admin-render.ts`
   so labels match the form the person actually filled in.
6. Every user-facing string goes in `lib/added-strings.ts` with **both** `en`
   and `np`. `lib/content.ts` is auto-generated — never edit it.
7. Match the existing visual language: `app/globals.css` tokens and classes
   (`.card`, `.rowlist`, `.fact__k` / `.fact__v`, `.panel`, `.btn`). Do not add
   Tailwind or any component library.

## Files you own

Modify:
- `app/[lang]/profile/page.tsx`
- `lib/added-strings.ts` — append your keys at the end of each block

Create:
- `lib/volunteer-profile.ts` — the read layer

You may **read** but not edit: `lib/admin-render.ts`, `lib/form-schema.ts`,
`components/StatusTimeline.tsx`.

## Acceptance criteria

- [ ] Signed out, `/en/profile` shows a sign-in prompt with no fake data and no dash rows.
- [ ] Signed in with a claimed registration, it shows that person's real answers.
- [ ] Signed in with no claimed registration, it says so clearly and links to the form.
- [ ] Status timeline reflects the row's actual `status`.
- [ ] Completeness is computed, not hardcoded.
- [ ] The two pre-existing `user_id IS NULL` registrations are unchanged in the admin dashboard.
- [ ] `npx tsc --noEmit` and `npm run build` are clean.
- [ ] Renders correctly at a 390px-wide viewport and in both `/en/` and `/np/`.

## Out of scope

Sign-in and account creation (Codex owns those), password reset, and editing
the registration — read-only for now.
