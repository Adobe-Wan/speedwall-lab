// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// A chaser shooting at you from behind, with a human on the stick. MODEL, every parameter ASSUMED (docs/aim-model.md).
//
// The game draws the lead pip from your current motion; the shooter has to hold the crosshair on it. That is a manual
// tracking task, and the classic description of a human doing one is the crossover model (McRuer & Jex 1967, "A Review of
// Quasi-Linear Pilot Models"): around the crossover frequency ωc the pilot plus the controlled thing behave like
// ωc·e^(−τe·s)/s, where τe is the pilot's effective delay. Aiming a fixed gun by turning the nose is a rate task (stick
// sets turn rate), so here the aim point moves at a rate set by the error the shooter saw τe ago. A skilled shooter also
// matches the pip's own drift (pursuit with rate feed-forward), so a target sliding at a steady speed is tracked without
// error; only changes in the pip's motion open a gap, and the gap closes at ωc.
//
// Everything is in the plane square to the line of sight, in metres at the target: the chaser sits directly behind on the
// target's starting line (+x), so the plane is (y right, z up). A shot fired at t lands at t + τ where it was aimed.
import { DT, boostActive, step } from "./physics.js";
import { angularVelocity, turnVelocity } from "./rotation.js";
import type { FlightProfile, Input, State, Vec3 } from "./types.js";

export type Vec2 = [number, number];

/** The target as the chaser sees it: one sample per physics step. */
export interface TargetSample {
  t: number;
  /** Position, velocity, acceleration across the line of sight (m, m/s, m/s²). */
  p: Vec2;
  v: Vec2;
  a: Vec2;
  /** The target's roll angle, rad (roll right positive): turns its cross-section. */
  roll: number;
  /** Flight time of a shot fired now, s. */
  tau: number;
  /** Range to the chaser, m. */
  range: number;
}

/** What the game's lead pip extrapolates: your velocity only (A) or velocity and acceleration (B). Not settled in game. */
export type LeadModel = "velocity" | "acceleration";

export interface Shooter {
  lead: LeadModel;
  /** Effective delay τe, s: what the shooter sees now steers the aim this much later. */
  react: number;
  /** Crossover frequency ωc, rad/s. Infinity = the "ideal" shooter of the alpha's readout (aims exactly at the pip it saw). */
  crossover: number;
  /** Match the pip's own drift (skilled shooter). Off: pure error-correcting (compensatory) tracking. Default on. */
  feedForward?: boolean;
}

/** The target's cross-section seen from behind, m: width along its wings, height along its up axis. */
export interface Hull {
  width: number;
  height: number;
}

/** The lead pip for a sample: where the target will be after the flight time if it keeps its motion. */
export function pip(s: TargetSample, lead: LeadModel): Vec2 {
  const k = lead === "acceleration" ? 0.5 * s.tau * s.tau : 0;
  return [s.p[0] + s.v[0] * s.tau + s.a[0] * k, s.p[1] + s.v[1] * s.tau + s.a[1] * k];
}

/**
 * Where the shooter's crosshair is at each sample. Starts settled on the pip (the shooter has been tracking a while).
 * Crossover tracker: da/dt(t) = ff·ṗ(t − τe) + ωc·(p − a)(t − τe). The "ideal" shooter (ωc = Infinity) aims at the target's
 * motion seen τe ago, extrapolated across τe plus the flight time: the alpha's readout since PR #3.
 */
export function aimTrack(samples: TargetSample[], sh: Shooter): Vec2[] {
  const n = samples.length;
  if (n === 0) return [];
  const dt = n > 1 ? samples[1]!.t - samples[0]!.t : DT;
  const lag = Math.max(0, Math.round(sh.react / dt));
  const at = (i: number) => samples[Math.max(0, Math.min(n - 1, i))]!;
  if (!Number.isFinite(sh.crossover)) {
    return samples.map((_, i) => {
      const s = at(i - lag), h = s.tau + sh.react, k = sh.lead === "acceleration" ? 0.5 * h * h : 0;
      return [s.p[0] + s.v[0] * h + s.a[0] * k, s.p[1] + s.v[1] * h + s.a[1] * k];
    });
  }
  const P = samples.map((s) => pip(s, sh.lead));
  const ff = sh.feedForward === false ? 0 : 1;
  const rate = (i: number): Vec2 => {
    const a = P[Math.max(0, Math.min(n - 2, i))]!, b = P[Math.max(1, Math.min(n - 1, i + 1))]!;
    return [(b[0] - a[0]) / dt, (b[1] - a[1]) / dt];
  };
  const out: Vec2[] = [[...P[0]!]];
  for (let i = 1; i < n; i++) {
    const j = i - 1 - lag, pj = P[Math.max(0, j)]!, aj = j >= 0 ? out[j]! : pj, r = rate(j);   // before the start: settled, same drift
    const prev = out[i - 1]!;
    out.push([prev[0] + dt * (ff * r[0]! + sh.crossover * (pj[0] - aj[0])), prev[1] + dt * (ff * r[1]! + sh.crossover * (pj[1] - aj[1]))]);
  }
  return out;
}

