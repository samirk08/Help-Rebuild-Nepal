"use client";

import { useState } from "react";

/**
 * Copies every open bug as plain text.
 *
 * The whole reason the tracker earns its place: whoever is fixing these
 * generally cannot sign in and read the table, so the report has to be able to
 * leave the dashboard in one action rather than being retyped.
 */
export default function CopyBugsButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      className="btn btn--outline btn--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
          setTimeout(() => setState("idle"), 2500);
        } catch {
          setState("failed");
        }
      }}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy open bugs"}
    </button>
  );
}
