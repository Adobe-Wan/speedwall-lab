// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import type { FlightProfile, Input, Readouts, State } from "./types.js";

/** Fixed physics timestep, seconds (PLAN.md §3). */
export const DT = 1 / 240;

const notImplemented = (fn: string): never => {
  throw new Error(`@speedwall-lab/core: ${fn}() is not implemented yet (phase P1)`);
};

/** Advance the simulation by one fixed step. P1: PLAN.md §4. */
export function step(_s: State, _u: Input, _p: FlightProfile, _dt: number = DT): State {
  return notImplemented("step");
}

/** Everything the views show for a state and held input. P1: PLAN.md §4–§5. */
export function derive(_s: State, _u: Input, _p: FlightProfile): Readouts {
  return notImplemented("derive");
}

/** A state at rest, attitude identity, full tank. */
export function restState(): State {
  return { vWorld: [0, 0, 0], xWorld: [0, 0, 0], q: [0, 0, 0, 1], tank: 100, t: 0 };
}
