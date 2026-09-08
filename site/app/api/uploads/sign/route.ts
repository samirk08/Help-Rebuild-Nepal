import { NextResponse } from "next/server";

import { UPLOAD_BUDGET, callerKey, consume } from "@/lib/rate-limit";
import { DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase";
import { checkFileClaim, MAX_FILES } from "@/lib/upload-policy";
import { verifyUploadTicket } from "@/lib/upload-tickets";
import { currentVolunteer } from "@/lib/volunteer-auth";
import { errorFields, logError } from "@/lib/log";

/**
 * Mints a signed Storage upload URL scoped to one submission's folder.
 *
 * Files never pass through this route or any Vercel function body — the
 * browser PUTs bytes straight to Supabase Storage using the token this
 * returns, which is what keeps an 8-file, 10MB-each upload clear of serverless
 * payload-size limits. This route only ever touches the service role key
 * server-side; the browser gets back a path and a token, never the key.
 *
 * Authorization is the part that changed. Confirming "a submission row exists"
 * was never authorization — ids appear in URLs and in forwarded links, so
 * anyone holding one could file documents against a stranger's request. A
 * caller must now present one of two proofs:
 *
 *   * the session of the account the submission belongs to, or
 *   * the upload ticket `/api/submissions` returned to the browser that
 *     created the row (see lib/upload-tickets.ts).
 *
 * Everything else — count, bytes, declared type — is a quota check on top of
 * that, applied against what the submission already holds so the limits cannot
 * be reset by starting a second request.
 */
export async function POST(request: Request) {
  const rate = consume(callerKey(request, "upload-sign"), UPLOAD_BUDGET);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: {
    submissionId?: unknown;
    filename?: unknown;
    mimeType?: unknown;
    size?: unknown;
    ticket?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { submissionId, filename, mimeType, size, ticket } = body;

  if (typeof submissionId !== "string" || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json({ error: "submissionId must be a uuid" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: submission, error: lookupError } = await admin
    .from("submissions")
    .select("id, user_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (lookupError) {
    logError("upload_sign_lookup_failed", errorFields(lookupError));
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }

  // A caller without a valid proof is told the same thing whether the row is
  // missing or simply not theirs, so this cannot be used to test which
  // submission ids exist.
  const authorized = await isAuthorized(submission, submissionId, ticket);
  if (!authorized) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  // Count and bytes already recorded, so the quota spans requests rather than
  // resetting each time the form posts again.
  const { data: existing, error: existingError } = await admin
    .from("documents")
    .select("size_bytes")
    .eq("submission_id", submissionId);

  if (existingError) {
    logError("upload_quota_lookup_failed", errorFields(existingError));
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }

  const used = {
    count: existing?.length ?? 0,
    bytes: (existing ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0),
  };

  const verdict = checkFileClaim(
    { filename: filename as string, mimeType: mimeType as string, size: size as number },
    used
  );
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason, message: verdict.message }, { status: 400 });
  }

  const path = `${submissionId}/${Date.now()}-${verdict.storedName}`;

  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    logError("createsigneduploadurl_failed", errorFields(error));
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    remaining: MAX_FILES - used.count - 1,
  });
}

/**
 * The session first, because it is the stronger claim and does not expire on a
 * slow upload; the ticket second, for the anonymous person who has just filled
 * in a public form and has no account at all.
 */
async function isAuthorized(
  submission: { id: string; user_id: string | null } | null,
  submissionId: string,
  ticket: unknown
): Promise<boolean> {
  if (!submission) return false;

  if (submission.user_id) {
    const user = await currentVolunteer();
    if (user && user.id === submission.user_id) return true;
  }

  return verifyUploadTicket(ticket, submissionId).ok;
}
