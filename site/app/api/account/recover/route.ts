import { NextResponse } from "next/server";

import { normalizedEmail } from "@/lib/account-claim";
import { EMAIL_BUDGET, callerKey, consume } from "@/lib/rate-limit";
import { supabaseServerClient } from "@/lib/supabase-server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends a password reset link to a returning volunteer.
 *
 * There was no way back in before this: someone who claimed an account and
 * forgot the password had no route except registering again, which is exactly
 * the duplicate registration the whole claim flow exists to prevent.
 *
 * Always answers `{ ok: true }` for a well-formed address, whether or not an
 * account exists. Supabase does not send to an unknown address, so the honest
 * response and the private one are the same shape.
 */
export async function POST(request: Request) {
  const rate = consume(callerKey(request, "recover"), EMAIL_BUDGET);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { email, lang } = (body ?? {}) as { email?: unknown; lang?: unknown };
  if (typeof email !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const address = normalizedEmail(email);
  if (address.length > 254 || !EMAIL_PATTERN.test(address)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const language = lang === "np" ? "np" : "en";

  const supabase = await supabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(address, {
    redirectTo: `${origin}/${language}/account/reset`,
  });

  // Logged, not returned: a provider outage is worth knowing about, but the
  // caller learns nothing about whether the address has an account either way.
  if (error) console.error("password reset send failed", error.message);

  return NextResponse.json({ ok: true });
}
