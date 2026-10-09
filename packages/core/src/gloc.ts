// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Pilot G-LOC model, first version (MODEL, not CIG's rule: it is not published). Measured: a per-direction tolerance
// (not one G limit); time to grey-out falls as G rises above it; the HUD digits fade first, then the edges of the screen,
// then everything; down loads red out; about 4 s to recover; while fully blacked out the ship stops responding and boost
// drops. Fitted by hand to fixture glocTrials (docs/physics-fit.md); forward and backward tolerances are NOT mapped.
import type { PilotParams, Vec3 } from "./types.js";

export interface PilotState {
  /** Accumulated stress: 0 = fine, greyDose = HUD digits at 80 %, goneDose = HUD below 50 %, blackDose = fully out. */
  dose: number;
  /** Fully blacked out: thrust and boost are cut until vision returns (dose drained back down to clearDose). */
  blackout: boolean;
  /** 0..1: how much of the recent load was "eyeballs up" (down strafe), which tints the screen red. */
  redShare: number;
}

export interface Vision {
  /** HUD digit brightness, 0..1 (1 = normal). */
  hud: number;
  /** Darkness at the screen's edge and at its centre, 0..1 (the edge goes first). */
  edge: number;
  centre: number;
  /** Red tint strength, 0..1. */
  red: number;
  state: "ok" | "grey" | "gone" | "blackout";
}

export const restPilot = (): PilotState => ({ dose: 0, blackout: false, redShare: 0 });

/**
 * Load ratio: how far the current acceleration is past the pilot's tolerance, per direction (the worst axis counts), 1 = at the limit.
 * `aG` is the acceleration in G in the core ship frame (+x nose, +y right, +z up). Up (+z) presses you into the seat
 * toward your feet and is the most tolerated; down (−z) reds you out.
 */
export function loadRatio(aG: Vec3, p: PilotParams): number {
  const T = p.tolG;
  const rx = aG[0] / (aG[0] >= 0 ? T.fwd : T.back), ry = aG[1] / T.lat, rz = aG[2] / (aG[2] >= 0 ? T.up : T.down);
  return Math.max(Math.abs(rx), Math.abs(ry), Math.abs(rz));
}

/** One step. `aG` is the acceleration the pilot is actually feeling (0 while blacked out: the thrusters are cut). */
export function stepPilot(s: PilotState, aG: Vec3, p: PilotParams, dt: number): PilotState {
  const ratio = loadRatio(aG, p);
  let dose = s.dose + (ratio > 1 ? (ratio - 1) * p.kappa : -p.recoverPerS) * dt;
  dose = Math.min(p.blackDose, Math.max(0, dose));
  const blackout = s.blackout ? dose > p.clearDose : dose >= p.blackDose;
  const down = aG[2] < 0 ? Math.abs(aG[2]) / p.tolG.down : 0;
  const redShare = s.redShare + ((ratio > 0 && down >= ratio - 1e-9 ? 1 : 0) - s.redShare) * Math.min(1, 3 * dt);
  return { dose, blackout, redShare: ratio > 1 ? redShare : s.redShare };
}

const lerp = (x: number, x0: number, y0: number, x1: number, y1: number) => y0 + ((y1 - y0) * (Math.min(x1, Math.max(x0, x)) - x0)) / (x1 - x0);

/** What the pilot sees at this stress. The numbers are a first model, picked to match the measured grey/gone/dark times. */
export function vision(s: PilotState, p: PilotParams): Vision {
  const D = s.dose;
  const hud = D < p.greyDose ? lerp(D, 0.4, 1, p.greyDose, 0.8) : D < p.goneDose ? lerp(D, p.greyDose, 0.8, p.goneDose, 0.5) : lerp(D, p.goneDose, 0.5, p.blackDose, 0);
  const edge = lerp(D, 0.5, 0, p.goneDose, 0.85), centre = lerp(D, 0.9, 0, p.blackDose, 1);
  const red = Math.min(0.9, s.redShare * lerp(D, 0.3, 0, p.goneDose, 0.9));
  const state = s.blackout ? "blackout" : D >= p.goneDose ? "gone" : D >= p.greyDose ? "grey" : "ok";
  // While blacked out the HUD stays dark (measured: it reads 0 until vision returns), even as the stress drains under it.
  return { hud: s.blackout ? 0 : hud, edge: Math.max(edge, s.blackout ? 1 : 0), centre: s.blackout ? 1 : centre, red, state };
}
