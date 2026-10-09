// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Replays the flight-test speed traces (fixture releaseTraces, turnTraces, ...) through the core, for the acceptance
// tests and tools/fit-gladius.mjs. Test tooling: not exported from the package root.
import { DT, angularVelocity, boostActive, restState, step, turnVelocity, type FlightProfile, type Input, type State } from "@speedwall-lab/core";

/** Minimal shape of a fixture speed trace (see fixture-schema.ts `speedTrace`). */
export interface SpeedTrace {
  test: string;
  steps: { t: number; strafe_long?: number; strafe_lat?: number; strafe_vert?: number; pitch?: number; yaw?: number; roll?: number; boost?: boolean; brake?: boolean }[];
  samples: [number, number][];
}
export interface Row { t: number; measured: number; model: number }

/** The HUD shows a boost drop about this long after the command (fitted to the release traces: 0.35-0.4 s; the game's boost ramp-down is 0.3 s). Inputs register at once. */
export const HUD_LAG_S = 0.4;

const toInput = (s: SpeedTrace["steps"][number]): Input => ({
  fwd: s.brake ? 0 : s.strafe_long ?? 0,
  lat: s.strafe_lat ?? 0,
  up: s.strafe_vert ?? 0,
  boost: s.brake ? false : s.boost ?? false,
  pitch: s.pitch ?? 0,
  yaw: s.yaw ?? 0,
  roll: s.roll ?? 0,
});
const speed = (s: State) => Math.hypot(...s.vWorld);

export const traceEnd = (tr: SpeedTrace) => tr.steps.reduce((a, b) => a + b.t, 0);

/** Seconds after the inputs start at which boost first drops (Infinity if it never does). The spacebrake counts as a release. */
export function releaseTime(tr: SpeedTrace): number {
  let t = 0, was = false;
  for (const s of tr.steps) {
    const on = !!s.boost && !s.brake;
    if (was && !on) return t;
    was = was || on;
    t += s.t;
  }
  return Infinity;
}

/** Linear interpolation in the trace's samples. */
export function sampleAt(tr: SpeedTrace, t: number): number {
  const a = tr.samples;
  for (let i = 1; i < a.length; i++) if (t <= a[i]![0]) { const [t0, v0] = a[i - 1]!, [t1, v1] = a[i]!; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
  return a[a.length - 1]![1];
}

/** Run the trace's steps from rest, turning the velocity with the ship's rotation (as the page does). */
function runSteps(p: FlightProfile, tr: SpeedTrace, onStep?: (t: number, s: State) => State): { t: number[]; v: number[] } {
  let s = restState(), t = 0;
  const ts = [0], vs = [0];
  for (const seg of tr.steps) {
    const u = toInput(seg), n = Math.round(seg.t / DT);
    for (let i = 0; i < n; i++) {
      if (onStep) s = onStep(t, s);
      s = step(s, u, p, DT);
      s = { ...s, vWorld: turnVelocity(s.vWorld, angularVelocity(u, p, boostActive(s, u)), DT) };
      t += DT; ts.push(t); vs.push(speed(s));
    }
  }
  return { t: ts, v: vs };
}

/**
 * Boost release: the model flies the launch, then its speed is set to the HUD speed `HUD_LAG_S` after the release and
 * the bleed that follows is compared with the samples from then to the end of the steps. t = seconds after the release.
 */
export function releaseRows(p: FlightProfile, tr: SpeedTrace): Row[] {
  const t0 = releaseTime(tr), tStart = t0 + HUD_LAG_S, end = traceEnd(tr);
  let done = false;
  const { t, v } = runSteps(p, tr, (now, s) => {
    if (done || now < t0 - DT / 2) return s;
    done = true;
    const sp = speed(s), want = sampleAt(tr, tStart);
    return { ...s, vWorld: s.vWorld.map((x) => (x * want) / sp) as [number, number, number] };
  });
  const k0 = Math.round(t0 / DT);
  const out: Row[] = [];
  for (const [ts, measured] of tr.samples) {
    if (ts < tStart || ts > end) continue;
    const k = Math.min(t.length - 1, Math.max(k0, Math.round((ts - HUD_LAG_S) / DT)));
    out.push({ t: ts - t0, measured, model: v[k]! });
  }
  return out;
}

/** Turns and other manoeuvres: the model flies the whole trace from rest; rows run from the start of the second step to the end. */
export function turnRows(p: FlightProfile, tr: SpeedTrace): Row[] {
  const from = tr.steps[0]!.t, end = traceEnd(tr), t0 = releaseTime(tr);
  const { v } = runSteps(p, tr);
  const out: Row[] = [];
  for (const [ts, measured] of tr.samples) {
    if (ts < from || ts > end) continue;
    const lag = ts > t0 ? HUD_LAG_S : 0;
    out.push({ t: ts - from, measured, model: v[Math.min(v.length - 1, Math.max(0, Math.round((ts - lag) / DT)))]! });
  }
  return out;
}

/** Launch from rest (throttle traces): the whole trace. */
export function launchRows(p: FlightProfile, tr: SpeedTrace): Row[] {
  const end = traceEnd(tr), { v } = runSteps(p, tr);
  return tr.samples.filter(([t]) => t >= 0 && t <= end).map(([t, measured]) => ({ t, measured, model: v[Math.min(v.length - 1, Math.round(t / DT))]! }));
}
