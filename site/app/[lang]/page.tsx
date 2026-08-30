import Link from "next/link";

import CountUp from "@/components/CountUp";
import LoopWord from "@/components/LoopWord";
import StatusTimeline from "@/components/StatusTimeline";
import { dict, isLang, translator } from "@/lib/i18n";
import { DEMO_ALLOWED, isDemo, trackerMetrics } from "@/lib/metrics";
import { screenPath } from "@/lib/routes";
import { HOW_STEPS, MATCH_ON, TRUST_ITEMS } from "@/lib/site-data";
import { notFound } from "next/navigation";

export default async function HomePage({
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
  const metrics = trackerMetrics(DEMO_ALLOWED && isDemo(await searchParams));

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <h1 className="h1">{t.heroTitle}</h1>
            <p className="lede">{t.heroSub}</p>
            <div className="btn-row">
              <Link href={screenPath(lang, "volunteer")} className="btn btn--green">
                {t.iCanHelpBtn} <span aria-hidden="true">→</span>
              </Link>
              <Link href={screenPath(lang, "post")} className="btn btn--navy">
                {t.requestSupportBtn} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="hero__loop">
              <span className="hero__loop-label">{t.openTo}</span>
              <LoopWord lang={lang} />
            </p>
          </div>
        </div>
      </section>

      <section className="tracker-band" aria-labelledby="tracker-band-title">
        <div className="tracker-band__trail" aria-hidden="true" />
        <div className="tracker-band__inner">
          <div className="tracker-band__head">
            <span className="pulse" aria-hidden="true" />
            <h2 className="tracker-band__label" id="tracker-band-title">
              {t.trackerTitle}
            </h2>
            <Link href={screenPath(lang, "tracker")} className="tracker-band__link">
              {t.seeTracker} <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="tracker-band__grid">
            {metrics.map((metric, i) => (
              <div
                className="tracker-band__cell"
                data-reveal=""
                key={metric.label}
                style={{ transitionDelay: `${i * 0.06}s` }}
              >
                <p className="tracker-band__value">
                  <CountUp value={metric.value} />
                </p>
                <p className="tracker-band__cell-label">{tr(metric.label)}</p>
              </div>
            ))}
          </div>

          <p className="tracker-band__note">{t.earlyBody}</p>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="h2 h2--rule">{t.needsNowTitle}</h2>
          <p className="section__head-note">{t.needsNowBody}</p>
        </div>
        <div className="card card--empty">
          <p className="card__title">{t.needsNowEmptyTitle}</p>
          <p className="card__body">{t.needsNowEmptyBody}</p>
          <Link href={screenPath(lang, "needs")} className="btn btn--outline btn--sm">
            {t.seeNeedsBoard}
          </Link>
        </div>
      </section>

      <section className="section section--tight">
        <h2 className="h2 center">{t.whatBrings}</h2>
        <div className="grid grid--320" style={{ gap: 20 }}>
          <div className="path-card path-card--green" data-reveal="">
            <h3 className="h3">{t.canHelpTitle}</h3>
            <p>{t.canHelpBody}</p>
            <div className="path-card__foot">
              <Link href={screenPath(lang, "volunteer")} className="btn btn--green btn--md">
                {t.offerHelpBtn} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <div className="path-card path-card--navy" data-reveal="" style={{ transitionDelay: "0.08s" }}>
            <h3 className="h3">{t.needSupportTitle}</h3>
            <p>{t.needSupportBody}</p>
            <div className="path-card__foot">
              <Link href={screenPath(lang, "post")} className="btn btn--navy btn--md">
                {t.requestSupportBtn} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--full">
        <h2 className="how-heading">{t.howItWorks}</h2>
        <div className="grid grid--230" style={{ gap: 14 }}>
          {HOW_STEPS.map((step, i) => (
            <div className="how-card" data-reveal="" key={step.n} style={{ transitionDelay: `${i * 0.07}s` }}>
              <p className="how-card__n">{step.n}</p>
              <p className="how-card__title">{tr(step.title)}</p>
            </div>
          ))}
        </div>

        <div className="statusbar">
          <StatusTimeline tr={tr} label={t.statusFlow} />
        </div>
      </section>

      <section className="band">
        <div className="band__inner">
          <div>
            <h2 className="h2" style={{ marginBottom: 12, textWrap: "pretty" }}>
              {t.moreThanTitle}
            </h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--ink-2)", maxWidth: "52ch" }}>
              {t.moreThanBody}
            </p>
          </div>
          <ul className="chips" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {MATCH_ON.map((item) => (
              <li className="chip" key={item}>
                {tr(item)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--full">
        <div className="splitcard">
          <div className="maxw-60">
            <h2 className="h2" style={{ fontSize: 22, letterSpacing: "-0.4px", marginBottom: 8 }}>
              {t.projectsPeekTitle}
            </h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--muted)" }}>
              {t.projectsPeekBody}
            </p>
          </div>
          <Link href={screenPath(lang, "projects")} className="btn btn--outline btn--md">
            {t.seeProjects}
          </Link>
        </div>
      </section>

      <section className="trust">
        <div className="trust__inner">
          <h2 className="h2 h2--rule" style={{ marginBottom: 8 }}>
            {t.trustTitle}
          </h2>
          <p className="trust__intro">{t.trustIntro}</p>
          <div className="grid grid--240" style={{ gap: 14 }}>
            {TRUST_ITEMS.map((item, i) => (
              <div className="trust__item" data-reveal="" key={item.k} style={{ transitionDelay: `${i * 0.07}s` }}>
                <h3 className="trust__k">{tr(item.k)}</h3>
                <p className="trust__v" style={{ margin: 0 }}>
                  {tr(item.v)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta__inner">
          <div className="maxw-56">
            <h2>{t.ctaTitle}</h2>
            <p>{t.ctaBody}</p>
          </div>
          <div className="btn-row">
            <Link href={screenPath(lang, "volunteer")} className="btn btn--white">
              {t.iCanHelpBtn} <span aria-hidden="true">→</span>
            </Link>
            <Link href={screenPath(lang, "post")} className="btn btn--on-red">
              {t.requestSupportBtn} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
