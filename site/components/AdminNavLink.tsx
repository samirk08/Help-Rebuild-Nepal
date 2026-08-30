"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A sidebar link that marks itself as the current page.
 *
 * Next's `<Link>` does not set `aria-current` on its own, so the nav's active
 * styling had nothing to hook onto. `/admin` has to match exactly — every other
 * admin route starts with it, so a prefix test would light up the Overview tab
 * on every page.
 */
export default function AdminNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <Link href={href} className="admin-nav__link" aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
}
