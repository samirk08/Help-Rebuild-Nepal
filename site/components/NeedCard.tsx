import Link from "next/link";

import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { translator } from "@/lib/i18n";
import { STATUS_OPTIONS, URGENCY_OPTIONS, needLocation, needSummary, type PublicNeedRow } from "@/lib/public-needs";
import { screenPath } from "@/lib/routes";

/** Uses only the public read model; contacts and precise locations stay private. */
export default function NeedCard({ need, lang }: { need: PublicNeedRow; lang: Lang }) {
  const a = added(lang);
  const tr = translator(lang);
  const status = STATUS_OPTIONS.find((s) => s.value === need.status)?.label ?? need.status;
  const urgency = URGENCY_OPTIONS.find((u) => u.value === need.urgency)?.label ?? need.urgency;
  const title = need.whatToDo || needSummary(need);
  const location = needLocation(need);
  const number = new Intl.NumberFormat(lang === "np" ? "ne-NP" : "en-GB");
  // Keep a date-only value in UTC so it never moves a day for overseas volunteers.
  const date = need.startDate && /^\d{4}-\d{2}-\d{2}$/.test(need.startDate)
    ? new Date(`${need.startDate}T00:00:00Z`) : null;
  const start = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(lang === "np" ? "ne-NP" : "en-GB", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
      })
    : need.startDate;

  return (
    <article className="need-card card" aria-labelledby={`need-title-${need.id}`}>
      <div className="badges">
        <span className={`badge ${need.open ? "badge--verified" : "badge--muted"}`}>{tr(status)}</span>
        {urgency ? (
          <span className={`badge ${need.open && need.urgency === "Immediate" ? "badge--urgent" : need.open && need.urgency === "Urgent" ? "badge--pending" : "badge--muted"}`}>
            {tr(urgency)}
          </span>
        ) : null}
        {need.communityReported ? <span className="badge badge--muted">{a.needsCommunityReported}</span> : null}
      </div>
      <h2 className="need-card__title" id={`need-title-${need.id}`}>{tr(title)}</h2>
      <p className="need-card__location">{location === "—" ? a.valueNotSpecified : location}</p>
      {need.org ? <p className="need-card__org">{need.org}</p> : null}
      {need.skills.length ? (
        <ul className="need-card__skills" aria-label={tr("Skill required")}>
          {need.skills.map((skill) => <li key={skill}>{tr(skill)}</li>)}
        </ul>
      ) : null}
      <dl className="need-card__facts">
        <div><dt>{a.needsWorkMode}</dt><dd>{need.workMode ? tr(need.workMode) : a.valueNotSpecified}</dd></div>
        <div><dt>{a.needsTiming}</dt><dd>{[start, need.duration && tr(need.duration)].filter(Boolean).join(" · ") || a.valueNotSpecified}</dd></div>
        <div><dt>{a.needsPeople}</dt><dd>{need.peopleNeeded == null ? a.valueNotSpecified : number.format(need.peopleNeeded)}{` · ${number.format(need.committed)} ${a.needsConfirmed}`}</dd></div>
      </dl>
      <div className="need-card__action">
        <Link href={`${screenPath(lang, "needs")}/${need.id}`} className="btn btn--outline btn--outline-green btn--sm" aria-describedby={`need-title-${need.id}`}>
          {a.needsViewNeed} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
