import { NextResponse } from "next/server";

import { startClaim } from "@/lib/account-claim";
import { supabaseClaimPorts } from "@/lib/account-claim-ports";
import { EMAIL_BUDGET, callerKey, consume } from "@/lib/rate-limit";

/**
 * Step one of claiming a registration: send a one-time code to the mailbox on
 * it.
 *
 * The response is deliberately the same in every case a caller could use to
 * learn something — unknown submission, wrong mailbox, already claimed — so
 * this cannot be walked to discover which addresses have registered or which
 * already have accounts. The only distinguishable answers are "your request
 * was malformed" and "our mail provider failed", neither of which says
 * anything about the person on the other end.
 *
 * Rate limited on the tightest budget in the app, because this is the one
 * public endpoint that causes mail to be sent to an address the caller chose.
 */
export async function POST(request: Request) {
  const rate = consume(callerKey(request, "claim-start"), EMAIL_BUDGET);
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

  const { submissionId, email, kind } = body as {
    submissionId?: unknown;
    email?: unknown;
    kind?: unknown;
  };

  const ports = await supabaseClaimPorts();
  // A requester claiming their need uses the same mailbox proof as a
  // volunteer claiming their registration — one flow, one set of guarantees.
  const result = await startClaim(ports, {
    submissionId,
    email,
    kind: kind === "need" ? "need" : "volunteer",
  });

  if (!result.ok) {
    const status = result.error === "invalid_request" ? 400 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  // `result.sent` is not returned. Whether a code actually went out is exactly
  // the fact this endpoint must not disclose.
  return NextResponse.json({ ok: true });
}
