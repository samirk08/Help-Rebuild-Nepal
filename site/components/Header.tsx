"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { dict, localePath, swapLangPath } from "@/lib/i18n";
import { isActivePath, navGroups, navItems, screenPath } from "@/lib/routes";

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
  const a = added(lang);
  const groups = navGroups(lang);
  const profile = navItems(lang).find((item) => item.id === "profile")!;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  const closeMenus = () => {
    setOpenGroup(null);
    setMobileOpen(false);
  };

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const close = () => {
      setOpenGroup(null);
      setMobileOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) close();
    };
    // Closing at the same breakpoint used by CSS prevents hidden focus and
    // stale mobile state when a phone rotates or the window is resized.
    const desktop = window.matchMedia("(min-width: 1051px)");
    const resize = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && headerRef.current?.contains(active)) {
        if (!desktop.matches && active.closest(".header__nav")) mobileToggleRef.current?.focus();
        else if (desktop.matches && active === mobileToggleRef.current) {
          headerRef.current?.querySelector<HTMLButtonElement>(".header__group-toggle")?.focus();
        }
      }
      close();
    };
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, []);

  return (
    <header
      className="header"
      ref={headerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeMenus();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (openGroup) {
          event.preventDefault();
          event.stopPropagation();
          headerRef.current?.querySelector<HTMLButtonElement>(`[aria-controls="header-${openGroup}"]`)?.focus();
          setOpenGroup(null);
        } else if (mobileOpen) {
          event.preventDefault();
          event.stopPropagation();
          mobileToggleRef.current?.focus();
          setMobileOpen(false);
        }
      }}
    >
      <div className="shell header__inner">
        <Link href={home} className="header__brand" aria-label={a.navHome} aria-current={isActivePath(pathname, home, true) ? "page" : undefined} onClick={closeMenus}>
          <Image
            src="/logo.png"
            alt="Help Rebuild Nepal"
            width={88}
            height={46}
            className="header__logo"
            priority
          />
          <span className="header__tagline">{a.headerTagline}</span>
        </Link>

        <button
          type="button"
          className="reset-button header__link header__menu-toggle"
          ref={mobileToggleRef}
          aria-expanded={mobileOpen}
          aria-controls="header-navigation"
          onClick={() => {
            setMobileOpen((value) => !value);
            setOpenGroup(null);
          }}
        >
          {a.navMenu} <span className="header__caret" aria-hidden="true" />
        </button>

        <nav
          id="header-navigation"
          className="header__nav"
          aria-label={a.navMain}
          data-open={mobileOpen}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpenGroup(null);
          }}
        >
          <ul className="header__groups">
            {groups.map((group) => (
              <li className="header__group" key={group.id}>
                <button
                  type="button"
                  className="reset-button header__link header__group-toggle"
                  aria-expanded={openGroup === group.id}
                  aria-controls={`header-${group.id}`}
                  data-active={group.items.some((item) => isActivePath(pathname, item.href, false))}
                  onClick={() => setOpenGroup((current) => current === group.id ? null : group.id)}
                >
                  {group.label} <span className="header__caret" aria-hidden="true" />
                </button>
                <ul className="header__dropdown" id={`header-${group.id}`} hidden={openGroup !== group.id}>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="header__link"
                        aria-current={isActivePath(pathname, item.href, false) ? "page" : undefined}
                        onClick={closeMenus}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header__actions">
          <Link href={screenPath(lang, "post")} className="btn btn--navy btn--sm header__post" aria-current={isActivePath(pathname, screenPath(lang, "post"), false) ? "page" : undefined} onClick={closeMenus}>
            {dict(lang).postCta}
          </Link>
          <Link
            href={profile.href}
            className="header__link header__profile"
            aria-current={isActivePath(pathname, profile.href, false) ? "page" : undefined}
            onClick={closeMenus}
          >
            {profile.label}
          </Link>
          {/* Language links preserve the current page. */}
          <div className="langswitch" role="group" aria-label={a.navLanguage}>
            <Link
              href={swapLangPath(pathname, "en")}
              className="langswitch__btn"
              aria-current={lang === "en"}
              hrefLang="en"
              onClick={closeMenus}
            >
              EN
            </Link>
            <Link
              href={swapLangPath(pathname, "np")}
              className="langswitch__btn langswitch__btn--np"
              aria-current={lang === "np"}
              hrefLang="ne"
              onClick={closeMenus}
            >
              नेपाली
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
