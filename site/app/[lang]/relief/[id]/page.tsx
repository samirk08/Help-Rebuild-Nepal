import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import StatusTimeline from "@/components/StatusTimeline";
import ToastButton from "@/components/ToastButton";
import { added } from "@/lib/added-strings";
import { dict, isLang, translator } from "@/lib/i18n";
import {
  EXAMPLE_ITEM_NEED,
  categoryById,
  categoryLabel,
  formatQuantity,
  unitLabel,
} from "@/lib/relief";
import { committedPercent, receivedPercent, remainingDemand } from "@/lib/relief-delivery";
import { getItemNeed } from "@/lib/relief-data";
import { screenPath } from "@/lib/routes";

// Real item needs are resolved per request; the worked example is static.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  // Nothing is published yet, so the worked example stays out of the index.
  return { title: added(lang).reliefTitle, robots: { index: false } };
}

export default async function ReliefDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();

  const isExample = id === EXAMPLE_ITEM_NEED.id;
  const need = isExample ? EXAMPLE_ITEM_NEED : await getItemNeed(id);
  if (!need) notFound();

  const category = categoryById(need.category);
  if (!category) notFound();

  const t = added(lang);
  const base = dict(lang);
  const tr = translator(lang);

  // Three numbers, not one. A bar filled to 100% by offers against a request
  // where nothing has shipped is the "second disaster" drawn as a progress bar:
  // it tells the next coordinator to stop looking for tarpaulins.
  const remaining = remainingDemand(need);
  const arrived = receivedPercent(need);
  const arranged = committedPercent(need);
  const closed = need.status !== "requested";
  const deadline = new Date(need.neededBy).toLocaleDateString(lang === "np" ? "ne-NP" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const facts = [
    { k: t.reliefItem, v: categoryLabel(category, lang) },
    { k: t.reliefQuantity, v: formatQuantity(need, lang) },
    { k: t.reliefNeededBy, v: deadline },
    {
      k: t.reliefLocation,
      v: [need.municipality, need.ward ? `${tr("Ward")} ${need.ward}` : null, tr(need.district)]
        .filter(Boolean)
        .join(" · "),
    },
    { k: t.reliefRequester, v: need.requester },
    ...(need.deliveryWindow ? [{ k: t.reliefDeliveryWindow, v: need.deliveryWindow }] : []),
    ...(need.deliveryAddress ? [{ k: t.reliefDeliveryAddress, v: need.deliveryAddress }] : []),
  ];

  return (
    <div className="page page--narrow">
      <Link href={screenPath(lang, "relief")} className="backlink">
        {t.reliefBackToBoard}
      </Link>
      <p className="notice">{base.exampleNote}</p>

      <article className="card card--flush">
        <header className="detail__head">
          <div className="badges">
            {need.verified ? (
              <span className="badge badge--verified">
                <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--green)" }} />
                {base.verifiedBadge}
              </span>
            ) : (
              <span className="badge badge--unrequested">{t.reliefUnrequested}</span>
            )}
            {category.newOnly ? (
              <span className="badge badge--urgent">{t.reliefNewOnly}</span>
            ) : null}
          </div>
          <h1 className="detail__title">
            {formatQuantity(need, lang)}, {categoryLabel(category, lang)}
          </h1>
          <p className="detail__meta">
            {need.municipality} · {tr(need.district)} · {t.reliefNeededBy} {deadline}
          </p>
        </header>

        <div className="detail__cols">
          <div className="detail__main">
            <h2 className="eyebrow--label" style={{ marginBottom: 14 }}>
              {base.whatToDo}
            </h2>
            <p className="detail__body">{lang === "np" ? need.detailNp : need.detail}</p>

            <div className="factlist">
              {facts.map((fact) => (
                <div className="fact" key={fact.k}>
                  <span className="fact__k">{fact.k}</span>
                  <span className="fact__v">{fact.v}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="detail__side">
            <h2 className="eyebrow--label" style={{ marginBottom: 14 }}>
              {t.reliefQuantity}
            </h2>
            {/* The headline number is what arrived, because that is the only
                one that means anything is there. */}
            <p className="detail__count">
              {need.received.toLocaleString()}
              <span>/{need.quantity.toLocaleString()}</span>
            </p>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 14px" }}>
              {need.received === 0
                ? t.reliefNothingArrived
                : `${t.reliefReceived} · ${need.received.toLocaleString()} ${unitLabel(category, lang)}`}
            </p>
            <div
              className="meter meter--stacked"
              style={{ marginBottom: 14 }}
              role="progressbar"
              aria-valuenow={arrived}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t.reliefReceived}
            >
              <div className="meter__fill" style={{ width: `${arrived}%` }} />
              {/* Arranged but not yet arrived, drawn behind — visibly not the
                  same thing as delivered. */}
              <div className="meter__fill meter__fill--pending" style={{ width: `${arranged}%` }} />
            </div>

            <div className="factlist factlist--tight" style={{ marginBottom: 20 }}>
              <div className="fact">
                <span className="fact__k">{t.reliefPledged}</span>
                <span className="fact__v">{need.pledged.toLocaleString()}</span>
              </div>
              <div className="fact">
                <span className="fact__k">{t.reliefArranged}</span>
                <span className="fact__v">{need.committed.toLocaleString()}</span>
              </div>
              <div className="fact">
                <span className="fact__k">{t.reliefStillNeeded}</span>
                <span className="fact__v">
                  {remaining.toLocaleString()} {unitLabel(category, lang)}
                </span>
              </div>
            </div>

            {/* The example has no row to pledge against, so it stays a toast.
                A real request sends you to the offer form pre-targeted at it. */}
            {/* A closed request stays readable — that is the record of what
                happened — but offering against it would leave the donor waiting
                for a collection nobody is going to arrange. */}
            {closed ? (
              <div className="notice notice--warn" role="status">
                <strong style={{ display: "block", marginBottom: 4 }}>{t.reliefClosed}</strong>
                {t.reliefClosedBody}
              </div>
            ) : isExample ? (
              <ToastButton label={t.reliefPledgeCta} message={t.reliefToastPledge} />
            ) : (
              <Link
                href={`${screenPath(lang, "reliefOffer")}?need=${need.id}`}
                className="btn btn--green btn--block"
              >
                {t.reliefPledgeCta}
              </Link>
            )}
            {closed ? null : (
              <p className="hint" style={{ marginTop: 10 }}>
                {base.interestNote}
              </p>
            )}

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line-2)" }}>
              <h3 className="eyebrow--label" style={{ marginBottom: 12 }}>
                {t.reliefStatus}
              </h3>
              <StatusTimeline tr={tr} orientation="vertical" />
            </div>
          </aside>
        </div>
      </article>

      <section className="panel panel--donate mt-16">
        <h2 className="panel__title">{t.reliefNoCustodyTitle}</h2>
        <p className="panel__body" style={{ marginBottom: 0 }}>
          {t.reliefNoCustodyBody}
        </p>
      </section>
    </div>
  );
}
