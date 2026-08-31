import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import StatusTimeline from "@/components/StatusTimeline";
import { added, type AddedStrings } from "@/lib/added-strings";
import { statusLabel } from "@/lib/admin-render";
import type { Lang } from "@/lib/content";
import { dict, isLang, localePath, translator } from "@/lib/i18n";
import { bandLabel, signalText } from "@/lib/match-copy";
import type { Signal, SignalCode } from "@/lib/matching";
import { navItems, screenPath } from "@/lib/routes";
import { STATUSES } from "@/lib/site-data";
import { districtLabel } from "@/lib/districts";
import { getVolunteerProfile, type VolunteerRegistration } from "@/lib/volunteer-profile";

// Reads live rows for the signed-in user; there is nothing to prerender and no
// credentials at build time to prerender it with.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  // Every other page titles itself with a short noun phrase, so take the nav
  // label. The page is personal, so it is never indexed.
  const label = navItems(lang).find((item) => item.id === "profile")?.label;
  return { title: label, description: added(lang).profileSignedOutBody, robots: { index: false } };
}

export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const a = added(lang);
  const profile = await getVolunteerProfile();

  if (profile.state === "signed-out") {
    return (
      <div className="page page--narrow">
        <h1 className="h1 h1--page">{a.profileSignedOutTitle}</h1>
        <p className="intro">{a.profileSignedOutBody}</p>
        <div className="btn-row">
          <Link href={localePath(lang, "/account/login")} className="btn btn--green btn--md">
            {a.profileSignIn}
          </Link>
        </div>
        <p style={{ marginTop: 20, fontSize: 14, color: "var(--muted)" }}>
          {a.profileNotRegistered}{" "}
          <Link href={screenPath(lang, "volunteer")}>{dict(lang).registerArrow}</Link>
        </p>
      </div>
    );
  }

  if (profile.state === "no-registration") {
    return (
      <div className="page page--narrow">
        <h1 className="h1 h1--page">{a.profileNoRegTitle}</h1>
        <p className="intro">{a.profileNoRegBody}</p>
        <div className="btn-row">
          <Link href={screenPath(lang, "volunteer")} className="btn btn--green btn--md">
            {dict(lang).registerArrow}
          </Link>
        </div>
        {profile.email ? (
          <p style={{ marginTop: 20, fontSize: 13, color: "var(--faint)" }}>
            {a.profileSignedInAs} {profile.email}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Registered lang={lang} a={a} email={profile.email} reg={profile.registration} />
  );
}

function Registered({
  lang,
  a,
  email,
  reg,
}: {
  lang: Lang;
  a: AddedStrings;
  email: string | null;
  reg: VolunteerRegistration;
}) {
  const t = dict(lang);
  const tr = translator(lang);

  // Chip answers arrive joined with ", "; translate each part so a list like
  // "Nepali, English" still localises. Free text falls through unchanged.
  const trValue = (value: string) => value.split(", ").map(tr).join(", ");

  const meta = [reg.primarySkill, reg.district].filter(Boolean).map((v) => tr(v as string));
  const statusIdx = STATUSES.findIndex((s) => s.label === statusLabel(reg.status));
  const statusColor = statusIdx >= 0 ? STATUSES[statusIdx].color : "var(--red)";
  const statusText =
    statusIdx >= 0
      ? tr(STATUSES[statusIdx].label)
      : reg.status === "rejected"
        ? a.profileStatusRejected
        : tr(statusLabel(reg.status));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "np" ? "ne-NP" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="page page--narrow">
      <div className="profilehead">
        <div className="profilehead__avatar" aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="profilehead__name">{reg.name ?? email ?? "—"}</h1>
          {meta.length > 0 ? <p className="profilehead__meta">{meta.join(" · ")}</p> : null}
          {email ? (
            <p className="profilehead__meta" style={{ color: "var(--faint)" }}>
              {a.profileSignedInAs} {email}
            </p>
          ) : null}
        </div>
        <div className="profilehead__progress">
          <p className="profilehead__progress-row">
            <span>{t.completeness}</span>
            <span>{reg.completeness.percent}%</span>
          </p>
          <div className="meter">
            <div className="meter__fill" style={{ width: `${reg.completeness.percent}%` }} />
          </div>
        </div>
      </div>

      <section className="panel panel--donate" style={{ marginBottom: 16 }}>
        <h2 className="panel__title">{a.profileStatusTitle}</h2>
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 22,
            margin: "0 0 4px",
          }}
        >
          <span className="dot" style={{ ["--dot-color" as string]: statusColor }} aria-hidden="true" />
          {statusText}
        </p>
        <p className="profilehead__meta" style={{ margin: "0 0 14px" }}>
          {a.profileRegisteredOn} {fmtDate(reg.createdAt)}
          {reg.verifiedAt ? ` · ${a.profileVerifiedOn} ${fmtDate(reg.verifiedAt)}` : ""}
        </p>
        {reg.status === "rejected" ? (
          <p className="notice notice--warn" style={{ marginBottom: 14 }}>
            {a.profileRejectedNote}
          </p>
        ) : (
          <p className="panel__body">{a.profileStatusNote}</p>
        )}
        <div className="profile-status">
          <StatusTimeline tr={tr} orientation="vertical" />
        </div>
        {/* StatusTimeline is shared and read-only, and it draws the whole
            sequence with no notion of "you are here" — so the current step is
            marked from outside: steps not yet reached are dimmed, the current
            one is bold. Scoped under .profile-status, which only this page
            renders. */}
        {statusIdx >= 0 ? (
          <style>{`
            .profile-status .timeline__step:nth-child(n + ${statusIdx + 2}) { opacity: 0.38; }
            .profile-status .timeline__step:nth-child(${statusIdx + 1}) .timeline__text { font-weight: 700; }
          `}</style>
        ) : null}
      </section>

      <div className="grid grid--280">
        {reg.sections.map((section) => (
          <section className="card" key={section.title}>
            <h2 className="card__heading" style={{ color: "var(--muted)", marginBottom: 14 }}>
              {tr(section.title)}
            </h2>
            <div className="rowlist">
              {section.rows.map((row) => (
                <div className="row" key={row.label}>
                  <span className="fact__k">{tr(row.label)}</span>
                  <span className="fact__v">{trValue(row.value)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Ranked by lib/matching.ts against this registration, published needs
          only. Nothing here contacts anyone: the request's own page carries
          the "I can help with this" form, and the requester makes contact
          first, exactly as before suggestions existed. */}
      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card__heading" style={{ color: "var(--muted)", marginBottom: 6 }}>
          {a.profileMatchesTitle}
        </h2>
        <p className="hint" style={{ margin: "0 0 14px" }}>
          {a.profileMatchesIntro}
          {reg.status !== "verified" ? ` ${a.profileMatchesNotRegistered}` : ""}
        </p>
        {reg.suggestions.length > 0 ? (
          <ul className="fitlist">
            {reg.suggestions.map((need) => (
              <li className="fit" key={need.id} data-band={need.assessment.band}>
                <div className="fit__head">
                  <div>
                    <p className="fit__title">
                      <Link href={`${screenPath(lang, "needs")}/${need.id}`}>{tr(need.title)}</Link>
                    </p>
                    <p className="fit__meta">
                      {[
                        need.district ? districtLabel(lang, need.district) : null,
                        need.urgency ? tr(need.urgency) : null,
                        need.peopleNeeded === null
                          ? null
                          : `${need.committed}/${need.peopleNeeded}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className={`fit__band fit__band--${need.assessment.band}`}>
                    {bandLabel(lang, need.assessment.band)}
                  </span>
                </div>

                {need.assessment.reasons.length > 0 ? (
                  <>
                    <p className="fit__label">{a.profileMatchesWhy}</p>
                    <ul className="fit__signals">
                      {need.assessment.reasons.slice(0, 3).map((signal, i) => (
                        <li key={`${signal.code}-${i}`}>{signalText(lang, signal)}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {/* Only the cautions that are about the work, not about the
                    reader. "Registration not verified yet" is on the status
                    panel above and telling someone their own form is thin is
                    what the completeness meter is for. */}
                {readerCautions(need.assessment.cautions).length > 0 ? (
                  <>
                    <p className="fit__label">{a.profileMatchesCheck}</p>
                    <ul className="fit__signals fit__signals--caution">
                      {readerCautions(need.assessment.cautions).map((signal, i) => (
                        <li key={`${signal.code}-${i}`}>{signalText(lang, signal)}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                <p style={{ margin: "10px 0 0" }}>
                  <Link
                    href={`${screenPath(lang, "needs")}/${need.id}`}
                    className="btn btn--outline btn--sm"
                  >
                    {a.needsViewNeed}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            {a.profileMatchesEmpty}{" "}
            <Link href={screenPath(lang, "needs")}>{a.thanksBrowseNeeds}</Link>
          </p>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card__heading" style={{ color: "var(--muted)", marginBottom: 14 }}>
          {a.profileInterestsTitle}
        </h2>
        {reg.interests.length > 0 ? (
          <div className="rowlist">
            {reg.interests.map((need) => (
              <div className="row" key={need.id}>
                <span className="fact__k">
                  {need.published ? (
                    <Link href={`${screenPath(lang, "needs")}/${need.id}`}>{tr(need.title)}</Link>
                  ) : (
                    tr(need.title)
                  )}
                  {need.district ? ` · ${tr(need.district)}` : ""}
                </span>
                <span className="fact__v">{tr(statusLabel(need.status))}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            {a.profileInterestsEmpty}{" "}
            <Link href={screenPath(lang, "needs")}>{a.thanksBrowseNeeds}</Link>
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * The cautions worth showing the volunteer themselves.
 *
 * The engine's caution list is written for a coordinator deciding whether to
 * send someone, so some of it is about the reader rather than the work:
 * whether their registration is verified, whether it is thin, whether a date
 * they typed parsed. Those are already answered elsewhere on this page — the
 * status panel and the completeness meter — and repeating them under every
 * suggestion would read as a series of small accusations. What is left is
 * about the request: what it does not provide, what it asks for that they may
 * not have.
 */
const READER_HIDDEN = new Set<SignalCode>([
  "not-verified",
  "low-information",
  "date-not-understood",
  "date-maybe-bikram-sambat",
  "safeguarding-vetting",
]);

function readerCautions(cautions: Signal[]): Signal[] {
  return cautions.filter((signal) => !READER_HIDDEN.has(signal.code));
}
