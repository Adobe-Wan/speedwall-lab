// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// How often a chaser's shots land on a fleeing Gladius, for each flee pattern, against shooters from "ideal" (the alpha's
// readout) to a human tracking the pip with a delay (crossover model, packages/core/src/aim.ts). MODEL results; every shooter
// parameter, the projectile speed and the hull outline are ASSUMED. Written up in docs/aim-model.md.
//
//   pnpm build && node tools/aim-study.mjs [--range 550] [--vp 1500] [--seeds 40]
//   node tools/aim-study.mjs --yaml     prints the target scripts of tools/sc-flighttest/tests_round13.yaml (the same sequences)
import { readFileSync } from "node:fs";
import { chaseTrack, aimTrack, scoreAim } from "../packages/core/dist/index.js";
import { profileFromFixture } from "../packages/data-gladius/dist/index.js";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? +process.argv[i + 1] : d; };
const RANGE = arg("range", 550), VP = arg("vp", 1500), SEEDS = arg("seeds", 40), SECONDS = 10, FROM = 1;
const fixture = JSON.parse(readFileSync(new URL("../research/gladius-v1-fixture.json", import.meta.url), "utf8"));
const p = profileFromFixture(fixture);
const HULL = { width: 17, height: 5.5 };   // Gladius seen from behind (fixture dimensions_note: 20 x 17 x 5.5 m, spviewer)
const opts = { startSpeed: 520, seconds: SECONDS, range: RANGE, chaserSpeed: 520, projectileSpeed: VP };

const B = (o) => ({ fwd: 1, lat: 0, up: 0, boost: true, roll: 0, ...o });
// The alpha's strafe-tap sequence (site/index.html TAPS): [start s, axis, sign, length s]
const TAPS = [[0, "l", 1, .4], [.9, "u", 1, .3], [1.9, "l", -1, .5], [2.8, "l", 1, .25], [3.7, "u", 1, .5], [4.6, "l", -1, .3],
  [5.6, "l", 1, .5], [6.5, "u", 1, .3], [7.5, "l", -1, .4], [8.3, "u", 1, .5], [9.4, "l", 1, .3]];
const taps = (seq, f = 1) => seq.flatMap(([t, k, v, d]) => [[t, B({ fwd: f, lat: k === "l" ? v : 0, up: k === "u" ? v : 0 })], [t + d, B({ fwd: f })]]);
// Random taps in the same style: gap 0.35-0.9 s after each tap, length 0.25-0.5 s, side left/right or up (never the same twice).
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randomTaps(seed, axes = ["l+", "l-", "u+"]) {
  const r = mulberry32(seed), seq = []; let t = 0, last = "";
  while (t < SECONDS) { const d = .25 + .25 * r(); let k; do { k = axes[Math.floor(r() * axes.length)]; } while (k === last && axes.length > 1); last = k;
    seq.push([t, k[0], k[1] === "+" ? 1 : -1, d]); t += d + .35 + .55 * r(); }
  return seq;
}
const PATTERNS = {
  "straight, forward held": [[0, B()]],
  "held up-strafe, no roll": [[0, B({ up: 1 })]],
  "corkscrew, full roll 240 °/s": [[0, B({ up: 1, roll: 1 })]],
  "escape corkscrew, 60 °/s reversing (ck-escape)": [[0, B({ up: 1, roll: .25 })], [3.5, B({ up: 1, roll: -.25 })], [6, B({ up: 1, roll: .25 })], [8.5, B({ up: 1, roll: -.25 })]],
  "slow roll 27 °/s (flee-tvi)": [[0, B({ up: 1, roll: .1125 })]],
  "strafe taps, forward held (flee-wall)": taps(TAPS),
  "strafe taps, forward released (flee-ease)": taps(TAPS, 0),
  "side taps only (round 13 sequence)": taps(randomTaps(1, ["l+", "l-"])),
  "up/down taps only (round 13 sequence)": taps(randomTaps(1, ["u+", "u-"])),
};
// Round 13: the same patterns as harness steps (durations, not start times), after a 6 s boosted run-up to the nose.
if (process.argv.includes("--yaml")) {
  const tapSteps = (seq) => seq.flatMap(([t, k, v, d], i) => {
    const next = i + 1 < seq.length ? seq[i + 1][0] : SECONDS, r = (x) => Math.round(x * 100) / 100;
    return [{ t: r(d), strafe_long: 1.0, [k === "l" ? "strafe_lat" : "strafe_vert"]: v, boost: true }, { t: r(next - t - d), strafe_long: 1.0, boost: true }];
  }).filter((st) => st.t > 0);
  const fmt = (st) => `{${Object.entries(st).map(([k, v]) => `${k}: ${v}`).join(", ")}}`;
  const runup = { t: 6, strafe_long: 1.0, boost: true };
  const out = {
    r13_aim_straight: [runup, { t: SECONDS, strafe_long: 1.0, boost: true }],
    r13_aim_taps_mixed: [runup, ...tapSteps(TAPS)],
    r13_aim_taps_side: [runup, ...tapSteps(randomTaps(1, ["l+", "l-"]))],
    r13_aim_taps_updown: [runup, ...tapSteps(randomTaps(1, ["u+", "u-"]))],
    r13_aim_ck_escape: [runup, ...[[3.5, 1], [2.5, -1], [2.5, 1], [1.5, -1]].map(([t, r]) => ({ t, strafe_long: 1.0, strafe_vert: 1.0, roll: r * 0.25, boost: true }))],
    r13_aim_held_up: [runup, { t: SECONDS, strafe_long: 1.0, strafe_vert: 1.0, boost: true }],
  };
  for (const [id, steps] of Object.entries(out)) console.log(`  - id: ${id}\n    steps: [${steps.map(fmt).join(", ")}]`);
  process.exit(0);
}
const SHOOTERS = [
  { name: "ideal 0.25 s (alpha readout)", react: .25, crossover: Infinity },
  { name: "human τe 0.15 s, ωc 4", react: .15, crossover: 4 },
  { name: "human τe 0.25 s, ωc 3", react: .25, crossover: 3 },
  { name: "human τe 0.35 s, ωc 2", react: .35, crossover: 2 },
  { name: "human τe 0.25 s, ωc 3, no feed-forward", react: .25, crossover: 3, feedForward: false },
];
const pct = (x) => `${Math.round(100 * x)}`;
const score = (track, sh, lead) => scoreAim(track, aimTrack(track, { ...sh, lead }), HULL, { from: FROM });

