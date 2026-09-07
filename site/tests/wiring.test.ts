import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every component that talks to an API route must actually be rendered.
 *
 * This exists because of a real bug. `JoinNetworkButton`, `networkViewer` and
 * `/api/networks/join` were all written, all correct, and all reachable from
 * nothing: the networks page rendered a hardcoded link to the registration
 * form instead. Someone who had just registered and signed in was told to
 * register again in order to join a network.
 *
 * Typecheck passed. Every test passed. The build passed. Working code that
 * nobody calls is still valid code, so none of those could see it — the defect
 * was in the wiring, and nothing checked the wiring.
 *
 * A component that posts to the backend and is imported by no page is either
 * dead weight or a feature the site does not actually offer. Both are worth
 * failing a build over.
 */

const COMPONENTS = "components";
const APP = "app";

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, out);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

test("every component that calls an API route is rendered by a page", () => {
  const appSources = filesUnder(APP)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  const orphaned: string[] = [];

  for (const file of readdirSync(COMPONENTS)) {
    if (!file.endsWith(".tsx")) continue;
    const source = readFileSync(join(COMPONENTS, file), "utf8");

    // Only components that reach the backend. A purely presentational one that
    // is temporarily unused is untidy, not a broken feature.
    if (!/fetch\(\s*["'`]\/api\//.test(source)) continue;

    const name = file.replace(/\.tsx$/, "");
    // Imported by a page, or composed into another component that is.
    const referenced =
      appSources.includes(`components/${name}"`) ||
      filesUnder(COMPONENTS).some(
        (other) =>
          !other.endsWith(file) && readFileSync(other, "utf8").includes(`components/${name}"`)
      );

    if (!referenced) orphaned.push(name);
  }

  assert.deepEqual(
    orphaned,
    [],
    `These components post to an API route but nothing renders them, so the ` +
      `feature does not exist for users: ${orphaned.join(", ")}`
  );
});

/**
 * The networks page specifically, because that is where the bug was and the
 * general rule above would still pass if the page imported the button but
 * never decided who sees it.
 */
test("the networks page decides what to show from the signed-in viewer", () => {
  const page = readFileSync(join(APP, "[lang]", "networks", "page.tsx"), "utf8");

  assert.match(page, /networkViewer/, "networks page must ask who is asking");
  assert.match(page, /JoinNetworkButton/, "a registered viewer must get the join button");
  assert.match(page, /memberships/, "an existing member must not be asked to join again");
});

/**
 * The mission actions have the same shape as the network join did before it
 * was fixed: correct server actions that a page has to actually call. Server
 * actions are invoked through a form rather than `fetch`, so the general rule
 * above cannot see them.
 */
test("the Situation Room page calls the actions that change the queue", () => {
  const page = readFileSync(join(APP, "admin", "(dashboard)", "situation", "page.tsx"), "utf8");
  const actions = readFileSync(join(COMPONENTS, "SituationItemActions.tsx"), "utf8");
  const layout = readFileSync(join(APP, "admin", "(dashboard)", "layout.tsx"), "utf8");

  assert.match(layout, /\/admin\/situation/, "the Situation Room must be in the admin nav");
  assert.match(page, /loadQueue/, "the page must load the derived queue");
  assert.match(page, /SituationItemActions/, "the page must render the actions");
  assert.match(page, /updateQueueItem/, "assign/due/priority must be reachable");
  assert.match(page, /snoozeQueueItem/, "snooze must be reachable");
  assert.match(page, /resolveQueueItem/, "resolve must be reachable");
  assert.match(actions, /updateQueueItem/);
  assert.match(actions, /snoozeQueueItem/);
  assert.match(actions, /resolveQueueItem/);
  assert.match(page, /metricsView|metrics/, "failed reads must have a metrics path that can show unavailable");
});

test("the missions pages call the actions that change membership", () => {
  const list = readFileSync(join(APP, "[lang]", "missions", "page.tsx"), "utf8");
  const detail = readFileSync(join(APP, "[lang]", "missions", "[id]", "page.tsx"), "utf8");
  const card = readFileSync(join(COMPONENTS, "MissionCard.tsx"), "utf8");

  assert.match(list, /missionViewer/, "the list must ask who is asking");
  assert.match(list, /setMissionOnly/, "the scope switch must be reachable");
  assert.match(card, /joinMission/, "a card must be able to join");
  assert.match(card, /leaveMission/, "joining must be reversible from the same place");
  assert.match(detail, /joinMission|leaveMission/, "the detail page must offer the same action");
});
