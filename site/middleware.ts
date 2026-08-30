import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Gates `/admin/**`. Everything else on the site is public and untouched.
 *
 * Also refreshes the Supabase session cookie on every admin request, so a
 * signed-in teammate doesn't get bounced to the login page mid-session just
 * because their access token expired — this is the pattern Supabase's own
 * Next.js docs recommend for the App Router.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /api/admin/** (CSV export, etc.) has no login page of its own to redirect
  // to — it's fetched directly, not navigated to — so it gets a 401 instead.
  if (!user && request.nextUrl.pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isLoginPage = request.nextUrl.pathname === "/admin/login";

  if (!user && !isLoginPage) {
    const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
    // Send people back to where they were headed once they've signed in.
    redirect.cookies.set("admin-redirect", request.nextUrl.pathname, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 300,
    });
    return redirect;
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
