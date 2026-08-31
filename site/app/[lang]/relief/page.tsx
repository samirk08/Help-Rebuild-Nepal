import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { added } from "@/lib/added-strings";
import { dict, isLang, translator } from "@/lib/i18n";
import { categoryById, categoryLabel, formatQuantity } from "@/lib/relief";
import { listItemNeeds } from "@/lib/relief-data";
import { screenPath } from "@/lib/routes";

// Verified item needs come from the database.
export const dynamic = "force-dynamic";

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
  const tr = translator(lang);
  const itemNeeds = await listItemNeeds();

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

      {itemNeeds.length === 0 ? (
        <div className="card card--flush">
          <div className="needtable__empty">
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
          </div>
        </div>
      ) : (
        <div className="card card--flush">
          <table className="needtable">
            <caption className="visually-hidden">{t.reliefTitle}</caption>
            <thead>
              <tr>
                <th scope="col">{tr(t.reliefItem)}</th>
                <th scope="col">{tr(t.reliefQuantity)}</th>
                <th scope="col">{tr(t.reliefPledged)}</th>
                <th scope="col">{tr(t.reliefLocation)}</th>
                <th scope="col">{tr(t.reliefNeededBy)}</th>
              </tr>
            </thead>
            <tbody>
              {itemNeeds.map((need) => {
                const category = categoryById(need.category);
                return (
                  <tr key={need.id}>
                    <td>
                      <Link href={`${screenPath(lang, "relief")}/${need.id}`}>
                        {category ? categoryLabel(category, lang) : need.category}
                      </Link>
                    </td>
                    <td>{formatQuantity(need, lang)}</td>
                    <td>{need.pledged}</td>
                    <td>
                      {need.municipality} · {need.district}
                    </td>
                    <td>
                      {new Date(need.neededBy).toLocaleDateString(
                        lang === "np" ? "ne-NP" : "en-GB",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="panel panel--example mt-16">
        <h2 className="panel__title">{t.reliefShippingTitle}</h2>
        <p className="panel__body" style={{ marginBottom: 0 }}>
          {t.reliefShippingBody}
        </p>
      </section>
    </div>
  );
}
