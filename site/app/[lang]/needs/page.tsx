import type { Metadata } from "next";
import { notFound } from "next/navigation";

import NeedsBoard from "@/components/NeedsBoard";
import { dict, isLang } from "@/lib/i18n";
import { listPublicNeeds } from "@/lib/public-needs";

// Reads live rows and the query string — must never be cached or prerendered.
export const dynamic = "force-dynamic";

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

function one(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function NeedsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const query = await searchParams;
  const filters = {
    province: one(query.province),
    district: one(query.district),
    skill: one(query.skill),
    urgency: one(query.urgency),
    status: one(query.status),
  };

  const needs = await listPublicNeeds(filters);

  return <NeedsBoard lang={lang} t={dict(lang)} needs={needs} filters={filters} />;
}
