import { BASE_PATH } from "./base-path";

/**
 * Whether this build has a server behind it.
 *
 * A static export — the GitHub Pages build — ships no API route, so there is
 * nothing to post to. Set in `next.config.ts`.
 */
const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export type SubmissionKind = "volunteer" | "need";

export type SubmissionResult = {
  ok: boolean;
  /** False while the register has no database behind it. */
  persisted: boolean;
};

/**
 * Send a completed form to the API.
 *
 * The endpoint accepts and validates the payload but does not store it yet —
 * see `app/api/submissions/route.ts`. The UI reports that honestly instead of
 * telling someone their registration was recorded when it was not.
 */
export async function submitRequest(
  kind: SubmissionKind,
  form: FormData
): Promise<SubmissionResult> {
  // Nothing to post to on a static host. The answer is the same one the route
  // gives — accepted, not stored — and the form already says so permanently,
  // so return it directly rather than fetching a URL known to 404.
  if (IS_STATIC_EXPORT) return { ok: true, persisted: false };

  const payload: Record<string, string | string[]> = {};

  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    const existing = payload[key];
    if (existing === undefined) payload[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else payload[key] = [existing, value];
  }

  const response = await fetch(`${BASE_PATH}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, fields: payload }),
  });

  if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
  return (await response.json()) as SubmissionResult;
}
