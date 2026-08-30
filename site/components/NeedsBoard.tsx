"use client";

import Link from "next/link";
import { useState } from "react";

import ExampleNeedDialog from "@/components/ExampleNeedDialog";
import type { Dict, Lang } from "@/lib/content";
import { translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { NEED_COLUMNS, NEED_FILTERS } from "@/lib/site-data";

type Sort = { col: number; asc: boolean };

/**
 * The published-requests board. No request has been verified yet, so the table
 * renders its header and an empty state; the sort and filter controls are wired
 * and ready for the first row.
 */
export default function NeedsBoard({ lang, t }: { lang: Lang; t: Dict }) {
  const tr = translator(lang);
  const [sort, setSort] = useState<Sort>({ col: 0, asc: true });
  const [dialogOpen, setDialogOpen] = useState(false);

  const onSort = (i: number) =>
    setSort((prev) => ({ col: i, asc: prev.col === i ? !prev.asc : true }));

  return (
    <div className="page">
      <h1 className="h1 h1--page">{t.needsTitle}</h1>
      <p className="intro">{t.needsIntro}</p>

      <div className="filterbar">
        {NEED_FILTERS.map((filter) => (
          <div key={filter.label}>
            <label className="visually-hidden" htmlFor={`filter-${filter.label}`}>
              {tr(filter.label)}
            </label>
            <select className="select" id={`filter-${filter.label}`} defaultValue="">
              {filter.options.map((option, i) => (
                <option key={option} value={i === 0 ? "" : option}>
                  {tr(option)}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="filterbar__count">{t.needsCount}</p>
      </div>

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
          </tbody>
        </table>
      </div>

      {dialogOpen ? (
        <ExampleNeedDialog lang={lang} t={t} onClose={() => setDialogOpen(false)} />
      ) : null}
    </div>
  );
}
