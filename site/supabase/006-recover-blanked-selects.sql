-- Migration 006 — recover the answers a select bug stored as empty strings.
--
-- Run once in the Supabase SQL editor, after 005. Safe to re-run: the WHERE
-- clauses only match the empty string, which no row has once it has run.
--
-- The bug (fixed in components/FormField.tsx, and see isSelectPlaceholder() in
-- lib/form-schema.ts): every dropdown rendered its FIRST option with an empty
-- value, on the assumption that a select always opens with a "Select…"
-- placeholder. Ten of the design's dropdowns do not — they open with a real
-- answer. For those, the option the browser had selected and the person
-- submitted was posted as "", so the answer they gave was thrown away.
--
-- The recovery below is a decode, not a guess. Under the old code an empty
-- string in these ten keys could only have come from choosing option one:
-- every other option carried its own text, and a select always has something
-- chosen. So the value is recoverable exactly, and each statement writes back
-- the first option of the field it names.
--
-- Fields whose first option really is a placeholder ("Select", "Select
-- district", "Select province") are deliberately absent: there, an empty
-- string means unanswered, which is true and stays.

-- --------------------------------------------------------- Volunteer form

update submissions
   set fields = jsonb_set(fields, '{s03-primary-skill}', '"Engineering (structural / civil)"')
 where kind = 'volunteer' and fields->>'s03-primary-skill' = '';

update submissions
   set fields = jsonb_set(fields, '{s05-where-you-can-work}', '"On the ground"')
 where kind = 'volunteer' and fields->>'s05-where-you-can-work' = '';

update submissions
   set fields = jsonb_set(fields, '{s05-travel}', '"Anywhere in Nepal"')
 where kind = 'volunteer' and fields->>'s05-travel' = '';

-- --------------------------------------------------------- Need form

update submissions
   set fields = jsonb_set(fields, '{s01-you-are-posting-as}', '"Government agency"')
 where kind = 'need' and fields->>'s01-you-are-posting-as' = '';

update submissions
   set fields = jsonb_set(fields, '{s04-experience-level-required}', '"Any"')
 where kind = 'need' and fields->>'s04-experience-level-required' = '';

update submissions
   set fields = jsonb_set(fields, '{s06-accommodation}', '"Provided"')
 where kind = 'need' and fields->>'s06-accommodation' = '';

update submissions
   set fields = jsonb_set(fields, '{s06-food}', '"Provided"')
 where kind = 'need' and fields->>'s06-food' = '';

update submissions
   set fields = jsonb_set(fields, '{s06-transport}', '"Provided"')
 where kind = 'need' and fields->>'s06-transport' = '';

update submissions
   set fields = jsonb_set(fields, '{s07-where-the-work-happens}', '"On the ground"')
 where kind = 'need' and fields->>'s07-where-the-work-happens' = '';

update submissions
   set fields = jsonb_set(fields, '{s07-paid-or-unpaid}', '"Unpaid / volunteer"')
 where kind = 'need' and fields->>'s07-paid-or-unpaid' = '';
