import test from "node:test";
import assert from "node:assert/strict";

// Statically imported so the compiler emits lib/metrics into the test build.
// The original version of this test only reached the module through a runtime
// `require`, which tsc cannot see, so the file was never compiled and the test
// failed with "Cannot find module '../lib/metrics'".
import { DEMO_ALLOWED, isDemo } from "../lib/metrics";

/**
 * `?demo` swaps every real figure on the tracker for the design's sample data.
 * That is a screenshot of a full register handed to anyone who knows the query
 * string, so it must stay off unless a deployment opts in deliberately.
 *
 * `DEMO_ALLOWED` is read once at module load, so exercising both states means
 * re-evaluating the module — hence the require-cache dance below.
 */
test("demo mode is off unless the environment opts in", () => {
  assert.equal(typeof isDemo, "function");
  assert.equal(typeof DEMO_ALLOWED, "boolean");

  const metricsPath = require.resolve("../lib/metrics");
  const original = process.env.NEXT_PUBLIC_ALLOW_DEMO;

  try {
    process.env.NEXT_PUBLIC_ALLOW_DEMO = "1";
    delete require.cache[metricsPath];
    let metrics = require("../lib/metrics") as typeof import("../lib/metrics");

    assert.equal(metrics.DEMO_ALLOWED, true);
    // Presence is what counts, not the value: `?demo`, `?demo=1` and a repeated
    // parameter all mean the same request.
    assert.equal(metrics.isDemo({ demo: "" }), true);
    assert.equal(metrics.isDemo({ demo: "true" }), true);
    assert.equal(metrics.isDemo({ demo: ["true", "false"] }), true);
    assert.equal(metrics.isDemo({}), false);
    assert.equal(metrics.isDemo({ other: "demo" }), false);

    // The case that matters. A production build must ignore the query string
    // entirely, however it is spelled.
    process.env.NEXT_PUBLIC_ALLOW_DEMO = "0";
    delete require.cache[metricsPath];
    metrics = require("../lib/metrics") as typeof import("../lib/metrics");

    assert.equal(metrics.DEMO_ALLOWED, false);
    assert.equal(metrics.isDemo({ demo: "" }), false);
    assert.equal(metrics.isDemo({ demo: "true" }), false);
    assert.equal(metrics.isDemo({ demo: ["true", "false"] }), false);

    // Unset is the same as off: a deployment that never heard of the flag does
    // not serve demo data.
    delete process.env.NEXT_PUBLIC_ALLOW_DEMO;
    delete require.cache[metricsPath];
    metrics = require("../lib/metrics") as typeof import("../lib/metrics");
    assert.equal(metrics.DEMO_ALLOWED, false);
    assert.equal(metrics.isDemo({ demo: "1" }), false);
  } finally {
    // Leave the environment and the module registry as they were found, or the
    // next test file inherits a half-configured metrics module.
    if (original === undefined) delete process.env.NEXT_PUBLIC_ALLOW_DEMO;
    else process.env.NEXT_PUBLIC_ALLOW_DEMO = original;
    delete require.cache[metricsPath];
  }
});
