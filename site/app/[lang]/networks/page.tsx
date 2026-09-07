import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import JoinNetworkButton from "@/components/JoinNetworkButton";
import { added } from "@/lib/added-strings";
import { networkCounts } from "@/lib/community";
import { dict, isLang, translator } from "@/lib/i18n";
import { networkViewer } from "@/lib/networks";
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
  const a = added(lang);

  // `networkViewer` and JoinNetworkButton already existed and were correct.
  // Nothing referenced them: every card rendered a hardcoded link to the
  // registration form, so a person who had just registered and signed in was
  // told to register again in order to join. Typecheck, tests and build all
  // passed, because working code that nobody calls is still valid code.
  const [counts, viewer] = await Promise.all([networkCounts(), networkViewer()]);

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
            {viewer.memberships.has(network.name) ? (
              <p className="network__member">{a.networkMemberBadge}</p>
            ) : viewer.registered ? (
              <JoinNetworkButton lang={lang} network={network.name} label={t.joinNetwork} />
            ) : (
              // Not registered, or signed out. Both genuinely need the form
              // first — joining a network attaches to a registration.
              <>
                <Link
                  href={screenPath(lang, "volunteer")}
                  className="btn btn--outline btn--outline-green btn--sm btn--block"
                >
                  {t.joinNetwork}
                </Link>
                {!viewer.signedIn ? (
                  <p className="hint" style={{ marginTop: 10, fontSize: 12 }}>
                    {a.networkSignInToJoin}{" "}
                    <Link href={screenPath(lang, "accountLogin")}>{a.networkSignInLink}</Link>
                  </p>
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
