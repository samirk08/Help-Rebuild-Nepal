import { NextResponse } from "next/server";

type Body = {
  kind?: unknown;
  fields?: unknown;
};

const KINDS = new Set(["volunteer", "need"]);

/**
 * Intake endpoint for both registration forms.
 *
 * It validates the shape of a submission and acknowledges it, but there is no
 * store behind it yet, so `persisted` is false and the UI says so. Wiring this
 * up is a single change here: validate the fields you care about, write the
 * record, and return `persisted: true`.
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
      { error: "kind must be 'volunteer' or 'need'" },
      { status: 400 }
    );
  }

  if (typeof body.fields !== "object" || body.fields === null || Array.isArray(body.fields)) {
    return NextResponse.json({ error: "fields must be an object" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, persisted: false });
}
