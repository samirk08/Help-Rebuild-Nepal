import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { chipFieldKeys } from "@/lib/form-schema";
import {
  MAX_BODY_BYTES,
  validateIntake,
  validateReliefOffer,
  UNMATCHED_SENTINEL,
  type FieldError,
  type IntakeKind,
} from "@/lib/intake-schema";
import { INTAKE_BUDGET, callerKey, consume } from "@/lib/rate-limit";
import { EXAMPLE_ITEM_NEED } from "@/lib/relief";
import { supabaseAdmin } from "@/lib/supabase";
import { issueUploadTicket } from "@/lib/upload-tickets";

type Body = {
  kind?: unknown;
  lang?: unknown;
  fields?: unknown;
  idempotencyKey?: unknown;
};

const KINDS = new Set(["volunteer", "need", "relief-offer"]);
const LANGS = new Set(["en", "np"]);

/** Postgres unique_violation — the idempotency index doing its job. */
const UNIQUE_VIOLATION = "23505";

/**
 * How long an identical submission with no client key is treated as the same
 * submission.
 *
 * Only used as a fallback. A browser that sends its own `idempotencyKey` gets
 * an exact guarantee instead; this bucket is what an older open tab gets, and
 * it preserves the previous behaviour — a double-click or a
 * refresh-to-resubmit collapses, a genuine second registration an hour later
 * does not — while moving the decision into a unique index, where two
 * simultaneous requests actually resolve against each other.
 */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * The key a row is deduplicated on.
 *
 * A caller-supplied key is namespaced so it cannot collide with a derived one,
 * and so a caller cannot claim a key that would suppress someone else's
 * pending submission by guessing its content hash.
 */
function idempotencyKeyFor(
  kind: string,
  supplied: unknown,
  payload: unknown,
  now: number
): string {
  if (typeof supplied === "string" && supplied.length >= 8 && supplied.length <= 200) {
    return `client:${kind}:${supplied}`;
  }
  const bucket = Math.floor(now / DUPLICATE_WINDOW_MS);
  const digest = createHash("sha256").update(stableStringify(payload)).digest("base64url");
  return `auto:${kind}:${bucket}:${digest}`;
}

function fieldErrors(errors: FieldError[]) {
  return NextResponse.json({ error: "validation_failed", errors }, { status: 400 });
}

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
  IntakeKind,
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

const SKILLS_FIELD = "s03-skills-required";
const PEOPLE_NEEDED_FIELD = "s04-how-many-people";

/**
 * A checkbox group with exactly one box checked arrives as a bare string
 * (FormData's own behaviour, flattened in lib/api.ts), not an array. Anything
 * downstream that reads a chip field — a jsonb `contains` query in
 * lib/metrics.ts, a CSV column, the admin detail view — needs it to always be
 * an array, so that's fixed here, once, at the point data enters the database.
 */
function normalizeChipFields(
  kind: IntakeKind,
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

/** Every value of a chip group, as an array. Null when nothing was ticked. */
function pickAll(fields: Record<string, unknown>, key: string): string[] | null {
  const value = fields[key];
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const cleaned = list.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * "How many people" is an open question, so answers like "2-3" or "as many as
 * can come" are valid. Take the leading integer where there is one; null means
 * "not specified", which the board renders as "—" rather than a misleading 0.
 * Mirrors the backfill in supabase/002-public-board.sql.
 */
function pickCount(fields: Record<string, unknown>, key: string): number | null {
  const raw = pick(fields, key);
  const digits = raw?.match(/\d+/)?.[0];
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Reads the body, refusing anything past the intake ceiling before buffering it.
 *
 * `Content-Length` is a claim, not a fact, so the parsed text is measured too.
 * Both checks are cheap and neither is sufficient alone.
 */
async function readBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { ok: false };

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false };

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * Intake endpoint for all three forms. Volunteer registrations and posted
 * needs land in `submissions`. Relief offers are structurally different — the
 * form asks which published item need it's supplying — so they land in
 * `pledges` instead, keyed to that `item_needs` row.
 */
export async function POST(request: Request) {
  const rate = consume(callerKey(request, "intake"), INTAKE_BUDGET);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await readBody(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Expected a JSON body within the size limit" }, { status: 400 });
  }
  const body = (parsed.value ?? {}) as Body;

  if (typeof body.kind !== "string" || !KINDS.has(body.kind)) {
    return NextResponse.json(
      { error: "kind must be 'volunteer', 'need' or 'relief-offer'" },
      { status: 400 }
    );
  }
  if (typeof body.lang !== "string" || !LANGS.has(body.lang)) {
    return NextResponse.json({ error: "lang must be 'en' or 'np'" }, { status: 400 });
  }

  const now = Date.now();

  if (body.kind === "relief-offer") {
    return handleReliefOffer(body.fields, body.idempotencyKey, now);
  }

  const kind = body.kind as IntakeKind;

  // One schema, shared with the browser. Everything past this point is a value
  // the form itself could have produced.
  const validated = validateIntake(kind, body.fields);
  if (!validated.ok) return fieldErrors(validated.errors);

  const normalized = normalizeChipFields(kind, validated.fields);
  // Record the form version without treating it as proof of qualifications.
  // Older open browser tabs remain legacy submissions.
  const rawFields = body.fields as Record<string, unknown>;
  if (rawFields?.__form_version === "2") normalized.__form_version = 2;
  else delete normalized.__form_version;
  delete normalized.idempotencyKey;

  const columns = COLUMN_FIELDS[kind];
  const key = idempotencyKeyFor(kind, body.idempotencyKey, normalized, now);

  const { data, error } = await supabaseAdmin()
    .from("submissions")
    .insert({
      kind,
      lang: body.lang,
      fields: normalized,
      idempotency_key: key,
      org_or_name: pick(normalized, columns.orgOrName),
      contact_phone: pick(normalized, columns.phone),
      contact_email: pick(normalized, columns.email),
      district: pick(normalized, columns.district),
      province: pick(normalized, columns.province),
      urgency: pick(normalized, columns.urgency),
      // Need-only, and only because the public board filters on skills and
      // counts against people_needed. Volunteers have neither column.
      skills: kind === "need" ? pickAll(normalized, SKILLS_FIELD) : null,
      people_needed: kind === "need" ? pickCount(normalized, PEOPLE_NEEDED_FIELD) : null,
    })
    .select("id")
    .single();

  if (error) {
    // The unique index refused a repeat. From the sender's side this did
    // succeed — the record they wanted exists — so return that row's id.
    if (error.code === UNIQUE_VIOLATION) {
      const { data: existing } = await supabaseAdmin()
        .from("submissions")
        .select("id")
        .eq("idempotency_key", key)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          ok: true,
          persisted: true,
          id: existing.id,
          duplicate: true,
          uploadTicket: issueUploadTicket(existing.id, now),
        });
      }
    }

    // Include the Postgres error code. It is what distinguishes an unapplied
    // migration (42703) from a key that cannot bypass RLS (42501), and without
    // it a failing form is indistinguishable from any other outage to anyone
    // without Vercel log access. The code names a fault, never any data.
    console.error("submissions insert failed", error);
    return NextResponse.json(
      { error: "Could not save submission", code: error.code ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    id: data.id,
    // The capability to attach files to this row, for this browser, for the
    // next half hour. See lib/upload-tickets.ts for why existence of a row is
    // not on its own permission to write against it.
    uploadTicket: issueUploadTicket(data.id, now),
  });
}

