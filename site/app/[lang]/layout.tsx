import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "../globals.css";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ScrollReveal from "@/components/ScrollReveal";
import { ToastProvider } from "@/components/ToastProvider";
import type { Lang } from "@/lib/content";
import { fontVariables } from "@/lib/fonts";
import { HTML_LANG, LANGS, dict, isLang } from "@/lib/i18n";

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
      canonical: `/${lang}`,
      languages: { en: "/en", ne: "/np" },
    },
    openGraph: {
      title: "Help Rebuild Nepal",
      description: t.heroSub,
      locale: HTML_LANG[lang],
      type: "website",
    },
    icons: { icon: "/logo.png" },
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
    <html lang={HTML_LANG[lang]} className={fontVariables}>
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
