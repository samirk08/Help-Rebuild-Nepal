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
//
// Migration 019 added `draft` and `paused`. Draft is never published at all, so
// it has no phase to count under. Paused is counted with the work that has
// started, because a stalled project is still a commitment someone made —
// reporting it as recruiting would ask volunteers to join something that has
// stopped.
const STAGE_KEY: Record<string, string[]> = {
  Recruiting: ["recruiting"],
  "In progress": ["in_progress", "paused"],
  Completed: ["completed"],
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
  const result = await listProjects();
  const projects = result.state === "ok" ? result.data : [];
  const unavailable = result.state !== "ok";

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.projectsTitle}</h1>
      <p className="intro" style={{ marginBottom: 26 }}>
        {t.projectsIntro}
      </p>

      {unavailable ? (
        <p className="notice notice--warn" role="alert">
          {a.boardUnavailable}
        </p>
      ) : null}

      <div className="grid grid--290 mb-16">
        {PROJECT_PHASES.map((phase) => (
          <div className="card" key={phase.stage}>
            <h2 className="phase__stage">{tr(phase.stage)}</h2>
            {/* A failed read has no count. Rendering 0 would report "no
                projects at this stage", which is a claim we cannot make. */}
            <p className="phase__value">
              {unavailable
                ? "—"
                : projects.filter((p) => (STAGE_KEY[phase.stage] ?? []).includes(p.stage)).length}
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
              {project.summary ? (
                <p className="card__body" style={{ marginBottom: 12 }}>
                  {(lang === "np" ? project.summaryNp : project.summary) ?? project.summary}
                </p>
              ) : null}
              <div className="rowlist">
                <div className="row">
                  <span className="fact__k">{tr("Team")}</span>
                  <span className="fact__v">
                    {project.peopleNeeded == null
                      ? project.committed
                      : `${project.committed}/${project.peopleNeeded}`}
                  </span>
                </div>
                {project.milestonesTotal > 0 ? (
                  <div className="row">
                    <span className="fact__k">{a.projectsMilestones}</span>
                    <span className="fact__v">
                      {project.milestonesDone}/{project.milestonesTotal}
                    </span>
                  </div>
                ) : null}
                <div className="row">
                  <span className="fact__k">{a.projectsCoordinator}</span>
                  <span className="fact__v">
                    {project.lead ?? project.coordinator ?? a.projectsNoCoordinator}
                  </span>
                </div>
              </div>

              {/* Only non-internal updates reach this point — the view they
                  come from has no internal rows and no author column in it. */}
              <div style={{ marginTop: 16 }}>
                <p className="eyebrow--label" style={{ marginBottom: 6 }}>
                  {a.projectsLatestUpdate}
                </p>
                <p className="card__body" style={{ margin: 0 }}>
                  {(lang === "np" ? project.latestUpdateNp : project.latestUpdate) ??
                    project.latestUpdate ??
                    a.projectsNoUpdate}
                </p>
              </div>

              {project.outcome ? (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-2)" }}>
                  <p className="eyebrow--label" style={{ marginBottom: 6 }}>
                    {a.projectsOutcome}
                  </p>
                  <p className="card__body" style={{ marginBottom: 8 }}>
                    {(lang === "np" ? project.outcome.summaryNp : project.outcome.summary) ??
                      project.outcome.summary}
                  </p>
                  {project.outcome.households != null ? (
                    <p className="card__body" style={{ marginBottom: 8 }}>
                      {a.projectsHouseholds}: {project.outcome.households.toLocaleString()}
                    </p>
                  ) : null}
                  {/* An unconfirmed outcome says so. Implying the requester
                      agreed when they have not been asked is the one claim this
                      page must never make. */}
                  <span
                    className={`badge ${
                      project.outcome.confirmed ? "badge--verified" : "badge--unrequested"
                    }`}
                  >
                    {project.outcome.confirmed
                      ? a.projectsOutcomeConfirmed
                      : a.projectsOutcomeUnconfirmed}
                  </span>
                </div>
              ) : null}
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
  if (stage === "paused") return "Paused";
  return Object.entries(STAGE_KEY).find(([, values]) => values.includes(stage))?.[0] ?? stage;
}
