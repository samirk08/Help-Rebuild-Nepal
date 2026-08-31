import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CountUp from "@/components/CountUp";
import { added } from "@/lib/added-strings";
import { districtLabel } from "@/lib/districts";
import { dict, isLang, translator } from "@/lib/i18n";
import {
  DEMO_ALLOWED,
  demandTotals,
  isDemo,
  originBreakdown,
  skillBreakdown,
  trackerMetrics,
} from "@/lib/metrics";

// Every figure on this page is a Supabase count — must not run at build time
// or be cached. See app/[lang]/page.tsx for the same note.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.trackerTitle, description: t.trackerIntro };
}

export default async function TrackerPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const t = dict(lang);
  const tr = translator(lang);
  const extra = added(lang);
  // Awaiting `searchParams` makes this page render on demand, and the demo
  // dataset is off unless the build opts in, so only read the query string
  // when it could change what renders.
  const demo = DEMO_ALLOWED && isDemo(await searchParams);
  const [metrics, skills, origins, demand] = await Promise.all([
    trackerMetrics(demo),
    skillBreakdown(demo),
    originBreakdown(demo),
    demandTotals(demo),
  ]);

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.trackerTitle}</h1>
      <p className="intro" style={{ marginBottom: 20 }}>
        {t.trackerIntro}
      </p>

      <div className="tracker-note">
        <h2 className="tracker-note__title">{t.earlyTitle}</h2>
        <p>{t.earlyBody}</p>
      </div>

      <div className="grid grid--160 mb-16" style={{ gap: 14 }}>
        {metrics.map((metric) => (
          <div className="stat" key={metric.label}>
            <p className="stat__value">
              <CountUp value={metric.value} />
            </p>
            <p className="stat__label">{tr(metric.label)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid--300">
        <section className="card" style={{ padding: 24 }}>
          <h2 className="card__heading card__heading--green">{t.expertiseTitle}</h2>
          <div className="breakdown">
            {skills.map((row) => (
              <div key={row.label}>
                <div className="breakdown__row-head">
                  <span>{tr(row.label)}</span>
                  <span className="breakdown__n">{row.percent}%</span>
                </div>
                <div className="meter meter--thin">
                  <div className="meter__fill" style={{ width: `${row.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <h2 className="card__heading card__heading--purple">{t.fromTitle}</h2>
          {origins.length > 0 ? (
            <div className="breakdown">
              {origins.map((row) => (
                <div key={row.label}>
                  <div className="breakdown__row-head">
                    {/* These labels are places read back out of the database,
                        so their Nepali comes from districts.ts rather than the
                        design's translation map; the rolled-up "Other" row is
                        design copy, and `tr` catches it. */}
                    <span>{tr(districtLabel(lang, row.label))}</span>
                    <span className="breakdown__n">{row.count}</span>
                  </div>
                  <div className="meter meter--thin">
                    <div
                      className="meter__fill meter__fill--purple"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="breakdown__empty">{extra.trackerNoOrigins}</p>
          )}
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--faint)", margin: "18px 0 0" }}>
            {t.diasporaNote}
          </p>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <h2 className="card__heading card__heading--navy">{t.demandTitle}</h2>
          <div className="stack-12">
            {demand.map((row) => (
              <div className="demandrow" key={row.label}>
                <span className="demandrow__label">{tr(row.label)}</span>
                <span className="demandrow__value">{row.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
