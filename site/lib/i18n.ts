import { NP_MAP, STR, type Dict, type Lang } from "./content";

export const LANGS: readonly Lang[] = ["en", "np"] as const;
export const DEFAULT_LANG: Lang = "en";

export function isLang(value: string): value is Lang {
  return value === "en" || value === "np";
}

/** Coerce an unknown route segment to a supported language. */
export function toLang(value: string | undefined): Lang {
  return value && isLang(value) ? value : DEFAULT_LANG;
}

/** The UI string table for a language. */
export function dict(lang: Lang): Dict {
  return STR[lang];
}

/**
 * Translate a data-table string that only exists in English.
 *
 * The design keeps its content tables (form labels, options, column headings)
 * in English and passes them through a lookup on render. Anything without an
 * entry falls back to the English source rather than showing a blank.
 */
export function translator(lang: Lang): (value: string) => string {
  if (lang === "en") return (value) => value;
  return (value) => NP_MAP[value] ?? value;
}

/** Build a language-prefixed href. `path` is the route below the language. */
export function localePath(lang: Lang, path = ""): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `/${lang}${suffix}`;
}

/** Swap the language on the current pathname, preserving the rest of the route. */
export function swapLangPath(pathname: string, next: Lang): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length && isLang(segments[0])) {
    segments[0] = next;
    return `/${segments.join("/")}`;
  }
  return localePath(next, pathname);
}

/** `lang` values for <html lang> and font selection. */
export const HTML_LANG: Record<Lang, string> = { en: "en", np: "ne" };
