import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import InterestButton from "@/components/InterestButton";
import StatusTimeline from "@/components/StatusTimeline";
import { added } from "@/lib/added-strings";
import { dict, isLang, translator } from "@/lib/i18n";
import { getPublicNeed, needLocation, needSummary, type PublicNeedDetail } from "@/lib/public-needs";
import { screenPath } from "@/lib/routes";
import { DETAIL_FACTS, EXAMPLE_NEED_ID } from "@/lib/site-data";

// Real rows, resolved per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);

  if (id === EXAMPLE_NEED_ID) {
    return { title: t.detailTitle, description: t.detailBody, robots: { index: false } };
  }

  const need = await getPublicNeed(id);
  if (!need) return {};
  return {
    title: `${needSummary(need)} — ${needLocation(need)}`,
    description: need.whatToDo ?? t.detailBody,
  };
}

export default async function NeedDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();

  const t = dict(lang);
  const tr = translator(lang);
  const a = added(lang);

  // The worked example predates any real data and is still linked from the
  // board's empty state, so it stays reachable at its own fixed id.
  const isExample = id === EXAMPLE_NEED_ID;
  const need = isExample ? null : await getPublicNeed(id);
  if (!isExample && !need) notFound();

  const facts = need
    ? realFacts(need, tr, a.valueNotSpecified)
    : DETAIL_FACTS.map((f) => ({ k: tr(f.k), v: tr(f.v) }));
  const title = need ? `${tr(needSummary(need))} — ${needLocation(need)}` : t.detailTitle;
  const meta = need ? metaLine(need, lang) : t.detailMeta;
  const body = need ? (need.whatToDo ?? "—") : t.detailBody;

  return (
    <div className="page page--narrow">
      <Link href={screenPath(lang, "needs")} className="backlink">
        {t.backToNeeds}
      </Link>
      {isExample ? <p className="notice">{t.exampleNote}</p> : null}

      <article className="card card--flush">
        <header className="detail__head">
          <div className="badges">
            {need?.communityReported ? (
              <span className="badge badge--muted">{a.needsCommunityReported}</span>
            ) : need ? (
              // The row's own status, not a fixed "Verified". A filled or
              // completed request was rendered as still verified and open,
              // which is the state a reader most needs to know is wrong.
              <span
                className={`badge ${need.open ? "badge--verified" : "badge--muted"}`}
              >
                {need.open ? (
                  <span
                    className="dot dot--xs"
                    style={{ ["--dot-color" as string]: "var(--green)" }}
                  />
                ) : null}
                {tr(statusLabel(need.status))}
              </span>
            ) : (
              <span className="badge badge--verified">
                <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--green)" }} />
                {t.verifiedBadge}
              </span>
            )}
            {/* No urgency recorded means no urgency badge. It used to default
                to "Immediate", inventing the single most consequential claim
                on the page out of a missing answer. */}
            {need ? (
              need.urgency === "Immediate" ? (
                <span className="badge badge--urgent">
                  <span
                    className="dot dot--xs"
                    style={{ ["--dot-color" as string]: "var(--red-dot)" }}
                  />
                  {tr("Immediate")}
                </span>
              ) : need.urgency ? (
                <span className="badge badge--muted">{tr(need.urgency)}</span>
              ) : null
            ) : (
              <span className="badge badge--urgent">
                <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--red-dot)" }} />
                {t.immediateBadge}
              </span>
            )}
          </div>
          <h1 className="detail__title">{title}</h1>
          <p className="detail__meta">{meta}</p>
        </header>

        <div className="detail__cols">
          <div className="detail__main">
            <h2 className="eyebrow--label" style={{ marginBottom: 14 }}>
              {t.whatToDo}
            </h2>
            <p className="detail__body">{body}</p>

            {need?.objectives ? (
              <p className="detail__body" style={{ color: "var(--muted)" }}>
                {need.objectives}
              </p>
            ) : null}

            <div className="factlist">
              {facts.map((fact) => (
                <div className="fact" key={fact.k}>
                  <span className="fact__k">{fact.k}</span>
                  <span className="fact__v">{fact.v}</span>
                </div>
              ))}
            </div>

            {need?.extra ? (
              <p className="hint" style={{ marginTop: 18 }}>
                {need.extra}
              </p>
            ) : null}
          </div>

          <aside className="detail__side">
            <h2 className="eyebrow--label" style={{ marginBottom: 14 }}>
              {t.positions}
            </h2>
            {/* "4" used to stand in for an unanswered headcount, so a request
                that never said how many people it needed advertised a number
                nobody had given. A missing answer now says so. */}
            <p className="detail__count">
              {need?.committed ?? 0}
              {need && need.peopleNeeded === null ? null : (
                <span>/{need?.peopleNeeded ?? 4}</span>
              )}
            </p>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 14px" }}>
              {need && need.peopleNeeded === null ? a.valueNotSpecified : t.committed}
            </p>
            <div className="meter" style={{ marginBottom: 24 }} />

            {need && !need.open ? (
              <div className="notice notice--warn" role="status">
                <strong>{a.needClosedTitle}</strong>
                <p style={{ margin: "6px 0 0" }}>{a.needClosedBody}</p>
              </div>
            ) : need ? (
              <>
                <InterestButton
                  lang={lang}
                  needId={need.id}
                  label={t.iCanHelp}
                  note={t.interestNote}
                />
                {need.interestCount > 0 ? (
                  <p className="hint" style={{ marginTop: 10 }}>
                    {need.interestCount === 1
                      ? a.interestCountOne
                      : `${need.interestCount} ${a.interestCount}`}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <button type="button" className="btn btn--green btn--block" disabled>
                  {t.iCanHelp}
                </button>
                <p className="hint" style={{ marginTop: 10 }}>
                  {t.interestNote}
                </p>
              </>
            )}

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line-2)" }}>
              <h3 className="eyebrow--label" style={{ marginBottom: 12 }}>
                {tr("Status")}
              </h3>
              <StatusTimeline tr={tr} orientation="vertical" />
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}

