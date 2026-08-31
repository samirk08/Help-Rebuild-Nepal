"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { screenPath } from "@/lib/routes";
import { supabaseBrowserClient } from "@/lib/supabase-browser";

const MIN_PASSWORD_LENGTH = 10;

export default function ClaimAccountForm({
  lang,
  submissionId,
}: {
  lang: Lang;
  submissionId: string;
}) {
  const a = added(lang);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

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
      const response = await fetch("/api/account/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, email, password }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(messageForError(result.error, a));
        return;
      }

      const supabase = supabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setAccountCreated(true);
        setError(a.claimCreatedSignInFailed);
        return;
      }

      router.replace(screenPath(lang, "profile"));
      router.refresh();
    } catch {
      setError(a.claimError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel panel--organize" style={{ marginBottom: 24 }}>
      <h2 className="panel__title">{a.claimTitle}</h2>
      <p className="panel__body">{a.claimIntro}</p>

      {error ? (
        <p className="notice notice--warn" role="alert">
          {error}
          {accountCreated ? (
            <>
              {" "}
              <Link href={screenPath(lang, "accountLogin")}>{a.claimLoginLink}</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {!accountCreated ? (
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="submissionId" value={submissionId} />

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label" htmlFor="claim-email">
              {a.claimEmail}
            </label>
            <input
              id="claim-email"
              name="email"
              type="email"
              className="input"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <span className="field__note">{a.claimEmailHint}</span>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label" htmlFor="claim-password">
              {a.claimPassword}
            </label>
            <input
              id="claim-password"
              name="password"
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

          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field__label" htmlFor="claim-confirm-password">
              {a.claimConfirmPassword}
            </label>
            <input
              id="claim-confirm-password"
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
  );
}

function messageForError(error: string | undefined, a: ReturnType<typeof added>): string {
  if (error === "email_mismatch") return a.claimEmailMismatch;
  if (error === "submission_claimed") return a.claimAlreadyUsed;
  if (error === "submission_unavailable" || error === "invalid_request") {
    return a.claimUnavailable;
  }
  if (error === "account_exists") return a.claimAccountExists;
  return a.claimError;
}
