"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
import { BUG_SEVERITIES, BUG_STATUSES } from "./bug-constants";
import { DOCUMENTS_BUCKET } from "./storage-constants";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";

/**
 * Bug reports filed from the dashboard.
 *
 * The point of this over a chat message is that a bug keeps its screenshot,
 * its URL and the browser it was filed from, and can be handed over whole.
 * `formatBugsForHandover` is what makes that last part work: the list page has
 * a button that copies every open bug as plain text, because the person
 * debugging this generally cannot sign in to read the table themselves.
 */

const SIGNED_URL_TTL_SECONDS = 60 * 10;

export type BugAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  /** Short-lived signed read URL; the bucket is private. */
  url: string;
};

export type BugReport = {
  id: string;
  title: string;
  detail: string | null;
  pageUrl: string | null;
  severity: string;
  status: string;
  reportedByEmail: string | null;
  reportedFrom: string | null;
  createdAt: string;
  resolvedAt: string | null;
  attachmentCount: number;
};

async function requireAdmin(): Promise<{ id: string; email: string }> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) redirect("/admin/login");
  return { id: user.id, email: user.email ?? "" };
}

type Row = {
  id: string;
  title: string;
  detail: string | null;
  page_url: string | null;
  severity: string;
  status: string;
  reported_by_email: string | null;
  reported_from: string | null;
  created_at: string;
  resolved_at: string | null;
};

function toBug(row: Row, attachmentCount: number): BugReport {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    pageUrl: row.page_url,
    severity: row.severity,
    status: row.status,
    reportedByEmail: row.reported_by_email,
    reportedFrom: row.reported_from,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    attachmentCount,
  };
}

export async function listBugs(status?: string): Promise<BugReport[]> {
  await requireAdmin();
  const client = supabaseAdmin();

  let query = client
    .from("bug_reports")
    .select("*")
    // Blocking first, then newest — the order someone triaging wants.
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("listBugs failed", error);
    return [];
  }

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const { data: counts } = await client
    .from("bug_attachments")
    .select("bug_id")
    .in("bug_id", rows.map((r) => r.id));

  const byBug = new Map<string, number>();
  for (const a of counts ?? []) byBug.set(a.bug_id, (byBug.get(a.bug_id) ?? 0) + 1);

  const rank = { blocking: 0, normal: 1, minor: 2 } as Record<string, number>;
  return rows
    .map((row) => toBug(row, byBug.get(row.id) ?? 0))
    .sort((a, b) => (rank[a.severity] ?? 1) - (rank[b.severity] ?? 1));
}

export async function getBug(
  id: string
): Promise<{ bug: BugReport; attachments: BugAttachment[] } | null> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const client = supabaseAdmin();
  const { data } = await client.from("bug_reports").select("*").eq("id", id).maybeSingle();
  if (!data) return null;

  const { data: rows } = await client
    .from("bug_attachments")
    .select("id, storage_path, original_name, mime_type, size_bytes")
    .eq("bug_id", id)
    .order("created_at", { ascending: true });

  const attachments = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: signed } = await client.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id,
        originalName: row.original_name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        url: signed?.signedUrl ?? "",
      };
    })
  );

  return {
    bug: toBug(data as Row, attachments.length),
    attachments: attachments.filter((a) => a.url !== ""),
  };
}

/** Creates the bug and returns its id, so the browser can attach files to it. */
export async function createBug(formData: FormData): Promise<{ id?: string; error?: string }> {
  const admin = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) return { error: "Give it a one-line title." };

  const severity = String(formData.get("severity") ?? "normal");
  if (!(BUG_SEVERITIES as readonly string[]).includes(severity)) {
    return { error: "Unknown severity." };
  }

  const { data, error } = await supabaseAdmin()
    .from("bug_reports")
    .insert({
      title,
      detail: String(formData.get("detail") ?? "").trim().slice(0, 8000) || null,
      page_url: String(formData.get("pageUrl") ?? "").trim().slice(0, 500) || null,
      severity,
      reported_by: admin.id,
      reported_by_email: admin.email,
      reported_from: String(formData.get("reportedFrom") ?? "").trim().slice(0, 400) || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createBug failed", error);
    return { error: error.message };
  }

  revalidatePath("/admin/bugs");
  return { id: data.id };
}

export async function updateBugStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!(BUG_STATUSES as readonly string[]).includes(status)) throw new Error("Unknown status");

  const { error } = await supabaseAdmin()
    .from("bug_reports")
    .update({ status, resolved_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/bugs");
  revalidatePath(`/admin/bugs/${id}`);
}

export async function deleteBug(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const client = supabaseAdmin();

  // Storage first: deleting the row cascades the attachment records away and
  // would strand the images with nothing left pointing at them. Same ordering
  // as deleteVolunteer in admin-actions.ts, for the same reason.
  const { data: files } = await client
    .from("bug_attachments")
    .select("storage_path")
    .eq("bug_id", id);

  const paths = (files ?? []).map((f) => f.storage_path as string);
  if (paths.length > 0) await client.storage.from(DOCUMENTS_BUCKET).remove(paths);

  const { error } = await client.from("bug_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/bugs");
  redirect("/admin/bugs");
}

/**
 * Every open bug as plain text, for pasting to whoever is fixing them.
 *
 * This exists because the useful reader of this table usually has no way to
 * sign in and read it. Screenshots cannot travel in text, so each bug says how
 * many it has and where to find them rather than pretending otherwise.
 */
export async function formatBugsForHandover(): Promise<string> {
  const bugs = await listBugs("open");
  if (bugs.length === 0) return "No open bugs.";

  const lines = [`# Open bugs (${bugs.length})`, ""];

  for (const bug of bugs) {
    lines.push(`## ${bug.title}`);
    lines.push(`- severity: ${bug.severity}`);
    if (bug.pageUrl) lines.push(`- page: ${bug.pageUrl}`);
    lines.push(`- reported: ${new Date(bug.createdAt).toISOString()} by ${bug.reportedByEmail ?? "—"}`);
    if (bug.reportedFrom) lines.push(`- reported from: ${bug.reportedFrom}`);
    if (bug.attachmentCount > 0) {
      lines.push(
        `- screenshots: ${bug.attachmentCount} (in /admin/bugs/${bug.id} — attach them to the chat to be seen)`
      );
    }
    if (bug.detail) {
      lines.push("");
      lines.push(bug.detail);
    }
    lines.push("");
  }

  return lines.join("\n");
}
