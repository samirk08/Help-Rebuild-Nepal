import { adminAllowlistReady } from "@/lib/admin-auth";
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

/**
 * Reports the Postgres error code, which is what actually identifies a fault,
 * plus the fix where the code and message together name one unambiguously.
 *
 * 42501 is worth spelling out because it covers two unrelated faults that are
 * easy to confuse: "permission denied for table" is the GRANT layer (migration
 * 003), while "violates row-level security policy" is RLS above it.
 */
function fromError(name: string, error: { message: string; code?: string } | null): Check {
  if (!error) return { name, ok: true, detail: "OK" };

  const code = error.code ? `[${error.code}] ` : "";
  let hint = "";

  if (error.code === "42501" && /permission denied/i.test(error.message)) {
    hint = " — service_role has no table privileges. Run supabase/003-service-role-grants.sql.";
  } else if (error.code === "42501") {
    hint = " — blocked by row level security. Check SUPABASE_SERVICE_ROLE_KEY is the secret key.";
  } else if (error.code === "42703" || error.code === "42P01") {
    hint = " — missing column or table. Run supabase/002-public-board.sql.";
  }

  return { name, ok: false, detail: `${code}${error.message}${hint}` };
}

/**
 * Migration state, read from the ledger view rather than probed.
 *
 * The page used to answer "can this deployment write?" by INSERTing a fake
 * volunteer registration into `submissions` and deleting it again — during a
 * GET. Two things were wrong with that. A GET that writes can be replayed by
 * anything that follows links: a browser prefetch, a link scanner, a preview
 * bot. And when the delete failed, a row called "Diagnostic probe" was left
 * sitting in the middle of real registrations, where the next person to export
 * the volunteer list would find it.
 *
 * `migration_state` (supabase/011-intake-integrity.sql) reports the same facts
 * from the catalogs. Write permission is inferred from the GRANT layer instead,
 * which is what the failing case actually was.
 */
async function migrationChecks(
  client: ReturnType<typeof supabaseAdmin>
): Promise<Check[]> {
  const { data, error } = await client
    .from("migration_state")
    .select("migration, detail, applied")
    .order("migration");

  if (error) {
    return [
      fromError("Migration ledger (migration 011)", error),
      {
        name: "Migration state",
        ok: false,
        detail:
          "Cannot read migration_state, so individual migrations cannot be reported. " +
          "Run supabase/011-intake-integrity.sql.",
      },
    ];
  }

  const rows = (data ?? []) as Array<{ migration: string; detail: string; applied: boolean }>;
  return rows.map((row) => ({
    name: `Migration ${row.migration} — ${row.detail}`,
    ok: row.applied,
    detail: row.applied ? "Applied" : `Not applied. Run supabase/${row.migration}-*.sql.`,
  }));
}

/**
 * Whether service_role actually holds INSERT on `submissions`.
 *
 * Read from `information_schema.role_table_grants`, so it answers the question
 * the write probe was really asking — "would the public form's insert be
 * refused?" — without performing the insert. This is the check that catches a
 * project missing supabase/003-service-role-grants.sql.
 */
async function writePrivilegeCheck(
  client: ReturnType<typeof supabaseAdmin>
): Promise<Check> {
  const { data, error } = await client.rpc("has_submissions_insert");

  if (error) {
    // The helper is optional: a project that has not run migration 011 still
    // gets every other check rather than a broken page.
    return {
      name: "Write privilege (submissions)",
      ok: false,
      detail:
        `Could not confirm INSERT privilege (${error.code ?? "unknown"}). ` +
        "Run supabase/011-intake-integrity.sql, then re-check.",
    };
  }

  return {
    name: "Write privilege (submissions)",
    ok: data === true,
    detail:
      data === true
        ? "service_role holds INSERT on submissions. Forms can save."
        : "service_role has no INSERT on submissions. Run supabase/003-service-role-grants.sql.",
  };
}

export default async function DiagnosticsPage() {
  const checks: Check[] = [describeKey(process.env.SUPABASE_SERVICE_ROLE_KEY)];
  const client = supabaseAdmin();

  const base = await client.from("submissions").select("id").limit(1);
  checks.push(fromError("Read submissions", base.error));

  checks.push(...(await migrationChecks(client)));

  const allowlist = await adminAllowlistReady();
  checks.push({
    name: "Admin allowlist (migration 004)",
    ok: allowlist.ready,
    detail: allowlist.detail,
  });

  checks.push(await writePrivilegeCheck(client));

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
