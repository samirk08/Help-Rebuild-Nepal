import type { User } from "@supabase/supabase-js";

import { supabaseServerClient } from "./supabase-server";

/**
 * The authenticated person for volunteer-facing server pages.
 *
 * This only establishes identity. Any submission read must still use the
 * service-role client and filter by this user's id; the browser-authenticated
 * client deliberately has no table privileges.
 */
export async function currentVolunteer(): Promise<User | null> {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return error ? null : user;
}
