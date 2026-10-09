// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { DT, angularVelocity, restPilot, stepPilot, stickScaled, turnVelocity, vision, type Vec3 } from "@speedwall-lab/core";
import { profile } from "./fixture.js";

const pilot = profile.pilot!;
const hold = (a: Vec3, seconds: number, s = restPilot()) => { for (let i = 0; i < seconds / DT; i++) s = stepPilot(s, s.blackout ? [0, 0, 0] : a, pilot, DT); return s; };

describe("pilot G-LOC model", () => {
  it("is not a single limit: the same 5 G is fine sideways and up, and reds you out downward", () => {
    expect(hold([0, 5, 0], 20).dose).toBe(0);
    expect(hold([0, 0, 5], 20).dose).toBe(0);
    expect(vision(hold([0, 0, -5], 4), pilot).state).not.toBe("ok");
    expect(vision(hold([0, 0, -5], 4), pilot).red).toBeGreaterThan(0.2);
  });
  it("blacks out under 10 G lateral and the thrusters cut", () => {
    const s = hold([0, 10, 0], 5);
    expect(s.blackout).toBe(true);
    expect(vision(s, pilot)).toMatchObject({ state: "blackout", centre: 1, edge: 1 });
  });
  it("the edge of the screen darkens before the centre, and the HUD digits fade first", () => {
    const s = hold([0, 10, 0], 1.5), v = vision(s, pilot);
    expect(v.edge).toBeGreaterThan(v.centre);
    expect(v.hud).toBeLessThan(1);
  });
  it("vision returns about 5.5 s after the blackout begins, because the thrusters are cut, and comes back clear", () => {
    // Measured (fixture glocRecovery): 4.6-6.7 s from the HUD going dark to vision back, the same whether the stick was
    // held or released (the blackout had already cut the thrust), and the HUD comes back clear, not grey.
    let s = restPilot(), t = 0, since = 0;
    while (!s.blackout && t < 20) { s = stepPilot(s, [0, 10, 0], pilot, DT); t += DT; }
    expect(s.blackout).toBe(true);
    expect(vision(s, pilot).hud).toBe(0);
    while (s.blackout && since < 20) { s = stepPilot(s, [0, 0, 0], pilot, DT); since += DT; }
    expect(since).toBeGreaterThan(4.6);
    expect(since).toBeLessThan(6.7);
    expect(vision(s, pilot)).toMatchObject({ state: "ok", hud: 1 });
  });
  it("a load still held after vision returns greys you again later, not at once (r10_g_up_100, r9_vis_scm_f0_lat_r50)", () => {
    let s = restPilot(), back = -1, again = -1, t = 0;
    for (let i = 0; i < 20 / DT && again < 0; i++) {
      const was = s.blackout;
      s = stepPilot(s, s.blackout ? [0, 0, 0] : [0, 10, 0], pilot, DT); t += DT;
      if (was && !s.blackout) back = t;
      if (back > 0 && vision(s, pilot).state !== "ok") again = t;
    }
    expect(again - back).toBeGreaterThan(1);   // measured 1.5 s at 10 G lateral; the old clear level greyed at once
  });
  it("a long boosted down hold makes a staircase: out, back, out again (r11_redout_stairs)", () => {
    let s = restPilot(), out = 0, back = 0, was = false;
    for (let i = 0; i < 20 / DT; i++) { s = stepPilot(s, s.blackout ? [0, 0, 0] : [0, 0, -6.8], pilot, DT); if (s.blackout && !was) out++; if (!s.blackout && was) back++; was = s.blackout; }
    expect(out).toBeGreaterThanOrEqual(2);
    expect(back).toBeGreaterThanOrEqual(1);
  });
});

describe("rotation (PLAN.md §4.8)", () => {
  it("scales a diagonal stick to unit length and leaves shorter sticks alone", () => {
    const [r, p, y] = stickScaled({ pitch: 1, yaw: 1 }, profile);
    expect(Math.hypot(r, p, y)).toBeCloseTo(1, 9);
    expect(stickScaled({ pitch: 0.5, yaw: 0.5 }, profile)).toEqual([0, 0.5, 0.5]);
    expect(stickScaled({ pitch: 1, yaw: 1 }, { rotationRule: "independent" })).toEqual([0, 1, 1]);
  });
  it("turns the nose slower on a full pitch + yaw stick than on pitch alone, boosted rates ×1.2", () => {
    const nose = (u: object, b: boolean) => { const w = angularVelocity(u, profile, b); return (Math.hypot(w[1], w[2]) * 180) / Math.PI; };
    expect(nose({ pitch: 1, yaw: 1 }, false)).toBeLessThan(nose({ pitch: 1 }, false));
    expect(nose({ pitch: 1 }, true) / nose({ pitch: 1 }, false)).toBeCloseTo(1.2, 1);
  });
  it("a world-fixed velocity swings 90° in the ship frame after a 90° pitch up, keeping its speed", () => {
    const w = angularVelocity({ pitch: 1 }, profile, false);
    let v: Vec3 = [100, 0, 0];
    const n = Math.round(90 / 68 / DT);
    for (let i = 0; i < n; i++) v = turnVelocity(v, w, DT);
    expect(Math.hypot(...v)).toBeCloseTo(100, 6);
    expect(v[0]).toBeLessThan(5);
    expect(v[2]).toBeLessThan(-95); // nose up: the velocity ends up below the ship
  });
});
