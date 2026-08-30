import { NextResponse } from "next/server";

import { chipFieldKeys } from "@/lib/form-schema";
import { EXAMPLE_ITEM_NEED } from "@/lib/relief";
import { supabaseAdmin } from "@/lib/supabase";

type Body = {
  kind?: unknown;
  lang?: unknown;
  fields?: unknown;
};

const KINDS = new Set(["volunteer", "need", "relief-offer"]);
const LANGS = new Set(["en", "np"]);
const UNMATCHED_SENTINEL = "__unmatched__"; // matches ReliefOfferForm.tsx

/**
 * Every field key this route pulls out into an indexed column, by kind.
 *
 * Keyed on the exact strings `fieldKey()` (lib/form-schema.ts) produces from
 * the design's field labels — `s{section}-{slugified-label}`. If the design
 * file regenerates `content.ts` with a renamed label, only this mapping needs
 * updating: the full payload still lands safely in `fields` either way, so a
 * missed rename loses a filter column, never data.
 */
const COLUMN_FIELDS: Record<
  "volunteer" | "need",
  { orgOrName?: string; phone?: string; email?: string; district?: string; province?: string; urgency?: string }
> = {
  volunteer: {
    orgOrName: "s01-full-name",
    phone: "s01-phone-whatsapp",
    email: "s01-email",
    district: "s01-where-you-are-based",
  },
  need: {
    orgOrName: "s01-organization-name",
    phone: "s01-phone-email",
    district: "s02-district",
    province: "s02-province",
    urgency: "s08-how-urgent-is-this",
  },
};

/**
 * A checkbox group with exactly one box checked arrives as a bare string
 * (FormData's own behaviour, flattened in lib/api.ts), not an array. Anything
 * downstream that reads a chip field — a jsonb `contains` query in
 * lib/metrics.ts, a CSV column, the admin detail view — needs it to always be
 * an array, so that's fixed here, once, at the point data enters the database.
 */
function normalizeChipFields(
  kind: "volunteer" | "need",
  fields: Record<string, unknown>
): Record<string, unknown> {
  const chipKeys = chipFieldKeys(kind);
  const normalized = { ...fields };
  for (const key of chipKeys) {
    const value = normalized[key];
    if (value !== undefined && !Array.isArray(value)) normalized[key] = [value];
  }
  return normalized;
}

function pick(fields: Record<string, unknown>, key: string | undefined): string | null {
  if (!key) return null;
  const value = fields[key];
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

/**
 * Intake endpoint for all three forms. Volunteer registrations and posted
 * needs land in `submissions`. Relief offers are structurally different — the
 * form asks which published item need it's supplying — so they land in
 * `pledges` instead, keyed to that `item_needs` row. This is also why
 * `submission_kind` includes `relief-offer` in lib/api.ts (it drives which
 * copy and validation the client uses) without a matching branch in
 * `COLUMN_FIELDS` here: offers never become `submissions` rows.
 */
export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  if (typeof body.kind !== "string" || !KINDS.has(body.kind)) {
    return NextResponse.json(
      { error: "kind must be 'volunteer', 'need' or 'relief-offer'" },
      { status: 400 }
    );
  }

  if (typeof body.lang !== "string" || !LANGS.has(body.lang)) {
    return NextResponse.json({ error: "lang must be 'en' or 'np'" }, { status: 400 });
  }

  if (typeof body.fields !== "object" || body.fields === null || Array.isArray(body.fields)) {
    return NextResponse.json({ error: "fields must be an object" }, { status: 400 });
  }

  const fields = body.fields as Record<string, unknown>;

  if (body.kind === "relief-offer") {
    return handleReliefOffer(fields);
  }

  // KINDS.has() already confirmed body.kind is one of the three known
  // strings, and relief-offer just returned — this narrows what's left.
  const kind = body.kind as "volunteer" | "need";
  const normalized = normalizeChipFields(kind, fields);
  const columns = COLUMN_FIELDS[kind];

  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .insert({
      kind,
      lang: body.lang,
      fields: normalized,
      org_or_name: pick(normalized, columns.orgOrName),
      contact_phone: pick(normalized, columns.phone),
      contact_email: pick(normalized, columns.email),
      district: pick(normalized, columns.district),
      province: pick(normalized, columns.province),
      urgency: pick(normalized, columns.urgency),
    })
    .select("id")
    .single();

  if (error) {
    console.error("submissions insert failed", error);
    return NextResponse.json({ error: "Could not save submission" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}

async function handleReliefOffer(fields: Record<string, unknown>) {
  const target = pick(fields, "relief-target");
  const quantityRaw = pick(fields, "relief-quantity");
  const quantity = quantityRaw ? Number(quantityRaw) : NaN;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "relief-quantity must be a positive number" }, { status: 400 });
  }

  // The worked example (lib/relief.ts's EXAMPLE_ITEM_NEED, id "example") lets
  // someone try the offer flow before any real item need is published, but it
  // has no row in item_needs — inserting a pledge against it as a real
  // foreign key would fail the uuid cast. Store it the same as an unmatched
  // offer: recorded, but not linked to a fillable request.
  const isExample = target === EXAMPLE_ITEM_NEED.id;
  const itemNeedId = target && target !== UNMATCHED_SENTINEL && !isExample ? target : null;
  const category = pick(fields, "relief-category");

  if (!itemNeedId && !isExample && !category) {
    return NextResponse.json(
      { error: "relief-category is required for an unmatched offer" },
      { status: 400 }
    );
  }

  // A matched offer inherits its category from the item need it targets — the
  // form doesn't ask for it again — so look it up rather than trust a client
  // value that was never collected for this path.
  let resolvedCategory = category ?? (isExample ? EXAMPLE_ITEM_NEED.category : null);
  if (itemNeedId && !resolvedCategory) {
    const { data: need } = await supabaseAdmin()
      .from("item_needs")
      .select("category")
      .eq("id", itemNeedId)
      .maybeSingle();
    resolvedCategory = need?.category ?? null;
  }

  const { data, error } = await supabaseAdmin()
    .from("pledges")
    .insert({
      item_need_id: itemNeedId,
      category: resolvedCategory,
      quantity,
      district: pick(fields, "relief-where"),
      available_from: pick(fields, "relief-available"),
      delivery_method: pick(fields, "relief-delivery"),
      contact: pick(fields, "relief-contact"),
    })
    .select("id")
    .single();

  if (error) {
    console.error("pledges insert failed", error);
    return NextResponse.json({ error: "Could not save offer" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
