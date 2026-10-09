// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// The maths of a corkscrew against a chaser behind you, with every assumption explicit. MODEL results.
//
//   node tools/evasion-math.mjs [--range 1000] [--vp 1000] [--chaser 520] [--hit 8] [--window 8]
//
// You thrust sideways with acceleration `a` that rotates at the roll rate ω (the ship rolls, the strafe stick is fixed in the
// ship). Over a projectile flight time τ the shooter's error against a straight-line extrapolation (lead model A) is
//     miss_A = a·τ²·f(ωτ),   f(x) = √((x − sin x)² + (1 − cos x)²) / x²,    f → ½ as x → 0, falling like 1/x
// and against a shooter who also extrapolates your current acceleration (lead model B)
//     miss_B = a·τ²·g(ωτ),   g(x) = |e^{ix} − 1 − ix + x²/2| / x²,           g ≈ x/6 for small x, peaking near x ≈ 3.5.
// So A wants ω as SLOW as possible and B wants ωτ ≈ 3.5 (FAST). What stops a slow roll is the egg: the sideways speed of the
// circle, a/ω, must fit in the egg's cross-section at your forward speed (room), so ω ≥ a/room. What stops a big `a` is
// G-LOC: sustained side G above the pilot's tolerance (up 8.1, lateral 6.6 G, fitted model) blacks you out in seconds.
// The available side G falls with forward speed (measured: ~6 G at the nose, 8.7-12.4 G at 260-400 m/s, round 8, noisy).
import { readFileSync } from "node:fs";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? +process.argv[i + 1] : d; };
const R0 = arg("range", 1000), VP = arg("vp", 1000), VC = arg("chaser", 520), HIT = arg("hit", 8), WIN = arg("window", 8);
const G0 = 9.80665;
const fx = JSON.parse(readFileSync(new URL("../research/gladius-v1-fixture.json", import.meta.url), "utf8"));
const roomTable = fx.lateralRoom.boost;                                   // [forward m/s, sideways room m/s], measured/limacon
const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); } return tab.at(-1)[1]; };
// side G available while corkscrewing boosted, by forward speed: round 8 (r8_bst_f*_up/lat_r100, G-meter means; noisy) and r9/r8 at the nose
const sideG = [[0, 12.9], [262, 12.3], [313, 11.1], [398, 8.7], [513, 6.0]];
const TOL = { up: 8.1, lat: 6.6 };                                         // G-LOC model, sustained tolerance
const integral = (fn, tau, n = 400) => { let re = 0, im = 0; for (let i = 0; i < n; i++) { const s = ((i + 0.5) * tau) / n, [r, m] = fn(s); re += r; im += m; } return Math.hypot((re * tau) / n, (im * tau) / n); };
const missA = (a, w, tau) => a * integral((s) => [(tau - s) * Math.cos(w * s), (tau - s) * Math.sin(w * s)], tau);
const missB = (a, w, tau) => a * integral((s) => [(tau - s) * (Math.cos(w * s) - 1), (tau - s) * Math.sin(w * s)], tau);

const rows = [];
for (const vf of [519, 480, 440, 400, 360, 320, 280, 240]) for (const axis of ["up", "lat"]) {
  const room = interp(roomTable, vf), avail = interp(sideG, vf), aG = Math.min(avail, TOL[axis]), a = aG * G0;   // sustained side acceleration
  const wMin = a / room, wMax = (240 * Math.PI) / 180;
  // choose ω to maximise the worse of the two lead models at the opening flight time (the one that matters most)
  let best = null;
  for (let k = 0; k <= 60; k++) {
    const w = Math.max(wMin, 0.02) * Math.pow(wMax / Math.max(wMin, 0.02), k / 60); if (w < wMin - 1e-9 || w > wMax + 1e-9) continue;
    const tau0 = R0 / VP, m = Math.min(missA(a, w, tau0), missB(a, w, tau0));
    if (!best || m > best.m) best = { w, m, A: missA(a, w, tau0), B: missB(a, w, tau0) };
  }
  // flight along: you slow to vf, the chaser holds VC: the range closes at VC - vf (opens if you are faster)
  let hitTime = null, rEnd = 0;
  for (let t = 0; t <= WIN; t += 0.05) {
    const R = R0 - (VC - vf) * t, tau = Math.max(0.2, R / VP);
    const m = Math.min(missA(a, best.w, tau), missB(a, best.w, tau)); rEnd = R;
    if (hitTime === null && m < HIT) hitTime = t;
  }
  rows.push({ vf, axis, room, avail, aG, w: best.w, wd: (best.w * 180) / Math.PI, A: best.A, B: best.B, hitTime, rEnd, delta: (Math.asin(Math.min(1, a / best.w / Math.max(vf, 1))) * 180) / Math.PI });
}
const f1 = (x) => x.toFixed(1);
console.log(`range ${R0} m, projectile ${VP} m/s (opening flight time ${f1(R0 / VP)} s), chaser ${VC} m/s, hit radius ${HIT} m, window ${WIN} s\n`);
console.log("| forward m/s | strafe | room m/s | side G available | side G used (G-LOC cap) | best roll °/s (maximin) | slowest roll the egg allows °/s | miss A / B at the start (m) | first time the miss drops below the hit radius | range at end (m) |\n|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.vf} | ${r.axis} | ${Math.round(r.room)} | ${f1(r.avail)} | ${f1(r.aG)} | ${Math.round(r.wd)} | ${Math.round(((r.aG * G0) / r.room) * 180 / Math.PI)} | ${f1(r.A)} / ${f1(r.B)} | ${r.hitTime === null ? "never" : f1(r.hitTime) + " s"} | ${Math.round(r.rEnd)} |`);
// the two pure cases, to show the opposite pulls
const a6 = 6.0 * G0, tau = R0 / VP;
console.log(`\nRoll-rate sweep at the nose (a = 6.0 G, room 29-128 m/s so ω ≥ ~0.45 rad/s), τ = ${f1(tau)} s:`);
console.log("| roll °/s | miss A (m) | miss B (m) | worse of the two |\n|---|---|---|---|");
for (const d of [15, 27, 40, 60, 90, 120, 144, 180, 240]) { const w = (d * Math.PI) / 180, A = missA(a6, w, tau), B = missB(a6, w, tau); console.log(`| ${d} | ${f1(A)} | ${f1(B)} | ${f1(Math.min(A, B))} |`); }
