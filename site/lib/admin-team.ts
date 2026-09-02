"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdmin } from "./admin-auth";
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
 *
 * Throughout, "the team" means the `admin_users` allowlist — never the Supabase
 * Auth user list. Volunteers hold accounts in that same pool, so listing users
 * answers "who has an account on this site", which is a different and much
 * longer question than "who may use this dashboard".
 */

async function requireAdmin(): Promise<string> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) redirect("/admin/login");
  return user.id;
}

export type TeamMember = {
  id: string;
  email: string;
  addedAt: string;
  lastSignInAt: string | null;
  isSelf: boolean;
};

/**
 * Everyone on the dashboard allowlist.
 *
 * Sourced from `admin_users`, not from `auth.admin.listUsers()`. The user list
 * returns every account in the project — volunteers who claimed their
 * registration on the thank-you page included — so it reported the whole
 * register as though it were the team, and grew by one every time somebody
 * signed up.
 *
 * `last_sign_in_at` lives only in Auth, so it is fetched per member. That is
 * one request each, which is fine for a table of admins and would not have
 * been for a table of volunteers.
 */
export async function listTeam(): Promise<TeamMember[]> {
  const selfId = await requireAdmin();

  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id, email, added_at")
    .order("added_at", { ascending: true });

  if (error) {
    console.error("admin_users read failed", error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    user_id: string;
    email: string | null;
    added_at: string;
  }>;

  const members = await Promise.all(
    rows.map(async (row) => {
      // The allowlist keeps its own copy of the email so a member is still
      // identifiable if this lookup fails or the Auth account is gone.
      const { data: found } = await supabaseAdmin().auth.admin.getUserById(row.user_id);

      return {
        id: row.user_id,
        email: found?.user?.email ?? row.email ?? "—",
        addedAt: row.added_at,
        lastSignInAt: found?.user?.last_sign_in_at ?? null,
        isSelf: row.user_id === selfId,
      };
    })
  );

  return members.sort((a, b) => a.email.localeCompare(b.email));
}

export type LinkResult = { path?: string; email?: string; isNew?: boolean; error?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase's ways of saying "that address already has an account". */
function isExistingUserError(error: { code?: string; message?: string } | null): boolean {
  const code = error?.code;
  if (code === "email_exists" || code === "user_already_exists") return true;
  return /already (been )?registered|already exists/i.test(error?.message ?? "");
}

/**
 * Adds `email` to the dashboard allowlist and returns a single-use sign-in link.
 *
 * Two things have to happen, and both are needed for the person to actually get
 * in: an Auth account has to exist, and a row has to exist in `admin_users`.
 * This used to do only the first, so an invited teammate could set a password,
 * sign in successfully, and still be bounced to the login page forever by the
 * middleware — an account without access to anything.
 *
 * Whether the account is new is decided by trying to create it, not by
 * searching the user list. The old check paged through the first 200 users and
 * called anyone it did not find "new", which was true while only admins had
 * accounts and became a coin flip once volunteers filled that list up.
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

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const client = supabaseAdmin();

  // "invite" creates the account; "recovery" is for one that already exists.
  // Calling the wrong one errors, which is what makes this a reliable test of
  // which case we are in.
  let isNew = true;
  let result = await client.auth.admin.generateLink({ type: "invite", email });

  if (result.error && isExistingUserError(result.error)) {
    isNew = false;
    result = await client.auth.admin.generateLink({ type: "recovery", email });
  }

  if (result.error) return { error: result.error.message };

  const tokenHash = result.data.properties?.hashed_token;
  const userId = result.data.user?.id;
  if (!tokenHash || !userId) return { error: "Supabase did not return a usable token." };

  // Granting access is the point of this action, so a failure here is a
  // failure of the whole thing — returning the link anyway would hand over a
  // credential that cannot reach the dashboard, which is the bug this fixes.
  const { error: grantError } = await client
    .from("admin_users")
    .upsert({ user_id: userId, email }, { onConflict: "user_id" });

  if (grantError) {
    console.error("admin allowlist grant failed", grantError);
    return { error: `Account is ready, but granting dashboard access failed: ${grantError.message}` };
  }

  revalidatePath("/admin/team");

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

export type RevokeResult = { removed?: string; error?: string };

/**
 * Takes someone off the dashboard allowlist.
 *
 * Their Auth account is left alone: it may be the account they registered as a
 * volunteer with, and deleting it would take their registration's `user_id`
 * with it. This removes dashboard access and nothing else.
 *
 * Removing yourself is refused. It is always a mistake — there is no second
 * role to fall back to, so the tab you are looking at is the last one that
 * could undo it, and the only way back would be the SQL editor.
 */
export async function revokeAdmin(
  _prev: RevokeResult | null,
  formData: FormData
): Promise<RevokeResult> {
  const selfId = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "No account given." };
  if (userId === selfId) return { error: "You cannot remove your own access." };

  const client = supabaseAdmin();

  const { data, error } = await client
    .from("admin_users")
    .delete()
    .eq("user_id", userId)
    .select("email")
    .maybeSingle();

  if (error) {
    console.error("admin allowlist revoke failed", error);
    return { error: error.message };
  }
  if (!data) return { error: "That account is not on the list." };

  revalidatePath("/admin/team");
  return { removed: data.email ?? "That account" };
}
