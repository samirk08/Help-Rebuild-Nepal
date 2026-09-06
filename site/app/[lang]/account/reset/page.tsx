"use client";

import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { added } from "@/lib/added-strings";
import { MIN_PASSWORD_LENGTH } from "@/lib/account-claim";
import { isLang } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { supabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Where the reset link lands: choose a new password.
 *
 * The recovery link establishes a short-lived session before this renders, so
 * the page checks for one rather than accepting a token from the URL itself.
 * Someone arriving without it is told the link has expired instead of being
 * shown a form that cannot work.
 */
export default function ResetPasswordPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  if (!isLang(lang)) notFound();
  const currentLang = lang;

  const a = added(currentLang);
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setReady(Boolean(data.user));
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(a.claimPasswordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(a.claimPasswordMismatch);
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabaseBrowserClient().auth.updateUser({ password });
      if (updateError) {
        setError(a.claimError);
        return;
      }
      router.replace(screenPath(currentLang, "profile"));
      router.refresh();
    } catch {
      setError(a.claimError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <div className="card" style={{ padding: 32 }}>
        <h1 className="h1" style={{ fontSize: 32, marginBottom: 12 }}>
          {a.recoverTitle}
        </h1>

        {ready === false ? (
          <p className="notice notice--warn" role="alert">
            {a.claimCodeInvalid}
          </p>
        ) : null}

        {error ? (
          <p className="notice notice--warn" role="alert">
            {error}
          </p>
        ) : null}

        {ready ? (
          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 14 }}>
              <label className="field__label" htmlFor="reset-password">
                {a.claimPassword}
              </label>
              <input
                id="reset-password"
                type="password"
                className="input"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span className="field__note">{a.claimPasswordHint}</span>
            </div>

            <div className="field" style={{ marginBottom: 18 }}>
              <label className="field__label" htmlFor="reset-confirm">
                {a.claimConfirmPassword}
              </label>
              <input
                id="reset-confirm"
                type="password"
                className="input"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={128}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>

            <button type="submit" className="btn btn--green btn--md" disabled={submitting}>
              {submitting ? a.claimSubmitting : a.claimSubmit}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