export interface AimScore {
  /** Share of shots that land inside the hull outline (0..1). */
  onTarget: number;
  /** Share inside a disc of `radius` m around the centre, the alpha's 8 m rule (0..1). */
  inRadius: number;
  /** Mean distance of the shots from the target's centre, m. */
  meanMiss: number;
  shots: number;
}

/**
 * Fire one shot per sample from `from` s on (while its impact still falls inside the run) and score where they land.
 * The hull is a rectangle turned with the target's roll at impact: a crude outline (the Gladius is a cross, not a slab),
 * so `onTarget` is an upper bound.
 */
export function scoreAim(samples: TargetSample[], aim: Vec2[], hull: Hull, opts: { from?: number; radius?: number } = {}): AimScore {
  const n = samples.length;
  if (n < 2) return { onTarget: 0, inRadius: 0, meanMiss: 0, shots: 0 };
  const dt = samples[1]!.t - samples[0]!.t, from = opts.from ?? 0, R = opts.radius ?? 8;
  let shots = 0, hit = 0, inR = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i]!;
    if (s.t < from) continue;
    const f = s.tau / dt, k = i + Math.floor(f), w = f - Math.floor(f);   // impact between samples k and k + 1
    if (k + 1 >= n) break;
    const t0 = samples[k]!, t1 = samples[k + 1]!, lerp = (x: number, y: number) => x + (y - x) * w;
    const a = aim[i]!, dy = a[0] - lerp(t0.p[0], t1.p[0]), dz = a[1] - lerp(t0.p[1], t1.p[1]), roll = lerp(t0.roll, t1.roll);
    const c = Math.cos(roll), sn = Math.sin(roll), by = dy * c - dz * sn, bz = dy * sn + dz * c;
    const d = Math.hypot(dy, dz);
    shots++; sum += d;
    if (Math.abs(by) <= hull.width / 2 && Math.abs(bz) <= hull.height / 2) hit++;
    if (d < R) inR++;
  }
  return shots ? { onTarget: hit / shots, inRadius: inR / shots, meanMiss: sum / shots, shots } : { onTarget: 0, inRadius: 0, meanMiss: 0, shots: 0 };
}

/** One step of a flight script, the alpha's lesson format: from `t` s on, hold these inputs. `roll` −1..1 (rf in the alpha). */
export type ScriptStep = [number, Partial<Input>];

export interface ChaseOpts {
  /** Target's start speed along the nose, m/s (boosted nose: 520). */
  startSpeed: number;
  /** Seconds to fly. */
  seconds: number;
  /** Chaser: start range (m), its speed along the target's start line (m/s), projectile speed (m/s, ASSUMED). */
  range: number;
  chaserSpeed: number;
  projectileSpeed: number;
}

const toWorld = (v: Vec3, phi: number): Vec2 => {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
};

/**
 * Fly a script with the core physics, the ship rolling as the stick says, and return what a chaser directly behind sees.
 * The chaser holds `chaserSpeed` along the start line: whatever speed the target gives up there is closing speed, and
 * the flight time is range / (projectile speed + closing), the alpha's rule (it assumes shots inherit the chaser's speed).
 */
export function chaseTrack(p: FlightProfile, script: ScriptStep[], o: ChaseOpts): TargetSample[] {
  let s: State = { vWorld: [o.startSpeed, 0, 0], xWorld: [0, 0, 0], q: [0, 0, 0, 1], tank: 100, boostLocked: false, t: 0, cmd: [0, 0, 0], aWorld: [0, 0, 0] };
  let phi = 0, y = 0, z = 0, range = o.range, k = 0;
  const out: TargetSample[] = [];
  const steps = Math.round(o.seconds / DT);
  for (let i = 0; i <= steps; i++) {
    const t = i * DT;
    while (k + 1 < script.length && script[k + 1]![0] <= t + 1e-9) k++;
    const u: Input = { fwd: 0, lat: 0, up: 0, boost: false, ...script[k]![1] };
    const vw = toWorld(s.vWorld, phi), aw = toWorld(s.aWorld, phi);
    const vx = s.vWorld[0], closing = o.chaserSpeed - vx;
    out.push({ t, p: [y, z], v: vw, a: aw, roll: phi, tau: range / (o.projectileSpeed + Math.max(0, closing)), range });
    if (i === steps) break;
    const boosted = boostActive(s, u);
    s = step(s, u, p, DT);
    const w = angularVelocity(u, p, boosted);
    phi += w[0] * DT;
    s = { ...s, vWorld: turnVelocity(s.vWorld, w, DT), aWorld: turnVelocity(s.aWorld, w, DT) };
    const nv = toWorld(s.vWorld, phi);
    y += nv[0] * DT; z += nv[1] * DT;
    range = Math.max(50, range - closing * DT);
  }
  return out;
}
