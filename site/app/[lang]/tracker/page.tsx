import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CountUp from "@/components/CountUp";
import { dict, isLang, translator } from "@/lib/i18n";
import { DEMO_ALLOWED, isDemo, trackerMetrics } from "@/lib/metrics";
import { DEMAND, EXPERTISE, LOCATIONS } from "@/lib/site-data";

// trackerMetrics() queries Supabase for real counts — must not run at build
// time or be cached. See app/[lang]/page.tsx for the same note.
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
  // Awaiting `searchParams` makes this page render on demand, and the demo
  // dataset is off unless the build opts in, so only read the query string
  // when it could change what renders. Everything else here is static.
  const metrics = await trackerMetrics(DEMO_ALLOWED && isDemo(await searchParams));

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
            {EXPERTISE.map((item) => (
              <div key={item}>
                <div className="breakdown__row-head">
                  <span>{tr(item)}</span>
                  <span className="breakdown__n">0%</span>
                </div>
                <div className="meter meter--thin" />
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <h2 className="card__heading card__heading--purple">{t.fromTitle}</h2>
          <div className="breakdown">
            {LOCATIONS.map((item) => (
              <div key={item}>
                <div className="breakdown__row-head">
                  <span>{tr(item)}</span>
                  <span className="breakdown__n">0</span>
                </div>
                <div className="meter meter--thin" />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--faint)", margin: "18px 0 0" }}>
            {t.diasporaNote}
          </p>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <h2 className="card__heading card__heading--navy">{t.demandTitle}</h2>
          <div className="stack-12">
            {DEMAND.map((row) => (
              <div className="demandrow" key={row.label}>
                <span className="demandrow__label">{tr(row.label)}</span>
                <span className="demandrow__value">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
