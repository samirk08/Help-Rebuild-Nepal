"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { added } from "@/lib/added-strings";
import { MIN_PASSWORD_LENGTH } from "@/lib/account-claim";
import type { Lang } from "@/lib/content";
import { screenPath } from "@/lib/routes";

/**
 * Claiming the account attached to a registration, in two steps.
 *
 * The first step asks for the email and sends a code; the second exchanges the
 * code for a linked, signed-in account. The password is chosen alongside the
 * code rather than before it, so nothing is created until the mailbox has
 * answered — see lib/account-claim.ts for why that ordering is the point.
 */
export default function ClaimAccountForm({
  lang,
  submissionId,
}: {
  lang: Lang;
  submissionId: string;
}) {
  const a = added(lang);
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/account/claim/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, email }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        setError(messageForError(result.error, a));
        return;
      }

      // Always advances, whatever the server found. The step-two screen says
      // "if that email matches, a code is on its way", which is the same thing
      // the API says — a wrong address must not be distinguishable here.
      setStep("code");
    } catch {
      setError(a.claimError);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
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
      const response = await fetch("/api/account/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, email, code, password }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        setError(messageForError(result.error, a));
        return;
      }

      // The verify response set the session cookie, so the profile is reachable
      // without a second sign-in.
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
      <h2 className="panel__title">{step === "email" ? a.claimTitle : a.claimCodeStepTitle}</h2>
      <p className="panel__body">{step === "email" ? a.claimIntro : a.claimCodeSent}</p>

      {error ? (
        <p className="notice notice--warn" role="alert">
          {error}{" "}
          <Link href={screenPath(lang, "accountLogin")}>{a.claimLoginLink}</Link>
        </p>
      ) : null}

      {step === "email" ? (
        <form onSubmit={requestCode}>
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
            <span className="field__note">{a.claimStartHint}</span>
          </div>

          <button type="submit" className="btn btn--green btn--md" disabled={submitting}>
            {submitting ? a.claimSendingCode : a.claimSendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field__label" htmlFor="claim-code">
              {a.claimCodeLabel}
            </label>
            <input
              id="claim-code"
              name="code"
              type="text"
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={12}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <span className="field__note">{a.claimCodeHint}</span>
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

          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="btn btn--green btn--md" disabled={submitting}>
              {submitting ? a.claimSubmitting : a.claimSubmit}
            </button>
            <button
              type="button"
              className="reset-button linkish"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              {a.claimUseAnotherEmail}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function messageForError(error: string | undefined, a: ReturnType<typeof added>): string {
  if (error === "invalid_code") return a.claimCodeInvalid;
  if (error === "already_claimed") return a.claimAlreadyUsed;
  if (error === "submission_unavailable") return a.claimUnavailable;
  if (error === "weak_password") return a.claimPasswordTooShort;
  return a.claimError;
}
