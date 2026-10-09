// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Which evasive deflection is best against a chaser BEHIND you? A numerical optimiser over the tested core model
// (packages/core, the Gladius fixture). MODEL results, not measurements: every row is only as good as the model constants
// (see docs/physics-fit.md) and the shooter model below.
//
//   pnpm build && node tools/corkscrew-opt.mjs [--range 1000] [--vp 1000] [--hit 8] [--chaser 520] [--window 9] [--top 15] [--ramp] [--csv out.csv]
//   --ramp   use a gradual boosted side-thrust penalty (1 at 300 m/s forward falling to 0.47 at 500) instead of the fitted step at 358 m/s
//
// Scenario. You are boosted at the nose wall (the state after 8 s of full forward from rest), tank full, nose pointing away
// from the chaser. A chaser flies straight behind you at `chaser` m/s along your line and fires with projectile speed `vp`
// (flight time = range / vp). It aims with one of two lead models:
//   A  velocity only:  aim = p + v·τ
//   B  velocity + acceleration:  aim = p + v·τ + ½·a·τ²
// Miss = |where you actually are at t+τ − aim|. You win by making the miss big for BOTH models (we rank by the worse one).
// Your pilot is the G-LOC MODEL from the core: a blackout cuts thrust and boost, so policies that black you out score badly.
import { readFileSync, writeFileSync } from "node:fs";
import { step, restState, DT, angularVelocity, turnVelocity, stepPilot, restPilot, boostActive } from "../packages/core/dist/index.js";
import { profileFromFixture } from "../packages/data-gladius/dist/index.js";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const RANGE = +arg("range", 1000), VP = +arg("vp", 1000), HIT = +arg("hit", 8), VC = +arg("chaser", 520), TOP = +arg("top", 15);
const WIN = +arg("window", 9);   // seconds of the manoeuvre that are scored
const P = profileFromFixture(JSON.parse(readFileSync(new URL("../research/gladius-v1-fixture.json", import.meta.url), "utf8")));
if (process.argv.includes("--ramp")) { P.wall.boostSide.fromFwd = 300; P.wall.boostSide.toFwd = 500; }
const G0 = 9.80665, hyp = (v) => Math.hypot(v[0], v[1], v[2]);
const rotX = (v, phi) => turnVelocity(v, [1, 0, 0], -phi);   // rotate a vector by +phi about the nose

// Start states: boosted, nose pointing away from the chaser, forward speed `vf` (full forward from rest until vf, then the
// speed is trimmed to exactly vf), tank full. Holding `fwd` = 0.06 afterwards keeps that forward speed (any forward request above
// 5 % stops the model's let-off bleed) so the policies differ in WHERE on the egg you fly, not in how much you thrust forward.
const startAt = (vf) => { let s = restState(); for (let i = 0; i < 12 / DT && s.vWorld[0] < vf; i++) s = step(s, { fwd: 1, lat: 0, up: 0, boost: true }, P, DT); return { ...s, vWorld: [vf, 0, 0] }; };
const startCache = new Map(); const start = (vf) => { if (!startCache.has(vf)) startCache.set(vf, startAt(vf)); return startCache.get(vf); };
const wall = start(519);

