// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Fit the G-LOC MODEL (packages/core/src/gloc.ts) to the measured HUD brightness over time, not just to grey-out times.
// For every flown test the G the pilot felt is rebuilt as: the model's direction of acceleration (a core run of the test's recorded
// inputs) scaled to the HUD G meter's magnitude at each moment. A candidate pilot model turns that into stress and a predicted HUD
// level, compared with the measured `hud_level` from vision.csv. Tests where the harness let go of the controls at a blackout are
// left out (the readings after the cut say nothing about the pilot); tests that never blacked out are kept whatever their policy.
//
//   pnpm build && node tools/fit-gloc.mjs [--fit] [--report]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { step, restState, DT, angularVelocity, turnVelocity, boostActive } from "../packages/core/dist/index.js";
import { profileFromFixture } from "../packages/data-gladius/dist/index.js";
const root = new URL("../research/raw/2026-10-08/", import.meta.url);
const P = profileFromFixture(JSON.parse(readFileSync(new URL("../research/gladius-v1-fixture.json", import.meta.url), "utf8")));
const G0 = 9.80665;
const csv = (f) => { const [h, ...rows] = readFileSync(f, "utf8").trim().split("\n"); const k = h.split(","); return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [k[i], v === "" || v === "nan" ? null : +v]))); };

const TESTS = [
  ["20261008-150350", /^r9_vis_/], ["20261008-172622", /^r10_(g_|geq_|rec_|flip_and_burn|turn90_release|turn180_boost)/], ["20261008-180210", /^r11_boost_down_long/],
  ["20261008-133222", /^r7_dodge_mid_boost|^r6_release_all|^r6_release_fwd_lat/], ["20261008-150350", /^r5_fwd_lat_rest/],
];
const data = [];
for (const [sess, re] of TESTS) for (const t of readdirSync(new URL(`${sess}/`, root)).filter((d) => re.test(d))) {
  const dir = new URL(`${sess}/${t}/`, root); if (!existsSync(new URL("vision.csv", dir))) continue;
  const meta = JSON.parse(readFileSync(new URL("meta.json", dir), "utf8")); if ((meta.gloc_policy === "release" || meta.gloc_policy === "ease") && meta.gloc_at != null) continue;   // the harness let go at a blackout
  const cmd = csv(new URL("commands.csv", dir)), ser = csv(new URL("series.csv", dir)), vis = csv(new URL("vision.csv", dir));
  // core run of the recorded inputs -> direction of the acceleration at each series time
  let s = restState(), ci = 0; const dirs = [];
  for (const r of ser) {
    while (ci + 1 < cmd.length && cmd[ci + 1].t <= r.t) ci++;
    const c = cmd[ci], inp = { fwd: c.strafe_long, lat: c.strafe_lat, up: c.strafe_vert, boost: !!c.boost, roll: c.roll, pitch: c.pitch, yaw: c.yaw };
    const n = Math.max(1, Math.round(((dirs.length ? r.t - ser[dirs.length - 1].t : 0.0166)) / DT));
    for (let i = 0; i < n; i++) { s = step(s, inp, P, DT); s = { ...s, vWorld: turnVelocity(s.vWorld, angularVelocity(inp, P, boostActive(s, inp)), DT) }; }
    const a = s.aWorld, m = Math.hypot(...a); dirs.push({ d: m > 1e-6 ? a.map((x) => x / m) : [0, 0, 0], m: m / G0 });
  }
  const pre = meta.pre_s ?? 1;
  const hud = vis.filter((r) => r.hud_level != null).map((r) => ({ t: r.t_s, h: r.hud_level }));
  // G magnitude: the HUD meter where the HUD is readable (it drops out, or reads garbage, when the screen is dark), the model's own
  // magnitude for those frames (the stick is held in every kept test, so the model's G is what the pilot was still being given).
  const hudAt = (t) => { let b = null; for (const x of hud) if (Math.abs(x.t - t) < 0.3 && (b === null || Math.abs(x.t - t) < Math.abs(b.t - t))) b = x; return b ? b.h : 0; };
  const g = ser.map((r, i) => { const meter = r.g != null && r.g < 40 && hudAt(r.t - pre) > 0.6, m = meter ? r.g : dirs[i].m; return { t: r.t - pre, v: dirs[i].d.map((x) => x * m) }; });
  const blk = hud.find((x) => x.t > 0 && x.h < 0.1);
  if (hud.length > 5 && g.length > 20) data.push({ id: t, g, hud, black: blk ? blk.t : undefined });
}
console.error(`${data.length} tests: ${data.map((d) => d.id).join(" ")}`);

