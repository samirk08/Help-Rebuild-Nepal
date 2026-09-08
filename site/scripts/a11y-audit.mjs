/**
 * Accessibility and small-screen audit, measured in a real browser.
 *
 * Reports what a static check cannot see: computed tap-target sizes, real
 * horizontal overflow, and controls that end up with no accessible name once
 * the DOM is assembled. Every finding here is a measurement, not a guess.
 *
 * Three classes of false positive are excluded deliberately, because a report
 * full of them is a report nobody reads:
 *   - the visually-hidden clip pattern, which parks a 1px box offscreen on
 *     purpose;
 *   - content inside a deliberate horizontal scroller, where the container is
 *     doing its job;
 *   - a checkbox inside a <label>, where the label is the real target.
 *
 * Usage — needs the dev server and a Chrome with remote debugging:
 *
 *   npm run dev
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless --remote-debugging-port=9333 --user-data-dir=/tmp/a11y about:blank
 *   node scripts/a11y-audit.mjs 320 /en/volunteer /en/request /np/request
 *
 * Not in CI: it needs a browser and a running app. tests/accessibility.test.ts
 * covers the statically checkable half on every pull request.
 */

const PORT = 9333;
const args = process.argv.slice(2);
const width = Number(args[0] || 320);
const paths = args.slice(1);

async function target(url) {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  return res.json();
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  const ready = new Promise((r) => ws.addEventListener("open", r));
  return {
    ready,
    close: () => ws.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    },
  };
}

const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const overflow = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // Only report the node itself sticking out, not every ancestor of one.
    // The standard visually-hidden clip pattern parks a 1px box offscreen on
    // purpose; reporting it as overflow buries the real findings.
    const cs = getComputedStyle(el);
    if (cs.position === "absolute" && (cs.clip !== "auto" || cs.clipPath !== "none")) continue;
    // Content inside a deliberate horizontal scroller (the section rail, a wide
    // table) is not page overflow — the container is doing its job. What
    // matters is whether the document itself scrolls sideways.
    let scroller = el.parentElement, inScroller = false;
    while (scroller && scroller !== document.body) {
      const p = getComputedStyle(scroller);
      if (p.overflowX === "auto" || p.overflowX === "scroll") { inScroller = true; break; }
      scroller = scroller.parentElement;
    }
    if (inScroller) continue;
    if (r.right > vw + 1 || r.left < -1) {
      const own = [...el.children].every((c) => {
        const cr = c.getBoundingClientRect();
        return cr.right <= vw + 1 && cr.left >= -1;
      });
      if (own) overflow.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 60)) || "",
        text: (el.textContent || "").trim().slice(0, 40),
        left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
      });
    }
  }

  const small = [];
  const unnamed = [];
  // WCAG 2.5.8 Target Size (Minimum), the AA bar in WCAG 2.2. 44 is the
  // enhanced level; reporting against it flags every ordinary text link and
  // buries the real failures.
  const TARGET = 24;
  for (const el of document.querySelectorAll("a[href], button, input, select, textarea, [role=button]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const type = el.getAttribute("type");
    // A checkbox inside a <label> is activated by the whole label, so that is
    // the real target. Measuring the 13px box alone reports a failure the user
    // never experiences.
    const wrapper = el.closest("label");
    const box = wrapper ? wrapper.getBoundingClientRect() : r;
    if (type !== "hidden" && (box.height < TARGET || box.width < TARGET)) {
      small.push({
        tag: el.tagName.toLowerCase(), type,
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 34),
        w: Math.round(box.width), h: Math.round(box.height),
        viaLabel: !!wrapper,
      });
    }
    const named =
      el.getAttribute("aria-label") ||
      el.getAttribute("aria-labelledby") ||
      (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) ||
      el.closest("label") ||
      (el.tagName === "A" || el.tagName === "BUTTON" ? (el.textContent || "").trim() : "") ||
      el.getAttribute("title");
    if (!named) unnamed.push({
      tag: el.tagName.toLowerCase(), type,
      name: el.getAttribute("name") || el.id || "", cls: String(el.className || "").slice(0, 40),
    });
  }

  const positiveTabIndex = [...document.querySelectorAll("[tabindex]")]
    .filter((el) => Number(el.getAttribute("tabindex")) > 0).length;

  return JSON.stringify({
    scrollW: document.documentElement.scrollWidth, vw,
    lang: document.documentElement.lang,
    h1: document.querySelectorAll("h1").length,
    skipLink: !!document.querySelector('a[href^="#"]'),
    imagesNoAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
    positiveTabIndex,
    overflow: overflow.slice(0, 12),
    small: small.slice(0, 12),
    unnamed: unnamed.slice(0, 12),
  });
})()`;

const chrome = await target("about:blank");
const client = connect(chrome.webSocketDebuggerUrl);
await client.ready;
await client.send("Page.enable");
await client.send("Emulation.setDeviceMetricsOverride", {
  width, height: 900, deviceScaleFactor: 1, mobile: true,
});

for (const path of paths) {
  await client.send("Page.navigate", { url: `http://127.0.0.1:3000${path}` });
  await new Promise((r) => setTimeout(r, 3500));
  const { result } = await client.send("Runtime.evaluate", {
    expression: PROBE, returnByValue: true,
  });
  console.log(`\n=== ${path} @ ${width}px ===`);
  console.log(result.value);
}

client.close();
process.exit(0);
