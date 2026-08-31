import AdminNavLink from "@/components/AdminNavLink";
import { signOut } from "@/lib/admin-actions";
import { supabaseServerClient } from "@/lib/supabase-server";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/volunteers", label: "Volunteers" },
  { href: "/admin/needs", label: "Needs" },
  { href: "/admin/relief", label: "Relief items" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/diagnostics", label: "Diagnostics" },
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
        <p className="admin-nav__brand-sub">Coordination desk</p>

        <p className="admin-nav__group">Review</p>
        {NAV.map((item) => (
          <AdminNavLink key={item.href} href={item.href} label={item.label} />
        ))}

        <div className="admin-nav__spacer" />

        {user ? (
          <div className="admin-nav__user">
            <p className="admin-nav__user-label">Signed in as</p>
            <p className="admin-nav__email">{user.email}</p>
          </div>
        ) : null}
        <form action={signOut}>
          <button type="submit" className="admin-nav__link admin-nav__signout reset-button">
            Sign out
          </button>
        </form>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
