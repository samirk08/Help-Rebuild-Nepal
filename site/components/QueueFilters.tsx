"use client";

import { useState } from "react";

import type { Lang } from "@/lib/content";
import { translator } from "@/lib/i18n";
import { QUEUE_FILTERS } from "@/lib/site-data";

/** Verification-queue scope picker. Nothing is queued yet, so it only sets scope. */
export default function QueueFilters({ lang }: { lang: Lang }) {
  const tr = translator(lang);
  const [active, setActive] = useState(QUEUE_FILTERS[0]);

  return (
    <div className="queue__filters" role="group" aria-label={tr("Verification queue")}>
      {QUEUE_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          className="reset-button qfilter"
          aria-pressed={active === filter}
          onClick={() => setActive(filter)}
        >
          {tr(filter)}
        </button>
      ))}
    </div>
  );
}
