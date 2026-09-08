/**
 * Which deployment this is, and what it is allowed to do to real people.
 *
 * The plan asks for "safe staging/production separation" before a pilot, and
 * the thing that actually makes staging unsafe is not configuration drift — it
 * is mail. A staging pilot has to send real email to be a real test, so
 * `MATCHING_EMAIL_ENABLED` gets set there. The moment it is, a deployment
 * pointed at a copy of production data can invite an actual volunteer to
 * actual work that does not exist.
 *
 * That is a single environment variable away at all times, and no amount of
 * care in a runbook prevents it. So the rule lives in code: outside production,
 * a message may only be delivered to an address someone explicitly listed.
 *
 * Pure and dependency-free so it can be tested against a fake environment
 * rather than the process it happens to be running in.
 */

export type Deployment = "production" | "preview" | "development";

/**
 * `HRN_ENV` wins where it is set, so a self-hosted or non-Vercel deployment can
 * declare itself. `VERCEL_ENV` is the platform's own answer, and is the value
 * that is actually present on a Vercel preview.
 *
 * The default is `development` rather than `production`: guessing wrong toward
 * "this is production" would switch the safety off on an unlabelled box.
 */
export function deploymentOf(env: Record<string, string | undefined> = process.env): Deployment {
  const declared = env.HRN_ENV ?? env.VERCEL_ENV;
  if (declared === "production") return "production";
  if (declared === "preview" || declared === "staging") return "preview";
  if (declared === "development") return "development";
  return env.NODE_ENV === "production" && !env.VERCEL_ENV ? "production" : "development";
}

export function isProduction(env: Record<string, string | undefined> = process.env): boolean {
  return deploymentOf(env) === "production";
}

/**
 * Addresses a non-production deployment may write to.
 *
 * Comma-separated in `MATCHING_TEST_RECIPIENTS`. Two forms are accepted: a
 * whole address, and a `@domain` suffix so a coordination team can list its own
 * domain once instead of every person on it.
 */
export function testRecipients(
  env: Record<string, string | undefined> = process.env
): string[] {
  return (env.MATCHING_TEST_RECIPIENTS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export type DeliveryVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Whether this deployment may send to this address.
 *
 * Production sends to anyone — that is the point of it. Everywhere else, the
 * recipient has to be listed, and an empty list means nothing is sent at all.
 * Refusing by default is the safe direction to be wrong in: a staging pilot
 * that sends nothing is an afternoon of confusion, and one that emails four
 * hundred volunteers about work that does not exist is not recoverable.
 */
export function canDeliverTo(
  address: string,
  env: Record<string, string | undefined> = process.env
): DeliveryVerdict {
  if (isProduction(env)) return { allowed: true };

  const to = address.trim().toLowerCase();
  const allowed = testRecipients(env);

  if (allowed.length === 0) {
    return {
      allowed: false,
      reason:
        `This is a ${deploymentOf(env)} deployment and MATCHING_TEST_RECIPIENTS is empty, ` +
        "so no mail is delivered. Add the addresses running the pilot to send to them.",
    };
  }

  const permitted = allowed.some((entry) =>
    entry.startsWith("@") ? to.endsWith(entry) : to === entry
  );

  if (!permitted) {
    return {
      allowed: false,
      reason:
        `This is a ${deploymentOf(env)} deployment, and ${redact(to)} is not in ` +
        "MATCHING_TEST_RECIPIENTS. Outside production, mail only reaches listed addresses.",
    };
  }

  return { allowed: true };
}

/**
 * An address in a log line, with enough left to recognise it and not enough to
 * be a contact list. Logs are read by more people than the database is.
 */
export function redact(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "***";
  const name = address.slice(0, at);
  const domain = address.slice(at);
  return `${name.slice(0, 2)}***${domain}`;
}
