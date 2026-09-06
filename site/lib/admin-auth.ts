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
 *
 * Every failure answers "not an admin", including the table being absent.
 * This used to treat a missing `admin_users` as "let everyone through", so
 * that deploying the allowlist could not lock the team out before they had a
 * chance to run migration 004. That reasoning expired the moment volunteer
 * sign-in shipped: from then on the fallback's effect was to hand every
 * volunteer the whole register, which is the exact breach the allowlist
 * exists to prevent. It is better to lock everyone out — recoverable by
 * running the migration — than to let everyone in.
 */
export async function isAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // 42P01 = undefined_table: migration 004 has not been run. Named here
    // because it is the one failure with a specific remedy, and because
    // /admin/diagnostics is itself behind this gate — so if it ever happens,
    // the server log is where the reason will be.
    if (error.code === "42P01") {
      console.error("admin_users is missing — run supabase/004-accounts.sql. Refusing all dashboard access until it exists.");
    } else {
      console.error("admin allowlist check failed", error);
    }
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
        "Not created yet. Run supabase/004-accounts.sql. Until it exists the dashboard refuses " +
        "everyone, so in practice nobody can reach this page to read this.",
    };
  }
  if (error) return { ready: false, detail: `[${error.code}] ${error.message}` };

  return { ready: true, detail: `${count ?? 0} account(s) may use this dashboard.` };
}
