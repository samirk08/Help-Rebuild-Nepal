import type { Metadata } from "next";
import { notFound } from "next/navigation";

import RequestForm from "@/components/RequestForm";
import { dict, isLang } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return { title: t.registerCta, description: t.helpBody };
}

export default async function VolunteerPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <RequestForm lang={lang} mode="volunteer" t={dict(lang)} />;
}
