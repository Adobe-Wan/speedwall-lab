// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT
// PLAN.md §4: the same input stream gives bit-identical replays. Expected to fail until P1.
import { describe, expect, it } from "vitest";
import { step, type Input, type State } from "@speedwall-lab/core";
import { profile } from "../fixture.js";
import { DT, input, restState } from "./sim.js";

/** Small deterministic PRNG (mulberry32) so the input stream is fixed. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stream(seed: number, n: number): Input[] {
  const r = rng(seed);
  const out: Input[] = [];
  let u = input();
  for (let i = 0; i < n; i++) {
    if (i % 60 === 0) u = input({ fwd: r() * 2 - 1, lat: r() * 2 - 1, up: r() * 2 - 1, boost: r() < 0.5 });
    out.push(u);
  }
  return out;
}

const replay = (inputs: Input[]): State => inputs.reduce((s, u) => step(s, u, profile, DT), restState());

describe("determinism", () => {
  it("bit-identical final state for the same 20 s input stream", () => {
    const inputs = stream(42, 240 * 20);
    const a = replay(inputs);
    const b = replay(inputs);
    const bits = (s: State) => new Float64Array([...s.vWorld, ...s.xWorld, ...s.q, s.tank, s.t]);
    expect(Buffer.from(bits(a).buffer).equals(Buffer.from(bits(b).buffer))).toBe(true);
  });

  it("does not mutate its input state", () => {
    const s = restState();
    const frozen = JSON.stringify(s);
    step(s, input({ fwd: 1, boost: true }), profile, DT);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});
