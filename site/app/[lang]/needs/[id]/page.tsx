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

  const facts = need ? realFacts(need, tr) : DETAIL_FACTS.map((f) => ({ k: tr(f.k), v: tr(f.v) }));
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
            ) : (
              <span className="badge badge--verified">
                <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--green)" }} />
                {need ? tr("Verified") : t.verifiedBadge}
              </span>
            )}
            {(need?.urgency ?? "Immediate") === "Immediate" ? (
              <span className="badge badge--urgent">
                <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--red-dot)" }} />
                {need ? tr("Immediate") : t.immediateBadge}
              </span>
            ) : need?.urgency ? (
              <span className="badge badge--muted">{tr(need.urgency)}</span>
            ) : null}
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
            <p className="detail__count">
              {need?.committed ?? 0}
              <span>/{need?.peopleNeeded ?? 4}</span>
            </p>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 14px" }}>
              {t.committed}
            </p>
            <div className="meter" style={{ marginBottom: 24 }} />

            {need ? (
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
 * The same fact rows the design's example shows, from a real submission.
 * Unanswered optional fields are dropped rather than rendered as "—", so the
 * list stays readable on a sparsely-filled request.
 */
function realFacts(need: PublicNeedDetail, tr: (v: string) => string) {
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

  return rows.filter((r) => r.v).map((r) => ({ k: tr(r.k), v: tr(r.v) }));
}
