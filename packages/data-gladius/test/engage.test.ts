// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Engagement geometry (packages/core/src/engage.ts) against the measured Gladius fixture. Sanity values from brief C1
// (2026-10-11) at ±1 %; monotonicity; unit consistency; guarded edge cases; the orbit simulation against the analytic
// limits; and a per-call time bench. Engagement ranges stay at 300–600 m (never 1 km).
import { describe, expect, it } from "vitest";
import {
  CLOSING_SIGN, G0, RAD, WEAPON, closingSpeed, leadDistance, noseCrossoverDeg, noseSim, orbitLimit, orbitSim, orbitThrottle, outrateRadius,
  timeOfFlight, timeToNose, timeToRange, type FlightMode, type TurnAxis,
} from "@speedwall-lab/core";
import { profile as p } from "./fixture.js";

const within = (x: number, want: number, pct = 1) => expect(Math.abs(x - want) / Math.abs(want)).toBeLessThanOrEqual(pct / 100);
const rates = (mode: FlightMode) => (mode === "boost" ? p.boost.rotationDps : p.scm.rotationDps);
const gees = (mode: FlightMode) => (mode === "boost" ? p.boost.G : p.scm.G);

describe("constants", () => {
  it("WEAPON carries its source and status; 1,800 m/s is sourced, not measured", () => {
    expect(WEAPON.projectileSpeed_mps).toBe(1800);
    expect(WEAPON.source).toContain("Apprentice_One");
    expect(WEAPON.source).toContain("2024-11-08");
    expect(WEAPON.status).toMatch(/not measured/);
    expect(CLOSING_SIGN.status).toMatch(/unconfirmed/);
  });
  it("every rate and G used here is the fixture's (measured), read through the profile", () => {
    expect(p.scm.rotationDps).toEqual({ pitch: 68.0, yaw: 52.1, roll: 199.9 });
    expect(p.boost.rotationDps).toEqual({ pitch: 81.6, yaw: 62.7, roll: 240.0 });
    expect(p.provenance["scm.rotationDps"]?.kind).toBe("measured");
    expect(p.provenance["boost.rotationDps"]?.kind).toBe("measured");
    expect(p.provenance["scm.G.fwd"]?.kind).toBe("measured");
    expect(p.provenance["boost.G.fwd"]?.kind).toBe("measured");
  });
});

describe("closingSpeed", () => {
  it("is −d|r|/dt: positive when the range shrinks, negative when it grows, zero across the line", () => {
    expect(closingSpeed([550, 0, 0], [-51, 0, 0])).toBeCloseTo(51, 9); // target coming straight at you
    expect(closingSpeed([550, 0, 0], [100, 0, 0])).toBeCloseTo(-100, 9); // target pulling away
    expect(closingSpeed([550, 0, 0], [0, 120, 0])).toBeCloseTo(0, 9); // pure crossing
    expect(closingSpeed([0, 550, 0], [0, -51, 0])).toBeCloseTo(51, 9); // any frame, any direction
  });
  it("matches a finite difference of the range", () => {
    const r0: [number, number, number] = [400, 300, 100], v: [number, number, number] = [-40, 25, -10], h = 1e-3;
    const r1 = Math.hypot(r0[0] + v[0] * h, r0[1] + v[1] * h, r0[2] + v[2] * h);
    expect(closingSpeed(r0, v)).toBeCloseTo(-(r1 - Math.hypot(...r0)) / h, 2);
  });
  it("returns 0 at zero range (undefined there) and scales linearly with speed", () => {
    expect(closingSpeed([0, 0, 0], [-51, 0, 0])).toBe(0);
    expect(closingSpeed([550, 0, 0], [-102, 0, 0])).toBeCloseTo(2 * closingSpeed([550, 0, 0], [-51, 0, 0]), 9);
  });
});

