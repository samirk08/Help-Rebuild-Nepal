import { NextResponse } from "next/server";

import { UPLOAD_BUDGET, callerKey, consume } from "@/lib/rate-limit";
import { DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase";
import { SIGNATURE_BYTES, checkStoredObject } from "@/lib/upload-policy";
import { verifyUploadTicket } from "@/lib/upload-tickets";
import { currentVolunteer } from "@/lib/volunteer-auth";
import { errorFields, logError, thrownFields } from "@/lib/log";

/** Postgres unique_violation: this exact object is already recorded. */
const UNIQUE_VIOLATION = "23505";

/**
 * Records a `documents` row once the browser has finished PUTting a file's
 * bytes to the signed URL from `/api/uploads/sign`.
 *
 * The route never sees the upload itself, which is exactly why it cannot take
 * the browser's word for what happened. Previously it inserted whatever
 * metadata it was handed: a row could be recorded for an object that was never
 * uploaded, at a size nobody had checked, with a `mime_type` of `image/png` on
 * a file whose bytes were an HTML document. Admin screens then linked to it.
 *
 * So the object is inspected before anything is written — it exists, it is the
 * size that was authorized, and its leading bytes are one of the five formats
 * on the allowlist. A file that fails any of those is left in Storage
 * unreferenced (a later sweep can collect it) rather than recorded as a
 * legitimate attachment.
 */
export async function POST(request: Request) {
  const rate = consume(callerKey(request, "upload-confirm"), UPLOAD_BUDGET);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: {
    submissionId?: unknown;
    path?: unknown;
    originalName?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
    ticket?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { submissionId, path, originalName, mimeType, sizeBytes, ticket } = body;

  if (
    typeof submissionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(submissionId) ||
    typeof path !== "string" ||
    typeof originalName !== "string" ||
    originalName.length > 200 ||
    typeof mimeType !== "string" ||
    typeof sizeBytes !== "number"
  ) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // Every signed path is "{submissionId}/{timestamp}-{name}". Requiring that
  // prefix, and refusing any further separator, keeps a confirm call inside the
  // namespace it was signed for — a path like "other-id/../mine" cannot resolve
  // out of this submission's folder.
  if (!path.startsWith(`${submissionId}/`) || path.slice(submissionId.length + 1).includes("/")) {
    return NextResponse.json({ error: "Path does not belong to this submission" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: submission } = await admin
    .from("submissions")
    .select("id, user_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) return NextResponse.json({ error: "not_authorized" }, { status: 403 });

  let authorized = false;
  if (submission.user_id) {
    const user = await currentVolunteer();
    authorized = Boolean(user && user.id === submission.user_id);
  }
  if (!authorized) authorized = verifyUploadTicket(ticket, submissionId).ok;
  if (!authorized) return NextResponse.json({ error: "not_authorized" }, { status: 403 });

  const actual = await inspectObject(path);
  const verdict = checkStoredObject({ mimeType, size: sizeBytes }, actual);

  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason, message: verdict.message }, { status: 400 });
  }

  const { error } = await admin.from("documents").insert({
    submission_id: submissionId,
    storage_path: path,
    original_name: originalName,
    // The sniffed type, not the declared one: this column is what admin
    // screens use to decide how to render the file.
    mime_type: verdict.type,
    size_bytes: actual.size ?? sizeBytes,
  });

  if (error) {
    // A retried confirm for an object already recorded is a success, not a
    // duplicate row. The unique index added in migration 011 is what makes
    // this decidable rather than a read-then-write race.
    if (error.code === UNIQUE_VIOLATION) return NextResponse.json({ ok: true, duplicate: true });

    logError("documents_insert_failed", errorFields(error));
    return NextResponse.json({ error: "Could not record the upload" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * What is actually in Storage at `path`: whether it is there, how big it is,
 * and its first bytes.
 *
 * The header is fetched with a Range request through a short-lived signed URL,
 * so verifying a 10MB photo costs 32 bytes of transfer rather than downloading
 * it into the function. A server that ignores `Range` returns the whole body;
 * only the slice is read either way.
 */
async function inspectObject(
  path: string
): Promise<{ exists: boolean; size: number | null; header: Uint8Array | null }> {
  const admin = supabaseAdmin();
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);

  const { data: listed, error: listError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .list(folder, { search: name, limit: 100 });

  if (listError) {
    logError("storage_list_failed", errorFields(listError));
    return { exists: false, size: null, header: null };
  }

  // `search` is a prefix match, so the exact name still has to be found.
  const object = (listed ?? []).find((entry) => entry.name === name);
  if (!object) return { exists: false, size: null, header: null };

  const size =
    typeof object.metadata?.size === "number" ? (object.metadata.size as number) : null;

  const { data: signed, error: signError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 60);

  if (signError || !signed?.signedUrl) {
    logError("signed_url_for_verification_failed", errorFields(signError));
    return { exists: true, size, header: null };
  }

  try {
    const response = await fetch(signed.signedUrl, {
      headers: { Range: `bytes=0-${SIGNATURE_BYTES - 1}` },
    });
    if (!response.ok && response.status !== 206) return { exists: true, size, header: null };
    const buffer = await response.arrayBuffer();
    return { exists: true, size, header: new Uint8Array(buffer).slice(0, SIGNATURE_BYTES) };
  } catch (err) {
    logError("header_fetch_failed", thrownFields(err));
    return { exists: true, size, header: null };
  }
}
