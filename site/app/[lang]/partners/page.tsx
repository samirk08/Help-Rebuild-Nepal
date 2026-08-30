import type { Metadata } from "next";
import { notFound } from "next/navigation";

import QueueFilters from "@/components/QueueFilters";
import { dict, isLang, translator } from "@/lib/i18n";
import { ADMIN_MODULES, EXPORTS, PARTNER_STATS } from "@/lib/site-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.partnersTitle, description: t.partnersIntro };
}

export default async function PartnersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const t = dict(lang);
  const tr = translator(lang);

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.partnersTitle}</h1>
      <p className="intro mb-22">{t.partnersIntro}</p>

      <div className="grid grid--180 mb-16" style={{ gap: 14 }}>
        {PARTNER_STATS.map((stat, i) => (
          <div className="card" data-reveal="" key={stat.label} style={{ transitionDelay: `${i * 0.07}s`, padding: 20 }}>
            <div className="pstat__head">
              <span className="dot dot--sm" style={{ ["--dot-color" as string]: stat.color }} />
              <h2 className="pstat__label">{tr(stat.label)}</h2>
            </div>
            <p className="pstat__value">{stat.value}</p>
            <p className="pstat__note">{tr(stat.note)}</p>
          </div>
        ))}
      </div>

      <section className="card card--flush mb-16">
        <div className="queue__head">
          <span className="pulse" style={{ ["--pulse-color" as string]: "var(--amber)" }} aria-hidden="true" />
          <h2 className="queue__title">{t.queueTitle}</h2>
          <p className="queue__note">{t.queueNote}</p>
          <QueueFilters lang={lang} />
        </div>
        <div className="queue__empty">
          <p className="card__title" style={{ fontSize: 16, marginBottom: 6 }}>
            {t.queueEmptyTitle}
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--muted)", maxWidth: "52ch", margin: "0 auto" }}>
            {t.queueEmptyBody}
          </p>
        </div>
      </section>

      <div className="grid grid--240 mb-16" style={{ gap: 14 }}>
        {ADMIN_MODULES.map((module) => (
          <div className="module" key={module.title}>
            <div className="module__head">
              <h2 className="module__title">{tr(module.title)}</h2>
              <span className="module__count">{tr(module.count)}</span>
            </div>
            <p className="module__body">{tr(module.body)}</p>
          </div>
        ))}
      </div>

      <section className="handover">
        <h2 className="handover__title">{t.handoverTitle}</h2>
        <p className="handover__body">{t.handoverBody}</p>
        <div className="grid grid--230" style={{ gap: 10 }}>
          {EXPORTS.map((item) => (
            <div className="handover__item" key={item}>
              {tr(item)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
