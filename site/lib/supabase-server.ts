import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * A Supabase client bound to the current request's session cookie, for
 * reading who's signed in inside a Server Component or Route Handler.
 *
 * Uses the anon key — safe to expose, unlike the service role key in
 * `lib/supabase.ts`. This client is only ever used to answer "who is this?"
 * (`auth.getUser()`), never to read or write application data: every actual
 * query against `submissions`/`documents`/etc. goes through `supabaseAdmin()`
 * instead, because access to `/admin` is gated by middleware, not by Supabase
 * Row Level Security policies (see `supabase/schema.sql`).
 */
export async function supabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written. Harmless as long as middleware also refreshes the
            // session — it does (see middleware.ts).
          }
        },
      },
    }
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set. See README.md.`);
  return value;
}
