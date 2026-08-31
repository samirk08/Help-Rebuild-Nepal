"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Per-person sign-in for the admin dashboard, backed by Supabase Auth.
 * Accounts are invited from the Supabase dashboard (Auth -> Users) — there is
 * no public sign-up here.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentReset, setSentReset] = useState(false);

  /**
   * Also the way out of an expired invite. An invited teammate exists as a user
   * the moment they're invited, so a reset link reaches them even though they
   * have never had a password — no need for an admin to re-invite them.
   */
  async function handleReset() {
    setError(null);
    if (!email) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }

    const supabase = supabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/auth/callback`,
    });

    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSentReset(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = supabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Incorrect email or password.");
      setSubmitting(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <p className="admin-login__eyebrow">Help Rebuild Nepal</p>
        <h1 className="admin-login__title">Coordination desk</h1>
        <p className="admin-login__sub">
          Sign in to review registrations, verify needs and coordinate relief.
        </p>

        {error ? (
          <p className="admin-login__error" role="alert">
            {error}
          </p>
        ) : null}

        {sentReset ? (
          <p className="notice" role="status" style={{ marginBottom: 16 }}>
            Check your email for a link to set a new password.
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="admin-login__field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="admin-login__field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn--dark btn--block admin-login__submit"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="admin-login__foot">
          <button type="button" className="reset-button admin-login__link" onClick={handleReset}>
            Forgot password, or invite link expired?
          </button>
          <br />
          Accounts are created by an administrator. Ask the team if you need access.
        </p>
      </div>
    </div>
  );
}
