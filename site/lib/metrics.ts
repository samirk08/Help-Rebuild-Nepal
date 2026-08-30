import { DEMO_COUNTS, TRACKER_LABELS } from "./content";
import { supabaseAdmin } from "./supabase";

export type Metric = { label: string; value: number };

const WORK_MODE_FIELD = "s05-where-you-can-work";
const CONTRIBUTE_FIELD = "s02-how-you-can-contribute";

/**
 * Headline capacity numbers, backed by real rows once they exist.
 *
 * Three of the five labels have an exact, unambiguous field behind them and
 * are computed for real. The other two — "On the ground, need logistics" and
 * "On the ground, self-supported" — describe a split the volunteer form
 * (VOL_FORM in content.ts) has no field for: nothing asks whether an
 * on-the-ground volunteer needs the coordination team to arrange their
 * lodging/transport or can cover it themselves. Rather than guess at a proxy
 * for that (e.g. "brought equipment" answers a different question), those two
 * stay at zero until either a form field exists to ask it directly or an
 * admin tags it — a wrong number here would be worse than an honest zero.
 */
export async function trackerMetrics(demo: boolean): Promise<Metric[]> {
  if (demo) {
    return TRACKER_LABELS.map((label, i) => ({ label, value: DEMO_COUNTS[i] ?? 0 }));
  }

  const client = supabaseAdmin();

  const [{ count: total }, { count: remote }, { count: offeringTime }] = await Promise.all([
    client.from("submissions").select("id", { count: "exact", head: true }).eq("kind", "volunteer"),
    client
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("kind", "volunteer")
      .eq(`fields->>${WORK_MODE_FIELD}`, "Remote"),
    client
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("kind", "volunteer")
      .contains("fields", { [CONTRIBUTE_FIELD]: ["I can contribute time"] }),
  ]);

  const values = [total ?? 0, remote ?? 0, 0, 0, offeringTime ?? 0];
  return TRACKER_LABELS.map((label, i) => ({ label, value: values[i] ?? 0 }));
}

/**
 * Whether this build will honour `?demo` at all.
 *
 * Reading the query string opts a page out of static rendering. Kept even
 * though the site no longer has a static-export build, because it's still
 * what stops a public deployment from letting anyone open `?demo` and
 * screenshot a full register: it must be turned on deliberately per
 * environment, not just by knowing the query string.
 */
export const DEMO_ALLOWED = process.env.NEXT_PUBLIC_ALLOW_DEMO === "1";

export function isDemo(searchParams: Record<string, string | string[] | undefined>): boolean {
  if (!DEMO_ALLOWED) return false;
  return searchParams.demo !== undefined;
}
