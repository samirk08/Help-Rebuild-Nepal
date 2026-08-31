import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { DOCUMENTS_BUCKET, supabaseAdmin } from "@/lib/supabase";
import { supabaseServerClient } from "@/lib/supabase-server";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Signed upload URL for a bug screenshot, plus the row that records it.
 *
 * Same shape as app/api/uploads/sign — the bytes go straight from the browser
 * to Storage so a big retina screenshot never has to fit through a serverless
 * function body. Sits under /api/admin/ so middleware gates it, and re-checks
 * the allowlist here anyway.
 *
 * POST { bugId, filename, mimeType, size }        -> { path, token }
 * POST { bugId, path, filename, mimeType, size, confirm: true } -> { ok }
 */
export async function POST(request: Request) {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { bugId, filename, mimeType, size, path, confirm } = body;

  if (typeof bugId !== "string" || !/^[0-9a-f-]{36}$/i.test(bugId)) {
    return NextResponse.json({ error: "bugId must be a uuid" }, { status: 400 });
  }
  if (typeof filename !== "string" || !filename || filename.length > 200) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  // Images only. A bug report has no reason to carry an arbitrary file, and
  // narrowing what can be stored narrows what can be served back out.
  if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Only images are accepted" }, { status: 400 });
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "Image exceeds the 10MB limit" }, { status: 400 });
  }

  const client = supabaseAdmin();

  const { data: bug } = await client.from("bug_reports").select("id").eq("id", bugId).maybeSingle();
  if (!bug) return NextResponse.json({ error: "Unknown bug" }, { status: 404 });

  if (confirm === true) {
    if (typeof path !== "string" || !path.startsWith(`bugs/${bugId}/`)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const { error } = await client.from("bug_attachments").insert({
      bug_id: bugId,
      storage_path: path,
      original_name: filename,
      mime_type: mimeType,
      size_bytes: size,
    });
    if (error) {
      console.error("bug attachment insert failed", error);
      return NextResponse.json({ error: "Could not record the image" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `bugs/${bugId}/${Date.now()}-${safeName}`;

  const { data, error } = await client.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    console.error("bug createSignedUploadUrl failed", error);
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
