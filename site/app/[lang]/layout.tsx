import type { Metadata } from "next";
import { Archivo, Noto_Sans_Devanagari, Public_Sans } from "next/font/google";
import { notFound } from "next/navigation";

import "../globals.css";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ScrollReveal from "@/components/ScrollReveal";
import { ToastProvider } from "@/components/ToastProvider";
import { asset } from "@/lib/base-path";
import type { Lang } from "@/lib/content";
import { HTML_LANG, LANGS, dict, isLang } from "@/lib/i18n";

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

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);

  return {
    title: {
      default: "Help Rebuild Nepal",
      template: "%s · Help Rebuild Nepal",
    },
    description: t.heroSub,
    applicationName: "Help Rebuild Nepal",
    alternates: {
      canonical: asset(`/${lang}`),
      languages: { en: asset("/en"), ne: asset("/np") },
    },
    openGraph: {
      title: "Help Rebuild Nepal",
      description: t.heroSub,
      locale: HTML_LANG[lang],
      type: "website",
    },
    icons: { icon: asset("/logo.png") },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = dict(lang);

  return (
    <html
      lang={HTML_LANG[lang]}
      className={`${archivo.variable} ${publicSans.variable} ${devanagari.variable}`}
    >
      <body>
        <ToastProvider>
          <ScrollReveal />
          <div className="layout">
            <a className="skip-link" href="#main">
              Skip to content
            </a>
            <div className="flagbar" />
            <Header lang={lang} />
            <main id="main">{children}</main>
            <Footer lang={lang} t={t} />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
