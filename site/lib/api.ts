import type { FieldError } from "./intake-schema";

export type SubmissionKind = "volunteer" | "need" | "relief-offer";

export type SubmissionResult = {
  ok: boolean;
  persisted: boolean;
  /** The new row's id — needed to attach uploaded documents to it. */
  id?: string;
  /** True when this request matched one already recorded. */
  duplicate?: boolean;
  /**
   * Short-lived permission to attach files to this submission. Held only in
   * memory for the life of the page; never stored.
   */
  uploadTicket?: string;
};

/** A submission the server refused, with the reason attached to each field. */
export class SubmissionValidationError extends Error {
  readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super("The form was not accepted");
    this.name = "SubmissionValidationError";
    this.errors = errors;
  }
}

/**
 * A key identifying one intended submission, stable across retries.
 *
 * Generated once per filled-in form and resent unchanged if the request has to
 * be retried, so a dropped response — the case where the row was written but
 * the browser never heard back — resolves to the original record rather than a
 * second registration.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Send a completed form to the API. `lang` records which language the form
 * was filled in, for follow-up.
 */
export async function submitRequest(
  kind: SubmissionKind,
  lang: "en" | "np",
  form: FormData,
  idempotencyKey: string
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
    body: JSON.stringify({ kind, lang, fields: payload, idempotencyKey }),
  });

  if (response.status === 400) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      errors?: FieldError[];
    };
    if (body.error === "validation_failed" && Array.isArray(body.errors)) {
      throw new SubmissionValidationError(body.errors);
    }
  }

  if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
  return (await response.json()) as SubmissionResult;
}
