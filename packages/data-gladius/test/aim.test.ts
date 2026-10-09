// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { DT, aimTrack, chaseTrack, pip, scoreAim, type TargetSample, type Vec2 } from "@speedwall-lab/core";
import { profile } from "./fixture.js";

const HULL = { width: 17, height: 5.5 };
// A synthetic target across the line of sight: position from a function of time, tau fixed.
function synth(pos: (t: number) => Vec2, seconds: number, tau = 0.37): TargetSample[] {
  const out: TargetSample[] = [], h = 1e-4;
  for (let i = 0; i <= Math.round(seconds / DT); i++) {
    const t = i * DT, p = pos(t), p1 = pos(t + h), p0 = pos(t - h);
    out.push({ t, p, v: [(p1[0] - p0[0]) / (2 * h), (p1[1] - p0[1]) / (2 * h)], a: [(p1[0] - 2 * p[0] + p0[0]) / (h * h), (p1[1] - 2 * p[1] + p0[1]) / (h * h)], roll: 0, tau, range: 550 });
  }
  return out;
}

describe("lead pip", () => {
  it("leads velocity (A) or velocity and acceleration (B)", () => {
    const s: TargetSample = { t: 0, p: [1, 2], v: [10, 0], a: [0, 20], roll: 0, tau: 0.5, range: 550 };
    expect(pip(s, "velocity")).toEqual([6, 2]);
    expect(pip(s, "acceleration")).toEqual([6, 4.5]);
  });
});

describe("human aim (crossover model)", () => {
  const slide = synth((t) => [30 * t, 0], 6);
  it("a skilled shooter (feed-forward) tracks a steady slide without error", () => {
    const aim = aimTrack(slide, { lead: "velocity", react: 0.25, crossover: 3 });
    expect(scoreAim(slide, aim, HULL).onTarget).toBe(1);
    expect(scoreAim(slide, aim, HULL).meanMiss).toBeLessThan(0.01);
  });
  it("a purely error-correcting shooter trails a steady slide by v / ωc (ramp error of a type-1 loop)", () => {
    const aim = aimTrack(slide, { lead: "velocity", react: 0.25, crossover: 3, feedForward: false });
    const i = slide.length - 1, gap = pip(slide[i]!, "velocity")[0] - aim[i]![0];
    expect(gap).toBeCloseTo(30 / 3, 0);
  });
  it("the ideal shooter is the alpha's readout: the motion seen τe ago, extrapolated across τe + flight time", () => {
    const tr = synth((t) => [5 * t * t, 0], 3);
    const aim = aimTrack(tr, { lead: "velocity", react: 0.25, crossover: Infinity });
    const i = 480, j = i - Math.round(0.25 / DT), s = tr[j]!;
    expect(aim[i]![0]).toBeCloseTo(s.p[0] + s.v[0] * (0.37 + 0.25), 6);
  });
  it("a sudden dodge is missed for longer the slower the shooter reacts", () => {
    const jink = synth((t) => [t < 2 ? 0 : 0.5 * 60 * (t - 2) ** 2 * (t < 2.4 ? 1 : 0) + (t >= 2.4 ? 4.8 + 24 * (t - 2.4) : 0), 0], 5);
    const miss = (react: number) => scoreAim(jink, aimTrack(jink, { lead: "velocity", react, crossover: 0.75 / react }), HULL).meanMiss;
    expect(miss(0.15)).toBeLessThan(miss(0.25));
    expect(miss(0.25)).toBeLessThan(miss(0.35));
  });
});

describe("hit outline", () => {
  it("turns with the target's roll: 4 m above the centre misses a level Gladius and hits one rolled 90°", () => {
    const level = synth(() => [0, 0], 1), aim: Vec2[] = level.map(() => [0, 4]);
    expect(scoreAim(level, aim, HULL).onTarget).toBe(0);
    expect(scoreAim(level, aim, HULL).inRadius).toBe(1);
    const rolled = level.map((s) => ({ ...s, roll: Math.PI / 2 }));
    expect(scoreAim(rolled, aim, HULL).onTarget).toBe(1);
  });
});

describe("chase track (core physics with roll)", () => {
  const o = { startSpeed: 520, seconds: 4, range: 550, chaserSpeed: 520, projectileSpeed: 1500 };
  it("flying straight at the nose holds the range and the flight time", () => {
    const tr = chaseTrack(profile, [[0, { fwd: 1, boost: true }]], o);
    expect(tr.at(-1)!.range).toBeGreaterThan(548);
    expect(tr.at(-1)!.tau).toBeCloseTo(550 / 1500, 2);
    expect(Math.hypot(...tr.at(-1)!.p)).toBeLessThan(0.5);
  });
  it("rolls at the profile's boosted rate and the up-push turns with it", () => {
    const tr = chaseTrack(profile, [[0, { fwd: 1, up: 1, roll: 1, boost: true }]], o);
    expect(tr[240]!.roll).toBeCloseTo((profile.boost.rotationDps.roll * Math.PI) / 180, 2);
    const a0 = tr[240]!.a, a1 = tr[300]!.a;   // 0.25 s apart: the side push has turned by ~60°
    const ang = Math.acos((a0[0] * a1[0] + a0[1] * a1[1]) / (Math.hypot(...a0) * Math.hypot(...a1))) * 180 / Math.PI;
    expect(ang).toBeGreaterThan(45);
    expect(ang).toBeLessThan(75);
  });
  it("a held up-strafe swings the velocity off the line and the chaser closes", () => {
    const tr = chaseTrack(profile, [[0, { fwd: 1, up: 1, boost: true }]], o);
    expect(tr.at(-1)!.range).toBeLessThan(540);
    expect(tr.at(-1)!.p[1]).toBeGreaterThan(50);
  });
});
