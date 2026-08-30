import Link from "next/link";

import { signOut } from "@/lib/admin-actions";
import { supabaseServerClient } from "@/lib/supabase-server";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/volunteers", label: "Volunteers" },
  { href: "/admin/needs", label: "Needs" },
  { href: "/admin/relief", label: "Relief items" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <p className="admin-nav__brand">Help Rebuild Nepal</p>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="admin-nav__link">
            {item.label}
          </Link>
        ))}
        <div className="admin-nav__spacer" />
        {user ? <p className="admin-nav__user">{user.email}</p> : null}
        <form action={signOut}>
          <button type="submit" className="admin-nav__link reset-button" style={{ width: "100%" }}>
            Sign out
          </button>
        </form>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
