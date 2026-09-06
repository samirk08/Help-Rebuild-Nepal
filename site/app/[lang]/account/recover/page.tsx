"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useState } from "react";

import { added } from "@/lib/added-strings";
import { isLang } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";

/**
 * The way back in for a returning volunteer who has forgotten their password.
 *
 * Without this, the only route to a working account was to register a second
 * time — the duplicate registration the claim flow exists to prevent.
 *
 * The confirmation is shown for any well-formed address, never only for ones
 * that have an account, so this page cannot be used to test which addresses
 * are registered.
 */
export default function RecoverPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  if (!isLang(lang)) notFound();
  const currentLang = lang;

  const a = added(currentLang);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/account/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang: currentLang }),
      });
    } catch {
      // Deliberately ignored: the confirmation below is shown either way, so a
      // network blip must not become a signal about the address.
    } finally {
      setSent(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <div className="card" style={{ padding: 32 }}>
        <h1 className="h1" style={{ fontSize: 32, marginBottom: 12 }}>
          {a.recoverTitle}
        </h1>
        <p className="intro" style={{ marginBottom: 24 }}>
          {a.recoverIntro}
        </p>

        {sent ? (
          <p className="notice" role="status">
            {a.recoverSent}
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 18 }}>
              <label className="field__label" htmlFor="recover-email">
                {a.loginEmail}
              </label>
              <input
                id="recover-email"
                type="email"
                className="input"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <button type="submit" className="btn btn--green btn--md" disabled={submitting}>
              {submitting ? a.recoverSubmitting : a.recoverSubmit}
            </button>
          </form>
        )}

        <p className="hint" style={{ marginTop: 24 }}>
          <Link href={screenPath(currentLang, "accountLogin")}>{a.loginSubmit}</Link>
        </p>
      </div>
    </div>
  );
}
