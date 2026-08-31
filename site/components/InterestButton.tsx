"use client";

import { useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";

/**
 * "I can help with this" on a published need.
 *
 * Expressing interest is not a commitment and does not assign anyone — it
 * records that someone is willing and hands their contact details to the
 * requester, which is the direction the whole flow promises. Contact details
 * go straight to the admin review screens and are never rendered publicly.
 */
export default function InterestButton({
  lang,
  needId,
  label,
  note,
}: {
  lang: Lang;
  needId: string;
  label: string;
  note: string;
}) {
  const a = added(lang);
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);

    try {
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          needId,
          name: form.get("name"),
          contact: form.get("contact"),
          message: form.get("message"),
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setDone(true);
      setOpen(false);
      showToast(a.interestSuccess);
    } catch {
      showToast(a.interestError);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return <p className="notice">{a.interestSuccess}</p>;
  }

  if (!open) {
    return (
      <>
        <button type="button" className="btn btn--green btn--block" onClick={() => setOpen(true)}>
          {label}
        </button>
        <p className="hint" style={{ marginTop: 10 }}>
          {note}
        </p>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="eyebrow--label" style={{ marginBottom: 6 }}>
        {a.interestTitle}
      </h3>
      <p className="hint" style={{ marginBottom: 14 }}>
        {a.interestIntro}
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field__label" htmlFor="interest-name">
          {a.interestName}
        </label>
        <input id="interest-name" name="name" className="input" required maxLength={120} />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field__label" htmlFor="interest-contact">
          {a.interestContact}
        </label>
        <input id="interest-contact" name="contact" className="input" required maxLength={200} />
        <p className="field__note">{a.interestContactHint}</p>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label className="field__label" htmlFor="interest-message">
          {a.interestMessage}
        </label>
        <textarea id="interest-message" name="message" className="textarea" rows={3} maxLength={2000} />
        <p className="field__note">{a.interestMessageHint}</p>
      </div>

      <button type="submit" className="btn btn--green btn--block" disabled={sending}>
        {sending ? a.interestSending : a.interestSubmit}
      </button>
    </form>
  );
}
