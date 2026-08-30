import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";

/**
 * Records a `documents` row once the browser has finished PUTting a file's
 * bytes to the signed URL from `/api/uploads/sign`. This route never sees the
 * file itself, only its metadata.
 */
export async function POST(request: Request) {
  let body: {
    submissionId?: unknown;
    path?: unknown;
    originalName?: unknown;
    mimeType?: unknown;
    sizeBytes?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { submissionId, path, originalName, mimeType, sizeBytes } = body;

  if (
    typeof submissionId !== "string" ||
    typeof path !== "string" ||
    typeof originalName !== "string" ||
    typeof mimeType !== "string" ||
    typeof sizeBytes !== "number"
  ) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // The signed-upload path is always "{submissionId}/...", so this also
  // rejects a confirm call for a path that was never signed for this submission.
  if (!path.startsWith(`${submissionId}/`)) {
    return NextResponse.json({ error: "Path does not belong to this submission" }, { status: 400 });
  }

  const { error } = await supabaseAdmin().from("documents").insert({
    submission_id: submissionId,
    storage_path: path,
    original_name: originalName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
  });

  if (error) {
    console.error("documents insert failed", error);
    return NextResponse.json({ error: "Could not record the upload" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
