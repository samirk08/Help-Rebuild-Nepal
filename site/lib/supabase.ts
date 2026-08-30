import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export { DOCUMENTS_BUCKET } from "./storage-constants";

/**
 * The one Supabase client this app uses for submissions, storage and admin
 * queries — built from the service role key.
 *
 * That key bypasses Row Level Security, so it must never reach the browser:
 * every file that imports this one is either a server component, a route
 * handler, or middleware. There is no client-side Supabase usage anywhere in
 * this app — the browser only ever talks to this app's own routes, plus the
 * one short-lived signed upload URL it's issued per file (see
 * `app/api/uploads/sign/route.ts`).
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. See supabase/schema.sql and README.md."
    );
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
