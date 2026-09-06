"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import type { ActionState } from "@/lib/matching/validation";

export default function MatchingActionForm({ action, children, label, lang = "en" }: {
  action:(state:ActionState,form:FormData) => Promise<ActionState>;
  children:ReactNode; label:string; lang?:"en"|"np";
}) {
  const [state,submit,pending] = useActionState(action,{});
  return <form action={submit} className="matching-form">
    <fieldset disabled={pending} className="matching-fieldset">{children}
      <button type="submit" className="btn btn--dark btn--sm" disabled={pending}>{pending ? (lang === "np" ? "सुरक्षित गर्दै…" : "Saving…") : label}</button>
    </fieldset>
    {state.error ? <p role="alert" className="matching-error">{state.error}</p> : null}
    {state.success ? <p role="status" className="matching-success">{state.success}</p> : null}
  </form>;
}
