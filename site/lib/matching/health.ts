import { ok, unavailable, type ReadResult } from "../publication";
import { supabaseAdmin } from "../supabase";
import { errorFields, logError } from "../log";

/**
 * Whether outbound mail is actually moving.
 *
 * Everything the plan asks for in 4.3 — an outbox, idempotent retries, a lease,
 * POST-only responses — already existed and is tested. What did not exist was
 * any way to look at it. A worker that stopped six hours ago and a worker with
 * nothing to do produce identical outbox rows, so a silent queue was
 * indistinguishable from a healthy one.
 *
 * Read-only. No alerting, no cron: this feeds the Diagnostics page and the
 * Situation Room, which are where a coordinator already looks.
 */

export type OutboxCounts = {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
};

export type WorkerHealth = {
  counts: OutboxCounts;
  /** Age in ms of the oldest item still waiting, or null if none are. */
  oldestPendingMs: number | null;
  /** Deliveries the provider told us bounced, last 7 days. */
  bounced: number;
  /** Age in ms since the last run that finished without error, or null. */
  lastSuccessfulRunMs: number | null;
  /** True when email delivery is switched off — not a fault, but worth saying. */
  deliveryDisabled: boolean;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Older than this and a pending item is stuck rather than merely queued. */
export const STUCK_AFTER_MS = 60 * 60 * 1000;
/** A worker that has not completed in this long has probably stopped. */
export const HEARTBEAT_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export async function workerHealth(now: number = Date.now()): Promise<ReadResult<WorkerHealth>> {
  const client = supabaseAdmin();

  const [outbox, events, runs] = await Promise.all([
    client.from("matching_email_outbox").select("status, created_at, delivery_status"),
    client
      .from("matching_email_events")
      .select("event_type, created_at, provider_id")
      .gte("created_at", new Date(now - WEEK_MS).toISOString()),
    client
      .from("worker_runs")
      .select("finished_at, error")
      .not("finished_at", "is", null)
      .is("error", null)
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);

  // A count nobody could read is not a zero. Reporting one here would say
  // "nothing is queued", which during an outage is the most misleading thing
  // this panel can say.
  const failure = [outbox, events, runs].find((read) => read.error);
  if (failure?.error) {
    logError("workerhealth_failed", errorFields(failure.error));
    return unavailable(failure.error.code ?? "read_failed");
  }

  const counts: OutboxCounts = { pending: 0, sending: 0, sent: 0, failed: 0, cancelled: 0 };
  let oldestPendingMs: number | null = null;
  let bounced = 0;

  for (const row of (outbox.data ?? []) as Array<{
    status: keyof OutboxCounts;
    created_at: string;
    delivery_status: string | null;
  }>) {
    if (row.status in counts) counts[row.status] += 1;
    if (row.status === "pending") {
      const age = now - Date.parse(row.created_at);
      if (Number.isFinite(age) && (oldestPendingMs === null || age > oldestPendingMs)) {
        oldestPendingMs = age;
      }
    }
  }

  // Counted from the delivery events alone, and deduplicated by the provider's
  // own id for the message.
  //
  // Counting the outbox as well double-counted every bounce, because the event
  // is what sets `delivery_status` on the row in the first place. It also had
  // no date filter, so bounces from any point in the project's history landed
  // in a figure labelled "7 days". Two ways of being wrong that cancelled into
  // a number nobody could act on.
  const bouncedIds = new Set<string>();
  for (const event of (events.data ?? []) as Array<{ event_type: string; provider_id: string }>) {
    if (event.event_type === "email.bounced") bouncedIds.add(event.provider_id);
  }
  bounced = bouncedIds.size;

  const lastRun = (runs.data ?? [])[0] as { finished_at: string } | undefined;
  const lastSuccessfulRunMs = lastRun ? now - Date.parse(lastRun.finished_at) : null;

  return ok({
    counts,
    oldestPendingMs,
    bounced,
    lastSuccessfulRunMs,
    deliveryDisabled: process.env.MATCHING_EMAIL_ENABLED !== "1",
  });
}

export type HealthCheck = { name: string; ok: boolean; detail: string; critical?: boolean };

function age(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.floor(hours / 24)} days`;
}

/**
 * The health read as Diagnostics rows.
 *
 * Nothing here is marked critical. A stuck mail queue is serious, but it does
 * not stop a form saving — and the banner on that page claims public forms are
 * failing whenever a critical check fails. Crying wolf there is what made the
 * migration ledger untrustworthy the first time.
 */
export function healthChecks(result: ReadResult<WorkerHealth>): HealthCheck[] {
  if (result.state === "unavailable") {
    return [
      {
        name: "Email worker",
        ok: false,
        critical: false,
        detail:
          `Could not read the outbox (${result.reason}). This is not the same as an empty ` +
          "queue — no count below can be trusted until it reads.",
      },
    ];
  }

  const h = result.data;
  const checks: HealthCheck[] = [];

  checks.push({
    name: "Email delivery",
    ok: true,
    critical: false,
    detail: h.deliveryDisabled
      ? "MATCHING_EMAIL_ENABLED is not 1. Messages queue in the outbox and are not sent — expected outside production."
      : "Enabled. Messages queue and are delivered by the worker.",
  });

  const stuck = h.oldestPendingMs !== null && h.oldestPendingMs > STUCK_AFTER_MS;
  checks.push({
    name: "Oldest queued message",
    ok: !stuck,
    critical: false,
    detail:
      h.oldestPendingMs === null
        ? "Nothing waiting."
        : `${age(h.oldestPendingMs)} old${stuck ? " — the worker may not be running." : "."}`,
  });

  checks.push({
    name: "Outbox",
    ok: h.counts.failed === 0,
    critical: false,
    detail:
      `${h.counts.pending} pending · ${h.counts.sending} sending · ${h.counts.sent} sent · ` +
      `${h.counts.failed} failed · ${h.counts.cancelled} cancelled`,
  });

  checks.push({
    name: "Bounced deliveries (7 days)",
    ok: h.bounced === 0,
    critical: false,
    detail:
      h.bounced === 0
        ? "None."
        : `${h.bounced}. A bounce pauses that volunteer's invitations until their address is fixed.`,
  });

  // Delivery being switched off is the ordinary reason a worker has never run,
  // so it is not reported as a fault in that case.
  const staleHeartbeat =
    !h.deliveryDisabled &&
    (h.lastSuccessfulRunMs === null || h.lastSuccessfulRunMs > HEARTBEAT_STALE_AFTER_MS);

  checks.push({
    name: "Last successful worker run",
    ok: !staleHeartbeat,
    critical: false,
    detail:
      h.lastSuccessfulRunMs === null
        ? h.deliveryDisabled
          ? "Never run. Delivery is switched off, so this is expected."
          : "Never run. Nothing has processed the outbox."
        : `${age(h.lastSuccessfulRunMs)} ago.`,
  });

  return checks;
}
