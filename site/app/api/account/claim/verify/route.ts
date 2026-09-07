import { NextResponse } from "next/server";

import { completeClaim } from "@/lib/account-claim";
import { supabaseClaimPorts } from "@/lib/account-claim-ports";
import { EMAIL_BUDGET, callerKey, consume } from "@/lib/rate-limit";

/**
 * Step two: exchange the code for a linked account.
 *
 * Nothing is attached to `auth.users` before the code checks out, which is the
 * whole point of the change — the previous flow created a `email_confirm: true`
 * account for anyone holding a submission id, marking a mailbox verified that
 * nobody had proved control of.
 *
 * A successful verify also establishes the session cookie, so the person lands
 * on their profile signed in. The password they chose is set for next time
 * rather than being the thing that authenticated them now.
 */
export async function POST(request: Request) {
  const rate = consume(callerKey(request, "claim-verify"), EMAIL_BUDGET);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { submissionId, email, code, password, kind } = body as Record<string, unknown>;

  const ports = await supabaseClaimPorts();
  const result = await completeClaim(ports, {
    submissionId,
    email,
    code,
    password,
    kind: kind === "need" ? "need" : "volunteer",
  });

  if (!result.ok) {
    const status =
      result.error === "invalid_code"
        ? 401
        : result.error === "already_claimed"
          ? 409
          : result.error === "submission_unavailable"
            ? 404
            : result.error === "server_error"
              ? 500
              : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
