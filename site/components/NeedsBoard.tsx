"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ExampleNeedDialog from "@/components/ExampleNeedDialog";
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
import { NEED_COLUMNS } from "@/lib/site-data";

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
 * rows already fetched, which is what the column headers were always wired for.
 */
export default function NeedsBoard({
  lang,
  t,
  needs,
  filters,
}: {
  lang: Lang;
  t: Dict;
  needs: PublicNeedRow[];
  filters: NeedFilters;
}) {
  const tr = translator(lang);
  const a = added(lang);
  const [sort, setSort] = useState<Sort>({ col: 0, asc: true });
  const [dialogOpen, setDialogOpen] = useState(false);

  const onSort = (i: number) =>
    setSort((prev) => ({ col: i, asc: prev.col === i ? !prev.asc : true }));

  const sorted = useMemo(() => {
    const keyed = needs.map((need) => ({
      need,
      keys: [
        needLocation(need),
        needSummary(need),
        need.peopleNeeded ?? 0,
        // Sort urgency by real severity, not alphabetically — "Immediate"
        // must not sort below "Upcoming" on a board people scan in a crisis.
        URGENCY_OPTIONS.findIndex((u) => u.value === need.urgency),
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
  const count =
    needs.length === 1 ? a.needsCountOne : `${needs.length} ${a.needsCountMany}`;

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.needsTitle}</h1>
      <p className="intro">{t.needsIntro}</p>

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
        <p className="filterbar__count">{count}</p>
      </form>

      <div className="card card--flush">
        <table className="needtable">
          <caption className="visually-hidden">{t.needsTitle}</caption>
          <thead>
            <tr>
              {NEED_COLUMNS.map((label, i) => {
                const active = sort.col === i;
                return (
                  <th
                    key={label}
                    scope="col"
                    aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      className="reset-button needtable__col"
                      onClick={() => onSort(i)}
                    >
                      <span>{tr(label)}</span>
                      <span className="needtable__arrow" aria-hidden="true">
                        {active ? (sort.asc ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={NEED_COLUMNS.length} className="needtable__empty">
                  <p className="card__title card__title--lg">{t.needsEmptyTitle}</p>
                  <p className="card__body">{t.needsEmptyBody}</p>
                  <div className="btn-row" style={{ justifyContent: "center" }}>
                    <Link href={screenPath(lang, "post")} className="btn btn--navy btn--sm">
                      {t.postCta}
                    </Link>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => setDialogOpen(true)}
                    >
                      {t.seeExample}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((need) => (
                <tr key={need.id}>
                  <td>{needLocation(need)}</td>
                  <td>
                    <Link href={`${screenPath(lang, "needs")}/${need.id}`}>
                      {tr(needSummary(need))}
                    </Link>
                    {need.communityReported ? (
                      <span className="badge badge--muted" style={{ marginLeft: 8 }}>
                        {a.needsCommunityReported}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {need.peopleNeeded == null
                      ? "—"
                      : `${need.committed}/${need.peopleNeeded}`}
                  </td>
                  <td>{need.urgency ? tr(need.urgency) : "—"}</td>
                  <td>{tr(statusLabel(need.status))}</td>
                  <td>
                    <Link href={`${screenPath(lang, "needs")}/${need.id}`}>{a.needsViewNeed} →</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen ? (
        <ExampleNeedDialog lang={lang} t={t} onClose={() => setDialogOpen(false)} />
      ) : null}
    </div>
  );
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
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
    <div>
      <label className="visually-hidden" htmlFor={`filter-${name}`}>
        {tr(label)}
      </label>
      <select className="select" id={`filter-${name}`} name={name} defaultValue={value ?? ""}>
        <option value="">{tr(all)}</option>
        {children}
      </select>
    </div>
  );
}
