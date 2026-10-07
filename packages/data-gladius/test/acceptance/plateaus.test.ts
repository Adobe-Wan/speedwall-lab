// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT
// PLAN.md §4 acceptance. Written from the fixture before the physics exists (P0); expected to fail until P1.
import { describe, expect, it } from "vitest";
import { derive, step } from "@speedwall-lab/core";
import { fixture, profile } from "../fixture.js";
import { DT, input, restState, run, speedOf } from "./sim.js";

const SETTLE_SECONDS = 12; // boost tank drains 4.8 %/s: 12 s leaves ~42 %, so boost never cuts out

const withPlateau = fixture.plateaus.filter((p) => p.plateau_mps !== null);
const withAccel = fixture.plateaus.filter((p) => p.accel_G !== null);

describe("settled speed (every fixture plateau within 1 % or ±3 m/s)", () => {
  it.each(withPlateau.map((p): [string, typeof p] => [p.id, p]))("%s", (_id, p) => {
    const u = input({ ...p.inputs, boost: p.boost });
    const end = run(profile, restState(), u, SETTLE_SECONDS).at(-1)!;
    const want = p.plateau_mps as number;
    const tol = Math.max(0.01 * want, 3);
    expect(Math.abs(speedOf(end) - want)).toBeLessThanOrEqual(tol);
  });
});

describe("acceleration from rest (within 5 %)", () => {
  it.each(withAccel.map((p): [string, typeof p] => [p.id, p]))("%s", (_id, p) => {
    const u = input({ ...p.inputs, boost: p.boost });
    const s1 = step(restState(), u, profile, DT);
    const g = derive(s1, u, profile).gNow;
    const want = p.accel_G as number;
    expect(Math.abs(g - want)).toBeLessThanOrEqual(0.05 * want);
  });
});

describe("lateral room (table exact, ±0.05 m/s for the 1-decimal rounding)", () => {
  it.each(fixture.lateralRoom.boost.map(([v, r]): [number, number] => [v, r]))("boost, forward %d m/s", (vFwd, room) => {
    const s = { ...restState(), vWorld: [vFwd, 0, 0] as [number, number, number] };
    const got = derive(s, input({ boost: true }), profile).lateralRoom;
    expect(Math.abs(got - room)).toBeLessThanOrEqual(0.05);
  });

  it.each([0, 100, 200, 225])("SCM sphere, forward %d m/s: sqrt(225² − v²)", (vFwd) => {
    const s = { ...restState(), vWorld: [vFwd, 0, 0] as [number, number, number] };
    const got = derive(s, input(), profile).lateralRoom;
    expect(Math.abs(got - Math.sqrt(225 ** 2 - vFwd ** 2))).toBeLessThanOrEqual(0.05);
  });
});
