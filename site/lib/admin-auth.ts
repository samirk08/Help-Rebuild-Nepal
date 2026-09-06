import { supabaseAdmin } from "./supabase";

/**
 * Whether a signed-in user may use the coordination dashboard.
 *
 * Until volunteers could sign in, "is anyone signed in" was an adequate gate,
 * because the only accounts in the project were invited admins. Volunteer
 * accounts break that assumption completely: they live in the same Supabase
 * user pool, so a volunteer session satisfies an existence check just as well
 * as an admin one would. Without this, adding volunteer sign-in would hand
 * every volunteer the full register — every phone number, every address,
 * every uploaded document.
 *
 * Membership is a table rather than a flag on the user so that revoking access
 * is a delete an admin can perform and audit, not a metadata edit.
 */
export async function isAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Volunteer accounts now exist. Missing migrations must never grant them
    // access to private registrations or matching details.
    console.error("admin allowlist check failed", error);
    return false;
  }

  return Boolean(data);
}

/** Whether the allowlist table exists yet, for the diagnostics page. */
export async function adminAllowlistReady(): Promise<{ ready: boolean; detail: string }> {
  const { count, error } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id", { count: "exact", head: true });

  if (error?.code === "42P01") {
    return {
      ready: false,
      detail:
        "Not created yet. Run supabase/004-accounts.sql and review the admin allowlist. Dashboard access is denied until it is available.",
    };
  }
  if (error) return { ready: false, detail: `[${error.code}] ${error.message}` };

  return { ready: true, detail: `${count ?? 0} account(s) may use this dashboard.` };
}
