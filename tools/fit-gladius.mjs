// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Fit the Gladius wall/transient constants (PLAN.md §4 items 4–6) to the measured traces, and print a
// model-vs-measured report.   pnpm build && node tools/fit-gladius.mjs [--fit] [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { step, derive, restState, DT } from "../packages/core/dist/index.js";
import { profileFromFixture } from "../packages/data-gladius/dist/index.js";
import { releaseRows, turnRows, launchRows } from "../packages/data-gladius/dist/replay.js";

const fixture = JSON.parse(readFileSync(new URL("../research/gladius-v1-fixture.json", import.meta.url), "utf8"));
const base = profileFromFixture(fixture);
const input = (o = {}) => ({ fwd: 0, lat: 0, up: 0, boost: false, ...o });
const speed = (s) => Math.hypot(...s.vWorld);
const toInput = (st) => input({ fwd: st.strafe_long ?? 0, lat: st.strafe_lat ?? 0, boost: st.boost ?? false });

function replay(p, trace) {
  const [pin, ...dodge] = trace.steps;
  let s = restState(); const u0 = toInput(pin);
  for (let i = 0; i < Math.round(pin.t / DT); i++) s = step(s, u0, p, DT);
  const states = [s], held = [toInput(dodge[0])];
  for (const seg of dodge) { const u = toInput(seg); for (let i = 0; i < Math.round(seg.t / DT); i++) { s = step(s, u, p, DT); states.push(s); held.push(u); } }
  return trace.samples.map(([t, v, g]) => { const i = Math.min(states.length - 1, Math.round(t / DT));
    return { t, v, g, mv: speed(states[i]), mg: derive(states[i], held[i], p).gNow }; });
}
function release(p) {
  let s = { ...restState(), vWorld: [fixture.boostRelease.samples[0][1], 0, 0] }; const st = [s];
  for (let i = 0; i < 1.5 / DT; i++) { s = step(s, input(), p, DT); st.push(s); }
  return fixture.boostRelease.samples.map(([t, v]) => ({ t, v, mv: speed(st[Math.round(Math.max(0, t - 0.3) / DT)]) }));
}
const TRACES = Object.entries(fixture.wallTraces);
function score(p, report = false) {
  let cost = 0, fails = 0;
  for (const [id, tr] of TRACES) {
    const boosted = !!tr.steps[0].boost, tolG = boosted ? 1.5 : 1, tolV = 10;
    const rows = replay(p, tr);
    if (report) console.log(`\n${id}  (tolerance G ±${tolG}${boosted ? ", v ±10" : ""})\n    t |  v meas model |  G meas model`);
    for (const r of rows) {
      const eg = Math.abs(r.mg - r.g) / tolG, ev = boosted ? Math.abs(r.mv - r.v) / tolV : 0;
      cost += eg * eg + ev * ev; if (eg > 1 || ev > 1) fails++;
      if (report) console.log(`${r.t.toFixed(2).padStart(5)} | ${String(r.v).padStart(6)} ${r.mv.toFixed(0).padStart(5)} | ${r.g.toFixed(1).padStart(5)} ${r.mg.toFixed(1).padStart(5)} ${eg > 1 || ev > 1 ? " ✗" : ""}`);
    }
  }
  // every measured plateau (from rest, 12 s), within 1 % or ±3 m/s, as in the acceptance tests
  for (const pl of fixture.plateaus) {
    if (pl.plateau_mps == null) continue;
    const u = input({ ...pl.inputs, boost: pl.boost }); let s = restState();
    for (let i = 0; i < 12 / DT; i++) s = step(s, u, p, DT);
    const e = Math.abs(speed(s) - pl.plateau_mps) / Math.max(0.01 * pl.plateau_mps, 3);
    cost += e * e; if (e > 1) { fails++; if (report) console.log(`plateau ${pl.id}: measured ${pl.plateau_mps}, model ${speed(s).toFixed(0)} ✗`); }
  }
  // 2026-10-08 traces (research/raw/2026-10-08): the six release traces (±10 m/s) and the five turn-to-egg traces (±15 m/s)
  // are fitted; the rest are validation only (tolerances as in the acceptance tests) and are only reported.
  for (const [group, rows, tol, fitted] of [
    ["releaseTraces", releaseRows, 10, true], ["turnTraces", turnRows, 15, true], ["turnTraces", turnRows, 15, false], ["throttleTraces", launchRows, 10, false]]) {
    const FIT = new Set(["turn90_boosted_pitch_up", "turn90_boosted_pitch_down", "turn120_boosted", "turn135_boosted_yaw", "turn150_boosted"]);
    for (const [id, tr] of Object.entries(fixture[group])) {
      if (id === "_note" || (group === "turnTraces" && FIT.has(id) !== fitted)) continue;
      const r = rows(p, tr).filter((_, i) => i % 2 === 0);
      let bad = 0; for (const x of r) { const e = Math.abs(x.model - x.measured) / tol; if (fitted) cost += e * e * 0.5; if (e > 1) bad++; }
      if (bad) fails += fitted ? bad : 0;
      if (report) console.log(`\n${group}/${tr.test}${fitted ? "" : " (validation)"}: ${bad}/${r.length} samples outside ±${tol} m/s`);
    }
  }
  const rel = release(p);
  if (report) console.log("\nboostRelease (±15, model at t − 0.3 s)\n    t | v meas model");
  for (const r of rel) { const e = Math.abs(r.mv - r.v) / 15; cost += e * e; if (e > 1) fails++; if (report) console.log(`${r.t.toFixed(3).padStart(5)} | ${r.v} ${r.mv.toFixed(0)}${e > 1 ? " ✗" : ""}`); }
  return { cost, fails };
}

