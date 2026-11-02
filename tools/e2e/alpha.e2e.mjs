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
  // readouts by stage: Dodge Potential and the detail row wait for group 2 unless the visitor asks for everything
  await expect(page.locator("#vt-dodge")).toBeHidden();
  await expect(page.locator(".readouts")).toBeHidden();
  await page.click("#ro-all");
  await expect(page.locator("#vt-dodge")).toBeVisible();
  await expect(page.locator(".readouts")).toBeVisible();
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

// Desktop layout: the views sit in a sticky cockpit beside the lesson rail, so a lesson picked anywhere in the list
// starts with the views, the Vitals and the running lesson in the window (the owner's report, 2026-11-01).
for (const vp of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`at ${vp.width}x${vp.height} a lesson low in the list starts with the views in sight`, async ({ page }) => {
    await page.setViewportSize(vp);
    await open(page);
    const last = page.locator("[data-preset]").last();
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await page.waitForFunction(() => window.speedwallDebug.get().script?.t > 0.3);
    const inWindow = async sel => { const b = await page.locator(sel).boundingBox(); return b && b.y >= 0 && b.y + b.height <= vp.height + 1; };
    expect(await inWindow(".views"), "views in the window").toBe(true);
    expect(await inWindow("#vitals"), "Vitals in the window").toBe(true);
    expect(await inWindow("#runbar"), "running lesson in the window").toBe(true);
    expect(await inWindow('[data-preset][aria-pressed="true"]'), "the picked card stays where it was clicked").toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
  });
}

test("taking the keys early keeps the lesson's note and offers a replay; Continue picks up where you left off", async ({ page }) => {
  await open(page);
  await page.click("#first-go");
  await page.waitForFunction(() => window.speedwallDebug.get().script?.t > 0.5);
  await page.keyboard.down("KeyW");
  await expect(page.locator("#run-msg")).toHaveText(/You took over/);
  await expect(page.locator("#run-again")).toBeVisible();
  await expect(page.locator('[data-preset="scm-strafe"]')).not.toHaveClass(/done/);
  await page.keyboard.up("KeyW");
  await page.click("#run-again");
  await page.waitForFunction(() => { const r = window.speedwallDebug.get().run; return r && r.shown; }, null, { timeout: 90_000 });
  await page.click("#run-stop");
  await expect(page.locator("#note-next")).toHaveText(/^Continue: Strafe From a Stop With Boost/);
  await expect(page.locator("#lessons-count")).toHaveText(/^1 of \d+ done$/);
  await page.click("#note-next");
  await expect(page.locator("#run-name")).toHaveText(/^Strafe From a Stop With Boost/);
});

test("Controls: Done is in reach, the mouse flies the nose on a first desktop visit", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.click("#ctl-open");
  const done = await page.locator("#c-close").boundingBox();
  expect(done.y + done.height).toBeLessThanOrEqual(768);
  await expect(page.locator("#c-mouse")).toBeChecked();
  await expect(page.locator("#c-wizard")).toHaveText("Set up controls");
  await page.click("#c-x");
  await expect(page.locator("#ctl-dlg")).toBeHidden();
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
