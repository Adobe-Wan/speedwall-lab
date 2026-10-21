// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Smoke tests for the live alpha in a real browser. Every test fails on a page error, a console error, a
// Content-Security-Policy violation, or any request that leaves the site's own origin.
import { test as base, expect } from "@playwright/test";

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const problems = [];
    const origin = new URL(baseURL).origin;
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    page.on("pageerror", e => problems.push(`pageerror: ${e.message}`));
    page.on("console", m => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
    page.on("request", r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) problems.push(`off-site request: ${u}`); });
    await use(page);
    const csp = await page.evaluate(() => window.__csp || []).catch(() => []);
    expect([...problems, ...csp.map(c => `csp: ${c}`)]).toEqual([]);
  },
});

async function open(page, path = "index.html") {
  await page.goto(path);
  await page.waitForFunction(() => window.speedwallDebug && window.speedwallDebug.dodgeTable().ready, null, { timeout: 90_000 });
}
async function lesson(page, key, seconds) {
  await page.click(`[data-preset="${key}"]`);
  await page.waitForFunction(T => { const r = window.speedwallDebug.get().run; return r && r.t >= T; }, seconds, { timeout: 90_000 });
}

test("loads with the views, the Vitals and no price on Dodge Potential at rest", async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle("Speedwall Lab");
  await expect(page.locator("#v-egg")).toBeVisible();
  await expect(page.locator("#v-pilot")).toBeVisible();
  await expect(page.locator("#r-dodge")).not.toHaveText("–");
  await expect(page.locator("#r-dodge-price")).toHaveText(/^best push: (left|right|up|down)$/);
  await expect(page.locator("#ro-range")).toBeHidden();
});

test("every lesson starts and runs", async ({ page }) => {
  await open(page);
  const keys = await page.locator("[data-preset]").evaluateAll(bs => bs.map(b => b.dataset.preset));
  expect(keys.length).toBeGreaterThan(5);
  for (const k of keys) {
    await page.click(`[data-preset="${k}"]`);
    await page.waitForFunction(() => window.speedwallDebug.get().script?.t > 0.3);
    await expect(page.locator("#runbar")).toBeVisible();
  }
});

test("First Flight strip starts lesson one; the lesson ends with a takeaway, your keys and Next", async ({ page }) => {
  await open(page);
  await expect(page.locator("#first")).toBeVisible();
  await expect(page.locator("#lesson-note .term[data-term='scm']")).toHaveAttribute("data-def", /^SCM: /);
  await page.click("#first-go");
  await expect(page.locator("#first")).toBeHidden();
  await page.waitForFunction(() => { const r = window.speedwallDebug.get().run; return r && r.shown; }, null, { timeout: 90_000 });
  await expect(page.locator("#run-result")).toContainText("In Game 226 m/s");
  await expect(page.locator("#run-result")).not.toContainText("r1_scm_right");
  await expect(page.locator("#run-end .take")).toContainText("225 m/s is the limit");
  await expect(page.locator("#run-end .try kbd")).toHaveText("D");
  await page.click("#run-next");
  await expect(page.locator("#run-name")).toHaveText(/^Strafe From a Stop With Boost/);
  await expect(page.locator('[data-preset="scm-strafe"]')).toHaveClass(/done/);
  await page.reload();
  await open(page);
  await expect(page.locator("#first")).toBeHidden();   // remembered: the strip is for the first visit
});

test("Flee: Hold the Wall marks the chaser in the Cockpit and prices the dodge", async ({ page }) => {
  await open(page);
  await lesson(page, "flee-wall", 4);
  await expect(page.locator("#ro-range")).toBeVisible();
  await expect(page.locator("#h-chs-lbl")).toHaveText(/^chaser \d+ m behind$/);
  await expect(page.locator("#r-dodge-price")).toHaveText(/^costs \d+ m of range$/);
  // the marker stays inside the view, above the caption
  const view = await page.locator("#v-pilot").boundingBox(), cap = await page.locator("#cap-pilot").boundingBox();
  const mark = await page.locator("#h-chs-edge").boundingBox();
  expect(mark.y).toBeGreaterThan(view.y);
  expect(mark.y + mark.height).toBeLessThanOrEqual(cap.y);
});

test("desktop Top-Down switch swaps the right-hand view and is remembered", async ({ page }) => {
  await open(page);
  await page.click('#v-pilot [data-right="slice"]');
  await expect(page.locator("#v-slice")).toBeVisible();
  await expect(page.locator("#v-pilot")).toBeHidden();
  await expect(page.locator("#c-inset")).toBeHidden();
  await page.reload();
  await open(page);
  await expect(page.locator("#v-slice")).toBeVisible();
  await page.click('#v-slice [data-right="pilot"]');
  await expect(page.locator("#v-pilot")).toBeVisible();
  await expect(page.locator("#c-inset")).toBeVisible();
});

test("the TVI readout never overlaps the HUD bars, numbers or G column", async ({ page }) => {
  await open(page);
  await lesson(page, "ck-shoot", 8);   // parks the TVI ~10° off the nose, right on the bars
  const boxes = await page.evaluate(() => {
    const all = [...document.querySelectorAll("#ahud text")].filter(t => t.getAttribute("display") !== "none" && t.textContent.trim());
    const tvi = all.find(t => /^TVI \d+°$/.test(t.textContent));
    const r = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, e.textContent]; };
    const rects = [...document.querySelectorAll("#ahud rect")].filter(e => e.getBoundingClientRect().width > 0);
    return { tvi: tvi && r(tvi), others: [...all.filter(t => t !== tvi), ...rects].map(r) };
  });
  expect(boxes.tvi, "TVI readout shown").toBeTruthy();
  const [a, b, c, d] = boxes.tvi;
  const hits = boxes.others.filter(([x0, y0, x1, y1]) => x0 < c && x1 > a && y0 < d && y1 > b).map(o => o[4] || "bar");
  expect(hits).toEqual([]);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("tabs name the views and the desktop switch is hidden", async ({ page }) => {
    await open(page);
    await expect(page.locator(".tabs")).toBeVisible();
    await expect(page.locator(".vswitch").first()).toBeHidden();
    await page.click("#tab-slice");
    await expect(page.locator("#v-slice")).toBeVisible();
  });
});