/** Fly one policy; returns sampled world positions, velocities, accelerations, ship-frame G and the pilot state. */
function fly(pol, seconds = WIN + 3) {
  let s = { ...(pol.start ?? wall), tank: 100, boostLocked: false }, ps = restPilot(), phi = 0, vw = [...s.vWorld], pos = [0, 0, 0];
  const out = { t: [], p: [], v: [], a: [], dose: 0, blackout: 0, gpeak: 0 };
  const n = Math.round(seconds / DT);
  for (let i = 0; i <= n; i++) {
    const t = i * DT, cut = ps.blackout;
    if (i % 4 === 0) { out.t.push(t); out.p.push([...pos]); out.v.push([...vw]); out.a.push(rotX(s.aWorld, phi)); }
    const inp = pol.input(t), before = s.vWorld;
    s = step(s, cut ? { fwd: 0, lat: 0, up: 0, boost: false } : { fwd: inp.fwd, lat: inp.lat, up: inp.up, boost: true }, P, DT);
    const dv = [s.vWorld[0] - before[0], s.vWorld[1] - before[1], s.vWorld[2] - before[2]], dw = rotX(dv, phi);
    vw = [vw[0] + dw[0], vw[1] + dw[1], vw[2] + dw[2]];
    const w = angularVelocity({ roll: cut ? 0 : pol.roll }, P, boostActive(s, { boost: true }));
    s = { ...s, vWorld: turnVelocity(s.vWorld, w, DT) }; phi += w[0] * DT;
    const g = cut ? [0, 0, 0] : [s.aWorld[0] / G0, s.aWorld[1] / G0, s.aWorld[2] / G0];
    ps = stepPilot(ps, g, P.pilot, DT); out.dose = Math.max(out.dose, ps.dose); if (ps.blackout) out.blackout += DT; out.gpeak = Math.max(out.gpeak, hyp(g));
    pos = [pos[0] + vw[0] * DT, pos[1] + vw[1] * DT, pos[2] + vw[2] * DT];
  }
  return out;
}
const unit = (v) => { const n = hyp(v); return [v[0] / n, v[1] / n, v[2] / n]; };
const at = (o, key, t) => { const k = t * 60, i = Math.min(o.t.length - 2, Math.floor(k)), f = k - i; return o[key][i].map((x, j) => x + (o[key][i + 1][j] - x) * f); };

/** Score a flown policy against both lead models. */
function score(o) {
  const u0 = unit(o.v[0]);   // the chaser flies VC m/s along your initial line of flight, RANGE behind you
  const res = { A: { miss: 0, hit: 0 }, B: { miss: 0, hit: 0 } }; let n = 0, rEnd = 0, delta = 0, speed = 0;
  for (let t = 0.5; t <= WIN; t += 1 / 30) {
    const p = at(o, "p", t), v = at(o, "v", t), a = at(o, "a", t);
    const along = p[0] * u0[0] + p[1] * u0[1] + p[2] * u0[2], R = RANGE + along - VC * t;
    const tau = Math.max(0.2, R / VP), fut = at(o, "p", t + tau);
    for (const [k, h] of [["A", 0], ["B", 1]]) {
      const lead = [p[0] + v[0] * tau + h * 0.5 * a[0] * tau * tau, p[1] + v[1] * tau + h * 0.5 * a[1] * tau * tau, p[2] + v[2] * tau + h * 0.5 * a[2] * tau * tau];
      const m = Math.hypot(fut[0] - lead[0], fut[1] - lead[1], fut[2] - lead[2]);
      res[k].miss += m; if (m < HIT) res[k].hit++;
    }
    n++; rEnd = R; delta += (Math.acos(Math.max(-1, Math.min(1, v[0] / hyp(v)))) * 180) / Math.PI; /* TVI angle off the nose (the nose stays on +x) */ speed += hyp(v);
  }
  return { missA: res.A.miss / n, missB: res.B.miss / n, hitA: res.A.hit / n, hitB: res.B.hit / n, rEnd, delta: delta / n, speed: speed / n };
}

