# HRN matching engine: research and integration plan

Prepared 5 September 2026. Planning deliverable; no application changes, database migrations, or emails executed.

**Recommendation:** build a rules-based, two-sided recommendation process that improves incomplete profiles through short confirmations. Recommend people for specific roles, invite them to express interest, and record a commitment only after both sides agree. Mission membership supplies an explicit interest signal and a place to organize teams.

The first release should produce explainable shortlists inside the existing admin dashboard. Fixed percentage weights, a trained recommendation model, and automatic allocation are premature. This is a design judgment based on the inspected application and research below, not a proven optimum for HRN.

## 1. What the website actually collects

This audit covers the local source, migration files, and the example supplied in the conversation. It does not measure completeness across the live database or confirm which migrations are deployed. The 177 volunteers are the count stated in the email.

| Information | Volunteer form | Need form | Matching implication |
|---|---|---|---|
| Contact | Name, email, phone/WhatsApp, district, emergency contact | Poster type, organization, contact person, combined phone/email | Split requester email and phone before automated introductions. Do not match using emergency contacts. |
| Skills | One primary skill, free-text sub-skills, experience band, certifications/licences | Multiple skill categories, broad experience level, task description and objectives | Shared categories help retrieve candidates; they do not establish task-specific competence. |
| Time | Available from, commitment duration, hours/week, maximum deployment | Start date, duration, deadline, urgency | Dates are text and many answers may be absent. A start date alone cannot establish an available schedule. |
| Work location | Contribution checkboxes, on-site/remote/both, travel scope, preferred districts | District, municipality, ward, location, on-site/remote/both | Work-mode answers can conflict. A remote role generally does not need the volunteer's district. |
| Logistics | Resources and free-text conditions | Accommodation, food, transport, equipment, paid/unpaid/expenses covered | Need support provisions exist; volunteer support requirements need an explicit answer when relevant. |
| Other | Languages, disaster-response experience, references, organizing interests | Extra conditions, documents/photos | Form language is a communication preference, not proof of spoken-language ability. |
| Missions and preferences | No mission selection or invitation preference fields | No structured mission classification | Add these independently of existing skill-network memberships. |
| Role structure | No multiple structured skill records | One overall people count across all chosen skills | “Four people; engineering and logistics” does not say how many of each, or whether everyone needs both skills. |

The complete forms are in [content.ts](/Users/samirkadariya/Developer/HRN/site/lib/content.ts:154), enhanced through [form-schema.ts](/Users/samirkadariya/Developer/HRN/site/lib/form-schema.ts:1). The need form begins at [content.ts:421](/Users/samirkadariya/Developer/HRN/site/lib/content.ts:421).

### Data-quality findings that affect the algorithm

1. **Displayed values do not always prove an explicit choice.** The select component defaults to the first real option. Engineering, On the ground, and Anywhere in Nepal are first options. Skill and travel sections initially sit collapsed. An untouched form can therefore submit these values. The same issue affects need logistics and work-mode defaults. [FormField.tsx](/Users/samirkadariya/Developer/HRN/site/components/FormField.tsx:81), [RequestForm.tsx](/Users/samirkadariya/Developer/HRN/site/components/RequestForm.tsx:20).
2. **Required labels are not reliable completeness guarantees.** The ordinary form controls have no required validation; the consent checkbox does. The submission API validates the envelope and normalizes chip values, but does not enforce a matching-ready volunteer or need schema. [RequestForm.tsx](/Users/samirkadariya/Developer/HRN/site/components/RequestForm.tsx:282), [submissions route](/Users/samirkadariya/Developer/HRN/site/app/api/submissions/route.ts:180).
3. **Historical repairs cannot establish intent.** Migration 006 restores empty select values to their first options. This recovers the option the browser represented, but cannot show whether someone actively chose it. Treat affected first-option values as potentially defaulted until confirmed; do not declare them false or erase them. The repository alone cannot establish which individual records were repaired. [Migration 006](/Users/samirkadariya/Developer/HRN/site/supabase/006-recover-blanked-selects.sql:1).
4. **Requester email is not separately populated by this form.** The combined contact input maps to `contact_phone`; the need mapping has no email key. Existing requests require contact confirmation before a two-email introduction is possible. [Submission mappings](/Users/samirkadariya/Developer/HRN/site/app/api/submissions/route.ts:94).

