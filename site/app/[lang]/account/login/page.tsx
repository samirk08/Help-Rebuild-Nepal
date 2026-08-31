"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useState } from "react";

import { added } from "@/lib/added-strings";
import { isLang } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { supabaseBrowserClient } from "@/lib/supabase-browser";

export default function VolunteerLoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = use(params);
  if (!isLang(lang)) notFound();
  const currentLang = lang;

  const a = added(currentLang);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = supabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError(a.loginError);
        return;
      }

      router.replace(screenPath(currentLang, "profile"));
      router.refresh();
    } catch {
      setError(a.loginError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--narrow">
      <div className="card" style={{ padding: 32 }}>
        <h1 className="h1" style={{ fontSize: 32, marginBottom: 12 }}>
          {a.loginTitle}
        </h1>
        <p className="intro" style={{ marginBottom: 24 }}>
          {a.loginIntro}
        </p>

        {error ? (
          <p className="notice notice--warn" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field__label" htmlFor="volunteer-login-email">
              {a.loginEmail}
            </label>
            <input
              id="volunteer-login-email"
              type="email"
              className="input"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <label className="field__label" htmlFor="volunteer-login-password">
              {a.loginPassword}
            </label>
            <input
              id="volunteer-login-password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button type="submit" className="btn btn--green btn--md" disabled={submitting}>
            {submitting ? a.loginSubmitting : a.loginSubmit}
          </button>
        </form>

        <p className="hint" style={{ marginTop: 24 }}>
          {a.loginNoAccount}{" "}
          <Link href={screenPath(currentLang, "volunteer")}>{a.loginRegister}</Link>
        </p>
      </div>
    </div>
  );
}
