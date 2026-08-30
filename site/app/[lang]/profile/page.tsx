import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dict, isLang, translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { PROFILE_CARDS } from "@/lib/site-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.profileNote, description: t.profileBody, robots: { index: false } };
}

export default async function ProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const t = dict(lang);
  const tr = translator(lang);

  return (
    <div className="page page--narrow">
      <p className="notice">{t.profileNote}</p>

      <div className="profilehead">
        <div className="profilehead__avatar" aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="profilehead__name">{t.yourName}</h1>
          <p className="profilehead__meta">{t.profileMeta}</p>
        </div>
        <div className="profilehead__progress">
          <p className="profilehead__progress-row">
            <span>{t.completeness}</span>
            <span>0%</span>
          </p>
          <div className="meter" />
        </div>
      </div>

      <div className="grid grid--280">
        {PROFILE_CARDS.map((card) => (
          <section className="card" key={card.title}>
            <h2 className="card__heading" style={{ color: "var(--muted)", marginBottom: 14 }}>
              {tr(card.title)}
            </h2>
            <div className="rowlist">
              {card.rows.map((row) => (
                <div className="row" key={row.k}>
                  <span className="fact__k">{tr(row.k)}</span>
                  <span className="fact__v">{tr(row.v)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="callout">
        <p className="callout__body">{t.profileBody}</p>
        <Link href={screenPath(lang, "volunteer")} className="btn btn--green btn--md">
          {t.registerArrow}
        </Link>
      </div>
    </div>
  );
}