## 2. What the research supports—and its limits

| Approach | What it offers | Decision for HRN |
|---|---|---|
| Fixed weighted score | Easy to calculate and sort | Useful as a comparison baseline later. Current weights would encode untested tradeoffs and ambiguous data. |
| Explicit constraints and preferences | Explainable eligibility without needing prior successful matches | Use now; collect missing requirements through short follow-up questions. |
| Text similarity / embeddings | Finds related wording in descriptions | Optional candidate discovery later. Similar language cannot confirm availability, qualifications, or willingness. |
| Learned ranking / collaborative filtering | Can learn patterns from interactions and outcomes | Reconsider once HRN has usable response and collaboration history. Registrations alone do not provide success labels. |
| Assignment optimization | Coordinates role coverage and limited volunteer capacity across several needs | Add if simultaneous requests create allocation conflicts; proposed allocations still require consent. |

Felfernig and Burke describe recommendations using explicit requirements and domain constraints, including explanations and ways to resolve a lack of suitable results. This supports the eligibility-and-clarification structure; it does not choose HRN's rules for us. [Original constraint-based recommendation paper](https://www.researchgate.net/publication/221550593_Constraint-based_recommender_systems_technologies_and_research_issues).

A particularly relevant 2024 volunteer study offers personalized task options, collects volunteers' willingness, then forms groups that cover task requirements. Its case study concerned remote educational-content volunteers, with computational experiments; it does not establish performance in Nepal disaster recovery. Adopt the opportunity → response → team sequence. Its assumptions about demographic similarity and guaranteed completion should not become HRN rules. [Kaur, Pazour and Ausseil, author manuscript](https://optimization-online.org/wp-content/uploads/2024/09/An-optimization-framework-to-provide-volunteers-with-task-selection-autonomy-and-group-opportunities.pdf).

