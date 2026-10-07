// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { DT, step, restState, type Input, type State } from "@speedwall-lab/core";
import { profile } from "./fixture.js";

const u = (o: Partial<Input> = {}): Input => ({ fwd: 0, lat: 0, up: 0, boost: false, ...o });
const run = (s: State, i: Input, sec: number) => { for (let k = 0; k < Math.round(sec / DT); k++) s = step(s, i, profile, DT); return s; };

describe("boost tank", () => {
  const untilLocked = (s: State) => { while (!s.boostLocked) s = step(s, u({ boost: true }), profile, DT); return s; };

  it("drains at the fixture rate while boosting and empties into a lockout", () => {
    const s = run(restState(), u({ boost: true }), 10);
    expect(s.tank).toBeCloseTo(100 - 10 * profile.boost.tankDrainPctPerS, 0);
    const empty = untilLocked(s);
    expect(empty.tank).toBe(0);
    expect(empty.t).toBeCloseTo(100 / profile.boost.tankDrainPctPerS, 1);
  });
  it("stays locked while boost is held, refilling through the red zone, then unlocks", () => {
    let s = untilLocked(restState());
    s = run(s, u({ boost: true }), 3); // holding boost while locked does not drain
    expect(s.tank).toBeCloseTo(3 * profile.boost.tankRegenPctPerS, 1);
    expect(s.boostLocked).toBe(true);
    s = run(s, u({ boost: true }), (profile.boost.redZonePct - s.tank) / profile.boost.tankRegenPctPerS - 0.1);
    expect(s.boostLocked).toBe(true);
    s = run(s, u(), 0.2);
    expect(s.boostLocked).toBe(false);
  });
  it("boost does nothing while locked: no boosted speed", () => {
    const locked: State = { ...restState(), tank: 10, boostLocked: true };
    const s = run(locked, u({ fwd: 1, boost: true }), 3);
    expect(Math.hypot(...s.vWorld)).toBeLessThanOrEqual(profile.scm.speedCap + 0.5);
  });
  it("unlimited boost never drains or locks", () => {
    const s = run(restState(), u({ fwd: 1, boost: true, unlimitedBoost: true }), 40);
    expect(s.tank).toBe(100);
    expect(s.boostLocked).toBe(false);
    expect(Math.hypot(...s.vWorld)).toBeGreaterThan(515);
  });
});
