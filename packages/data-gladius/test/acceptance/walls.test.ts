// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
// PLAN.md §4 acceptance: wall and release traces. Expected to fail until P1.
//
// Each trace is replayed from rest: the first step pins the ship at the forward wall
// (same as in game), then the remaining steps are the dodge, sampled from t = 0 at its start.
import { describe, expect, it } from "vitest";
import { derive, type Input, type State } from "@speedwall-lab/core";
import { fixture, profile } from "../fixture.js";
import { DT, at, input, restState, run, speedOf } from "./sim.js";
import type { FixtureWallTrace } from "@speedwall-lab/data-gladius/fixture-schema";

interface Replay {
  states: State[];
  /** G meter reading at dodge time t, from the held input of that moment. */
  gAt: (t: number) => number;
}

function replay(trace: FixtureWallTrace): Replay {
  const [pin, ...dodge] = trace.steps;
  const toInput = (s: { strafe_long?: number; strafe_lat?: number; boost?: boolean }) =>
    input({ fwd: s.strafe_long ?? 0, lat: s.strafe_lat ?? 0, boost: s.boost ?? false });

  let cur = run(profile, restState(), toInput(pin!), pin!.t).at(-1)!;
  const states: State[] = [cur];
  const held: Input[] = [toInput(dodge[0]!)]; // held input at each state index
  for (const seg of dodge) {
    const u = toInput(seg);
    const part = run(profile, cur, u, seg.t);
    for (const s of part.slice(1)) {
      states.push(s);
      held.push(u);
    }
    cur = part.at(-1)!;
  }
  const gAt = (t: number) => {
    const i = Math.min(states.length - 1, Math.round(t / DT));
    return derive(states[i]!, held[i]!, profile).gNow;
  };
  return { states, gAt };
}

/** Replays are expensive and only run once a test needs them (the physics throws until P1). */
function lazy<T>(f: () => T): () => T {
  let v: T | undefined;
  return () => (v ??= f());
}

const traces = Object.entries(fixture.wallTraces);
const scm = traces.filter(([, t]) => !t.steps[0]?.boost);
const boosted = traces.filter(([, t]) => t.steps[0]?.boost);

describe("SCM wall traces: G within ±1 per sample", () => {
  describe.each(scm)("%s", (_id, trace) => {
    const r = lazy(() => replay(trace));
    it.each(trace.samples.map(([t, , g]): [number, number] => [t, g]))("t = %d s", (t, g) => {
      expect(Math.abs(r().gAt(t) - g)).toBeLessThanOrEqual(1);
    });
  });
});

describe("boosted wall traces: G within ±1.5 and speed within ±10 m/s per sample", () => {
  describe.each(boosted)("%s", (_id, trace) => {
    const r = lazy(() => replay(trace));
    it.each(trace.samples.map(([t, v, g]): [number, number, number] => [t, v, g]))("t = %d s", (t, v, g) => {
      expect(Math.abs(speedOf(at(r().states, t)) - v)).toBeLessThanOrEqual(10);
      expect(Math.abs(r().gAt(t) - g)).toBeLessThanOrEqual(1.5);
    });
  });
});

describe("boost release: speed within ±15 m/s per sample", () => {
  // All inputs and boost released near the boosted nose wall; samples are t after release.
  const start: State = { ...restState(), vWorld: [fixture.boostRelease.samples[0]![1], 0, 0] };
  const states = lazy(() => run(profile, start, input(), 1.5));
  it.each(fixture.boostRelease.samples.map(([t, v]): [number, number] => [t, v]))("t = %d s", (t, v) => {
    expect(Math.abs(speedOf(at(states(), t)) - v)).toBeLessThanOrEqual(15);
  });
});
