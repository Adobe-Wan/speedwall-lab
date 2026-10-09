// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
// Acceptance for the G-LOC MODEL against fixture glocTrials. It is a model, not CIG's rule: it only has to reproduce when
// the measured pilots greyed out and when they did not. Misses are listed in docs/physics-fit.md.
import { describe, expect, it } from "vitest";
import { DT, restPilot, restState, step, stepPilot, type Vec3 } from "@speedwall-lab/core";
import { fixture, profile } from "../fixture.js";

const pilot = profile.pilot!;
const rows = fixture.glocTrials.rows;

/** Hold a constant load of `g` G in `dir` for `seconds` (no ramp); returns when the stress first reaches each level. */
function hold(dir: "up" | "lat" | "down", g: number, seconds: number) {
  const a: Vec3 = dir === "up" ? [0, 0, g] : dir === "down" ? [0, 0, -g] : [0, g, 0];
  let s = restPilot();
  let grey: number | null = null, gone: number | null = null;
  for (let i = 0; i < seconds / DT; i++) {
    s = stepPilot(s, s.blackout ? [0, 0, 0] : a, pilot, DT);
    const t = (i + 1) * DT;
    if (grey === null && s.dose >= pilot.greyDose) grey = t;
    if (gone === null && s.dose >= pilot.goneDose) gone = t;
  }
  return { grey, gone };
}

const steady = rows.filter((r) => !r.forwardLaunch && r.gPeak !== null);
describe("G-LOC model: constant side load, time to grey-out", () => {
  it.each(steady.map((r): [string, (typeof rows)[number]] => [`${r.test} (${r.dir} ${r.gPeak} G)`, r]))("%s", (_n, r) => {
    const m = hold(r.dir, r.gPeak as number, 20);
    if (r.greyAt_s === null) expect(m.grey, "measured: no grey-out in the test").toBeNull();
    else {
      expect(m.grey, "measured: grey-out").not.toBeNull();
      expect(Math.abs((m.grey as number) - r.greyAt_s)).toBeLessThanOrEqual(Math.max(1.5, 0.4 * r.greyAt_s));
    }
  });
});

describe("G-LOC model: constant side load, time until the HUD is gone", () => {
  it.each(steady.filter((r) => r.hudGoneAt_s !== null).map((r): [string, (typeof rows)[number]] => [`${r.test} (${r.dir} ${r.gPeak} G)`, r]))("%s", (_n, r) => {
    const m = hold(r.dir, r.gPeak as number, 25);
    expect(m.gone, "measured: HUD gone").not.toBeNull();
    expect(Math.abs((m.gone as number) - (r.hudGoneAt_s as number))).toBeLessThanOrEqual(Math.max(2, 0.5 * (r.hudGoneAt_s as number)));
  });
});

describe("G-LOC model: boosted launch from rest with a strafe (the side part of the capped thrust), grey-out within 0.6 s", () => {
  it.each(rows.filter((r) => r.test.startsWith("r9_vis_bst_")).map((r): [string, (typeof rows)[number]] => [r.test, r]))("%s", (_n, r) => {
    const inp = { fwd: 1, lat: r.dir === "lat" ? 1 : 0, up: r.dir === "up" ? 1 : r.dir === "down" ? -1 : 0, boost: true };
    let s = restState(), ps = restPilot(), grey: number | null = null;
    for (let i = 0; i < 8 / DT && grey === null; i++) {
      s = step(s, inp, profile, DT);
      const a: Vec3 = [s.aWorld[0] / 9.80665, s.aWorld[1] / 9.80665, s.aWorld[2] / 9.80665];
      ps = stepPilot(ps, ps.blackout ? [0, 0, 0] : a, pilot, DT);
      if (ps.dose >= pilot.greyDose) grey = (i + 1) * DT;
    }
    expect(grey, "model grey-out").not.toBeNull();
    expect(Math.abs((grey as number) - (r.greyAt_s as number))).toBeLessThanOrEqual(0.6);
  });
});
