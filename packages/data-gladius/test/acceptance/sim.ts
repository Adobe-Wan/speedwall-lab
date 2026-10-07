// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT
import { DT, restState, step, type FlightProfile, type Input, type State } from "@speedwall-lab/core";

export const input = (u: Partial<Input> = {}): Input => ({
  fwd: 0,
  lat: 0,
  up: 0,
  boost: false,
  ...u,
});

/** Run `seconds` of simulated time at the fixed timestep, holding one input. Returns every state, including the start. */
export function run(p: FlightProfile, s0: State, u: Input, seconds: number): State[] {
  const n = Math.round(seconds / DT);
  const out: State[] = [s0];
  let s = s0;
  for (let i = 0; i < n; i++) {
    s = step(s, u, p, DT);
    out.push(s);
  }
  return out;
}

export const speedOf = (s: State): number => Math.hypot(...s.vWorld);

/** State at simulated time `t` (seconds after the first state of `states`). */
export function at(states: State[], t: number): State {
  const i = Math.min(states.length - 1, Math.max(0, Math.round(t / DT)));
  return states[i] as State;
}

export { DT, restState };
