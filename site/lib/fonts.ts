import { Archivo, Noto_Sans_Devanagari, Public_Sans } from "next/font/google";

/**
 * The site's three typefaces, loaded once and shared by every root layout.
 *
 * This lives here rather than inline in a layout because there is more than one
 * root layout — `app/[lang]/layout.tsx` for the public site and
 * `app/admin/layout.tsx` for the internal dashboard — and each needs to declare
 * the same font variables on its own `<html>`. When only the public layout
 * loaded them, `/admin` rendered in the browser's default serif: `globals.css`
 * sets `font-family: var(--font-body), var(--font-deva)`, and a `var()` that
 * resolves to nothing makes the whole declaration invalid at computed-value
 * time, so the browser drops `font-family` outright instead of falling through
 * to the next name in the list.
 *
 * Devanagari is loaded for the admin too, not just the public site: submissions
 * made in Nepali are stored verbatim and rendered back in the review screens.
 */

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600"],
  variable: "--font-devanagari",
  display: "swap",
});

/** Put this on `<html className>` in every root layout. */
export const fontVariables = `${archivo.variable} ${publicSans.variable} ${devanagari.variable}`;
