import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ReliefOfferForm from "@/components/ReliefOfferForm";
import { added } from "@/lib/added-strings";
import { isLang } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = added(lang);
  return { title: t.reliefOfferTitle, description: t.reliefOfferIntro };
}

export default async function ReliefOfferPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <ReliefOfferForm lang={lang} />;
}
