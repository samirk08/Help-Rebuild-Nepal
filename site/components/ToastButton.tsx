"use client";

import { useToast } from "@/components/ToastProvider";

/**
 * A button whose only job is to say something honest and do nothing else.
 *
 * Used where a flow genuinely has no backing action yet — currently only the
 * relief worked example, which has no row to pledge against. Real requests
 * link to the offer form instead. Kept separate from InterestButton so that
 * component can be about recording interest and nothing else.
 */
export default function ToastButton({
  label,
  message,
  className = "btn btn--green btn--block",
}: {
  label: string;
  message: string;
  className?: string;
}) {
  const { showToast } = useToast();

  return (
    <button type="button" className={className} onClick={() => showToast(message)}>
      {label}
    </button>
  );
}