const ONSET = process.argv.includes("--onset");   // score only up to the first blackout (the latch that follows is not modelled)
const hudOf = (D, q) => (D <= 0.4 ? 1 : D < 1 ? 1 - (0.2 * (D - 0.4)) / 0.6 : D < q.gone ? 0.8 - (0.3 * (D - 1)) / (q.gone - 1) : Math.max(0, 0.5 - (0.5 * (D - q.gone)) / 0.5));
function predict(test, q) {
  let D = 0, last = null, vf = null; const out = [];
  for (const { t, v: v0 } of test.g) {
    const a = q.tau > 0 && last !== null ? Math.min(1, (t - last) / q.tau) : 1; vf = vf === null || a >= 1 ? v0 : vf.map((x, i) => x + (v0[i] - x) * a); const v = vf;
    if (last !== null) {
      const dt = t - last, T = q.T, r = Math.max(Math.abs(v[0]) / (v[0] >= 0 ? T.fwd : T.back), Math.abs(v[1]) / T.lat, Math.abs(v[2]) / (v[2] >= 0 ? T.up : T.down));
      const rise = r > 1 ? (r - 1) ** q.p : 0, fall = r <= 1 ? (q.exp ? q.rec * D : q.rec * (1 - r * q.near)) : 0;
      D = Math.min(q.gone + 0.5, Math.max(0, D + rise * dt - fall * dt));
    }
    last = t; out.push({ t, D });
  }
  return out;
}
function cost(q, rep = false) {
  let c = 0, n = 0;
  for (const d of data) {
    const pr = predict(d, q); let k = 0, e2 = 0, m = 0, worst = 0;
    for (const { t, h } of d.hud) { while (k + 1 < pr.length && pr[k + 1].t <= t) k++; if (t < -0.5) continue; if (ONSET && d.black !== undefined && t > d.black) continue; const e = hudOf(pr[k].D, q) - h; e2 += e * e; m++; worst = Math.max(worst, Math.abs(e)); }
    c += e2; n += m; if (rep) console.log(`  ${d.id.padEnd(26)} rms ${Math.sqrt(e2 / m).toFixed(2)}  worst ${worst.toFixed(2)}`);
  }
  return Math.sqrt(c / n);
}
const KEYS = ["up", "lat", "down", "fwd", "back", "p", "rec", "gone", "near", "tau"];
const mk = (x, exp) => ({ T: { up: x[0], lat: x[1], down: x[2], fwd: x[3], back: x[4] }, p: x[5], rec: x[6], gone: x[7], near: x[8], tau: x[9], exp });
const LO = [4, 3, 2, 6, 3, 0.5, 0.05, 1.3, 0, 0], HI = [14, 12, 8, 30, 16, 2.5, 2, 3, 0.95, 3];
function nm(fn, x0, iters = 1500) {
  const n = x0.length, clampX = (x) => x.map((v, i) => Math.min(HI[i], Math.max(LO[i], v)));
  let pts = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? v + (HI[i] - LO[i]) * 0.1 : v)))].map((x) => ({ x: clampX(x), y: fn(clampX(x)) }));
  for (let it = 0; it < iters; it++) {
    pts.sort((a, b) => a.y - b.y); const c = x0.map((_, j) => pts.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n), w = pts[n];
    const at = (t) => clampX(c.map((v, j) => v + t * (w.x[j] - v))), r = { x: at(-1) }; r.y = fn(r.x);
    if (r.y < pts[0].y) { const e = { x: at(-2) }; e.y = fn(e.x); pts[n] = e.y < r.y ? e : r; } else if (r.y < pts[n - 1].y) pts[n] = r;
    else { const k = { x: at(0.5) }; k.y = fn(k.x); if (k.y < w.y) pts[n] = k; else pts = pts.map((p, i) => (i === 0 ? p : ((q) => ({ x: q, y: fn(q) }))(clampX(p.x.map((v, j) => pts[0].x[j] + 0.5 * (v - pts[0].x[j])))))); }
  }
  pts.sort((a, b) => a.y - b.y); return pts[0];
}
const cur = [8.1, 6.6, 3.85, 13.5, 8, 1, 0.33, 1.8, 0, 0];
console.log(`current model (T up ${cur[0]}, lat ${cur[1]}, down ${cur[2]}, fwd ${cur[3]}, back ${cur[4]}, exponent 1, linear recovery 0.33/s): HUD rms error ${cost(mk(cur, false), process.argv.includes("--report")).toFixed(3)}`);
if (process.argv.includes("--fit")) {
  for (const exp of [false, true]) {
    let best = { y: 1e9 };
    for (const start of [cur, [10, 8, 5, 18, 10, 1.3, 0.5, 2, 0.3, 0.5], [9, 9, 4.5, 15, 8, 0.8, 0.8, 1.6, 0.6, 1.5]]) { const r = nm((x) => cost(mk(x, exp)), start, 900); if (r.y < best.y) best = r; }
    console.log(`\nbest, ${exp ? "exponential" : "linear"} recovery: rms ${best.y.toFixed(3)}\n  ` + KEYS.map((k, i) => `${k} ${best.x[i].toFixed(2)}`).join(", "));
    cost(mk(best.x, exp), true);
  }
}
if (process.argv.includes("--trace")) {
  const q = mk(cur, false);
  for (const id of process.argv.slice(process.argv.indexOf("--trace") + 1)) {
    const d = data.find((x) => x.id === id); if (!d) continue; const pr = predict(d, q);
    console.log(`\n${id}: t | G(vec mag) | dose | predicted HUD | measured HUD`);
    let k = 0; for (const { t, h } of d.hud.filter((_, i) => i % 3 === 0)) { while (k + 1 < pr.length && pr[k + 1].t <= t) k++; const gv = d.g[k].v; console.log(`${t.toFixed(1).padStart(5)} | ${Math.hypot(...gv).toFixed(1).padStart(5)} (${gv.map((x) => x.toFixed(0)).join(",")}) | ${pr[k].D.toFixed(2)} | ${hudOf(pr[k].D, q).toFixed(2)} | ${h.toFixed(2)}`); }
  }
}
