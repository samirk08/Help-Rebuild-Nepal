import { DOCUMENTS_BUCKET } from "./storage-constants";
import { supabaseAdmin } from "./supabase";

export type SubmissionDocument = {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
};

const SIGNED_URL_TTL_SECONDS = 60 * 10;

/**
 * Documents attached to a submission, each with a signed, short-lived read
 * URL. The bucket is private — this is the only way to view a file, and the
 * link expires, so it's never something that can be reshared and still work.
 */
export async function documentsFor(submissionId: string): Promise<SubmissionDocument[]> {
  const client = supabaseAdmin();

  const { data: rows } = await client
    .from("documents")
    .select("id, storage_path, original_name, mime_type, size_bytes")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) return [];

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data } = await client.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id,
        original_name: row.original_name,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        url: data?.signedUrl ?? "",
      };
    })
  );

  return withUrls.filter((doc) => doc.url !== "");
}
