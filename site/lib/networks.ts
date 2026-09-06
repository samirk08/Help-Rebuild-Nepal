import { fieldKey } from "./form-schema";
import { NETWORKS } from "./site-data";
import { supabaseAdmin } from "./supabase";
import { currentVolunteer } from "./volunteer-auth";

/**
 * Network membership (migration 009).
 *
 * A member is a row in network_members: one account, one network. Two ways in:
 * an explicit click on "Join network", or automatically into your primary-skill
 * network when your registration is claimed (see /api/account/create and the
 * migration's backfill). Registrations never claimed by an account cannot hold
 * a membership row, so the public count adds them by primary skill — the same
 * derivation the page used before joining existed, now only for the rows that
 * cannot join.
 */

export const PRIMARY_SKILL_KEY = fieldKey("03", "Primary skill");

export function isNetworkName(value: unknown): value is string {
  return typeof value === "string" && NETWORKS.some((n) => n.name === value);
}

/** The network a registration's primary skill maps to, if any. */
export function networkForSkill(skill: unknown): string | null {
  // Primary skill is a single select, stored as a string — but read it the way
  // the profile does, tolerating the array shape chip answers arrive in.
  const value = Array.isArray(skill) ? skill[0] : skill;
  if (typeof value !== "string") return null;
  return NETWORKS.find((n) => n.skill === value)?.name ?? null;
}

/**
 * Adds an account to a network. Idempotent: joining twice is a no-op, not an
 * error, because a second click must never turn into a failure toast.
 */
export async function addMember(userId: string, network: string): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin()
    .from("network_members")
    .upsert(
      { user_id: userId, network },
      { onConflict: "user_id,network", ignoreDuplicates: true }
    );

  if (error) {
    console.error("network join failed", error);
    return { error: "insert_failed" };
  }
  return { error: null };
}

export type NetworkViewer = {
  signedIn: boolean;
  /** Has a volunteer registration linked to this account. */
  registered: boolean;
  /** Network names this account has joined. */
  memberships: ReadonlySet<string>;
};

/**
 * What the signed-in person means to the networks page: can they one-click
 * join (signed in + registered), and which networks are already theirs.
 * Identity comes from the session cookie only, same rule as the profile.
 */
export async function networkViewer(): Promise<NetworkViewer> {
  const user = await currentVolunteer();
  if (!user) return { signedIn: false, registered: false, memberships: new Set() };

  const client = supabaseAdmin();
  const [registration, memberRows] = await Promise.all([
    client
      .from("submissions")
      .select("id")
      .eq("kind", "volunteer")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    client.from("network_members").select("network").eq("user_id", user.id),
  ]);

  return {
    signedIn: true,
    registered: Boolean(registration.data),
    memberships: new Set((memberRows.data ?? []).map((row) => row.network)),
  };
}
