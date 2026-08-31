"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabaseBrowserClient } from "@/lib/supabase-browser";

const MIN_LENGTH = 10;

/**
 * Choose a password after accepting an invite or a reset link.
 *
 * An invited teammate arrives signed in but with no password set, so without
 * this page they could never sign in again once the invite link expired. The
 * middleware requires a session here, which is exactly right: you can only set
 * a password for the account you already proved you control by opening the
 * emailed link.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = supabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.refresh();
    router.replace("/admin");
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <p className="admin-login__eyebrow">Help Rebuild Nepal</p>
        <h1 className="admin-login__title">Choose a password</h1>
        <p className="admin-login__sub">
          This is the password you will use to sign in to the coordination desk from now on.
        </p>

        {error ? (
          <p className="admin-login__error" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="admin-login__field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="admin-login__field">
            <label htmlFor="confirm">Repeat password</label>
            <input
              id="confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn--dark btn--block admin-login__submit"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save password and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
