export type SubmissionKind = "volunteer" | "need" | "relief-offer";

export type SubmissionResult = {
  ok: boolean;
  persisted: boolean;
  /** The new row's id — needed to attach uploaded documents to it. */
  id?: string;
};

/**
 * Send a completed form to the API. `lang` records which language the form
 * was filled in, for follow-up.
 */
export async function submitRequest(
  kind: SubmissionKind,
  lang: "en" | "np",
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
    body: JSON.stringify({ kind, lang, fields: payload }),
  });

  if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
  return (await response.json()) as SubmissionResult;
}
