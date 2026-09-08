/**
 * Walks the critical routes against a running build.
 *
 * What this catches that the existing checks do not: a page that compiles and
 * then throws when it renders. `next build` proves the bundle exists; a unit
 * test proves a function is right. Neither one loads a page, so a server
 * component that dereferences a null read, or a route that 500s on a fresh
 * deployment, is invisible to both. That is exactly the failure the Diagnostics
 * page was originally written to chase after the fact.
 *
 * Deliberately not end-to-end. It runs against placeholder Supabase
 * credentials, so nothing here proves a form saves — a real end-to-end run
 * needs a real project and belongs in the staging pilot (docs/RELEASE.md).
 * What it does prove is that every public page renders, in both languages,
 * with the database unreachable. That is a real condition, not a contrived
 * one: it is what a misconfigured deployment looks like, and these pages are
 * supposed to degrade rather than break.
 *
 *   node scripts/smoke.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

/** `text` must appear in the body; it is what proves the page actually rendered. */
const ROUTES = [
  { path: "/en", text: "Help Rebuild Nepal" },
  { path: "/np", text: "नेपाल" },
  { path: "/en/volunteer", text: "consent" },
  { path: "/np/volunteer", text: "consent" },
  { path: "/en/post", text: "form" },
  { path: "/en/needs", text: "need" },
  { path: "/en/relief", text: "relief" },
  { path: "/en/relief/offer", text: "relief-target" },
  { path: "/np/relief/offer", text: "relief-target" },
  { path: "/en/projects", text: "project" },
  { path: "/en/missions", text: "mission" },
  { path: "/en/networks", text: "network" },
  { path: "/en/tracker", text: "tracker" },
  { path: "/en/partners", text: "partner" },
];

/** Routes whose status is the point, rather than their content. */
const STATUS_ONLY = [
  // Redirects to /en. A broken root is the most visible failure there is.
  { path: "/", expect: [200, 307, 308] },
  // Admin is gated; being sent to the login page is the correct answer.
  { path: "/admin", expect: [200, 302, 307, 308] },
  // Unknown language must not render a half-page.
  { path: "/xx/volunteer", expect: [404] },
  // 503 is correct here: the smoke run has no reachable database, and a health
  // endpoint that returns 200 when the database is down is worse than none.
  { path: "/api/health", expect: [200, 503] },
];

const failures = [];

async function check(path, assertion) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const problem = await assertion(res);
    if (problem) failures.push(`${path} — ${problem}`);
    else console.log(`  ok   ${path} (${res.status})`);
  } catch (error) {
    failures.push(`${path} — request failed: ${error.message}`);
  }
}

console.log(`Smoke test against ${BASE}\n`);

for (const { path, text } of ROUTES) {
  await check(path, async (res) => {
    if (res.status !== 200) return `expected 200, got ${res.status}`;
    const body = await res.text();
    // Case-insensitive: the marker is proof the page rendered its own content
    // rather than an error boundary, not an assertion about exact copy.
    if (!body.toLowerCase().includes(text.toLowerCase())) {
      return `rendered, but "${text}" is missing — likely an error boundary`;
    }
    return null;
  });
}

for (const { path, expect } of STATUS_ONLY) {
  await check(path, async (res) =>
    expect.includes(res.status) ? null : `expected one of ${expect.join("/")}, got ${res.status}`
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} route(s) failed:`);
  for (const failure of failures) console.error(`  ✖ ${failure}`);
  process.exit(1);
}

console.log(`\nAll ${ROUTES.length + STATUS_ONLY.length} routes rendered.`);
