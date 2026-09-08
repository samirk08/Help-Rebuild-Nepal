import { NextResponse } from "next/server";

import { deploymentOf } from "@/lib/env";
import { errorFields, logError } from "@/lib/log";
import { HEARTBEAT_STALE_AFTER_MS, STUCK_AFTER_MS, workerHealth } from "@/lib/matching/health";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Machine-readable health, for something outside this deployment to watch.
 *
 * The plan asks for alerting on queue age, delivery failure, stale data and
 * public read failures. Everything needed to decide those already existed —
 * `workerHealth()` computes them, and Diagnostics shows them — but only to a
 * signed-in coordinator who thinks to look. Nothing was watching, so the
 * failure mode was: the worker stops on Friday, and someone notices on Monday
 * because a volunteer says they never got the email.
 *
 * This is deliberately not a new alerting system. It is one endpoint returning
 * a status and a non-200 when something is wrong, which is the contract every
 * uptime monitor already speaks. Point a free monitor at it and the alerting
 * problem is solved with infrastructure that already exists.
 *
 * Public on purpose, and therefore reports no data: counts and ages only,
 * never a subject, an address, or a record id. `?verbose=1` adds the numbers
 * behind the verdict; even those are aggregates.
 */

type Check = { name: string; ok: boolean; detail: string };

export async function GET(request: Request) {
  const verbose = new URL(request.url).searchParams.get("verbose") === "1";
  const checks: Check[] = [];

  // Can we reach the database at all? This is the check that matters most and
  // the one a monitor can act on without any interpretation.
  const probe = await supabaseAdmin().from("submissions").select("id").limit(1);
  checks.push({
    name: "database",
    ok: !probe.error,
    detail: probe.error ? `${probe.error.code ?? "read_failed"}` : "reachable",
  });
  if (probe.error) logError("health_database_unreachable", errorFields(probe.error));

  const health = await workerHealth();

  if (health.state !== "ok") {
    // A count nobody could read is not a zero, and a monitor must not be told
    // the queue is empty when the truth is that we cannot see it.
    checks.push({ name: "outbox", ok: false, detail: `unreadable (${health.reason})` });
  } else {
    const h = health.data;

    const stuck = h.oldestPendingMs !== null && h.oldestPendingMs > STUCK_AFTER_MS;
    checks.push({
      name: "queue_age",
      ok: !stuck,
      detail: h.oldestPendingMs === null
        ? "nothing waiting"
        : `oldest pending ${Math.round(h.oldestPendingMs / 60000)}m`,
    });

    checks.push({
      name: "delivery_failures",
      ok: h.counts.failed === 0,
      detail: `${h.counts.failed} failed`,
    });

    // Delivery being switched off is the ordinary state outside production, so
    // a worker that has never run is only a fault when mail is meant to flow.
    const staleWorker =
      !h.deliveryDisabled &&
      (h.lastSuccessfulRunMs === null || h.lastSuccessfulRunMs > HEARTBEAT_STALE_AFTER_MS);
    checks.push({
      name: "worker_heartbeat",
      ok: !staleWorker,
      detail: h.deliveryDisabled
        ? "delivery disabled"
        : h.lastSuccessfulRunMs === null
          ? "never run"
          : `${Math.round(h.lastSuccessfulRunMs / 60000)}m since last run`,
    });
  }

  const failing = checks.filter((c) => !c.ok);
  const status = failing.length === 0 ? "ok" : failing.some((c) => c.name === "database")
    ? "down"
    : "degraded";

  if (failing.length > 0) {
    logError("health_degraded", {
      status,
      failing: failing.map((c) => c.name).join(","),
    });
  }

  const body: Record<string, unknown> = {
    status,
    deployment: deploymentOf(),
    checks: checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail })),
  };

  if (verbose && health.state === "ok") {
    body.counts = health.data.counts;
    body.bounced7d = health.data.bounced;
  }

  // 503 for anything not ok, because that is what a monitor watches. A page
  // that always returns 200 with a status field in the body is a page that
  // needs its own alerting rule to be useful.
  return NextResponse.json(body, {
    status: status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
