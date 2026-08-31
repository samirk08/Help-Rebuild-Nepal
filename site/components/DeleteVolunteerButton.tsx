"use client";

import { useState } from "react";

import { deleteVolunteer } from "@/lib/admin-actions";

/**
 * Two-step delete.
 *
 * Deliberately not a native confirm() dialog: those are easy to dismiss on
 * autopilot and give no room to say what is actually about to be destroyed.
 * Arming the button in place shows the name and the file count first, and
 * costs nothing to back out of.
 */
export default function DeleteVolunteerButton({
  id,
  name,
  documentCount,
}: {
  id: string;
  name: string;
  documentCount: number;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" className="btn btn--outline btn--sm" onClick={() => setArmed(true)}>
        Delete this registration
      </button>
    );
  }

  return (
    <div className="admin-detail" style={{ borderColor: "var(--red-line)" }}>
      <p style={{ fontSize: 13.5, margin: "12px 0 4px", fontWeight: 600 }}>
        Permanently delete {name}?
      </p>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
        This removes the registration
        {documentCount > 0
          ? `, ${documentCount} uploaded ${documentCount === 1 ? "file" : "files"},`
          : ""}{" "}
        and any volunteer matches. It cannot be undone.
      </p>
      <div className="admin-form-row" style={{ paddingBottom: 14 }}>
        <form action={deleteVolunteer}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn--sm" style={{ background: "var(--red-2)", color: "#fff" }}>
            Yes, delete permanently
          </button>
        </form>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => setArmed(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
