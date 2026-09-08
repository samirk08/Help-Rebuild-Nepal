import { DOCUMENTS_BUCKET } from "./storage-constants";
import { supabaseBrowserClient } from "./supabase-browser";
import { logError, thrownFields } from "./log";

/**
 * Uploads picked files straight to Supabase Storage, once a submission row
 * exists to attach them to.
 *
 * The result is per file, not a pair of counts. The counts were the problem:
 * "6 of 8 uploaded" told the person their request had partly failed but gave
 * them nothing to do about it, so the realistic response was to fill in the
 * whole form again — which is how a lost photo turned into a duplicate
 * registration. Each file now carries its own status and its own reason, and a
 * failed one can be retried against the submission that already exists.
 */

export type UploadStatus = "uploaded" | "failed";

export type UploadOutcome = {
  file: File;
  status: UploadStatus;
  /** Present on failure, in the words shown to the person. */
  message?: string;
};

export type UploadSummary = {
  results: UploadOutcome[];
  succeeded: number;
  failed: number;
};

/** The API's machine-readable reasons, in language a person can act on. */
function describe(reason: string | undefined, fallback: string): string {
  switch (reason) {
    case "type_not_allowed":
      return "Not an accepted file type. Use a JPEG, PNG, WebP or HEIC photo, or a PDF.";
    case "too_large":
      return "Larger than the 10MB limit.";
    case "quota_exceeded":
      return "This request has reached its attachment limit.";
    case "empty":
      return "The upload did not finish. Try again.";
    case "not_authorized":
      return "This upload is no longer authorized. Reload the page and try again.";
    case "rate_limited":
      return "Too many uploads at once. Wait a moment and try again.";
    default:
      return fallback;
  }
}

async function uploadOne(
  submissionId: string,
  ticket: string | undefined,
  file: File
): Promise<UploadOutcome> {
  const browser = supabaseBrowserClient();

  try {
    const signRes = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        ticket,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      }),
    });

    if (!signRes.ok) {
      const body = (await signRes.json().catch(() => ({}))) as { error?: string; message?: string };
      return {
        file,
        status: "failed",
        message: body.message ?? describe(body.error, "Could not start the upload."),
      };
    }

    const { path, token } = (await signRes.json()) as { path: string; token: string };

    const { error: uploadError } = await browser.storage
      .from(DOCUMENTS_BUCKET)
      .uploadToSignedUrl(path, token, file);
    if (uploadError) throw uploadError;

    const confirmRes = await fetch("/api/uploads/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        ticket,
        path,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      }),
    });

    if (!confirmRes.ok) {
      const body = (await confirmRes.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      return {
        file,
        status: "failed",
        message: body.message ?? describe(body.error, "The file did not finish uploading."),
      };
    }

    return { file, status: "uploaded" };
  } catch (err) {
    // The filename is the user's, so it is logged by size and type rather
    // than by name: an uploaded document can be called anything.
    logError("document_upload_failed", {
      size_bytes: file.size, mime: file.type || null, ...thrownFields(err),
    });
    return { file, status: "failed", message: "The upload did not finish. Try again." };
  }
}

/**
 * Uploads each file, reporting on each one.
 *
 * Never throws: the submission itself is already saved by the time this runs,
 * and failing the whole flow over an attachment would discard a registration
 * that succeeded. `ticket` is the capability minted by `/api/submissions`; an
 * authenticated owner uploading to their own submission does not need one.
 */
export async function uploadDocuments(
  submissionId: string,
  files: File[],
  ticket?: string
): Promise<UploadSummary> {
  if (files.length === 0) return { results: [], succeeded: 0, failed: 0 };

  const results: UploadOutcome[] = [];
  // Sequential on purpose: the per-submission quota is evaluated against what
  // is already recorded, so parallel signing could each see the same
  // pre-upload state and collectively exceed it.
  for (const file of files) {
    results.push(await uploadOne(submissionId, ticket, file));
  }

  return {
    results,
    succeeded: results.filter((r) => r.status === "uploaded").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
}
