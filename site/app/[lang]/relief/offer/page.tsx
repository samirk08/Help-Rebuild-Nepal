import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ReliefOfferForm from "@/components/ReliefOfferForm";
import { added } from "@/lib/added-strings";
import { isLang } from "@/lib/i18n";
import { listItemNeeds } from "@/lib/relief-data";

// The request picker lists live verified item needs.
export const dynamic = "force-dynamic";

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

export default async function ReliefOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const { need } = await searchParams;
  const itemNeeds = await listItemNeeds();

  return (
    <ReliefOfferForm
      lang={lang}
      itemNeeds={itemNeeds}
      preselect={typeof need === "string" ? need : undefined}
    />
  );
}
