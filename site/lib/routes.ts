import { added } from "./added-strings";
import type { Lang, NavItem } from "./content";
import { NAV } from "./content";
import { localePath } from "./i18n";

/** Route below the language prefix, keyed by the design's screen name. */
export const ROUTES = {
  home: "",
  volunteer: "/volunteer",
  post: "/post",
  needs: "/needs",
  detail: "/needs/example",
  relief: "/relief",
  reliefDetail: "/relief/example",
  reliefOffer: "/relief/offer",
  tracker: "/tracker",
  projects: "/projects",
  networks: "/networks",
  profile: "/profile",
  partners: "/partners",
} as const;

export type ScreenKey = keyof typeof ROUTES;

export function screenPath(lang: Lang, screen: ScreenKey): string {
  return localePath(lang, ROUTES[screen]);
}

/**
 * Header navigation, resolved for a language.
 *
 * `NAV` is generated from the design, so the relief entry is appended here
 * rather than edited into `content.ts`. It sits after Needs because relief
 * items are a kind of need, and before Projects.
 */
export function navItems(lang: Lang): Array<{ id: string; label: string; href: string }> {
  const items: Array<{ id: string; label: string; href: string }> = NAV.map((item: NavItem) => ({
    id: item.id as string,
    label: lang === "np" ? item.np : item.en,
    href: screenPath(lang, item.id as ScreenKey),
  }));

  const relief = {
    id: "relief",
    label: added(lang).reliefNav,
    href: screenPath(lang, "relief"),
  };

  const afterNeeds = items.findIndex((i) => i.id === "needs") + 1;
  items.splice(afterNeeds || items.length, 0, relief);
  return items;
}

/**
 * Whether a nav entry is the active one for the current pathname.
 * Home only matches exactly; every other route also matches its children.
 */
export function isActivePath(pathname: string, href: string, isHome: boolean): boolean {
  if (isHome) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}
