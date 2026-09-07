import { addMember, networkForSkill, PRIMARY_SKILL_KEY } from "./networks";
import { supabaseAdmin } from "./supabase";
import { supabaseServerClient } from "./supabase-server";
import type { ClaimPorts, ClaimSubmission } from "./account-claim";

/**
 * The real implementations of the claim ports, wired to Supabase.
 *
 * Kept apart from `account-claim.ts` so the rules in that file stay testable
 * against fakes. Everything here is a thin adapter: no decision is made in this
 * module, which is what keeps the fakes honest — there is no logic here for
 * them to diverge from.
 */
export async function supabaseClaimPorts(): Promise<ClaimPorts> {
  const admin = supabaseAdmin();
  // The cookie-bound client, so a successful `verifyOtp` also establishes the
  // session. The person finishes the claim signed in, rather than being asked
  // to type the password they just chose.
  const session = await supabaseServerClient();

  return {
    async loadSubmission(id: string): Promise<ClaimSubmission | null> {
      const { data, error } = await admin
        .from("submissions")
        .select("id, kind, user_id, contact_email, created_at, fields")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("claim submission lookup failed", error);
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        kind: data.kind,
        user_id: data.user_id ?? null,
        contact_email: data.contact_email ?? null,
        created_at: data.created_at,
        fields: (data.fields ?? {}) as Record<string, unknown>,
      };
    },

    async sendCode(email: string): Promise<boolean> {
      const { error } = await session.auth.signInWithOtp({
        email,
        // The account for a registered volunteer may not exist yet — the
        // registration was a form post, not a sign-up — so the first proven
        // code is what creates it. Nothing is linked until it is proven.
        options: { shouldCreateUser: true },
      });
      if (error) console.error("claim code send failed", error.message);
      return !error;
    },

    async verifyCode(email: string, code: string): Promise<string | null> {
      const { data, error } = await session.auth.verifyOtp({ email, token: code, type: "email" });
      if (error || !data.user) return null;
      return data.user.id;
    },

    async setPassword(userId: string, password: string): Promise<boolean> {
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) console.error("claim password set failed", error.message);
      return !error;
    },

    async linkSubmission(submissionId: string, userId: string, kind): Promise<boolean> {
      // `is("user_id", null)` in the UPDATE itself is what makes two
      // simultaneous claims resolve to one winner: the second matches no row
      // and comes back empty rather than overwriting the first.
      const { data, error } = await admin
        .from("submissions")
        .update({ user_id: userId })
        .eq("id", submissionId)
        .eq("kind", kind)
        .is("user_id", null)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("claim link failed", error);
        return false;
      }
      return Boolean(data);
    },

    async enrolInNetwork(userId: string, fields: Record<string, unknown>): Promise<void> {
      // Matches the public count, which already includes this registration
      // under that skill.
      const network = networkForSkill(fields[PRIMARY_SKILL_KEY]);
      if (network) await addMember(userId, network);
    },
  };
}