// parameter vector <-> wall params
const KEYS = [["slewGps", 5, 80], ["boostSide.factor", 0.05, 1], ["boostSide.fromFwd", 0, 500], ["boostSide.toFwd", 0, 520],
  ["letOffBleed.G", 0, 10], ["letOffBleed.side", 0.05, 1], ["letOffBleed.fromFwd", 0, 519], ["letOffBleed.toFwd", 0, 520],
  ["retroEaseK", 0.1, 5], ["releaseK", 0.0005, 0.01], ["overspeedK", 0.3, 3], ["overspeedTail", 0, 1], ["releaseSideFactor", 0.2, 1]];
const get = (o, k) => k.split(".").reduce((a, b) => a[b], o);
const set = (o, k, v) => { const ks = k.split("."); const last = ks.pop(); ks.reduce((a, b) => a[b], o)[last] = v; };
function withX(x) { const p = structuredClone(base); KEYS.forEach(([k, lo, hi], i) => set(p.wall, k, Math.min(hi, Math.max(lo, x[i])))); 
  if (p.wall.boostSide.toFwd < p.wall.boostSide.fromFwd) p.wall.boostSide.toFwd = p.wall.boostSide.fromFwd;
  if (p.wall.letOffBleed.toFwd < p.wall.letOffBleed.fromFwd) p.wall.letOffBleed.toFwd = p.wall.letOffBleed.fromFwd; return p; }
const f = (x) => score(withX(x)).cost;

function nelderMead(fn, x0, steps, iters) {
  let pts = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? v + steps[i] : v)))].map((x) => ({ x, y: fn(x) }));
  for (let it = 0; it < iters; it++) {
    pts.sort((a, b) => a.y - b.y);
    const n = x0.length, c = x0.map((_, j) => pts.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n), w = pts[n];
    const at = (t) => c.map((v, j) => v + t * (w.x[j] - v)), r = { x: at(-1) }; r.y = fn(r.x);
    if (r.y < pts[0].y) { const e = { x: at(-2) }; e.y = fn(e.x); pts[n] = e.y < r.y ? e : r; }
    else if (r.y < pts[n - 1].y) pts[n] = r;
    else { const k = { x: at(0.5) }; k.y = fn(k.x); if (k.y < w.y) pts[n] = k; else pts = pts.map((p, i) => (i === 0 ? p : ((q) => ({ x: q, y: fn(q) }))(p.x.map((v, j) => pts[0].x[j] + 0.5 * (v - pts[0].x[j]))))); }
  }
  pts.sort((a, b) => a.y - b.y); return pts[0];
}

const args = new Set(process.argv.slice(2));
let p = base;
if (args.has("--fit")) {
  const x0 = KEYS.map(([k]) => get(base.wall, k)), steps = KEYS.map(([, lo, hi]) => (hi - lo) * 0.15);
  let best = { x: x0, y: f(x0) };
  for (let round = 0; round < 4; round++) { const r = nelderMead(f, best.x, steps.map((s) => s / (round + 1)), 400); if (r.y < best.y) best = r; console.error(`round ${round}: cost ${best.y.toFixed(1)}`); }
  p = withX(best.x);
}
const { cost, fails } = score(p, !args.has("--quiet"));
console.log(`\nwall params: ${JSON.stringify(p.wall)}\ncost ${cost.toFixed(1)}, samples outside tolerance: ${fails}`);
if (args.has("--write")) {
  const W = p.wall, r = (x, d = 0) => +x.toFixed(d);
  const src = readFileSync(new URL("../packages/data-gladius/src/fitted.ts", import.meta.url), "utf8").replace(/export const FITTED_WALL[\s\S]*$/, `export const FITTED_WALL: WallParams = {
  slewGps: ${r(W.slewGps, 1)},
  boostSide: { factor: ${r(W.boostSide.factor, 3)}, fromFwd: ${r(W.boostSide.fromFwd)}, toFwd: ${r(W.boostSide.toFwd)} },
  letOffBleed: { G: ${r(W.letOffBleed.G, 2)}, side: ${r(W.letOffBleed.side, 3)}, fromFwd: ${r(W.letOffBleed.fromFwd)}, toFwd: ${r(W.letOffBleed.toFwd)} },
  retroEaseK: ${r(W.retroEaseK, 3)},
  releaseK: ${r(W.releaseK, 6)},
  overspeedK: ${r(W.overspeedK, 2)},
  overspeedTail: ${r(W.overspeedTail, 2)},
  releaseSideFactor: ${r(W.releaseSideFactor, 2)},
};
`);
  writeFileSync(new URL("../packages/data-gladius/src/fitted.ts", import.meta.url), src);
  console.log("wrote packages/data-gladius/src/fitted.ts");
}
