import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail: string };

/**
 * Why this page exists: when a public form starts returning 500, the only
 * signal anyone outside the Vercel dashboard gets is a generic "something went
 * wrong" toast. That is not enough to tell a missing migration apart from a
 * mis-pasted key, and both look identical from the browser.
 *
 * Everything here is admin-gated by middleware and reports shapes, never data.
 * No key is ever printed — only which *kind* of key it is.
 */

/**
 * The single most common misconfiguration: pasting the publishable/anon key
 * into SUPABASE_SERVICE_ROLE_KEY. Every table has RLS enabled with no policies
 * (see supabase/schema.sql), so an anon key reads zero rows *without error* and
 * fails every write — a dashboard of honest-looking zeros plus a form that
 * cannot save.
 *
 * Supabase issues two key formats. Legacy keys are JWTs carrying a `role`
 * claim; newer projects issue opaque `sb_secret_…` / `sb_publishable_…` keys.
 * Both are identified without revealing the key.
 */
function describeKey(key: string | undefined): Check {
  if (!key) {
    return {
      name: "Service role key",
      ok: false,
      detail: "SUPABASE_SERVICE_ROLE_KEY is not set in this environment.",
    };
  }

  if (key.startsWith("sb_secret_")) {
    return { name: "Service role key", ok: true, detail: "Secret key (sb_secret_…). Correct." };
  }
  if (key.startsWith("sb_publishable_")) {
    return {
      name: "Service role key",
      ok: false,
      detail:
        "This is the PUBLISHABLE key (sb_publishable_…), not the secret key. It cannot bypass " +
        "row level security, so every read returns nothing and every write fails.",
    };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64").toString("utf8")
    ) as { role?: string };

    if (payload.role === "service_role") {
      return { name: "Service role key", ok: true, detail: "JWT with role=service_role. Correct." };
    }
    return {
      name: "Service role key",
      ok: false,
      detail:
        `This key's role is "${payload.role ?? "unknown"}", not "service_role". It cannot bypass ` +
        "row level security, so every read returns nothing and every write fails.",
    };
  } catch {
    return {
      name: "Service role key",
      ok: false,
      detail: "Set, but not a recognisable Supabase key format.",
    };
  }
}

/** Reports the Postgres error code, which is what actually identifies a fault. */
function fromError(name: string, error: { message: string; code?: string } | null): Check {
  if (!error) return { name, ok: true, detail: "OK" };
  const code = error.code ? `[${error.code}] ` : "";
  return { name, ok: false, detail: `${code}${error.message}` };
}

export default async function DiagnosticsPage() {
  const checks: Check[] = [describeKey(process.env.SUPABASE_SERVICE_ROLE_KEY)];
  const client = supabaseAdmin();

  const base = await client.from("submissions").select("id").limit(1);
  checks.push(fromError("Read submissions", base.error));

  // Present only after supabase/002-public-board.sql has been run. 42703
  // (undefined_column) here means that migration has not been applied.
  const migrated = await client.from("submissions").select("id, skills, people_needed").limit(1);
  checks.push(fromError("Migration 002 columns (skills, people_needed)", migrated.error));

  const interests = await client.from("interests").select("id").limit(1);
  checks.push(fromError("Migration 002 table (interests)", interests.error));

  // The exact path the public volunteer form takes. Written and removed again,
  // so this reproduces the real failure without leaving a row behind.
  const probe = await client
    .from("submissions")
    .insert({
      kind: "volunteer",
      lang: "en",
      fields: { diagnostic: true },
      org_or_name: "Diagnostic probe",
      skills: null,
      people_needed: null,
    })
    .select("id")
    .single();

  if (probe.error) {
    checks.push(fromError("Write a submission", probe.error));
  } else {
    await client.from("submissions").delete().eq("id", probe.data.id);
    checks.push({ name: "Write a submission", ok: true, detail: "Inserted and removed. OK" });
  }

  const failing = checks.filter((c) => !c.ok);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1 className="admin-h1">Diagnostics</h1>
          <p className="admin-head__note">
            Whether this deployment can actually reach and write to the database. Reports
            configuration only — never keys, never submitted data.
          </p>
        </div>
      </div>

      {failing.length === 0 ? (
        <div className="admin-stat admin-stat--green" style={{ marginBottom: 24 }}>
          <p className="admin-stat__value">All clear</p>
          <p className="admin-stat__label">Forms can save and the dashboard can read.</p>
        </div>
      ) : (
        <div className="admin-stat admin-stat--amber" style={{ marginBottom: 24 }}>
          <p className="admin-stat__value">{failing.length} failing</p>
          <p className="admin-stat__label">
            Public forms are likely returning errors right now. Details below.
          </p>
        </div>
      )}

      <div className="admin-detail">
        {checks.map((check) => (
          <div className="admin-detail__row" key={check.name}>
            <span className="admin-detail__k">
              <span
                className={`admin-badge admin-badge--${check.ok ? "verified" : "rejected"}`}
                style={{ marginRight: 8 }}
              >
                {check.ok ? "PASS" : "FAIL"}
              </span>
              {check.name}
            </span>
            <span className="admin-detail__v">{check.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
