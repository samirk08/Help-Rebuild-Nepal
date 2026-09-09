import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { canDeliverTo, deploymentOf, isProduction, redact, testRecipients } from "../lib/env";
import { errorFields, thrownFields } from "../lib/log";

/**
 * The rules that decide what a deployment may do to real people.
 *
 * A staging pilot has to send real email to be a real test, so
 * MATCHING_EMAIL_ENABLED gets set there. At that moment a deployment pointed at
 * a copy of production data can invite an actual volunteer to work that does
 * not exist. That is one environment variable away at all times, and no runbook
 * prevents it — so it is decided in code, and held here.
 */

const prod = { HRN_ENV: "production" };
const staging = { HRN_ENV: "preview", MATCHING_TEST_RECIPIENTS: "pilot@hrn.org, @coordination.np" };

test("a deployment that has not said what it is does not get production's permissions", () => {
  // Guessing toward "production" would switch the safety off on an unlabelled
  // box, which is the one direction this must never be wrong in.
  assert.equal(deploymentOf({}), "development");
  assert.equal(isProduction({}), false);
  assert.equal(deploymentOf({ VERCEL_ENV: "preview" }), "preview");
  assert.equal(deploymentOf({ HRN_ENV: "staging" }), "preview");
  assert.equal(deploymentOf({ VERCEL_ENV: "production" }), "production");

  // HRN_ENV wins, so a non-Vercel host can declare itself.
  assert.equal(deploymentOf({ VERCEL_ENV: "preview", HRN_ENV: "production" }), "production");

  // A self-hosted production build with no platform variable at all.
  assert.equal(deploymentOf({ NODE_ENV: "production" }), "production");
});

test("production may write to anyone; that is what production is", () => {
  assert.equal(canDeliverTo("volunteer@example.np", prod).allowed, true);
});

test("outside production, an unlisted recipient is refused", () => {
  const verdict = canDeliverTo("a.real.volunteer@example.np", staging);
  assert.equal(verdict.allowed, false);
  assert.match(verdict.allowed === false ? verdict.reason : "", /MATCHING_TEST_RECIPIENTS/);

  // And the refusal names the address only in redacted form, because the
  // reason travels into logs and error messages.
  assert.ok(!(verdict.allowed === false ? verdict.reason : "").includes("a.real.volunteer"));
});

test("outside production, the people running the pilot still get their mail", () => {
  assert.equal(canDeliverTo("pilot@hrn.org", staging).allowed, true);
  // Case and surrounding whitespace are the ordinary way a pasted address
  // arrives; refusing on those would send someone hunting for a bug that isn't.
  assert.equal(canDeliverTo("  Pilot@HRN.org ", staging).allowed, true);
});

test("a domain entry lets a team list itself once", () => {
  assert.equal(canDeliverTo("sujata@coordination.np", staging).allowed, true);
  assert.equal(canDeliverTo("rajan@coordination.np", staging).allowed, true);
  // A suffix must not match a lookalike domain someone else registered. The
  // "@" is part of the entry precisely so that notcoordination.np cannot
  // satisfy @coordination.np.
  assert.equal(canDeliverTo("attacker@notcoordination.np", staging).allowed, false);
  assert.equal(canDeliverTo("someone@coordination.np.example.com", staging).allowed, false);
});

test("an empty allowlist outside production sends nothing at all", () => {
  // A staging pilot that sends nothing is an afternoon of confusion. One that
  // emails four hundred volunteers about work that does not exist is not
  // recoverable.
  const verdict = canDeliverTo("anyone@example.np", { HRN_ENV: "preview" });
  assert.equal(verdict.allowed, false);
  assert.match(verdict.allowed === false ? verdict.reason : "", /no mail is delivered/i);
});

test("the allowlist tolerates the way people actually write lists", () => {
  assert.deepEqual(
    testRecipients({ MATCHING_TEST_RECIPIENTS: " A@b.org ,, @c.np,  " }),
    ["a@b.org", "@c.np"]
  );
  assert.deepEqual(testRecipients({}), []);
});

test("an address in a log is recognisable but not reusable", () => {
  assert.equal(redact("sujata@coordination.np"), "su***@coordination.np");
  assert.equal(redact("a@b.np"), "a***@b.np");
  assert.equal(redact("not-an-address"), "***");
});