Reciprocal-recommendation research argues for evaluating the outcomes for both parties, including coverage, rather than only one side's ranking. Its recruitment and dating experiments support that evaluation principle, not a claim that the published model will work on HRN's sparse records. [Yang et al., KDD 2024](https://arxiv.org/abs/2408.09748).

Google's engineering guidance recommends beginning with simple heuristics, building metrics early, and adding machine learning when the data supports it. That is consistent with starting inside this site's existing TypeScript application. [Rules of Machine Learning](https://developers.google.com/machine-learning/guides/rules-of-ml).

## 3. The proposed algorithm

### A. Turn each verified need into role requests

An admin confirms a short structured brief during verification:

- Mission or missions associated with the need.
- Specific roles and headcounts: for example, two assessment engineers and one logistics coordinator.
- Required capabilities, acceptable alternatives, and optional useful skills. Multiple categories must distinguish alternatives from capabilities required together.
- Work mode: remote, on-site, either, or hybrid requiring both. The existing “Both” answer needs clarification because it does not distinguish those last two meanings.
- Dates or flexible time window, expected hours, location/travel requirements, and necessary support.
- Role-specific credentials and who must verify them, when required by the requester and the work.
- Requester contact, approved contact-sharing scope, and response deadline.

A need may be published while details are being clarified, but automatic invitations require a matching-ready brief. Urgency controls the response window and processing order; it cannot override eligibility. Item-only needs continue through the relief-item/pledge workflow. “Can provide equipment” does not imply someone can staff a professional role.

### B. Preserve evidence and uncertainty

Keep the original submission. Build a typed matching profile from it, with field-level provenance: value, source, confirmation time, and verification where applicable.

Distinguish explicit self-report, admin-confirmed facts, verified credentials, potentially defaulted legacy values, and suggested text-derived tags. Keep unknown, conflicting, and stale information visible. Self-confirming a skill does not verify a professional licence.

Normalize known labels into stable skill IDs. Preserve free text and its source. Confirm ambiguous dates instead of guessing locale, and do not turn experience/hour bands into fabricated exact numbers. Add secondary skills so a volunteer can legitimately match beyond their primary category.

### C. Retrieve broadly, then check requirements

For each role, consider volunteers whose confirmed skills, reported category, relevant sub-skills, or explicit interest make them plausible. Mission interest alone is sufficient for a genuinely open participation role; it cannot establish professional competence. If structured retrieval finds nobody, give the admin a broader search and a gap explanation.

Evaluate each applicable requirement as:

| Result | Meaning | Action |
|---|---|---|
| Pass | Current evidence supports the requirement | Continue. |
| Fail | A confirmed answer is incompatible | Exclude from this role now; show the reason. |
| Unknown | Missing, ambiguous, potentially defaulted, conflicting, or outdated evidence | Ask the specific question needed to resolve it. |

Examples: confirmed remote-only availability fails an on-site role; absent district does not fail a remote role; an unverified licence leaves a licence-dependent role pending; travel willingness alone does not establish arrival before an urgent deadline. Unknown does not mean unqualified, and it does not count as satisfying a mandatory requirement.

Use three admin shortlist sections: **Ready for invitation**, **Needs confirmation**, and **Not currently suitable**. Only role-relevant missing information matters; there is no overall profile-completeness cutoff. A person with a sparse profile can still be ready for a simple role.

### D. Order equally eligible candidates using stated priorities

Use a short, published priority order rather than a percentage total:

1. Stronger evidence for the specific task, within the eligible pool.
2. Explicit interest in that need, then alignment with a chosen mission, then openness to other relevant work.
3. Up to two practical preferences selected in the need brief, such as local presence or a particular useful sub-skill. These cannot substitute for mandatory requirements.
4. Fewer recent invitations, then longest since last invitation; use a stored seeded tie-break for remaining equals rather than alphabetic ordering.

This ordering is itself a policy choice to test. Display each reason and allow an admin to adjust the order with a recorded explanation. Profile length, age, name, assumed nationality, phone country code, and general seniority should not act as proxies for fit. Additional experience matters when the task benefits from it.

Enforce pause/unsubscribe, existing commitments, pending invitations, declined opportunities, and explicitly restricted notification scope separately. A decline concerns that opportunity, not the volunteer's worth or reliability. No response is recorded as no response, not as lack of skill.

### E. Clarify only what changes a decision

For a plausible candidate with missing time information, ask “Can you contribute five hours a week between these dates?” For an ambiguous work mode, ask “For this opportunity, can you work remotely, travel to the site, or both?”

Confirmation requests can go to otherwise contactable volunteers awaiting review, with admin control. They are not deployment invitations and should not disclose requester contacts. Role-specific verification remains a separate gate. Ordinary invitations require the volunteer review promised by the current site, with further checks for roles that need them.

### F. Form a team from willing candidates

Cover required roles and headcounts; do not take the highest overall scores and hope their skills form a team. Initially use an admin coverage view and prioritize roles with the fewest eligible candidates. Show shared candidates so a scarce specialist is not consumed by a role others could fill. This is a practical heuristic, not a global-optimality guarantee.

When competing needs justify optimization, model volunteer-role edges with role headcounts, actual time capacity, accepted interest, and required skills. An assignment solver can handle these explicit constraints. [Google OR-Tools team-assignment example](https://developers.google.com/optimization/assignment/assignment_teams). HRN's objective would need its own definition: agreed task coverage and volunteer preferences, with unfilled roles allowed instead of forcing incompatible allocations.

### Worked example: the supplied volunteer

| Record evidence | Interpretation |
|---|---|
| “I can help remotely” checkbox | Explicit reported willingness to help remotely. |
| Engineering primary skill | Reported category, potentially a default; confirm. |
| On the ground; Anywhere in Nepal | Potentially defaulted. Do not infer travel feasibility or silently resolve this to “Both.” |
| District absent | Unknown; unnecessary for an asynchronous remote role. |
| Availability, experience, sub-skills, mission choice absent | Unknown. Do not fabricate them. |
| Submitted | Awaiting the site's volunteer review. |

For an illustrative remote housing-design role, place her in **Needs confirmation**, with: “Remote interest recorded; please confirm engineering skills and availability.” For an urgent on-site structural assessment, hold until travel timing, capability, and required qualifications are established. Her phone number does not establish her current country. Confirmation might establish engineering, another field, or different work preferences; the system must accommodate each result.

## 4. Honor the mission email

Create the nine missions using the names and numbering already sent:

1. Low-Cost & Energy-Efficient Housing Design.
2. Remote health support and on-site health camps.
3. Mental Health, Emotional Support & Community Well-being.
4. Flood-Resilient Community Design & Planning.
5. Water, Sanitation & Public Health.
6. Operations and IT.
7. Story + Advocacy.
8. Situation Room.
9. Temporary Shelter Design: 1-Week Design Challenge; dates pending.

Record one or two selected missions. The email did not ask people to rank them: selection order must not become an invented first/second preference. People who have not replied remain in the wider network. They can still receive appropriate opportunities unless they explicitly restrict or pause notifications.

Allow admins to record email replies against an identified volunteer, with source and timestamp, and let volunteers correct them. Do not automatically merge similar names or infer choices from skills. Existing skill networks remain useful professional communities; they are not evidence of mission selection, especially where enrollment came from primary-skill defaults.

Each mission page shows its purpose, interested members' skill coverage, coordinator, current work, and open roles. Joining is interest, not a commitment to every project. Ask separately about coordinating; Situation Room membership does not grant admin privileges. Confirm availability again when the shelter challenge gets dates.

Extend the skill vocabulary for gaps such as writing, photography/video, advocacy, mapping, and volunteer coordination. Have volunteers identify the skills they offer. A shared mission should bring complementary skills together without automatically classifying every member as qualified for every role within it.

## 5. Email and connection workflow

**Verified need → role brief → recommendations → admin-approved invitations → volunteer response → introduction → both sides confirm → active work → completion/withdrawal.**

- Start with one invitation per unfilled role slot, configurable by the admin. Larger batches can be used when justified, with clear wording that Proceed expresses interest and does not guarantee a place.
- Each invitation includes the role, dates, expected commitment, support arrangements, why the person was invited, and requester-approved contact details. Offer Proceed, Decline, and preference controls.
- A provisional default is a 48-hour response window for non-urgent needs, one optional reminder, and an admin-set shorter window for urgent work. These are pilot settings, not research-derived constants.
- Proceed confirms current willingness and collects any outstanding role details. Once required checks are satisfied, send separate introduction emails to the volunteer and requester, sharing only the agreed contact fields.
- Pause further invitations for slots under active coordination. Requester confirmation, or an admin recording both parties' agreement, creates the commitment. A coordination deadline prevents indefinite holds.
- Decline or invitation expiry permits the next candidate. Requester rejection or coordination expiry releases the hold. Need closure, opt-out, or materially changed requirements cancels stale invitations; material changes require renewed agreement.
- If parties connect directly using the original email, provide “We have connected” and an admin recording path so the platform catches up.
- After work, record completion, withdrawal, or unresolved outcome. Capture optional decline reasons such as timing, travel, different skills, or no interest; do not create a hidden volunteer reputation score.

Response links must open a review page; accepting or declining requires an explicit POST action. Email scanners should not consume a token or accept an invitation through a GET request. Supabase documents link-prefetching problems for authentication emails, illustrating why opening a link cannot safely represent an intentional response. [Supabase email-template guidance](https://supabase.com/docs/guides/auth/auth-email-templates).

## 6. Integration with the existing site

Keep Next.js, React, TypeScript, and Supabase. At the stated pool size, evaluate candidates in a server-side TypeScript module with batched database reads. No dedicated recommendation service or vector database is needed for the first release.

| Existing area | Concrete integration |
|---|---|
| [Form schema](/Users/samirkadariya/Developer/HRN/site/lib/form-schema.ts:1), [field controls](/Users/samirkadariya/Developer/HRN/site/components/FormField.tsx:1), [submission handler](/Users/samirkadariya/Developer/HRN/site/app/api/submissions/route.ts:1) | Add explicit unanswered select options, validation on client and server, stable matching-field IDs, and form-version tracking. Keep generated content protected through the existing enhancement pattern. |
| [Volunteer profile](/Users/samirkadariya/Developer/HRN/site/app/[lang]/profile/page.tsx:1), [profile reader](/Users/samirkadariya/Developer/HRN/site/lib/volunteer-profile.ts:1) | Add a short editable matching-preferences section, one/two missions, additional skills, availability and notifications. Add My opportunities and connection status. |
| [Account claim endpoint](/Users/samirkadariya/Developer/HRN/site/app/api/account/create/route.ts:12) | The current route only claims registrations within 24 hours and sets email-confirmed administratively. Build a separate mailbox-verified recovery/claim flow for older registrations. Do not treat the existing confirmation flag as proof that an email challenge occurred. |
| [Admin need detail](/Users/samirkadariya/Developer/HRN/site/app/admin/(dashboard)/needs/[id]/page.tsx:1) | Add role editing, matching-readiness checks, explained shortlists, preview emails, invitation history, and role coverage. Preserve manual coordination. |
| [Admin actions](/Users/samirkadariya/Developer/HRN/site/lib/admin-actions.ts:49) | Verification and brief changes queue recomputation. Replace unconditional manual matching for new workflow records with validated commitment actions; check both submission kinds, eligibility, capacity, and authority. |
| [Public interest endpoint](/Users/samirkadariya/Developer/HRN/site/app/api/interests/route.ts:1) | Reuse authenticated interest as an explicit preference. Guests need identity confirmation; never attribute them by a guessed name/email match. Restrict new interest to open needs rather than all published statuses. |
| [Public need counts](/Users/samirkadariya/Developer/HRN/site/lib/public-needs.ts:162), [tracker counts](/Users/samirkadariya/Developer/HRN/site/lib/metrics.ts:204) | Count confirmed commitments according to explicit status. Both currently count match rows without that distinction. Invitations and generated recommendations must never inflate fulfillment. |
| [Networks](/Users/samirkadariya/Developer/HRN/site/lib/networks.ts:1) | Keep skill networks; add mission pages and memberships independently. Support volunteers without claimed accounts through authorized admin entry and secure claim links. |

Proposed new application areas: `site/lib/matching/` for normalization, rules, explanations and ordering; `site/lib/matching-actions.ts` for authenticated workflow mutations; `site/lib/email/` for templates and delivery; mission pages under `/[lang]/missions`; invitation review pages under `/[lang]/opportunities`; matching controls under `/admin`. All new public text and emails support English and Nepali.

### Proposed database additions

Names below are a design contract, not applied migrations. Choose the next migration numbers at implementation time because network work is already in progress.

| Record | Purpose and important constraints |
|---|---|
| `volunteer_matching_profiles` | One per volunteer submission. Canonical skills, work modes, availability, support needs, notification scope, provenance and revision. Preserve original raw fields. |
| `missions`, `mission_memberships` | Stable mission IDs and membership keyed to volunteer submission, not only auth account. Unique volunteer/mission pair; maximum two active choices enforced transactionally. |
| `need_matching_briefs`, `need_roles` | One versioned brief per need, multiple role rows with headcount and requirements. Role totals reconcile to the people count; request contact and sharing settings are explicit. |
| `match_recommendations` | Volunteer/role pair, evaluated profile and brief revisions, algorithm version, requirement results, explanations and priority tuple. Unique pair per evaluation version. |
| `match_invitations` | Recommendation reference, response status, deadline, contact-sharing snapshot and invitation version. Prevent multiple active invitations for the same person and role. |
| Existing `matches`, plus role allocation records | Preserve existing need/volunteer uniqueness. Add a separate commitment lifecycle and role allocations; one person may cover multiple capabilities but counts once toward unique people. Legacy manual rows remain identifiable pending reconciliation. |
| `matching_events`, `email_outbox` | Audit of user/admin transitions; uniquely keyed messages with attempts, next retry, provider ID, and final delivery/suppression state. Retain no unnecessary contact data in event payloads. |
| Scoped action tokens | Store hashes, purpose, subject, expiry and used/revoked state. Separate profile-claim, invitation and requester-confirmation capabilities. |

Retain the current server-only Supabase access pattern with explicit identity/ownership checks on every route and action, RLS enabled, and restricted database function privileges. All new relationships validate submission kinds. Volunteer deletion must handle the new records and invalidate pending messages/tokens; do not leave executable jobs referencing deleted people.

For old registrations, support a scoped emailed invitation response without forcing a password signup first. Broader profile access requires a separate ownership-verified claim. Existing authenticated users can use the profile normally. Mailbox proof is not a qualification check; shared or ambiguous registration identities require admin resolution.

### Background work and delivery

Use a transactional outbox in Supabase and a bounded worker in the existing Next.js server. Schedule authenticated worker calls with Supabase Cron, which supports HTTP requests; this keeps the application logic in one runtime. Supabase Queues is an available alternative if jobs grow more complex. [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart), [Queues documentation](https://supabase.com/docs/guides/queues).

Use a transactional email provider such as Resend through a small adapter. Configure a verified sending domain, monitored Reply-To, and signed delivery webhooks. Resend distinguishes sent, delivered, failed, bounced and complained events; reflect these separately in the admin UI. [Resend event types](https://resend.com/docs/webhooks/event-types).

Persist the invitation and its outbox message in one database transaction. Workers claim work with a lease, recheck consent, eligibility, role capacity and need status before sending, then save the provider result. Duplicate verification events and worker retries reuse the same logical message ID. Resend deduplicates idempotency keys for 24 hours; local records must retain deduplication beyond that window. An uncertain send outside the provider window should be reconciled or reviewed rather than blindly resent. [Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).

Keep delivery state separate from acceptance. Do not promise exactly-once email delivery from queue guarantees alone. Two simultaneous confirmations must lock/check role capacity and volunteer commitments in one transaction. If the last slot is taken, show a pending/waitlist result instead of creating an extra commitment. A final eligibility check limits cancellation races, though a message already handed to a provider may still arrive; its landing page must show the current state.

## 7. Smallest useful rollout

| Order | Deliverable | Completion check |
|---|---|---|
| 1. Confirm the data | Read-only aggregate audit of real records; fix defaults and validation; add secure preference editing and old-account access | Untouched controls remain unknown. Existing volunteers can correct matching facts. No unsupported automatic backfills. |
| 2. Organize missions | Record replies, allow one/two choices, show team coverage and coordinators | Selections reflect what people said; no ranking inferred from reply order; wider-network opportunities remain available. |
| 3. Add recommendations | Admin role brief and explainable shortlist, initially without sending | Admin can see why someone fits or what needs confirming. Sample cases pass and no public counts change. |
| 4. Pilot invitations | Email previews, manual send approval, secure responses, introductions and commitments | Full path tested with designated test recipients, duplicate protection, cancellation and capacity checks. Live delivery only when deliberately enabled. |
| 5. Automate eligible cases | Automatically dispatch within configured limits for well-defined roles | Pilot review supports it; pause switch and manual review remain available for ambiguous or specialist work. |

The immediate product to build is **mission preferences + reliable matching facts + an admin recommendation panel**. Those are useful before requests arrive and create the evidence the later email workflow needs.

### Evaluation and release cases

Before live sending, use fictitious profiles and representative role briefs reviewed by the coordination team. Compare the proposed shortlist with a simple exact-skill baseline and, if useful, the earlier weighted baseline. Keep the cases independent of how the implementation happens to be written.

- Untouched/defaulted engineering and travel fields produce confirmation requests.
- Missing district permits an otherwise valid remote role; restricted travel blocks an incompatible on-site role.
- “Both” with ambiguous meaning stays unresolved; a flexible role accepts either mode only when its brief explicitly permits that.
- Missing availability is distinct from confirmed unavailability; conflicting schedules cannot create a commitment.
- Broad medical or engineering categories cannot satisfy role-specific credential checks.
- Multiple required capabilities, alternative skills, role headcounts and unique people counts remain distinct.
- No mission reply is not a rejection; two choices have equal priority unless the volunteer says otherwise.
- Declining a housing opportunity does not suppress an unrelated IT opportunity; pause/unsubscribe does suppress new matching invitations.
- Repeated events, retries, email link scanners, expired/replayed tokens, and concurrent accepts do not create duplicate emails or extra commitments.
- Need closure and material edits invalidate stale invitations; requester phone-only records cannot enter a two-email introduction unnoticed.
- Unclaimed volunteers can respond securely; other people's profiles and contacts remain inaccessible.
- Guest interests and legacy manual matches are reconciled without invented identity links or inflated fulfillment.

Measure shortlist usefulness and missed suitable candidates during review, then accepted invitations per delivered invitation, requester-confirmed connections, time to fill each role, completed work, clarification burden, invitation load, declines, and opt-outs. Separate unresolved outcomes and delivery failures from negative responses. Record which algorithm and ordering generated each invitation so later comparisons are interpretable. A few successful matches justify continued piloting, not a claim that one ranking policy is statistically superior.

## 8. Outstanding checks before implementation reaches production

The code inspection cannot establish live profile completeness, migration state, mailbox verification, provider configuration, or actual mission replies. The first implementation phase should report those facts as aggregates without exporting the volunteer directory. Operational settings—invitation limits, response windows, and which roles qualify for automatic sending—remain configurable pilot choices. Professional role requirements are supplied and reviewed by the relevant coordinator; the engine does not invent them.

Existing network-related working-tree changes were observed and preserved. This plan adds documentation only.
