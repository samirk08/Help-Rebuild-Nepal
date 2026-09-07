"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ExampleNeedDialog from "@/components/ExampleNeedDialog";
import NeedCard from "@/components/NeedCard";
import { added } from "@/lib/added-strings";
import type { Dict, Lang } from "@/lib/content";
import { SKILLS } from "@/lib/content";
import { districtOptions } from "@/lib/districts";
import { translator } from "@/lib/i18n";
import {
  STATUS_OPTIONS,
  URGENCY_OPTIONS,
  needLocation,
  needSummary,
  type NeedFilters,
  type PublicNeedRow,
} from "@/lib/public-needs";
import { screenPath } from "@/lib/routes";

const PROVINCES = [
  "Koshi",
  "Madhesh",
  "Bagmati",
  "Gandaki",
  "Lumbini",
  "Karnali",
  "Sudurpashchim",
];

type Sort = { col: number; asc: boolean };

/**
 * The published-requests board.
 *
 * Filtering happens on the server (a plain GET form, so a filtered view is a
 * shareable URL and works without JavaScript); sorting is client-side over the
 * rows already fetched. The same controls and task cards work on small screens.
 */
export default function NeedsBoard({
  lang,
  t,
  needs,
  filters,
  unavailable = false,
  lastUpdated = null,
}: {
  lang: Lang;
  t: Dict;
  needs: PublicNeedRow[];
  filters: NeedFilters;
  /** True when the read failed. Distinct from a successful read of no rows. */
  unavailable?: boolean;
  lastUpdated?: string | null;
}) {
  const tr = translator(lang);
  const a = added(lang);
  const [sort, setSort] = useState<Sort>({ col: 0, asc: true });
  const [dialogOpen, setDialogOpen] = useState(false);

  const sorted = useMemo(() => {
    const keyed = needs.map((need) => ({
      need,
      keys: [
        needLocation(need),
        need.whatToDo || needSummary(need),
        need.peopleNeeded ?? 0,
        // Sort urgency by real severity, not alphabetically — "Immediate"
        // must not sort below "Upcoming" on a board people scan in a crisis.
        URGENCY_OPTIONS.findIndex((u) => u.value === need.urgency) < 0
          ? URGENCY_OPTIONS.length
          : URGENCY_OPTIONS.findIndex((u) => u.value === need.urgency),
        need.status,
        need.createdAt,
      ] as Array<string | number>,
    }));

    return keyed
      .sort((x, y) => {
        const a2 = x.keys[sort.col];
        const b2 = y.keys[sort.col];
        const cmp =
          typeof a2 === "number" && typeof b2 === "number"
            ? a2 - b2
            : String(a2).localeCompare(String(b2));
        return sort.asc ? cmp : -cmp;
      })
      .map((k) => k.need);
  }, [needs, sort]);

  const hasFilters = Boolean(
    filters.province || filters.district || filters.skill || filters.urgency || filters.status
  );
  // A count is a claim about how many requests exist. When the read failed we
  // do not know that number, so none is shown rather than an implied zero.
  const count = unavailable
    ? a.boardUnavailableCount
    : needs.length === 1
      ? a.needsCountOne
      : `${needs.length} ${a.needsCountMany}`;

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.needsTitle}</h1>
      <p className="intro">{t.needsIntro}</p>

      {unavailable ? (
        <p className="notice notice--warn" role="alert">
          {a.boardUnavailable}
        </p>
      ) : null}

      <form className="filterbar" method="get">
        <Select name="province" label="Province" all="All provinces" value={filters.province} tr={tr}>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {tr(p)}
            </option>
          ))}
        </Select>
        {/* All 77 districts, not the design's ten: the need form uses the
            searchable district widget, so any of them can be on a real row. */}
        <Select name="district" label="District" all="All districts" value={filters.district} tr={tr}>
          {districtOptions(lang).map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
        <Select name="skill" label="Skill required" all="All skills" value={filters.skill} tr={tr}>
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {tr(s)}
            </option>
          ))}
        </Select>
        <Select name="urgency" label="Urgency" all="Any urgency" value={filters.urgency} tr={tr}>
          {URGENCY_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {tr(u.label)}
            </option>
          ))}
        </Select>
        <Select name="status" label="Status" all="Any status" value={filters.status} tr={tr}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {tr(s.label)}
            </option>
          ))}
        </Select>

        <button type="submit" className="btn btn--outline btn--sm">
          {tr("Filter")}
        </button>
        {hasFilters ? (
          <Link href={screenPath(lang, "needs")} className="footer__link">
            {a.needsClearFilters}
          </Link>
        ) : null}
        <p className="filterbar__count">
          {count}
          {lastUpdated ? (
            <span className="hint" style={{ marginLeft: 8 }}>
              {a.boardLastUpdated}{" "}
              <time dateTime={lastUpdated}>
                {new Date(lastUpdated).toLocaleTimeString(lang === "np" ? "ne-NP" : "en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </span>
          ) : null}
        </p>
      </form>

      {unavailable ? (
        <div className="card card--empty-lg">
          <h2 className="card__title card__title--lg">{a.boardUnavailableTitle}</h2>
          <p className="card__body">{a.boardUnavailable}</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card card--empty-lg">
          <h2 className="card__title card__title--lg">{t.needsEmptyTitle}</h2>
          <p className="card__body">{t.needsEmptyBody}</p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <Link href={screenPath(lang, "post")} className="btn btn--navy btn--sm">{t.postCta}</Link>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setDialogOpen(true)}>{t.seeExample}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="needs-sort">
            <label htmlFor="needs-sort">{a.needsSortBy}</label>
            <select id="needs-sort" className="select" value={sort.col} onChange={(event) => setSort({ col: Number(event.target.value), asc: Number(event.target.value) !== 5 })}>
              {[tr("Location"), tr("Need"), a.needsPeople, tr("Urgency"), tr("Status"), a.needsNewest].map((label, i) => <option key={i} value={i}>{label}</option>)}
            </select>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setSort((prev) => ({ ...prev, asc: !prev.asc }))}>
              <span aria-hidden="true">{sort.asc ? "↑" : "↓"}</span> {sort.asc ? a.needsAscending : a.needsDescending}
            </button>
          </div>
          <ul className="needs-grid" aria-label={t.needsTitle}>
            {sorted.map((need) => <li key={need.id}><NeedCard need={need} lang={lang} /></li>)}
          </ul>
        </>
      )}

      {dialogOpen ? (
        <ExampleNeedDialog lang={lang} t={t} onClose={() => setDialogOpen(false)} />
      ) : null}
    </div>
  );
}

function Select({
  name,
  label,
  all,
  value,
  tr,
  children,
}: {
  name: string;
  label: string;
  all: string;
  value: string | undefined;
  tr: (v: string) => string;
  children: React.ReactNode;
}) {
  return (
    <div className="filterbar__field">
      <label className="field__label" htmlFor={`filter-${name}`}>
        {tr(label)}
      </label>
      <select className="select" id={`filter-${name}`} name={name} defaultValue={value ?? ""}>
        <option value="">{tr(all)}</option>
        {children}
      </select>
    </div>
  );
}
