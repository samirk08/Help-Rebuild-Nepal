import type { Metadata } from "next";

import "../globals.css";
import "./admin.css";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "Admin · Help Rebuild Nepal", template: "%s · Admin · Help Rebuild Nepal" },
  robots: { index: false, follow: false },
};

/**
 * Root shell for everything under `/admin`. Deliberately outside `[lang]/` —
 * this is an internal tool for the coordination team, not public bilingual
 * copy, so it doesn't take part in the site's language routing.
 *
 * Sits below `(dashboard)/layout.tsx`, which adds the sidebar nav; `/admin/login`
 * is a sibling of that group so it renders without the nav around a login form.
 *
 * `fontVariables` is not optional decoration — this is a separate root layout
 * from the public site's, so without it nothing under /admin has the site's
 * typefaces at all. See lib/fonts.ts.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
