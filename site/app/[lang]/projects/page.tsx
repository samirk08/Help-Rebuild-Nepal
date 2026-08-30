import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dict, isLang, translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { PROJECT_PHASES } from "@/lib/site-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.projectsTitle, description: t.projectsIntro };
}

export default async function ProjectsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const t = dict(lang);
  const tr = translator(lang);

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.projectsTitle}</h1>
      <p className="intro" style={{ marginBottom: 26 }}>
        {t.projectsIntro}
      </p>

      <div className="grid grid--290 mb-16">
        {PROJECT_PHASES.map((phase) => (
          <div className="card" key={phase.stage}>
            <h2 className="phase__stage">{tr(phase.stage)}</h2>
            <p className="phase__value">0</p>
            <p className="phase__body">{tr(phase.body)}</p>
          </div>
        ))}
      </div>

      <div className="card card--empty-lg">
        <p className="card__title card__title--lg">{t.projectsEmptyTitle}</p>
        <p className="card__body maxw-56">{t.projectsEmptyBody}</p>
        <Link href={screenPath(lang, "post")} className="btn btn--navy btn--sm">
          {t.proposeProject}
        </Link>
      </div>
    </div>
  );
}