test("the send path itself refuses, not only the worker", () => {
  // Defence in depth: the worker checks first so a blocked address never burns
  // retry attempts, but anything else that reaches the provider must be
  // refused too.
  const source = readFileSync(join("lib", "matching", "email.ts"), "utf8");
  const send = source.slice(source.indexOf("export async function sendMatchingEmail"));
  assert.match(send, /canDeliverTo/, "sendMatchingEmail must check the deployment");

  const worker = readFileSync(join("lib", "matching", "worker.ts"), "utf8");
  assert.match(worker, /canDeliverTo/, "the worker must check before claiming an attempt");
  assert.match(worker, /cancelled/, "a blocked message is cancelled, not retried forever");
});

test("logs are structured, with nothing ad hoc left behind", () => {
  // 46 console.error calls, each fine alone and useless in aggregate: prose
  // messages, inconsistent error stringification, and no field you can filter
  // on during an incident.
  const stray: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(full) && full !== join("lib", "log.ts")) {
        const source = readFileSync(full, "utf8");
        if (/\bconsole\.(error|warn|log)\(/.test(source)) stray.push(full);
      }
    }
  };
  walk("lib");
  walk("app");
  assert.deepEqual(stray, [], "use logError/logWarn/logInfo so the field is queryable");
});

test("a log line carries the fault, bounded, and not the payload", () => {
  const fields = errorFields({ code: "42501", message: "x".repeat(1000) });
  assert.equal(fields.error_code, "42501");
  // A Postgres error can carry a whole statement; a log line that wraps for
  // forty lines is one nobody reads to the end of.
  assert.equal(String(fields.error_message).length, 300);

  assert.deepEqual(errorFields(null), {});
  assert.equal(thrownFields(new Error("boom")).error_name, "Error");
  assert.equal(thrownFields("plain string").error_message, "plain string");
});

test("the health endpoint answers a monitor, not a person", () => {
  const source = readFileSync(join("app", "api", "health", "route.ts"), "utf8");

  // A page that always returns 200 with a status in the body needs its own
  // alerting rule to be useful, which defeats the point of using a monitor
  // that already exists.
  assert.match(source, /status:\s*status === "ok" \? 200 : 503/);
  assert.match(source, /no-store/, "a cached health check reports the past");

  // Public, so it must report shapes and never data. Matched as property
  // access rather than as words, since the file's own comments name the things
  // it is careful not to return.
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  for (const leak of ["contact_email", "org_or_name", "payload", "subject", "to"]) {
    assert.ok(
      !new RegExp(`[.\\["']${leak}["'\\]]?\\s*[,:)\\]]`).test(code),
      `health must not expose ${leak}`
    );
  }
});

test("every column the health read asks for actually exists", () => {
  // `matching_email_events.type` does not exist — the column is `event_type`.
  // So workerHealth() errored on every call, reported the outbox as unreadable,
  // and /api/health returned 503 from the moment it shipped. An alerting
  // endpoint that is always red is worse than none: it is the crying-wolf
  // failure the Diagnostics page was carefully written to avoid, reintroduced
  // one file away.
  //
  // Nothing caught it because the tests around this module check the log shape
  // and the route source, and never put a column name next to the schema.
  const health = readFileSync(join("lib", "matching", "health.ts"), "utf8");
  const schema = readdirSync("supabase")
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join("supabase", f), "utf8"))
    .join("\n");

  const reads = [...health.matchAll(/\.from\("(\w+)"\)\s*\n?\s*\.select\("([^"]+)"\)/g)];
  assert.ok(reads.length >= 2, "expected the outbox and events reads");

  for (const [, table, columns] of reads) {
    // The table's own CREATE, so a column of the same name on a different
    // table cannot vouch for this one.
    const start = schema.indexOf(`create table if not exists ${table} (`);
    assert.notEqual(start, -1, `${table} is not created by any migration`);
    const body = schema.slice(start, schema.indexOf(");", start));
    // Columns added later by ALTER also count.
    const altered = [...schema.matchAll(
      new RegExp(`alter table ${table} add column if not exists (\\w+)`, "g")
    )].map((m) => m[1]);

    for (const column of columns.split(",").map((c) => c.trim())) {
      assert.ok(
        new RegExp(`^\\s*${column}\\s`, "m").test(body) || altered.includes(column),
        `${table}.${column} is selected but does not exist`
      );
    }
  }
});
