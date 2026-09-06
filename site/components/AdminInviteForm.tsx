"use client";

import { useActionState, useEffect, useState } from "react";

import { createAccessLink, type LinkResult } from "@/lib/admin-team";

/**
 * Mints a sign-in link and shows it for the admin to copy.
 *
 * The link is a single-use credential, so it is only ever rendered into the
 * page — never put in the URL, never logged, and not persisted anywhere.
 */
export default function AdminInviteForm() {
  const [state, action, pending] = useActionState<LinkResult | null, FormData>(
    createAccessLink,
    null
  );
  const [copied, setCopied] = useState(false);

  // Built in the browser so the link always points at the host the admin is
  // actually using, rather than a server-side guess at the public origin.
  const fullLink = state?.path ? `${window.location.origin}${state.path}` : "";

  useEffect(() => setCopied(false), [state]);

  return (
    <>
      <form action={action} className="admin-filters">
        <input
          type="email"
          name="email"
          placeholder="teammate@example.com"
          required
          aria-label="Email address"
          style={{ minWidth: 280 }}
        />
        <button type="submit" className="btn btn--dark btn--sm" disabled={pending}>
          {pending ? "Creating…" : "Create sign-in link"}
        </button>
      </form>

      {state?.error ? (
        <p className="admin-login__error" role="alert">
          {state.error}
        </p>
      ) : null}

      {fullLink ? (
        <div className="admin-detail">
          <p className="admin-section-title" style={{ marginTop: 0 }}>
            {state?.isNew ? "New account created" : "Existing account"} · {state?.email}
          </p>

          <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 0 }}>
            They now have dashboard access and appear in the list below. Send this to them over a
            channel you trust — it signs in whoever opens it, once. They will be asked to choose a
            password immediately.
          </p>

          <textarea
            className="admin-textarea"
            readOnly
            value={fullLink}
            onFocus={(e) => e.currentTarget.select()}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}
          />

          <button
            type="button"
            className="btn btn--outline btn--sm"
            style={{ marginTop: 10 }}
            onClick={async () => {
              await navigator.clipboard.writeText(fullLink);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </>
  );
}
