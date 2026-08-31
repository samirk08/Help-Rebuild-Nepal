import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

type Body = {
  submissionId?: unknown;
  email?: unknown;
  password?: unknown;
};

const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Creates a volunteer Auth account only when it can be anchored to a fresh,
 * unclaimed registration. Public browser code never creates Auth users.
 */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure("invalid_request", 415);
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return failure("invalid_request", 400);
  }

  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return failure("invalid_request", 400);
  }
  const body = rawBody as Body;

  if (
    typeof body.submissionId !== "string" ||
    !UUID_PATTERN.test(body.submissionId) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return failure("invalid_request", 400);
  }

  const email = normalizedEmail(body.email);
  if (
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    body.password.length < MIN_PASSWORD_LENGTH ||
    body.password.length > MAX_PASSWORD_LENGTH
  ) {
    return failure("invalid_request", 400);
  }

  const admin = supabaseAdmin();
  const { data: submission, error: submissionError } = await admin
    .from("submissions")
    .select("id, kind, user_id, contact_email, created_at")
    .eq("id", body.submissionId)
    .maybeSingle();

  if (submissionError) {
    console.error("account claim lookup failed", submissionError);
    return failure("server_error", 500);
  }
  if (!submission) return failure("submission_unavailable", 404);
  if (submission.kind !== "volunteer") return failure("submission_unavailable", 403);
  if (submission.user_id) return failure("submission_claimed", 409);

  const createdAt =
    typeof submission.created_at === "string" ? Date.parse(submission.created_at) : NaN;
  const cutoff = Date.now() - CLAIM_WINDOW_MS;
  if (!Number.isFinite(createdAt) || createdAt < cutoff) {
    return failure("submission_unavailable", 410);
  }

  if (
    typeof submission.contact_email !== "string" ||
    normalizedEmail(submission.contact_email) !== email
  ) {
    return failure("email_mismatch", 403);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const code = createError?.code;
    if (code === "email_exists" || code === "user_already_exists") {
      return failure("account_exists", 409);
    }
    console.error("volunteer account creation failed", createError);
    return failure("account_create_failed", 500);
  }

  // Re-check the claim constraints in the update itself. This makes a second
  // request lose safely even if it passed the lookup while the first request
  // was still creating its Auth user.
  const { data: linked, error: linkError } = await admin
    .from("submissions")
    .update({ user_id: created.user.id })
    .eq("id", submission.id)
    .eq("kind", "volunteer")
    .is("user_id", null)
    .gte("created_at", new Date(Date.now() - CLAIM_WINDOW_MS).toISOString())
    .select("id")
    .maybeSingle();

  if (linkError || !linked) {
    // Auth and Postgres are separate systems, so this is the compensating
    // action that keeps a failed link from consuming the person's email.
    const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
    if (cleanupError) console.error("orphaned volunteer Auth user cleanup failed", cleanupError);

    if (linkError) {
      console.error("volunteer submission link failed", linkError);
      return failure("link_failed", 500);
    }
    return failure("submission_claimed", 409);
  }

  return NextResponse.json({ ok: true });
}
