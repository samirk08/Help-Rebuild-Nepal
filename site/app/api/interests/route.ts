import { NextResponse } from "next/server";

import { PUBLISHED_STATUSES } from "@/lib/public-needs";
import { supabaseAdmin } from "@/lib/supabase";
import { currentVolunteer } from "@/lib/volunteer-auth";

const MAX = { name: 120, contact: 200, message: 2000 };

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * "I can help with this" on a published need.
 *
 * Deliberately open (no volunteer login exists yet), so it validates hard:
 * the need must exist and already be published, or this becomes a way to probe
 * which submission ids are real and to attach records to needs still under
 * review. Nothing here is ever shown publicly — the interest lands in the admin
 * review screens and the requester makes contact from there.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const { needId, name, contact, message } = (body ?? {}) as Record<string, unknown>;

  if (typeof needId !== "string" || !/^[0-9a-f-]{36}$/i.test(needId)) {
    return NextResponse.json({ error: "needId must be a uuid" }, { status: 400 });
  }

  const cleanName = clean(name, MAX.name);
  const cleanContact = clean(contact, MAX.contact);
  if (!cleanName || !cleanContact) {
    return NextResponse.json({ error: "name and contact are required" }, { status: 400 });
  }

  const client = supabaseAdmin();

  const { data: need } = await client
    .from("submissions")
    .select("id")
    .eq("id", needId)
    .eq("kind", "need")
    .in("status", PUBLISHED_STATUSES)
    .maybeSingle();

  if (!need) {
    return NextResponse.json({ error: "No published need with that id" }, { status: 404 });
  }

  // Attribute this to an account when one is signed in, so it can appear on
  // that person's profile later. Taken from the session cookie, never from the
  // request body — a caller must not be able to file an interest under someone
  // else's id. Signing in is not required to express interest, so a null here
  // is the normal anonymous case, not a failure.
  const volunteer = await currentVolunteer();

  const { error } = await client.from("interests").insert({
    need_id: needId,
    name: cleanName,
    contact: cleanContact,
    message: clean(message, MAX.message) || null,
    user_id: volunteer?.id ?? null,
  });

  if (error) {
    console.error("interests insert failed", error);
    return NextResponse.json({ error: "Could not record interest" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
