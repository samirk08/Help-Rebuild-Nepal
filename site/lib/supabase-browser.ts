"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * The one place the browser touches Supabase directly: signing in on
 * `/admin/login`. Uses the anon key, which is designed to be public — the
 * service role key in `lib/supabase.ts` never leaves the server.
 */
export function supabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
