"use client";

import { useState } from "react";

import { deleteNeed, deleteVolunteer } from "@/lib/admin-actions";

/**
 * Two-step delete, for a volunteer registration or a posted need.
 *
 * Deliberately not a native confirm() dialog: those are easy to dismiss on
 * autopilot and give no room to say what is actually about to be destroyed.
 * Arming the button in place shows the name and the file count first, and
 * costs nothing to back out of.
 *
 * One component for both because the decision is the same shape and the
 * wording is the only difference — two copies would drift, and the copy is the
 * part that has to be right.
 */
export default function DeleteSubmissionButton({
  id,
  name,
  documentCount,
  kind = "volunteer",
}: {
  id: string;
  name: string;
  documentCount: number;
  kind?: "volunteer" | "need";
}) {
  const isNeed = kind === "need";
  const noun = isNeed ? "need" : "registration";
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" className="btn btn--outline btn--sm" onClick={() => setArmed(true)}>
        Delete this {noun}
      </button>
    );
  }

  return (
    <div className="admin-detail" style={{ borderColor: "var(--red-line)" }}>
      <p style={{ fontSize: 13.5, margin: "12px 0 4px", fontWeight: 600 }}>
        Permanently delete {name}?
      </p>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
        This removes the {noun}
        {documentCount > 0
          ? `, ${documentCount} uploaded ${documentCount === 1 ? "file" : "files"},`
          : ""}
        {isNeed
          ? ", every expression of interest, and any invitations sent for it"
          : " and any volunteer matches"}
        . It cannot be undone.
        {isNeed ? " A need already promoted to a project cannot be deleted this way." : ""}
      </p>
      <div className="admin-form-row" style={{ paddingBottom: 14 }}>
        <form action={isNeed ? deleteNeed : deleteVolunteer}>
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
