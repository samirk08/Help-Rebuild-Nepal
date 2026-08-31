import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import StatusTimeline from "@/components/StatusTimeline";
import { added } from "@/lib/added-strings";
import { dict, isLang, translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";

type Kind = "volunteer" | "need" | "relief-offer";

/**
 * Where every form lands after a successful submit.
 *
 * A page rather than a toast, for two reasons. A toast on a still-filled form
 * leaves the sender unsure whether anything happened and one stray click away
 * from sending the whole thing twice; and a confirmation is the only place with
 * room to say what happens next, which is the actual question someone has after
 * handing over their details in an emergency.
 *
 * It carries no personal data — only which form was sent and a short reference
 * — so it is safe to land on, reload, or share a screenshot of.
 */
export const metadata: Metadata = { robots: { index: false } };

function isKind(value: string): value is Kind {
  return value === "volunteer" || value === "need" || value === "relief-offer";
}

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const query = await searchParams;
  const rawKind = typeof query.kind === "string" ? query.kind : "";
  const kind: Kind = isKind(rawKind) ? rawKind : "volunteer";

  // Already shortened and upper-cased by the caller; sanitised again here
  // because it is rendered straight from the query string.
  const rawRef = typeof query.ref === "string" ? query.ref : "";
  const reference = rawRef.replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();

  const t = dict(lang);
  const tr = translator(lang);
  const a = added(lang);

  const copy = {
    volunteer: { title: a.thanksVolunteerTitle, body: a.thanksVolunteerBody },
    need: { title: a.thanksNeedTitle, body: a.thanksNeedBody },
    "relief-offer": { title: a.thanksOfferTitle, body: a.thanksOfferBody },
  }[kind];

  return (
    <div className="page page--narrow">
      <div className="card" style={{ padding: 32 }}>
        <span className="badge badge--verified" style={{ display: "inline-flex", marginBottom: 18 }}>
          <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--green)" }} />
          {tr("Submitted")}
        </span>

        <h1 className="h1" style={{ fontSize: 32, marginBottom: 12 }}>
          {copy.title}
        </h1>
        <p className="intro" style={{ marginBottom: 24 }}>
          {copy.body}
        </p>

        {reference ? (
          <div className="panel panel--donate" style={{ marginBottom: 24 }}>
            <h2 className="panel__title">{a.thanksReference}</h2>
            <p className="detail__count" style={{ fontSize: 24, letterSpacing: "1px" }}>
              {reference}
            </p>
            <p className="panel__body" style={{ marginBottom: 0 }}>
              {a.thanksReferenceNote}
            </p>
          </div>
        ) : null}

        <h2 className="eyebrow--label" style={{ marginBottom: 14 }}>
          {a.thanksNextTitle}
        </h2>
        <div style={{ marginBottom: 24 }}>
          <StatusTimeline tr={tr} orientation="vertical" />
        </div>

        <p className="hint" style={{ marginBottom: 24 }}>
          {a.thanksNoDuplicate}
        </p>

        <div className="btn-row">
          <Link href={screenPath(lang, "needs")} className="btn btn--green btn--md">
            {a.thanksBrowseNeeds} <span aria-hidden="true">→</span>
          </Link>
          <Link href={screenPath(lang, "home")} className="btn btn--outline btn--md">
            {a.thanksHome}
          </Link>
        </div>
      </div>

      <p className="hint" style={{ marginTop: 18, textAlign: "center" }}>
        {t.interestNote}
      </p>
    </div>
  );
}
