# Brief for Codex — T2: volunteer accounts

Repo: `Help-Rebuild-Nepal`. All paths below are relative to `site/`.
Branch off `main` as `feat/volunteer-auth`. **Do not** touch any file outside the
"Files you own" list — Cursor is working in parallel in `app/[lang]/profile/`.

## What exists already (do not rebuild)

- Next.js 15 App Router, React 19, TypeScript. No CSS framework — hand-written
  CSS with design tokens in `app/globals.css`. Reuse existing classes
  (`.card`, `.btn`, `.field`, `.input`, `.notice`, `.panel`).
- Bilingual: every public route lives under `app/[lang]/` with `lang` = `en|np`.
- Supabase Auth already powers the admin dashboard. `lib/supabase.ts` exports
  `supabaseAdmin()` (service role, **server only**); `lib/supabase-browser.ts`
  exports `supabaseBrowserClient()` (anon key).
- `submissions.user_id uuid` and the `admin_users` allowlist exist as of
  migration `supabase/004-accounts.sql`.
- The confirmation page is `app/[lang]/thank-you/page.tsx`. It already receives
  `?kind=` and `?ref=`.

## Goal

Let a volunteer create an account **after** submitting the volunteer form, and
sign back in later. Account creation must never be a precondition of
registering.

```
volunteer form → POST /api/submissions → /thank-you?kind=volunteer&ref=XXXX
                                          └─ "Set a password to manage this"
                                             → account created, submission linked
```

## Hard requirements

1. **Never add friction before submission.** The account offer appears only on
   the confirmation page, after the registration is already saved.
2. **Account creation requires a real, recent submission id.** Create the user
   with `supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true })`.
   Then set `submissions.user_id` for that submission. Reject if the submission
   is older than 24h, is not `kind = 'volunteer'`, or already has a `user_id`.
   This is also what stops drive-by bot signups.
3. **Do not enable public `signUp()` from the browser.** All account creation
   goes through your own server route using the service key. The anon key ships
   in the browser bundle, so anything it can do, anyone can do.
4. **Never put the submission id in a link you email or render as a bare URL.**
   The confirmation page already holds it in memory; pass it through the form.
5. **Do not add RLS policies and do not grant `anon`/`authenticated` access to
   any table.** Every read stays server-side through `supabaseAdmin()`, filtered
   by the session user's id. This is a deliberate two-layer model — see the
   header comment in `supabase/003-service-role-grants.sql`.
6. **A volunteer account must not reach `/admin`.** It won't, because of the
   `admin_users` allowlist — do not weaken it, and do not add volunteer users
   to `admin_users`.
7. Every user-facing string goes in `lib/added-strings.ts` with **both** `en`
   and `np`. `lib/content.ts` is auto-generated — never edit it.

## Files you own

Create:
- `app/api/account/create/route.ts` — POST `{ submissionId, email, password }`
- `app/[lang]/account/login/page.tsx` — volunteer sign-in
- `components/ClaimAccountForm.tsx` — the "set a password" form
- `lib/volunteer-auth.ts` — `currentVolunteer()` returning the session user, or null

Modify:
- `app/[lang]/thank-you/page.tsx` — render `ClaimAccountForm` when `kind=volunteer`
- `lib/added-strings.ts` — append your keys at the end of each block
- `lib/routes.ts` — add `accountLogin: "/account/login"`

## Acceptance criteria

- [ ] Submitting the volunteer form still works unchanged if the user ignores the account offer.
- [ ] Setting a password creates an account and sets `submissions.user_id` on **that** submission.
- [ ] Signing out and back in at `/en/account/login` restores the session.
- [ ] Reusing the same submission id a second time is rejected.
- [ ] A submission id belonging to a `need` is rejected.
- [ ] Signed in as a volunteer, `GET /admin` redirects to `/admin/login`.
- [ ] Signed in as a volunteer, `GET /api/admin/export?kind=volunteer` returns **401**.
- [ ] `npx tsc --noEmit` and `npm run build` are clean.
- [ ] Both `/en/...` and `/np/...` render.

## Out of scope

Password reset (blocked on custom SMTP), the profile page itself (Cursor owns
it), and anything under `app/admin/`.
