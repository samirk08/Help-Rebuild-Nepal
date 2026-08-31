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
    // 42P01 = undefined_table: migration 004 has not been run yet. Failing
    // closed here would lock the whole team out of the dashboard the moment
    // this deploys, before anyone could apply it — so this one case keeps the
    // previous behaviour (any signed-in user is an admin), which is exactly as
    // safe as it was yesterday because volunteer accounts do not exist yet.
    // /admin/diagnostics reports it so it cannot go unnoticed.
    if (error.code === "42P01") {
      console.error("admin_users is missing — run supabase/004-accounts.sql. Allowing existing admins through in the meantime.");
      return true;
    }

    // Anything else is a real fault, and the safe answer is "not an admin".
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
        "Not created yet. Run supabase/004-accounts.sql. Until then every signed-in account is " +
        "treated as an admin, which must be fixed before volunteer sign-in ships.",
    };
  }
  if (error) return { ready: false, detail: `[${error.code}] ${error.message}` };

  return { ready: true, detail: `${count ?? 0} account(s) may use this dashboard.` };
}
