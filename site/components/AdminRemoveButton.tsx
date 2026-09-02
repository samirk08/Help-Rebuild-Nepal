"use client";

import { useActionState } from "react";

import { revokeAdmin, type RevokeResult } from "@/lib/admin-team";

/**
 * Removes one person from the dashboard allowlist.
 *
 * Confirms first, because there is no undo in the UI: an admin who removes the
 * wrong person has to be re-added, and re-adding issues a fresh sign-in link
 * that has to be delivered all over again.
 */
export default function AdminRemoveButton({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState<RevokeResult | null, FormData>(revokeAdmin, null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${email}? They will no longer be able to sign in here.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="btn btn--outline btn--sm" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error ? (
        <span className="admin-login__error" role="alert" style={{ marginLeft: 8, fontSize: 13 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
