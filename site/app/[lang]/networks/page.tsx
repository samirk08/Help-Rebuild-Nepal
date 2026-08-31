import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { networkCounts } from "@/lib/community";
import { dict, isLang, translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { NETWORKS } from "@/lib/site-data";

// Member counts come from live rows.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.networksTitle, description: t.networksIntro };
}

export default async function NetworksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const t = dict(lang);
  const tr = translator(lang);
  const counts = await networkCounts();

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.networksTitle}</h1>
      <p className="intro" style={{ marginBottom: 26 }}>
        {t.networksIntro}
      </p>

      <div className="grid grid--260">
        {NETWORKS.map((network) => (
          <div className="card network" key={network.name}>
            <h2 className="network__name">{tr(network.name)}</h2>
            <p className="network__body">{tr(network.body)}</p>
            <p className="network__count">
              <strong>{counts.get(network.name) ?? 0}</strong>
              <span>{t.membersLabel}</span>
            </p>
            <Link
              href={screenPath(lang, "volunteer")}
              className="btn btn--outline btn--outline-green btn--sm btn--block"
            >
              {t.joinNetwork}
            </Link>
          </div>
        ))}

        <div className="network--new">
          <h2 className="network__name">{t.createNetwork}</h2>
          <p className="network__body">{t.createNetworkBody}</p>
        </div>
      </div>
    </div>
  );
}