const policies = [];
const AX = { up: { lat: 0, up: 1 }, lat: { lat: 1, up: 0 }, down: { lat: 0, up: -1 } };
const RFS = [0.04, 0.06, 0.08, 0.12, 0.17, 0.25, 0.4, 0.6, 1];
const VFS = [519, 480, 440, 400, 360, 320, 280, 240];     // forward speed you hold while you corkscrew
const US = [1, 0.8, 0.6, 0.5, 0.4];                        // strafe stick (side G = stick x the available side G)
policies.push({ name: "straight (no evasion)", vf: 519, start: wall, u: 0, axis: "-", rf: 0, input: () => ({ fwd: 1, lat: 0, up: 0 }), roll: 0 });
for (const vf of VFS) for (const axis of ["up", "lat"]) for (const u of US) {
  const hold = vf >= 519 ? 1 : 0.06, ax = { lat: AX[axis].lat * u, up: AX[axis].up * u };
  policies.push({ name: "held strafe", vf, start: start(vf), u, axis, rf: 0, input: () => ({ fwd: hold, ...ax }), roll: 0 });
  for (const rf of RFS) policies.push({ name: "corkscrew", vf, start: start(vf), u, axis, rf, input: () => ({ fwd: hold, ...ax }), roll: rf });
}
for (const vf of [519, 400, 300]) for (const Tj of [0.75, 1.25, 2]) policies.push({ name: `jink ${Tj} s`, vf, start: start(vf), u: 1, axis: "lat", rf: 0, input: (t) => ({ fwd: vf >= 519 ? 1 : 0.06, lat: Math.floor(t / Tj) % 2 ? -1 : 1, up: 0 }), roll: 0 });
const rows = policies.map((pol) => { const o = fly(pol), s = score(o); return { ...pol, ...s, dose: o.dose, black: o.blackout, gpeak: o.gpeak, worstHit: Math.max(s.hitA, s.hitB), minMiss: Math.min(s.missA, s.missB) }; });
rows.sort((a, b) => a.worstHit - b.worstHit || b.minMiss - a.minMiss);

const f1 = (x) => x.toFixed(1), pc = (x) => `${Math.round(x * 100)} %`;
const line = (r) => `| ${r.name} | ${r.vf} | ${r.axis} ${r.u} | ${r.rf ? Math.round(r.rf * 240) : "-"} | ${f1(r.delta)}° | ${Math.round(r.speed)} | ${f1(r.gpeak)} | ${f1(r.missA)} / ${f1(r.missB)} | ${pc(r.hitA)} / ${pc(r.hitB)} | ${Math.round(r.rEnd)} | ${f1(r.dose)}${r.black ? ` (${f1(r.black)} s out)` : ""} |`;
const head = `| tactic | fwd m/s | strafe | roll °/s | mean TVI δ | mean m/s | peak G | mean miss A / B (m) | time hit (r<${HIT} m) A / B | range at ${WIN} s (m) | peak stress |\n|---|---|---|---|---|---|---|---|---|---|---|`;
console.log(`range ${RANGE} m, projectile ${VP} m/s, chaser ${VC} m/s, hit radius ${HIT} m, scored 0.5-${WIN} s, boosted, ${rows.length} policies${process.argv.includes("--ramp") ? ", RAMP side-thrust law" : ""}\n`);
console.log("TOP (ranked by the worse lead model's hit share, then the smaller mean miss):\n" + head + "\n" + rows.slice(0, TOP).map(line).join("\n"));
const pick = (pred) => rows.filter(pred)[0];
console.log("\nBASELINES:\n" + head + "\n" + [pick((r) => r.name.startsWith("straight")), pick((r) => r.name === "held strafe" && r.vf === 519 && r.axis === "up" && r.u === 1), ...[0.75, 1.25, 2].map((Tj) => pick((r) => r.name === `jink ${Tj} s` && r.vf === 519))].filter(Boolean).map(line).join("\n"));
console.log("\nBEST CORKSCREW AT EACH FORWARD SPEED (any strafe stick, up or lateral):\n" + head + "\n" + VFS.map((vf) => pick((r) => r.name === "corkscrew" && r.vf === vf)).filter(Boolean).map(line).join("\n"));
console.log("\nBEST UP-STRAFE CORKSCREW AT EACH FORWARD SPEED THAT NEVER BLACKS YOU OUT:\n" + head + "\n" + VFS.map((vf) => pick((r) => r.name === "corkscrew" && r.vf === vf && r.axis === "up" && !r.black)).filter(Boolean).map(line).join("\n"));
if (arg("csv")) writeFileSync(arg("csv"), ["name,vf,axis,u,roll_dps,delta,speed,gpeak,missA,missB,hitA,hitB,range_end,dose,blackout_s"].concat(rows.map((r) => [r.name, r.vf, r.axis, r.u, r.rf * 240, r.delta, r.speed, r.gpeak, r.missA, r.missB, r.hitA, r.hitB, r.rEnd, r.dose, r.black].join(","))).join("\n"));
