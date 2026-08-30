import { DOCUMENTS_BUCKET } from "./storage-constants";
import { supabaseBrowserClient } from "./supabase-browser";

/**
 * Uploads picked files straight to Supabase Storage, once a submission row
 * exists to attach them to.
 *
 * Best-effort per file: one failed upload doesn't undo an otherwise-successful
 * form submission, since the submission itself is already saved by the time
 * this runs. Failures are swallowed here and surfaced to the caller as a
 * count, not thrown — a lost photo is a smaller problem than a lost
 * registration.
 */
export async function uploadDocuments(
  submissionId: string,
  files: File[]
): Promise<{ succeeded: number; failed: number }> {
  if (files.length === 0) return { succeeded: 0, failed: 0 };

  const browser = supabaseBrowserClient();
  let succeeded = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });
      if (!signRes.ok) throw new Error("sign failed");
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
          path,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!confirmRes.ok) throw new Error("confirm failed");

      succeeded += 1;
    } catch (err) {
      console.error("Document upload failed", file.name, err);
      failed += 1;
    }
  }

  return { succeeded, failed };
}