describe("timeOfFlight and lead", () => {
  it.each([
    [550, 0, 0.306],
    [550, 51, 0.297],
    [550, -100, 0.324],
  ])("range %d m, closing %d m/s → %f s (brief C1 sanity)", (range, closing, want) => within(timeOfFlight(range, closing), want));
  it("51 m/s of closing shortens the flight at 550 m by about 3 %", () => {
    const d = 1 - timeOfFlight(550, 51) / timeOfFlight(550, 0);
    expect(d).toBeGreaterThan(0.025);
    expect(d).toBeLessThan(0.03);
  });
  it("is monotonic: more closing → shorter flight; more range → longer flight", () => {
    let last = Infinity;
    for (let c = -200; c <= 200; c += 10) { const t = timeOfFlight(550, c); expect(t).toBeLessThan(last); last = t; }
    last = 0;
    for (const r of [300, 450, 550, 600]) { const t = timeOfFlight(r, 0); expect(t).toBeGreaterThan(last); last = t; }
  });
  it("uses WEAPON by default and takes another projectile speed explicitly", () => {
    expect(timeOfFlight(550, 0)).toBeCloseTo(550 / WEAPON.projectileSpeed_mps, 12);
    expect(timeOfFlight(550, 0, 1500)).toBeCloseTo(550 / 1500, 12);
  });
  it("guards: a projectile that never arrives is Infinity, a non-positive range is 0", () => {
    expect(timeOfFlight(550, -1800)).toBe(Infinity);
    expect(timeOfFlight(550, -2000)).toBe(Infinity);
    expect(timeOfFlight(0, 51)).toBe(0);
    expect(timeOfFlight(-5, 51)).toBe(0);
  });
  it("lead distance is crossing speed × flight time (m/s × s = m)", () => {
    expect(leadDistance(120, timeOfFlight(550, 0))).toBeCloseTo(120 * 550 / 1800, 9);
    expect(leadDistance(0, 0.3)).toBe(0);
    expect(leadDistance(-120, 0.3)).toBeCloseTo(-36, 9);
  });
});

describe("timeToRange", () => {
  it("is (r0 − r1) / closing, with the never cases Infinity and the there case 0", () => {
    expect(timeToRange(550, 300, 51)).toBeCloseTo(250 / 51, 9);
    expect(timeToRange(300, 600, -100)).toBeCloseTo(3, 9);
    expect(timeToRange(550, 300, -51)).toBe(Infinity);
    expect(timeToRange(550, 300, 0)).toBe(Infinity);
    expect(timeToRange(550, 550, 0)).toBe(0);
  });
  it("Δ matters more as distance management than as bullet speed: 51 m/s moves 550 → 300 m in ~5 s but trims the flight by 9 ms", () => {
    expect(timeToRange(550, 300, 51)).toBeGreaterThan(4.5);
    expect(timeOfFlight(550, 0) - timeOfFlight(550, 51)).toBeLessThan(0.01);
  });
});

