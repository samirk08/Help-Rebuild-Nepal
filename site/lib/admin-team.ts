"use server";

import { redirect } from "next/navigation";

import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";

/**
 * Admin account management that does not depend on Supabase sending email.
 *
 * Supabase's built-in email provider cannot be used to onboard this team: it is
 * capped at 2 messages an hour, and since 2024-09-26 it refuses to deliver to
 * any address that is not a member of the project's Supabase organization.
 * Inviting a teammate at their own work or personal address therefore fails
 * silently — the API reports success and no message is ever sent, which is
 * exactly what happened here.
 *
 * So instead of sending anything, this mints the sign-in link server-side and
 * hands it to the admin to pass on through a channel they already trust. The
 * link carries a `token_hash` that /admin/auth/callback verifies directly,
 * which also means it never travels through Supabase's redirect and so is
 * unaffected by the project's Site URL or redirect allowlist.
 *
 * Configuring custom SMTP remains the right long-term answer; this removes the
 * dependency in the meantime.
 */

async function requireAdmin(): Promise<void> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
}

export type TeamMember = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
};

export async function listTeam(): Promise<TeamMember[]> {
  await requireAdmin();

  const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.error("listUsers failed", error);
    return [];
  }

  return data.users
    .map((user) => ({
      id: user.id,
      email: user.email ?? "—",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export type LinkResult = { path?: string; email?: string; isNew?: boolean; error?: string };

/**
 * A single-use sign-in link for `email`, creating the account if it is new.
 *
 * Any admin can mint a link for any address, including another admin's. That is
 * not an escalation: every admin already has full access to every record, and
 * there are no roles to escalate between. It is worth knowing about all the
 * same, which is why the UI says so.
 */
export async function createAccessLink(
  _prev: LinkResult | null,
  formData: FormData
): Promise<LinkResult> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const client = supabaseAdmin();

  const { data: existing, error: listError } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) return { error: listError.message };

  const isNew = !existing.users.some((u) => u.email?.toLowerCase() === email);

  // "invite" creates the account; "recovery" is for one that already exists.
  // Calling the wrong one errors, so the choice is made from the user list.
  const { data, error } = isNew
    ? await client.auth.admin.generateLink({ type: "invite", email })
    : await client.auth.admin.generateLink({ type: "recovery", email });

  if (error) return { error: error.message };

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) return { error: "Supabase did not return a usable token." };

  // Path only. The caller prepends its own origin, so a link can never be
  // pinned to a stale or misconfigured host.
  return {
    path: `/admin/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${
      isNew ? "invite" : "recovery"
    }`,
    email,
    isNew,
  };
}
