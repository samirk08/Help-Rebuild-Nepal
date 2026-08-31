"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { supabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Where every Supabase email link lands: invites, password recovery, magic
 * links.
 *
 * This has to be a client page. Supabase's `/auth/v1/verify` endpoint returns
 * the session in the URL **hash** (`#access_token=…`), and a hash is never sent
 * to the server — so a server route would receive an apparently empty request
 * and could not complete the sign-in. Errors come back the same way
 * (`#error=access_denied&error_code=otp_expired`), which is why a plain landing
 * page shows nothing useful.
 *
 * Both shapes are handled, because which one Supabase uses depends on the
 * project's flow setting:
 *   - implicit: `#access_token=…&refresh_token=…&type=invite`
 *   - PKCE:     `?code=…`
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowserClient();

    async function complete() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);

      // Supabase reports failures (expired or already-used links) in either
      // place. Surface its own wording rather than a generic failure.
      const failed = hash.get("error_description") ?? query.get("error_description");
      if (failed) {
        setError(failed.replace(/\+/g, " "));
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");
      const tokenHash = query.get("token_hash");

      let signedIn = false;

      // A link minted by an admin on /admin/team. Verified here directly, so
      // it never passes through Supabase's redirect — which means it works
      // regardless of the project's Site URL or redirect allowlist, and does
      // not depend on Supabase's built-in email being able to deliver at all.
      if (tokenHash) {
        const otpType = (query.get("type") ?? "recovery") as "invite" | "recovery" | "email";
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (otpError) {
          setError(otpError.message);
          return;
        }
        signedIn = true;
      }

      if (signedIn) {
        // already handled above
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        signedIn = true;
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        signedIn = true;
      }

      if (!signedIn) {
        // Someone navigated here directly, with nothing to exchange.
        router.replace("/admin/login");
        return;
      }

      // An invited user has no password yet, and a recovery link means they
      // want to change theirs — both need the same next step. Anything else
      // (a magic link) is already done.
      const type = hash.get("type") ?? query.get("type");
      const needsPassword = type === "invite" || type === "recovery" || type === "signup";

      // The session now lives in cookies, so the server and middleware can see
      // it. refresh() makes them re-read before the redirect lands.
      router.refresh();
      router.replace(needsPassword ? "/admin/set-password" : "/admin");
    }

    void complete();
  }, [router]);

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <p className="admin-login__eyebrow">Help Rebuild Nepal</p>
        <h1 className="admin-login__title">{error ? "That link did not work" : "Signing you in…"}</h1>

        {error ? (
          <>
            <p className="admin-login__error" role="alert">
              {error}
            </p>
            <p className="admin-login__sub">
              Invite and reset links can only be used once, and they expire. Request a fresh one
              from the sign-in page.
            </p>
            <a href="/admin/login" className="btn btn--dark btn--block">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="admin-login__sub">One moment while we finish setting up your session.</p>
        )}
      </div>
    </div>
  );
}