/** Location and posting date, matching the example's meta line. */
function metaLine(need: PublicNeedDetail, lang: string): string {
  const where = [need.ward && `Ward ${need.ward}`, need.municipality, need.district, need.province]
    .filter(Boolean)
    .join(" · ");
  const posted = new Date(need.createdAt).toLocaleDateString(lang === "np" ? "ne-NP" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return [where, posted].filter(Boolean).join(" · ");
}

/**
 * The status a reader sees, in the vocabulary the board already uses.
 *
 * Derived from the row rather than hard-coded to "Verified", which is what the
 * page showed for every published need including the ones already filled.
 */
function statusLabel(status: string): string {
  switch (status) {
    case "recruiting":
      return "Recruiting";
    case "filled":
      return "Filled";
    case "completed":
      return "Completed";
    default:
      return "Verified";
  }
}

/**
 * The facts a volunteer decides on. These are always listed, and an unanswered
 * one says "Not specified" rather than disappearing: a row that is simply
 * absent reads as "does not apply here", which is a different claim from "we
 * never asked" and can be the difference between travelling and not.
 */
const DECISIVE_FACTS = new Set([
  "Skill required",
  "Experience level",
  "Duration",
  "Start date",
  "Accommodation",
  "Transport",
]);

/**
 * The same fact rows the design's example shows, from a real submission.
 *
 * Optional extras stay dropped when unanswered so the list is readable on a
 * sparsely-filled request; the decisive ones above never are.
 */
function realFacts(need: PublicNeedDetail, tr: (v: string) => string, notSpecified: string) {
  const rows: Array<{ k: string; v: string }> = [
    { k: "Skill required", v: need.skills.map(tr).join(", ") },
    { k: "Experience level", v: need.experience ?? "" },
    { k: "Duration", v: need.duration ?? "" },
    { k: "Start date", v: need.startDate ?? "" },
    { k: "Deadline", v: need.deadline ?? "" },
    { k: "Accommodation", v: need.accommodation ?? "" },
    { k: "Food", v: need.food ?? "" },
    { k: "Transport", v: need.transport ?? "" },
    { k: "Equipment on site", v: need.equipment ?? "" },
    { k: "Type of support", v: [need.workMode, need.paid].filter(Boolean).join(", ") },
    { k: "Resources required", v: need.resources.map(tr).join(", ") },
  ];

  return rows
    .filter((r) => r.v || DECISIVE_FACTS.has(r.k))
    .map((r) => ({ k: tr(r.k), v: r.v ? tr(r.v) : notSpecified }));
}
