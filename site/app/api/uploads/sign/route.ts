import { NextResponse } from "next/server";

import { DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase";

const ALLOWED_TYPES = new Set(["application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Mints a signed Storage upload URL scoped to one submission's folder.
 *
 * Files never pass through this route or any Vercel function body — the
 * browser PUTs bytes straight to Supabase Storage using the token this
 * returns, which is what keeps an 8-file, 10MB-each upload (already promised
 * in FileUpload.tsx's UI) clear of serverless payload-size limits. This route
 * only ever touches the service role key server-side; the browser gets back
 * a path and a token, never the key.
 */
export async function POST(request: Request) {
  let body: { submissionId?: unknown; filename?: unknown; mimeType?: unknown; size?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { submissionId, filename, mimeType, size } = body;

  if (typeof submissionId !== "string" || !/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json({ error: "submissionId must be a uuid" }, { status: 400 });
  }
  if (typeof filename !== "string" || filename.length === 0 || filename.length > 200) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  if (typeof mimeType !== "string" || !(mimeType.startsWith("image/") || ALLOWED_TYPES.has(mimeType))) {
    return NextResponse.json({ error: "Only images or PDFs are accepted" }, { status: 400 });
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10MB limit" }, { status: 400 });
  }

  // Confirming a submission row exists first stops a stranger from filing
  // documents against an id they guessed.
  const { data: submission } = await supabaseAdmin()
    .from("submissions")
    .select("id")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Unknown submission" }, { status: 404 });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${submissionId}/${Date.now()}-${safeName}`;

  const { data, error } = await supabaseAdmin()
    .storage.from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("createSignedUploadUrl failed", error);
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
