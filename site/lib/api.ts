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
  const payload: Record<string, string | string[]> = {};

  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    const existing = payload[key];
    if (existing === undefined) payload[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else payload[key] = [existing, value];
  }

  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, fields: payload }),
  });

  if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
  return (await response.json()) as SubmissionResult;
}
