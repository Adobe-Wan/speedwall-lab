// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Stopping: spacebrake / letting go versus turning the ship and burning with the strong thrusters. MODEL results from the
// tested core (the spacebrake's own behaviour is NOT measured; above SCM it is measured to equal letting go: r7_spacebrake_nose).
//
//   pnpm build && node tools/stop-opt.mjs
//
// Policies, from speed v0 along the nose (nose pointing the way you are going):
//   retro / retro+boost   full reverse thrust, boost off / on (the spacebrake modelled as the retro bank; 4.24 / 5.96 G)
//   flip                  full pitch to 180 degrees (68 deg/s SCM, 81.6 boosted); full forward throttle only while the nose is within a
//                         cone of straight against your velocity (burning earlier pushes you sideways and you never stop)
//   pitch up 90 + up      pitch 90 degrees so your velocity is below the ship, then strafe up against it (up thrusters, 13 G boosted)
// Letting go does not stop you in SCM (decoupled: no drag); above SCM it bleeds you to 225 (see r6_release_all).
// Time to stop = speed below 5 m/s. Also reported: distance covered while stopping, and the G-LOC stress the pilot model builds.
import { readFileSync } from "node:fs";
import { step, restState, DT, angularVelocity, turnVelocity, boostActive, stepPilot, restPilot } from "../packages/core/dist/index.js";
import { profileFromFixture } from "../packages/data-gladius/dist/index.js";
const P = profileFromFixture(JSON.parse(readFileSync(new URL("../research/gladius-v1-fixture.json", import.meta.url), "utf8")));
const G0 = 9.80665, hyp = (v) => Math.hypot(...v);

function run(v0, boosted0, pol) {
  let s = restState(); if (boosted0) for (let i = 0; i < 12 / DT && s.vWorld[0] < v0; i++) s = step(s, { fwd: 1, lat: 0, up: 0, boost: true }, P, DT);
  s = { ...s, vWorld: [v0, 0, 0], tank: 100 };
  let ps = restPilot(), ang = 0, dist = 0, t = 0;
  for (; t < 30; t += DT) {
    if (hyp(s.vWorld) < 5) break;
    const inp = pol.input(ang, t, s); const cut = ps.blackout;
    const u = cut ? { fwd: 0, lat: 0, up: 0, boost: false, pitch: 0 } : inp;
    s = step(s, u, P, DT); const w = angularVelocity(u, P, boostActive(s, u));
    s = { ...s, vWorld: turnVelocity(s.vWorld, w, DT) }; ang += (Math.abs(w[1]) * DT * 180) / Math.PI;
    dist += hyp(s.vWorld) * DT; ps = stepPilot(ps, cut ? [0, 0, 0] : s.aWorld.map((x) => x / G0), P.pilot, DT);
  }
  return { t, dist, dose: ps.dose, ang };
}
const R = (pol) => pol;
const cosA = (d) => Math.cos((d * Math.PI) / 180), unit = (v) => { const n = hyp(v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const pols = () => [
  R({ name: "retro (the spacebrake modelled as the retro bank), boost off", input: () => ({ fwd: -1, lat: 0, up: 0, boost: false }) }),
  R({ name: "retro + boost", input: () => ({ fwd: -1, lat: 0, up: 0, boost: true }) }),
  // flip & burn, closed loop: pitch so the nose points against your velocity (full rate until within 30 degrees, then proportional)
  // and burn forward in proportion to how well it is aligned (cos² of the error), so the burn never pushes you sideways
  ...[true, false].map((boost) => R({ name: `flip & burn, nose tracks retrograde, boost ${boost ? "on (21 G)" : "off (13.7 G)"}`, input: (a, t, s) => { const rx = -s.vWorld[0], rz = -s.vWorld[2], e = Math.atan2(rz, rx), big = Math.abs(e) > 2.9;
    const c = Math.cos(e); return { fwd: c > 0 ? c * c : 0, lat: 0, up: 0, boost, pitch: big ? 1 : Math.max(-1, Math.min(1, (2 * e) / (Math.PI / 6))) }; } })),
  // 90 degrees of pitch puts your velocity below the ship: strafe up against it with the up thrusters (13 G boosted)
  ...[40, 60].map((edge) => R({ name: `pitch up 90°, up-strafe ramps in from ${edge}° off straight below, boost on`, input: (a, t, s) => ({ fwd: 0, lat: 0, up: Math.min(1, Math.max(0, (-unit(s.vWorld)[2] - cosA(edge)) / (1 - cosA(edge)))), boost: true, pitch: a < 90 ? 1 : 0 }) })),
];
for (const [v0, b] of [[225, false], [225, true], [519, true]]) {
  console.log(`\nstopping from ${v0} m/s${b ? ", boosted nose wall" : ", SCM"}:\n| tactic | time to < 5 m/s (s) | distance (m) | G-LOC stress |\n|---|---|---|---|`);
  for (const p of pols()) { const r = run(v0, b, p); console.log(`| ${p.name} | ${r.t >= 30 ? ">30" : r.t.toFixed(1)} | ${Math.round(r.dist)} | ${r.dose.toFixed(1)} |`); }
}