describe("timeToNose", () => {
  it("Boost, 60° off in the yaw plane: yaw 0.96 s; roll 90° then pitch 60° 1.11 s (brief C1 sanity)", () => {
    const t = timeToNose(p, "boost", 60, 90);
    within(t.noRoll, 0.96);
    within(t.rollThenPitch, 1.11);
    expect(t.best).toBe("noRoll");
  });
  it("reduces to the single-axis times at 0° and 90° of roll need", () => {
    for (const mode of ["scm", "boost"] as const) {
      const R = rates(mode);
      expect(timeToNose(p, mode, 45, 90).noRoll).toBeCloseTo(45 / R.yaw, 9);
      expect(timeToNose(p, mode, 45, 0).noRoll).toBeCloseTo(45 / R.pitch, 9);
      expect(timeToNose(p, mode, 45, 0).rollThenPitch).toBeCloseTo(45 / R.pitch, 9);
      expect(timeToNose(p, mode, 45, 90).rollThenPitch).toBeCloseTo(90 / R.roll + 45 / R.pitch, 9);
    }
  });
  it("grows with the off-angle and with the roll needed", () => {
    let last = 0;
    for (const th of [10, 30, 60, 90, 120, 150]) { const t = timeToNose(p, "scm", th, 90); expect(t.noRoll).toBeGreaterThan(last); last = t.noRoll; }
    expect(timeToNose(p, "scm", 60, 90).rollThenPitch).toBeGreaterThan(timeToNose(p, "scm", 60, 30).rollThenPitch);
    expect(timeToNose(p, "scm", 60, 90).noRoll).toBeGreaterThan(timeToNose(p, "scm", 60, 30).noRoll);
  });
  it("boost turns faster than SCM on every option", () => {
    const s = timeToNose(p, "scm", 60, 90), b = timeToNose(p, "boost", 60, 90);
    expect(b.noRoll).toBeLessThan(s.noRoll);
    expect(b.rollThenPitch).toBeLessThan(s.rollThenPitch);
    expect(b.diagonal).toBeLessThan(s.diagonal);
  });
  it("the simulated diagonal stick converges within 3 s for 5–179° off and 0–180° of roll, and never beats the pure-pitch time", () => {
    for (const mode of ["scm", "boost"] as const) for (const ph of [0, 30, 60, 90, 120, 150, 180]) for (const th of [5, 20, 45, 90, 135, 179]) {
      const t = timeToNose(p, mode, th, ph);
      expect(t.diagonal).toBeLessThan(3);
      expect(t.diagonal).toBeGreaterThanOrEqual(th / rates(mode).pitch - 0.01);
      expect(["noRoll", "rollThenPitch", "diagonal"]).toContain(t.best);
    }
  });
  it("with no roll needed the simulated stick is the pitch-only time (±1 step)", () => {
    within(noseSim(p, "scm", 60, 0).t, 60 / p.scm.rotationDps.pitch, 1.5);
    within(noseSim(p, "boost", 60, 180).t, 60 / p.boost.rotationDps.pitch, 1.5);
  });
});

describe("noseCrossoverDeg", () => {
  it("roll-then-pitch beats a one-stick blend only past ~100° off when 90° of roll is needed (both modes)", () => {
    within(noseCrossoverDeg(p, "scm", 90), 100.3);
    within(noseCrossoverDeg(p, "boost", 90), 101.5);
    for (const mode of ["scm", "boost"] as const) {
      const x = noseCrossoverDeg(p, mode, 90);
      expect(timeToNose(p, mode, x - 1, 90).noRoll).toBeLessThan(timeToNose(p, mode, x - 1, 90).rollThenPitch);
      expect(timeToNose(p, mode, x + 1, 90).noRoll).toBeGreaterThan(timeToNose(p, mode, x + 1, 90).rollThenPitch);
    }
  });
  it("is never reached inside 180° when the target is already in the pitch plane (0° or 180° of roll)", () => {
    expect(noseCrossoverDeg(p, "scm", 0)).toBe(Infinity);
    expect(noseCrossoverDeg(p, "boost", 180)).toBe(Infinity);
  });
  it("sustained tracking in pitch is ~30 % faster than in yaw (the ratio of the measured rates), both modes", () => {
    within(p.scm.rotationDps.pitch / p.scm.rotationDps.yaw, 1.305);
    within(p.boost.rotationDps.pitch / p.boost.rotationDps.yaw, 1.301);
  });
});

