import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { added } from "@/lib/added-strings";
import { dict, isLang } from "@/lib/i18n";
import { ITEM_NEEDS } from "@/lib/relief";
import { screenPath } from "@/lib/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = added(lang);
  return { title: t.reliefTitle, description: t.reliefIntro };
}

export default async function ReliefPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const t = added(lang);
  const base = dict(lang);

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.reliefTitle}</h1>
      <p className="intro">{t.reliefIntro}</p>

      <div className="btn-row mb-16">
        <Link href={screenPath(lang, "reliefOffer")} className="btn btn--green btn--sm">
          {t.reliefOfferCta} <span aria-hidden="true">→</span>
        </Link>
        <Link href={screenPath(lang, "post")} className="btn btn--outline btn--sm">
          {base.postCta}
        </Link>
      </div>

      <div className="grid grid--300 mb-16">
        <section className="panel panel--organize">
          <h2 className="panel__title">{t.reliefWhyNeedsFirstTitle}</h2>
          <p className="panel__body" style={{ marginBottom: 0 }}>
            {t.reliefWhyNeedsFirstBody}
          </p>
        </section>
        <section className="panel panel--donate">
          <h2 className="panel__title">{t.reliefNoCustodyTitle}</h2>
          <p className="panel__body" style={{ marginBottom: 0 }}>
            {t.reliefNoCustodyBody}
          </p>
        </section>
      </div>

      <div className="card card--flush">
        <div className="needtable__empty">
          {ITEM_NEEDS.length === 0 ? (
            <>
              <p className="card__title card__title--lg">{t.reliefEmptyTitle}</p>
              <p className="card__body">{t.reliefEmptyBody}</p>
              <div className="btn-row" style={{ justifyContent: "center" }}>
                <Link href={screenPath(lang, "post")} className="btn btn--navy btn--sm">
                  {base.postCta}
                </Link>
                <Link href={screenPath(lang, "reliefDetail")} className="btn btn--outline btn--sm">
                  {t.reliefSeeExample}
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <section className="panel panel--example mt-16">
        <h2 className="panel__title">{t.reliefShippingTitle}</h2>
        <p className="panel__body" style={{ marginBottom: 0 }}>
          {t.reliefShippingBody}
        </p>
      </section>
    </div>
  );
}
