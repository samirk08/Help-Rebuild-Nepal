import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import InterestButton from "@/components/InterestButton";
import StatusTimeline from "@/components/StatusTimeline";
import { dict, isLang, translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { DETAIL_FACTS, EXAMPLE_NEED_ID } from "@/lib/site-data";

/**
 * The register holds no published requests yet, so the one worked example is
 * the only detail page there is to build. A static export needs that list up
 * front; add ids here as real requests start being published.
 */
export function generateStaticParams() {
  return [{ id: EXAMPLE_NEED_ID }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  // Nothing is published yet, so the one example page stays out of the index.
  return { title: t.detailTitle, description: t.detailBody, robots: { index: false } };
}

export default async function NeedDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  // The register holds no published requests; only the worked example resolves.
  if (id !== EXAMPLE_NEED_ID) notFound();

  const t = dict(lang);
  const tr = translator(lang);

  return (
    <div className="page page--narrow">
      <Link href={screenPath(lang, "needs")} className="backlink">
        {t.backToNeeds}
      </Link>
      <p className="notice">{t.exampleNote}</p>

      <article className="card card--flush">
        <header className="detail__head">
          <div className="badges">
            <span className="badge badge--verified">
              <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--green)" }} />
              {t.verifiedBadge}
            </span>
            <span className="badge badge--urgent">
              <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--red-dot)" }} />
              {t.immediateBadge}
            </span>
          </div>
          <h1 className="detail__title">{t.detailTitle}</h1>
          <p className="detail__meta">{t.detailMeta}</p>
        </header>

        <div className="detail__cols">
          <div className="detail__main">
            <h2 className="eyebrow--label" style={{ marginBottom: 14 }}>
              {t.whatToDo}
            </h2>
            <p className="detail__body">{t.detailBody}</p>

            <div className="factlist">
              {DETAIL_FACTS.map((fact) => (
                <div className="fact" key={fact.k}>
                  <span className="fact__k">{tr(fact.k)}</span>
                  <span className="fact__v">{tr(fact.v)}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="detail__side">
            <h2 className="eyebrow--label" style={{ marginBottom: 14 }}>
              {t.positions}
            </h2>
            <p className="detail__count">
              0<span>/4</span>
            </p>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 14px" }}>
              {t.committed}
            </p>
            <div className="meter" style={{ marginBottom: 24 }} />

            <InterestButton label={t.iCanHelp} message={t.toastInterest} />
            <p className="hint" style={{ marginTop: 10 }}>
              {t.interestNote}
            </p>

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
