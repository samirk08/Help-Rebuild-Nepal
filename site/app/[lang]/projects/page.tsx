import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { added } from "@/lib/added-strings";
import { listProjects } from "@/lib/community";
import { dict, isLang, translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { PROJECT_PHASES } from "@/lib/site-data";

// Real project rows.
export const dynamic = "force-dynamic";

// PROJECT_PHASES labels are display text; the DB stores the stage check
// constraint's values (see schema.sql). Map between them in one place.
const STAGE_KEY: Record<string, string> = {
  Recruiting: "recruiting",
  "In progress": "in_progress",
  Completed: "completed",
};

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
  const a = added(lang);
  const projects = await listProjects();

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
            <p className="phase__value">
              {projects.filter((p) => p.stage === STAGE_KEY[phase.stage]).length}
            </p>
            <p className="phase__body">{tr(phase.body)}</p>
          </div>
        ))}
      </div>

      {projects.length > 0 ? (
        <div className="grid grid--300">
          {projects.map((project) => (
            <section className="card" style={{ padding: 24 }} key={project.id}>
              <h2 className="card__heading">{project.title}</h2>
              <p className="card__body" style={{ marginBottom: 12 }}>
                {[project.district, tr(stageLabel(project.stage))].filter(Boolean).join(" · ")}
              </p>
              <div className="rowlist">
                <div className="row">
                  <span className="fact__k">{tr("Team")}</span>
                  <span className="fact__v">
                    {project.peopleNeeded == null
                      ? project.committed
                      : `${project.committed}/${project.peopleNeeded}`}
                  </span>
                </div>
                <div className="row">
                  <span className="fact__k">{a.projectsCoordinator}</span>
                  <span className="fact__v">
                    {project.coordinator ?? a.projectsNoCoordinator}
                  </span>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card card--empty-lg">
          <p className="card__title card__title--lg">{t.projectsEmptyTitle}</p>
          <p className="card__body maxw-56">{t.projectsEmptyBody}</p>
          <Link href={screenPath(lang, "post")} className="btn btn--navy btn--sm">
            {t.proposeProject}
          </Link>
        </div>
      )}
    </div>
  );
}

function stageLabel(stage: string): string {
  return (
    Object.entries(STAGE_KEY).find(([, value]) => value === stage)?.[0] ?? stage
  );
}
