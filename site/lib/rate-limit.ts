/**
 * A per-caller request budget for the public write endpoints.
 *
 * Honest about what it is: an in-process fixed-window counter. Serverless
 * functions scale horizontally and each instance keeps its own map, so the
 * effective limit is this budget times however many instances are warm, and a
 * cold start forgets everything. That makes it useless against a distributed
 * flood and genuinely useful against the thing that actually happens — one
 * script, one loop, one endpoint — at no infrastructure cost.
 *
 * It is deliberately not the only defence. Size limits, the option allowlist,
 * upload quotas and the idempotency key all hold regardless of how many
 * instances are running. When a shared store is added later, only `consume`
 * needs to change; every caller already treats the answer as advisory.
 */

export type Budget = { limit: number; windowMs: number };

/** Registration and need intake: generous, because forms get retried. */
export const INTAKE_BUDGET: Budget = { limit: 20, windowMs: 10 * 60 * 1000 };
/** Signing uploads: eight files per submission, a few submissions per window. */
export const UPLOAD_BUDGET: Budget = { limit: 60, windowMs: 10 * 60 * 1000 };
/** Anything that sends mail to an address the caller chose. */
export const EMAIL_BUDGET: Budget = { limit: 5, windowMs: 15 * 60 * 1000 };

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Stops the map growing without bound on a long-lived instance. */
const MAX_TRACKED = 10_000;

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateVerdict = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Records one request against `key` and says whether it may proceed.
 *
 * `now` is a parameter so the window can be tested without sleeping.
 */
export function consume(key: string, budget: Budget, now: number = Date.now()): RateVerdict {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED) sweep(now);
    windows.set(key, { count: 1, resetAt: now + budget.windowMs });
    return { allowed: true, remaining: budget.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, budget.limit - existing.count);
  if (existing.count > budget.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining, retryAfterSeconds: 0 };
}

/** Test seam: drops all recorded windows. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * The best available identifier for the caller.
 *
 * `x-forwarded-for` is client-controllable in general, but on Vercel the
 * platform rewrites it, and the leftmost entry is the real peer. A caller who
 * spoofs it only spreads their own budget across more keys, which is a smaller
 * problem than keying every anonymous request together and letting one script
 * lock out a whole shared network.
 */
export function callerKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
