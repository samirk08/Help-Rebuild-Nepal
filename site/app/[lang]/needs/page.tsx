import type { Metadata } from "next";
import { notFound } from "next/navigation";

import NeedsBoard from "@/components/NeedsBoard";
import { dict, isLang } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.needsTitle, description: t.needsIntro };
}

export default async function NeedsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <NeedsBoard lang={lang} t={dict(lang)} />;
}
