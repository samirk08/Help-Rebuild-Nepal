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
  return { title: t.postCta, description: t.needBody };
}

export default async function PostNeedPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <RequestForm lang={lang} mode="post" t={dict(lang)} />;
}