describe("orbitLimit (pole-drill geometry)", () => {
  it.each<[FlightMode, TurnAxis, number, number, string]>([
    ["scm", "pitch", 100, 116, "thrust"],
    ["scm", "yaw", 100, 91, "rotation"],
    ["scm", "pitch", 200, 164, "thrust"],
    ["boost", "pitch", 100, 142, "rotation"],
  ])("%s %s r = %d m → %d m/s, %s-limited (brief C1 sanity)", (mode, axis, r, want, by) => {
    const o = orbitLimit(p, mode, r, axis);
    within(o.vMax, want);
    expect(o.limitedBy).toBe(by);
  });
  it("SCM pitch at 100 m: thrust 116, rotation 119; boost at 100 m: thrust 144, pitch 142", () => {
    within(orbitLimit(p, "scm", 100, "pitch").vThrust, 116);
    within(orbitLimit(p, "scm", 100, "pitch").vRotation, 119);
    within(orbitLimit(p, "boost", 100, "pitch").vThrust, 144);
    within(orbitLimit(p, "boost", 100, "pitch").vRotation, 142);
  });
  it("is the formulas on the fixture: ω·r, √(G_fwd·g0·r), and the egg radius at 90° off the nose", () => {
    for (const mode of ["scm", "boost"] as const) for (const axis of ["pitch", "yaw"] as const) {
      const o = orbitLimit(p, mode, 150, axis);
      expect(o.vRotation).toBeCloseTo(rates(mode)[axis] * RAD * 150, 9);
      expect(o.vThrust).toBeCloseTo(Math.sqrt(gees(mode).fwd * G0 * 150), 9);
      expect(o.vCap).toBe(mode === "boost" ? p.boost.A : p.scm.speedCap);
      expect(o.vMax).toBe(Math.min(o.vRotation, o.vThrust, o.vCap));
    }
  });
  it("larger radius → higher orbit speed, until the speed cap takes over", () => {
    let last = 0;
    for (const r of [50, 100, 150, 200, 300, 400, 600]) { const v = orbitLimit(p, "scm", r, "pitch").vMax; expect(v).toBeGreaterThanOrEqual(last); last = v; }
    expect(orbitLimit(p, "scm", 600, "pitch")).toMatchObject({ vMax: p.scm.speedCap, limitedBy: "speedCap" });
  });
  it("guards r ≤ 0 (no orbit: 0 m/s)", () => {
    expect(orbitLimit(p, "scm", 0, "pitch").vMax).toBe(0);
    expect(orbitLimit(p, "scm", -10, "pitch").vMax).toBe(0);
  });
});

describe("outrateRadius and orbitThrottle", () => {
  it("is v / ω: the SCM nose in pitch loses a 116 m/s crossing target inside ~98 m, in yaw inside ~128 m", () => {
    within(outrateRadius(p, "scm", 116, "pitch"), 116 / (68 * RAD));
    within(outrateRadius(p, "scm", 116, "yaw"), 116 / (52.1 * RAD));
    expect(outrateRadius(p, "scm", 116, "yaw")).toBeGreaterThan(outrateRadius(p, "scm", 116, "pitch"));
    expect(outrateRadius(p, "boost", 116, "pitch")).toBeLessThan(outrateRadius(p, "scm", 116, "pitch"));
  });
  it("inverts orbitLimit's rotation bound and grows with speed", () => {
    const r = 150, v = orbitLimit(p, "boost", r, "yaw").vRotation;
    expect(outrateRadius(p, "boost", v, "yaw")).toBeCloseTo(r, 9);
    expect(outrateRadius(p, "scm", 200, "pitch")).toBeGreaterThan(outrateRadius(p, "scm", 100, "pitch"));
    expect(outrateRadius(p, "scm", -100, "pitch")).toBe(outrateRadius(p, "scm", 100, "pitch"));
  });
  it("orbitThrottle is v² / (r·G_fwd·g0), 1 at and above the thrust limit", () => {
    expect(orbitThrottle(p, "scm", 100, orbitLimit(p, "scm", 100, "pitch").vThrust)).toBeCloseTo(1, 9);
    expect(orbitThrottle(p, "scm", 100, 82)).toBeCloseTo(82 * 82 / (100 * p.scm.G.fwd * G0), 9);
    expect(orbitThrottle(p, "scm", 100, 150)).toBe(1);
    expect(orbitThrottle(p, "scm", 0, 150)).toBe(1);
  });
});

