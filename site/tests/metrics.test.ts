import test from "node:test";
import assert from "node:assert/strict";

test("isDemo returns true only when DEMO_ALLOWED is true and demo param is present", () => {
  // Clear require cache for metrics.ts to re-evaluate DEMO_ALLOWED
  const metricsPath = require.resolve("../lib/metrics");

  // Test when NEXT_PUBLIC_ALLOW_DEMO is "1"
  process.env.NEXT_PUBLIC_ALLOW_DEMO = "1";
  delete require.cache[metricsPath];
  let metrics = require("../lib/metrics");

  assert.equal(metrics.DEMO_ALLOWED, true, "DEMO_ALLOWED should be true when NEXT_PUBLIC_ALLOW_DEMO=1");
  assert.equal(metrics.isDemo({ demo: "" }), true, "demo is empty string");
  assert.equal(metrics.isDemo({ demo: "true" }), true, "demo is true");
  assert.equal(metrics.isDemo({ demo: ["true", "false"] }), true, "demo is array");
  assert.equal(metrics.isDemo({}), false, "demo is absent");
  assert.equal(metrics.isDemo({ other: "demo" }), false, "demo is absent, other present");

  // Test when NEXT_PUBLIC_ALLOW_DEMO is not "1"
  process.env.NEXT_PUBLIC_ALLOW_DEMO = "0";
  delete require.cache[metricsPath];
  metrics = require("../lib/metrics");

  assert.equal(metrics.DEMO_ALLOWED, false, "DEMO_ALLOWED should be false when NEXT_PUBLIC_ALLOW_DEMO=0");
  assert.equal(metrics.isDemo({ demo: "" }), false, "demo is empty string but disabled");
  assert.equal(metrics.isDemo({ demo: "true" }), false, "demo is true but disabled");
  assert.equal(metrics.isDemo({ demo: ["true", "false"] }), false, "demo is array but disabled");
  assert.equal(metrics.isDemo({}), false, "demo is absent");

  // Clean up
  delete process.env.NEXT_PUBLIC_ALLOW_DEMO;
});
