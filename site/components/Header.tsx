"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import type { Lang } from "@/lib/content";
import { localePath, swapLangPath } from "@/lib/i18n";
import { isActivePath, navItems } from "@/lib/routes";

/**
 * Publishes the sticky header's real height as `--header-h` so the form rail
 * can park directly beneath it. The header wraps to two rows on narrow
 * screens, so a fixed offset would either overlap or leave a gap.
 */
function useHeaderHeight() {
  useEffect(() => {
    const el = document.querySelector("header");
    if (!el) return;

    const measure = () => {
      const px = Math.round(el.getBoundingClientRect().height);
      if (px) document.documentElement.style.setProperty("--header-h", `${px}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
}

export default function Header({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  useHeaderHeight();

  const home = localePath(lang);
  const items = navItems(lang);

  return (
    <header className="header">
      <div className="shell header__inner">
        <Link href={home} className="header__brand" aria-label="Help Rebuild Nepal — home">
          <Image
            src="/logo.png"
            alt="Help Rebuild Nepal"
            width={88}
            height={46}
            className="header__logo"
            priority
          />
          <span className="header__tagline">Volunteer. Connect. Rebuild.</span>
        </Link>

        <nav className="header__nav" aria-label="Main">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href, item.id === "home");
            return (
              <Link
                key={item.id}
                href={item.href}
                className="header__link"
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Plain links on purpose. A view transition here was tried and dropped:
            React 19 stable has no ViewTransition component, and driving the
            native API by hand left the transition's promises unsettled, so it
            hung until the browser aborted it. See README. */}
        <div className="langswitch" role="group" aria-label="Language">
          <Link
            href={swapLangPath(pathname, "en")}
            className="langswitch__btn"
            aria-current={lang === "en"}
            hrefLang="en"
          >
            EN
          </Link>
          <Link
            href={swapLangPath(pathname, "np")}
            className="langswitch__btn langswitch__btn--np"
            aria-current={lang === "np"}
            hrefLang="ne"
          >
            नेपाली
          </Link>
        </div>
      </div>
    </header>
  );
}