describe("orbitSim (validation of orbitLimit)", () => {
  const hold = (mode: FlightMode, r: number, v: number, fwd: number, seconds = 20) => orbitSim({ p, mode, r0: r, inputs: { fwd, lat: 0, up: 0 }, seconds, v0: [0, 0, -v] });

  it.each<[FlightMode, number]>([["scm", 100], ["scm", 200], ["scm", 300], ["boost", 200]])(
    "%s r = %d m: full forward at the thrust-limited speed holds the circle (radius and speed within 1 %, nose on target)", (mode, r) => {
      const lim = orbitLimit(p, mode, r, "pitch");
      expect(lim.limitedBy).toBe("thrust");
      const o = hold(mode, r, lim.vMax, 1);
      within(o.meanRadius, r);
      within(o.meanSpeed, lim.vMax);
      within(o.final.r, r);
      expect(Math.abs(o.meanClosing)).toBeLessThan(1);
      expect(o.maxOffAngleDeg).toBeLessThan(0.5);
    });
  it("boost r = 100 m (rotation-limited): a balanced throttle holds at 95 % of the rate limit and the nose falls behind at 105 %", () => {
    const lim = orbitLimit(p, "boost", 100, "pitch");
    expect(lim.limitedBy).toBe("rotation");
    const ok = hold("boost", 100, 0.95 * lim.vRotation, orbitThrottle(p, "boost", 100, 0.95 * lim.vRotation));
    within(ok.meanRadius, 100);
    expect(ok.maxOffAngleDeg).toBeLessThan(0.5);
    const over = hold("boost", 100, 1.05 * lim.vRotation, orbitThrottle(p, "boost", 100, 1.05 * lim.vRotation));
    expect(over.maxOffAngleDeg).toBeGreaterThan(3);
    expect(over.final.r).toBeGreaterThan(130);
  });
  it("the circle is not self-correcting: 10 % too slow or too fast with full forward opens the orbit (throttle must be modulated)", () => {
    const lim = orbitLimit(p, "scm", 100, "pitch");
    expect(hold("scm", 100, 0.9 * lim.vMax, 1).final.r).toBeGreaterThan(150);
    expect(hold("scm", 100, 1.1 * lim.vMax, 1).final.r).toBeGreaterThan(150);
  });
  it("Winters' binary-circle input (forward ½, down-strafe ¼) from rest in SCM builds speed to the cap and the circle opens to v²/(½·a_fwd)", () => {
    const o = orbitSim({ p, mode: "scm", r0: 100, inputs: { fwd: 0.5, lat: 0, up: -0.25 }, seconds: 60 });
    const rPred = p.scm.speedCap ** 2 / (0.5 * p.scm.G.fwd * G0);
    expect(o.final.speed).toBeCloseTo(p.scm.speedCap, 0);
    expect(o.final.r).toBeGreaterThan(0.9 * rPred);
    expect(o.final.r).toBeLessThan(1.15 * rPred);
    expect(o.path.length).toBe(601);
    expect(o.path[0]).toMatchObject({ t: 0, r: 100, speed: 0 });
  });
  it("the world path keeps the target at the origin: |x| equals the range at every sample", () => {
    const o = hold("scm", 100, orbitLimit(p, "scm", 100, "pitch").vMax, 1, 5);
    for (const s of o.path) expect(Math.hypot(...s.x)).toBeCloseTo(s.r, 6);
  });
});

describe("bench (PLAN.md §9: physics under 0.2 ms per frame)", () => {
  const perCall = (n: number, f: () => unknown) => { f(); const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - t0) / n; };
  it("the per-frame candidates run well under 0.2 ms; timeToNose (a 240 Hz simulation) under 1 ms; orbitSim is for tables, not frames", () => {
    let i = 0;
    expect(perCall(20000, () => closingSpeed([550, 10, i++ % 5], [-20, 3, 1]))).toBeLessThan(0.02);
    expect(perCall(20000, () => timeOfFlight(550, i++ % 100))).toBeLessThan(0.02);
    expect(perCall(20000, () => orbitLimit(p, "scm", 100 + i++ % 7, "pitch"))).toBeLessThan(0.02);
    expect(perCall(20000, () => outrateRadius(p, "scm", 100 + i++ % 7, "pitch"))).toBeLessThan(0.02);
    expect(perCall(20000, () => noseCrossoverDeg(p, "scm", i++ % 180))).toBeLessThan(0.02);
    expect(perCall(200, () => timeToNose(p, "scm", 60 + i++ % 50, 90))).toBeLessThan(1);
    expect(perCall(3, () => orbitSim({ p, mode: "scm", r0: 100, inputs: { fwd: 1, lat: 0, up: 0 }, seconds: 20, v0: [0, 0, -116] }))).toBeLessThan(50);
  });
});