async function handleReliefOffer(rawFields: unknown, suppliedKey: unknown, now: number) {
  const validated = validateReliefOffer(rawFields);
  if (!validated.ok) return fieldErrors(validated.errors);

  const offer = validated.pledge;

  // The worked example (lib/relief.ts's EXAMPLE_ITEM_NEED, id "example") lets
  // someone try the offer flow before any real item need is published, but it
  // has no row in item_needs — inserting a pledge against it as a real foreign
  // key would fail the uuid cast. Store it the same as an unmatched offer:
  // recorded, but not linked to a fillable request.
  const isExample = offer.target === EXAMPLE_ITEM_NEED.id;
  const itemNeedId =
    offer.target && offer.target !== UNMATCHED_SENTINEL && !isExample ? offer.target : null;

  if (!itemNeedId && !isExample && !offer.category) {
    return fieldErrors([
      {
        field: "relief-category",
        code: "required",
        message: "Choose a category for an offer that is not against a listed need.",
      },
    ]);
  }

  let resolvedCategory = offer.category ?? (isExample ? EXAMPLE_ITEM_NEED.category : null);

  if (itemNeedId) {
    // An offer must target a need that is real and still able to receive one.
    // Previously any uuid was accepted, so supply could be pledged against a
    // closed or non-existent request and counted toward filling it.
    const [{ data: need }, { data: pledged }] = await Promise.all([
      supabaseAdmin().from("item_needs").select("id, category, quantity").eq("id", itemNeedId).maybeSingle(),
      supabaseAdmin()
        .from("item_need_pledged")
        .select("pledged")
        .eq("item_need_id", itemNeedId)
        .maybeSingle(),
    ]);

    if (!need) {
      return fieldErrors([
        {
          field: "relief-target",
          code: "invalid_option",
          message: "That item need is no longer listed.",
        },
      ]);
    }

    // `item_needs` has no lifecycle column yet, so "closed" is expressed the
    // only way the current schema can express it: confirmed pledges already
    // cover the quantity asked for. Taking more here would show supply against
    // a need that is met and leave the offerer waiting for a collection that
    // is never arranged. The richer `requested → … → closed` stages, and the
    // deadline case, belong to the supplies work in Phase 5.
    const already = Number(pledged?.pledged ?? 0);
    if (Number.isFinite(need.quantity) && already >= need.quantity) {
      return fieldErrors([
        {
          field: "relief-target",
          code: "invalid_option",
          message: "That item need is already met and is not taking new offers.",
        },
      ]);
    }
    // A matched offer inherits its category from the need it targets — the form
    // does not ask again — so look it up rather than trust a client value that
    // was never collected for this path.
    resolvedCategory = need.category ?? resolvedCategory;
  }

  const pledge = {
    item_need_id: itemNeedId,
    category: resolvedCategory,
    quantity: offer.quantity,
    district: offer.district,
    available_from: offer.availableFrom,
    delivery_method: offer.deliveryMethod,
    contact: offer.contact,
  };

  const key = idempotencyKeyFor("relief-offer", suppliedKey, pledge, now);

  const { data, error } = await supabaseAdmin()
    .from("pledges")
    .insert({ ...pledge, idempotency_key: key })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const { data: existing } = await supabaseAdmin()
        .from("pledges")
        .select("id")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ ok: true, persisted: true, id: existing.id, duplicate: true });
      }
    }
    console.error("pledges insert failed", error);
    return NextResponse.json({ error: "Could not save offer", code: error.code ?? null }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
