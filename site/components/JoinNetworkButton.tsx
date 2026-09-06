"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";

/**
 * One-click join for someone who already has a profile.
 *
 * Rendered only for a signed-in, registered visitor — everyone else gets the
 * registration link instead (see the networks page). Identity travels in the
 * session cookie; the request body carries nothing but the network name.
 * After a successful join the router refreshes so the member count and the
 * server-rendered "member" state update without a reload.
 */
export default function JoinNetworkButton({
  lang,
  network,
  label,
}: {
  lang: Lang;
  network: string;
  label: string;
}) {
  const a = added(lang);
  const router = useRouter();
  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [joined, setJoined] = useState(false);

  async function handleClick() {
    setSending(true);
    try {
      const response = await fetch("/api/networks/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setJoined(true);
      showToast(a.networkJoinToast);
      router.refresh();
    } catch {
      showToast(a.networkJoinError);
    } finally {
      setSending(false);
    }
  }

  if (joined) {
    return <p className="network__member">{a.networkMemberBadge}</p>;
  }

  return (
    <button
      type="button"
      className="btn btn--outline btn--outline-green btn--sm btn--block"
      onClick={handleClick}
      disabled={sending}
    >
      {sending ? a.networkJoining : label}
    </button>
  );
}
