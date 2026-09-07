import type { ReadResult } from "../publication";
import { unavailable } from "../publication";
import type { QueueItem, QueueSnapshot } from "./types";

export type QueueMetrics = {
  open: number;
  overdue: number;
  oldestWaitingMs: number | null;
};

export type QueueMetricsView = {
  open: string;
  overdue: string;
  oldest: string;
};

/**
 * Counts for the top of the Situation Room. Callers must not render these as
 * zero when the read failed — use `metricsView` which keeps that distinction.
 */
export function queueMetrics(items: QueueItem[], nowIso: string): QueueMetrics {
  const now = Date.parse(nowIso);
  const open = items.filter((item) => item.state === "open");
  let oldestWaitingMs: number | null = null;
  let overdue = 0;

  for (const item of open) {
    const waited = now - Date.parse(item.waitingSince);
    if (Number.isFinite(waited) && (oldestWaitingMs === null || waited > oldestWaitingMs)) {
      oldestWaitingMs = waited;
    }
    if (item.dueAt && Date.parse(item.dueAt) < now) overdue += 1;
  }

  return { open: open.length, overdue, oldestWaitingMs };
}

export function formatAge(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * What the metrics tiles render. A failed read is the word "Unavailable",
 * never "0" — an empty successful queue may still show 0 open items.
 */
export function metricsView(result: ReadResult<QueueSnapshot>, nowIso: string): QueueMetricsView {
  if (result.state === "unavailable") {
    return { open: "Unavailable", overdue: "Unavailable", oldest: "Unavailable" };
  }
  const metrics = queueMetrics(result.data.items, nowIso);
  return {
    open: String(metrics.open),
    overdue: String(metrics.overdue),
    oldest: metrics.open === 0 ? "—" : formatAge(metrics.oldestWaitingMs),
  };
}

export function readFailure<T>(reason: string): ReadResult<T> {
  return unavailable(reason);
}