const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const spread = (xs) => `${pct(med(xs))} [${pct(Math.min(...xs))}-${pct(Math.max(...xs))}]`;
const table = (title, metric) => {
  console.log(`\n${title}\n`);
  console.log(`| pattern | range at ${SECONDS} s | ${SHOOTERS.map((s) => s.name).join(" | ")} |`);
  console.log(`|---|---|${SHOOTERS.map(() => "---").join("|")}|`);
  for (const [name, script] of Object.entries(PATTERNS)) {
    const tr = chaseTrack(p, script, opts);
    const cells = SHOOTERS.map((sh) => `${pct(score(tr, sh, "velocity")[metric])} / ${pct(score(tr, sh, "acceleration")[metric])}`);
    console.log(`| ${name} | ${Math.round(tr.at(-1).range)} m | ${cells.join(" | ")} |`);
  }
};
console.log(`Chaser ${RANGE} m behind at 520 m/s, projectile ${VP} m/s (assumed), shots from ${FROM} s to ${SECONDS} s. Cells: lead A (velocity) / lead B (velocity + acceleration), %.`);
table(`On the hull outline (${HULL.width} x ${HULL.height} m rectangle turned with the target's roll)`, "onTarget");
table("Inside the alpha's 8 m disc", "inRadius");

// The fixed tap sequence is one draw: repeat with random sequences, and split by axis (side only, up only, both).
console.log(`\nRandom tap sequences, forward held (${SEEDS} seeds each): median [min-max] % on the hull outline, lead A / lead B\n`);
const SETS = { "side and up": ["l+", "l-", "u+"], "side only": ["l+", "l-"], "up and down": ["u+", "u-"] };
console.log(`| shooter | ${Object.keys(SETS).join(" | ")} |\n|---|${Object.keys(SETS).map(() => "---").join("|")}|`);
const tapTracks = Object.fromEntries(Object.entries(SETS).map(([k, axes]) => [k, Array.from({ length: SEEDS }, (_, i) => chaseTrack(p, taps(randomTaps(i + 1, axes)), opts))]));
for (const sh of SHOOTERS) {
  const cells = Object.values(tapTracks).map((trs) => `${spread(trs.map((tr) => score(tr, sh, "velocity").onTarget))} / ${spread(trs.map((tr) => score(tr, sh, "acceleration").onTarget))}`);
  console.log(`| ${sh.name} | ${cells.join(" | ")} |`);
}

// Calibration curve for the two-pilot test: hit share against the shooter's delay, for the patterns the test flies.
// Measured hit shares, each divided by the straight-line baseline, read off as the shooter's effective delay.
const CAL = ["straight, forward held", "strafe taps, forward held (flee-wall)", "side taps only (round 13 sequence)", "up/down taps only (round 13 sequence)", "escape corkscrew, 60 °/s reversing (ck-escape)", "held up-strafe, no roll"];
console.log(`\nCalibration: % on the hull outline by shooter delay τe (ωc = 0.75 / τe, feed-forward on), lead A / lead B\n`);
const TAUS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4];
console.log(`| pattern | ${TAUS.map((t) => `τe ${t}`).join(" | ")} |\n|---|${TAUS.map(() => "---").join("|")}|`);
for (const name of CAL) {
  const tr = chaseTrack(p, PATTERNS[name], opts);
  console.log(`| ${name} | ${TAUS.map((t) => { const sh = { react: t, crossover: 0.75 / t }; return `${pct(score(tr, sh, "velocity").onTarget)} / ${pct(score(tr, sh, "acceleration").onTarget)}`; }).join(" | ")} |`);
}
