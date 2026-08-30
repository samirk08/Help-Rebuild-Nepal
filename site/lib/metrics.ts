import { DEMO_COUNTS, TRACKER_LABELS } from "./content";

export type Metric = { label: string; value: number };

/**
 * Headline capacity numbers.
 *
 * The register is not wired to a data source yet, so real counts are zero —
 * which the copy states plainly rather than papering over. Pass `demo` (the
 * `?demo` query string) to render the design's sample figures for a
 * stakeholder walkthrough.
 *
 * TODO: replace the zeros with a query against the volunteer register.
 */
export function trackerMetrics(demo: boolean): Metric[] {
  const values = demo ? DEMO_COUNTS : TRACKER_LABELS.map(() => 0);
  return TRACKER_LABELS.map((label, i) => ({ label, value: values[i] ?? 0 }));
}

/**
 * True when a page should render the sample dataset.
 *
 * Gated behind an environment flag as well as the query string: on a public
 * deployment anyone could otherwise open `?demo` and screenshot 1,284
 * registered volunteers as though the register were full. Set
 * `NEXT_PUBLIC_ALLOW_DEMO=1` for stakeholder walkthroughs.
 */
export function isDemo(searchParams: Record<string, string | string[] | undefined>): boolean {
  if (process.env.NEXT_PUBLIC_ALLOW_DEMO !== "1") return false;
  return searchParams.demo !== undefined;
}
