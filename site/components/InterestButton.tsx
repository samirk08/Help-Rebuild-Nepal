"use client";

import { useToast } from "@/components/ToastProvider";

/**
 * "I can help with this" on a request. Expressing interest is not a commitment,
 * so this records intent rather than assigning anyone.
 */
export default function InterestButton({
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
