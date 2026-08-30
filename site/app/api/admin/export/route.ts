import { NextResponse } from "next/server";

import { chipFieldKeys, fieldKey, NEED_SECTIONS, VOLUNTEER_SECTIONS } from "@/lib/form-schema";
import { supabaseAdmin } from "@/lib/supabase";
import { supabaseServerClient } from "@/lib/supabase-server";

/**
 * Streams the volunteers or needs table as CSV, honouring the same
 * status/district/urgency filters the list page's URL carries.
 *
 * Covered by middleware's matcher, but checked again here too — the same
 * "don't trust the gate alone" reasoning as lib/admin-actions.ts.
 */
export async function GET(request: Request) {
  const supabase = await supabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "volunteer" && kind !== "need") {
    return NextResponse.json({ error: "kind must be 'volunteer' or 'need'" }, { status: 400 });
  }

  const status = url.searchParams.get("status");
  const district = url.searchParams.get("district");
  const urgency = url.searchParams.get("urgency");

  let query = supabaseAdmin().from("submissions").select("*").eq("kind", kind);
  if (status) query = query.eq("status", status);
  if (district) query = query.ilike("district", `%${district}%`);
  if (urgency) query = query.ilike("urgency", `%${urgency}%`);

  const { data: rows, error } = await query.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sections = kind === "volunteer" ? VOLUNTEER_SECTIONS : NEED_SECTIONS;
  const chipKeys = chipFieldKeys(kind);
  const fieldColumns = sections.flatMap((section) =>
    section.fields.map((field) => ({ key: fieldKey(section.n, field.label), label: field.label }))
  );

  const headers = [
    "id",
    "status",
    "district",
    "province",
    "urgency",
    "contact_phone",
    "contact_email",
    "created_at",
    "verified_at",
    ...fieldColumns.map((f) => f.label),
  ];

  const lines = [headers.map(csvCell).join(",")];

  for (const row of rows ?? []) {
    const fields = (row.fields ?? {}) as Record<string, unknown>;
    const fixed = [
      row.id,
      row.status,
      row.district,
      row.province,
      row.urgency,
      row.contact_phone,
      row.contact_email,
      row.created_at,
      row.verified_at,
    ];
    const dynamicCells = fieldColumns.map(({ key }) => {
      const value = fields[key];
      if (Array.isArray(value)) return value.join("; ");
      if (chipKeys.has(key) && typeof value === "string") return value;
      return value ?? "";
    });
    lines.push([...fixed, ...dynamicCells].map(csvCell).join(","));
  }

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}s-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
