// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { DT, step, restState, type Input, type State } from "@speedwall-lab/core";
import { profile } from "./fixture.js";

const u = (o: Partial<Input> = {}): Input => ({ fwd: 0, lat: 0, up: 0, boost: false, ...o });
const run = (s: State, i: Input, sec: number) => { for (let k = 0; k < Math.round(sec / DT); k++) s = step(s, i, profile, DT); return s; };
const speed = (s: State) => Math.hypot(...s.vWorld);

describe("boost release", () => {
  const atNose = run(restState(), u({ fwd: 1, boost: true, unlimitedBoost: true }), 12);

  // Measured (r6_release_*): 5.2 s from the nose with everything released or forward held, 7.6 s with a strafe held.
  it.each([
    ["all inputs released", 6, u()],
    ["forward still held", 6, u({ fwd: 1 })],
    ["forward + strafe held", 8, u({ fwd: 1, lat: 1 })],
  ])("returns to the SCM cap (%s) within %d s", (_, seconds, input) => {
    expect(speed(atNose)).toBeGreaterThan(515);
    const s = run(atNose, input, seconds);
    expect(speed(s)).toBeLessThanOrEqual(profile.scm.speedCap + 0.5);
  });
  it("never overshoots below the SCM cap with forward held", () => {
    let s = atNose, min = Infinity;
    for (let k = 0; k < Math.round(8 / DT); k++) { s = step(s, u({ fwd: 1 }), profile, DT); min = Math.min(min, speed(s)); }
    expect(min).toBeGreaterThan(profile.scm.speedCap - 0.5);
  });
});
