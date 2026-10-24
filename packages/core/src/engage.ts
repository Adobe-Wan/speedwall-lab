// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Engagement geometry: the math under the fighting-fundamentals lessons (closing speed, bullet flight time, time to
// put the nose on a target, and the orbit limits behind the pole drill and rate fighting). Pure, deterministic, SI
// units, zero dependencies. Every ship number comes from the FlightProfile (the measured fixture); the only other
// input is WEAPON, a named constant with its source. Nothing here says whether a shot hits: no hit rates, no PIP,
// no ESP, no shooter model (aim.ts is an *assumed* shooter model and is not used here).
import { G0, capped, step, restState } from "./physics.js";
import { eggRadius } from "./egg.js";
import { RAD } from "./rotation.js";
import type { FlightProfile, Input, State, Vec3 } from "./types.js";

/** "scm" uses the profile's SCM G and rotation rates; "boost" the boosted ones. */
export type FlightMode = "scm" | "boost";
/** Which turn axis a rate limit is read from. */
export type TurnAxis = "pitch" | "yaw";

/**
 * Projectile speed used for time of flight: the CF-337 Panther Repeater's ammunition speed from the Star Citizen Wiki
 * API (third-party data, CC BY-SA, listed in NOTICE.md), taken 2026-10-17 at Alex's request. Not measured in game.
 * Update here when the game patches or the Panther is measured.
 */
export const WEAPON = {
  projectileSpeed_mps: 1480,
  source: "Star Citizen Wiki API, CF-337 Panther Repeater (KLWE_LaserRepeater_S3), game build 4.10.2-LIVE.12881860, fetched 2026-10-17",
  status: "third-party data (CC BY-SA, NOTICE.md); not measured in game",
} as const;

/**
 * Sign convention for closing speed in this module: positive when the range is shrinking (closing), negative when
 * it grows. The in-game target box shows range then a bracketed rate, e.g. `166.9m [51m/s]`; Alex confirmed on
 * 2026-10-17 that the game's bracket is positive when closing, the same as this module.
 */
export const CLOSING_SIGN = {
  positive: "closing (range shrinking)",
  status: "matches the game's bracket: + when closing (confirmed in game, 2026-10-17)",
} as const;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hyp = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const rates = (p: FlightProfile, mode: FlightMode) => (mode === "boost" ? p.boost.rotationDps : p.scm.rotationDps);
const gees = (p: FlightProfile, mode: FlightMode) => (mode === "boost" ? p.boost.G : p.scm.G);

/**
 * Closing speed, m/s: the rate the range shrinks, `−d|r|/dt = −(r·v)/|r|`.
 * `relPos` = target − you (m), `relVel` = target velocity − your velocity (m/s), any common frame.
 * Positive = closing (see CLOSING_SIGN). Zero range returns 0 (the rate is undefined there).
 */
export function closingSpeed(relPos: Vec3, relVel: Vec3): number {
  const r = hyp(relPos);
  return r < 1e-9 ? 0 : -dot(relPos, relVel) / r;
}

/**
 * Time of flight, s: `range / (projectileSpeed + closing)`, under the ASSUMPTION that projectiles inherit the shooter's
 * velocity along the line of sight (Alex, 2026-10-11; still on the in-game test list). A projectile that never arrives
 * (`projectileSpeed + closing ≤ 0`) returns Infinity; a non-positive range returns 0.
 */
export function timeOfFlight(range: number, closing: number, projectileSpeed: number = WEAPON.projectileSpeed_mps): number {
  if (range <= 0) return 0;
  const v = projectileSpeed + closing;
  return v <= 0 ? Infinity : range / v;
}

/** Lead distance, m: how far a target moving across the line of sight at `crossingSpeed` (m/s) travels during `tof` (s). */
export function leadDistance(crossingSpeed: number, tof: number): number {
  return crossingSpeed * tof;
}

/**
 * Time, s, for the range to go from `r0` to `r1` at a constant closing speed (`(r0 − r1) / closing`).
 * Infinity when it never gets there (wrong sign, or zero closing); 0 when already there.
 */
export function timeToRange(r0: number, r1: number, closing: number): number {
  const d = r0 - r1;
  if (d === 0) return 0;
  if (closing === 0 || Math.sign(d) !== Math.sign(closing)) return Infinity;
  return d / closing;
}

export interface NoseTimes {
  /** Pitch and yaw blended (no roll) along the great circle to the target; pure yaw when `rollNeededDeg` = 90. */
  noRoll: number;
  /** Roll `rollNeededDeg` first, then pitch `offAngleDeg` (Apprentice_One's "track in pitch", 2024-05-09). */
  rollThenPitch: number;
  /** Roll and pitch held together on one stick (unit-length rule), simulated; see noseSim(). */
  diagonal: number;
  best: "noRoll" | "rollThenPitch" | "diagonal";
}

/**
 * Seconds to put the nose on a target `offAngleDeg` off the nose, when a roll of `rollNeededDeg` would bring it into
 * the pitch plane (0 = straight above or below, 90 = in the yaw plane). Rates in °/s from the profile (measured).
 *
 *   noRoll        = θ · √((cos φ / R_pitch)² + (sin φ / R_yaw)²)       (one fixed pitch+yaw stick, unit length)
 *   rollThenPitch = φ / R_roll + θ / R_pitch                            (sequential)
 *   diagonal      = simulated: roll toward the pitch plane and pitch toward the target at once, stick scaled to unit length
 *
 * Instant rate changes (no rotational inertia is modelled; the rotation gauges, round 3, show none at this scale).
 * Why Apprentice_One prefers pitch ("ESP magnetizes easier in pitch") is his claim and is not modelled here.
 */
export function timeToNose(p: FlightProfile, mode: FlightMode, offAngleDeg: number, rollNeededDeg: number): NoseTimes {
  const R = rates(p, mode), th = Math.abs(offAngleDeg), ph = Math.abs(rollNeededDeg) * RAD;
  const noRoll = th * Math.hypot(Math.cos(ph) / R.pitch, Math.sin(ph) / R.yaw);
  const rollThenPitch = Math.abs(rollNeededDeg) / R.roll + th / R.pitch;
  const diagonal = noseSim(p, mode, offAngleDeg, rollNeededDeg).t;
  let best: NoseTimes["best"] = "noRoll", bestT = noRoll;
  if (rollThenPitch < bestT) { best = "rollThenPitch"; bestT = rollThenPitch; }
  if (diagonal < bestT) best = "diagonal";
  return { noRoll, rollThenPitch, diagonal, best };
}

/**
 * The off-angle, °, beyond which rolling first then pitching beats a no-roll pitch+yaw blend, for a given roll need:
 * solve θ·c(φ) = φ/R_roll + θ/R_pitch, c(φ) = √((cos φ / R_pitch)² + (sin φ / R_yaw)²).
 * Infinity when the blend always wins (the usual case: roll time is never repaid inside 180°).
 */
export function noseCrossoverDeg(p: FlightProfile, mode: FlightMode, rollNeededDeg: number): number {
  const R = rates(p, mode), ph = Math.abs(rollNeededDeg) * RAD;
  const gain = Math.hypot(Math.cos(ph) / R.pitch, Math.sin(ph) / R.yaw) - 1 / R.pitch;
  if (gain <= 1e-12) return Infinity;
  const th = Math.abs(rollNeededDeg) / R.roll / gain;
  return th > 180 ? Infinity : th;
}

/** Rotate a space-fixed vector expressed in the body frame as the body turns at `w` (rad/s, body frame) for `dt`: v' = v − (w × v)·dt, exactly (Rodrigues). */
function turnBody(v: Vec3, w: Vec3, dt: number): Vec3 {
  const mag = hyp(w);
  if (mag < 1e-12) return v;
  const k: Vec3 = [w[0] / mag, w[1] / mag, w[2] / mag], th = -mag * dt, c = Math.cos(th), s = Math.sin(th), d = dot(k, v);
  const cr: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)];
}

/** Timestep for the nose and orbit simulations, s (matches physics DT). */
const NOSE_DT = 1 / 240;
/**
 * noseSim: the nose's turning radius on the sphere (pitch rate over roll rate) is kept under this fraction of the angle
 * still to go. A policy choice, not a measurement: 0.25 converged fastest over a 160-case grid (5–179° off, 15–150°
 * of roll, both modes); 1 lets the nose spiral around close targets for seconds.
 */
const DUBINS_K = 0.25;

/**
 * Simulated diagonal-stick snap: the target direction d in the body frame (+x nose, +y right, +z up) starts at
 * (cos θ, sin θ·sin φ, sin θ·cos φ). Each step the stick asks for the roll that brings d into the pitch plane and the
 * pitch that brings it onto the nose (weighted by cos(roll error) while the target is still out of the pitch plane),
 * both proportional near the end so nothing overshoots, scaled to unit length when the combined stick exceeds 1 (the
 * profile's rotationRule; "independent" skips the scaling). Returns the time to bring the target within `tolDeg` of the
 * nose and the steps used. Idealised geometry, not a pilot model; one policy among many a pilot could fly.
 */
export function noseSim(p: FlightProfile, mode: FlightMode, offAngleDeg: number, rollNeededDeg: number, tolDeg = 0.1): { t: number; steps: number } {
  const R = rates(p, mode), th = Math.abs(offAngleDeg) * RAD, ph = rollNeededDeg * RAD;
  let d: Vec3 = [Math.cos(th), Math.sin(th) * Math.sin(ph), Math.sin(th) * Math.cos(ph)];
  const tol = Math.cos(tolDeg * RAD), dt = NOSE_DT, maxSteps = Math.ceil(30 / dt);
  let n = 0;
  while (d[0] < tol && n < maxSteps) {
    // Roll angle (rad) that puts d in the pitch plane via the nearer pole: positive = roll right (+y goes down to −z).
    let rollErr = Math.atan2(d[1], d[2]);
    if (rollErr > Math.PI / 2) rollErr -= Math.PI; else if (rollErr < -Math.PI / 2) rollErr += Math.PI;
    // Pitch toward the target's elevation, weighted by cos(roll error) so the pitch does not flatten the elevation the
    // roll is still building (otherwise a target in the yaw plane is chased around the nose and never caught).
    const pitchErr = Math.atan2(d[2], d[0]) * Math.cos(rollErr); // positive = target above: pitch up
    const clamp = (x: number) => (x > 1 ? 1 : x < -1 ? -1 : x);
    let roll = clamp(rollErr / (R.roll * RAD * dt)), pitch = clamp(pitchErr / (R.pitch * RAD * dt));
    // Keep the nose's turning radius on the sphere (pitch rate / roll rate) inside the angle still to go, so the nose
    // never loops around a close target while the roll is still bringing it into the pitch plane.
    const remaining = Math.acos(Math.max(-1, Math.min(1, d[0]))), sinRoll = Math.abs(Math.sin(rollErr));
    if (sinRoll > 1e-6) {
      const cap = (DUBINS_K * remaining * R.roll * Math.abs(roll)) / (R.pitch * sinRoll);
      if (Math.abs(pitch) > cap) pitch = Math.sign(pitch) * cap;
    }
    const len = Math.hypot(roll, pitch);
    if (p.rotationRule === "unitLength" && len > 1) { roll /= len; pitch /= len; }
    // Body rates (rad/s) in the core frame: roll right = rotation about −x (right wing down); pitch up = about −y.
    const w: Vec3 = [-roll * R.roll * RAD, -pitch * R.pitch * RAD, 0];
    d = turnBody(d, w, dt);
    n++;
  }
  return { t: n * dt, steps: n };
}

export interface OrbitLimit {
  /** Tangential speed the turn rate allows while the nose stays on the centre, m/s: ω·r. */
  vRotation: number;
  /** Tangential speed the forward thrust can hold on the circle, m/s: √(a_fwd·r). */
  vThrust: number;
  /** The mode's speed limit for a velocity 90° off the nose, m/s (SCM sphere; boosted egg side, A). */
  vCap: number;
  vMax: number;
  limitedBy: "rotation" | "thrust" | "speedCap";
}

/**
 * Pole-drill geometry: holding the nose on a point at radius `r` (m) while moving tangentially at `v` needs a rotation
 * rate `v / r` and a centripetal acceleration `v² / r` from forward thrust (the nose points at the centre).
 *   vRotation = ω·r  (ω = the axis's measured rate)     vThrust = √(G_fwd · g0 · r)     vCap = egg radius at 90° off the nose
 * `axis` is the turn axis the orbit uses: "pitch" for a vertical circle (down/up strafe, Winters' binary circle), "yaw" for a flat one.
 */
export function orbitLimit(p: FlightProfile, mode: FlightMode, r: number, axis: TurnAxis): OrbitLimit {
  const R = rates(p, mode), G = gees(p, mode);
  const vRotation = R[axis] * RAD * Math.max(0, r);
  const vThrust = Math.sqrt(G.fwd * G0 * Math.max(0, r));
  const vCap = eggRadius(p, mode === "boost", 0);
  let vMax = vRotation, limitedBy: OrbitLimit["limitedBy"] = "rotation";
  if (vThrust < vMax) { vMax = vThrust; limitedBy = "thrust"; }
  if (vCap < vMax) { vMax = vCap; limitedBy = "speedCap"; }
  return { vRotation, vThrust, vCap, vMax, limitedBy };
}

/**
 * Forward stick (0..1) that balances a circle of radius `r` at tangential speed `v`: `v² / (r · G_fwd · g0)`, clipped to 1
 * (above that the forward thrust cannot hold the circle, see orbitLimit). The nose-on-target orbit is not self-correcting:
 * with a fixed stick a small speed error opens or tightens the circle, so this is the throttle to modulate around.
 */
export function orbitThrottle(p: FlightProfile, mode: FlightMode, r: number, v: number): number {
  if (r <= 0) return 1;
  return Math.min(1, (v * v) / (r * gees(p, mode).fwd * G0));
}

/**
 * Rate-fighting radius, m: `v / ω`. A target crossing your nose at `v` (m/s) closer than this outruns your turn on that
 * axis. The outcome of a rate fight between two pilots needs a two-pilot test (a gap); this is only the geometry.
 */
export function outrateRadius(p: FlightProfile, mode: FlightMode, v: number, axis: TurnAxis): number {
  return Math.abs(v) / (rates(p, mode)[axis] * RAD);
}

export interface OrbitSample {
  t: number;
  /** Ship position in the world frame, m; the target point is the origin. */
  x: Vec3;
  /** Range to the target, m. */
  r: number;
  speed: number;
  /** Closing speed toward the target, m/s (positive = closing). */
  closing: number;
  /** Angle between the nose and the target, °. */
  offAngleDeg: number;
}

export interface OrbitSimOptions {
  p: FlightProfile;
  mode: FlightMode;
  /** Starting range to the target, m (the nose starts on it). */
  r0: number;
  /** Held strafe/throttle, ship frame (fwd, lat, up each −1..1), e.g. Winters 2024-12-30: fwd 0.5, up −0.25. */
  inputs: Pick<Input, "fwd" | "lat" | "up">;
  seconds: number;
  /** Starting velocity in the ship frame, m/s (default rest). */
  v0?: Vec3;
  /** Path samples per second (default 10). */
  sampleHz?: number;
}

export interface OrbitSimResult {
  path: OrbitSample[];
  /** Means over the second half of the run (after the thrust ramp and any initial transient). */
  meanRadius: number;
  meanSpeed: number;
  meanClosing: number;
  final: OrbitSample;
  maxOffAngleDeg: number;
}

/**
 * Orbit simulation, the check on orbitLimit(): the core step() runs with the held inputs while an idealised nose rule
 * (geometry, not a pilot model) turns the nose toward the target at no more than the measured pitch/yaw rates, never
 * rolling, with the stick scaled to unit length. Boost uses an unlimited tank so the geometry is not cut short by the
 * tank. In the body frame the target and the velocity are space-fixed vectors, so both turn by −ω×v as the ship turns;
 * the world path is rebuilt from the attitude quaternion.
 */
export function orbitSim(o: OrbitSimOptions): OrbitSimResult {
  const { p, mode, r0, seconds } = o, boost = mode === "boost", R = rates(p, mode), dt = NOSE_DT;
  const u: Input = { fwd: o.inputs.fwd, lat: o.inputs.lat, up: o.inputs.up, boost, unlimitedBoost: boost };
  // Thrusters start at the held command (no slew ramp), so a run that starts on the analytic orbit stays on it.
  let s: State = { ...restState(), vWorld: o.v0 ? [...o.v0] : [0, 0, 0], cmd: capped(u, p, boost) };
  let rel: Vec3 = [r0, 0, 0]; // target relative to the ship, body frame
  let q: [number, number, number, number] = [0, 0, 0, 1]; // body → world (x, y, z, w)
  let x: Vec3 = [-r0, 0, 0];
  const every = Math.max(1, Math.round(1 / ((o.sampleHz ?? 10) * dt))), steps = Math.round(seconds / dt);
  const path: OrbitSample[] = [];
  let sumR = 0, sumV = 0, sumC = 0, nSum = 0, maxOff = 0;
  const sample = (t: number): OrbitSample => {
    const r = hyp(rel), speed = hyp(s.vWorld);
    const closing = closingSpeed(rel, [-s.vWorld[0], -s.vWorld[1], -s.vWorld[2]]);
    const offAngleDeg = r > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, rel[0] / r))) / RAD : 0;
    return { t, x: [...x], r, speed, closing, offAngleDeg };
  };
  path.push(sample(0));
  for (let i = 1; i <= steps; i++) {
    // Translate with the held inputs (core physics, attitude fixed within the step).
    s = step(s, u, p, dt);
    const v = s.vWorld;
    rel = [rel[0] - v[0] * dt, rel[1] - v[1] * dt, rel[2] - v[2] * dt];
    // Nose rule: turn toward the target about the axis nose × target, pitch and yaw only, each within its rate.
    const r = hyp(rel);
    if (r > 1e-9) {
      const d: Vec3 = [rel[0] / r, rel[1] / r, rel[2] / r];
      const ang = Math.acos(Math.max(-1, Math.min(1, d[0])));
      if (ang > 1e-9) {
        // Rotation axis for the shortest nose move, body frame: (1,0,0) × d = (0, −d_z, d_y), unit length.
        const sn = Math.sin(ang), ay = -d[2] / sn, az = d[1] / sn;
        // Rates about y and z with the unit-length stick: |ω_y| ≤ R.pitch, |ω_z| ≤ R.yaw, stick = (ω_y/R.pitch, ω_z/R.yaw).
        const k = 1 / Math.hypot(ay / (R.pitch * RAD), az / (R.yaw * RAD));
        const wMax = p.rotationRule === "unitLength" ? k : Math.min(ay !== 0 ? (R.pitch * RAD) / Math.abs(ay) : Infinity, az !== 0 ? (R.yaw * RAD) / Math.abs(az) : Infinity);
        const wMag = Math.min(wMax, ang / dt);
        // Turning the body by +wMag about (0, ay, az) moves the nose toward d, so space-fixed vectors turn by −w×v (turnBody).
        const w: Vec3 = [0, ay * wMag, az * wMag];
        rel = turnBody(rel, w, dt);
        s = { ...s, vWorld: turnBody(v, w, dt) }; // cmd and aWorld are body-fixed (thrusters), so they do not turn
        // Attitude: q ← q ⊗ exp(w·dt/2).
        const h = wMag * dt / 2, sh = Math.sin(h), dq: [number, number, number, number] = [0, ay * sh, az * sh, Math.cos(h)];
        const [qx, qy, qz, qw] = q, [dx, dy, dz, dw] = dq;
        q = [qw * dx + qx * dw + qy * dz - qz * dy, qw * dy - qx * dz + qy * dw + qz * dx, qw * dz + qx * dy - qy * dx + qz * dw, qw * dw - qx * dx - qy * dy - qz * dz];
      }
    }
    // World position: the target is the origin, so x = −(q · rel).
    const [qx, qy, qz, qw] = q;
    const rot = (v: Vec3): Vec3 => {
      const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]);
      return [v[0] + qw * tx + (qy * tz - qz * ty), v[1] + qw * ty + (qz * tx - qx * tz), v[2] + qw * tz + (qx * ty - qy * tx)];
    };
    const rw = rot(rel);
    x = [-rw[0], -rw[1], -rw[2]];
    const off = r > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, rel[0] / r))) / RAD : 0;
    if (off > maxOff) maxOff = off;
    if (i * 2 >= steps) { sumR += r; sumV += hyp(s.vWorld); sumC += closingSpeed(rel, [-s.vWorld[0], -s.vWorld[1], -s.vWorld[2]]); nSum++; }
    if (i % every === 0 || i === steps) path.push(sample(i * dt));
  }
  const final = path[path.length - 1]!;
  return { path, meanRadius: sumR / nSum, meanSpeed: sumV / nSum, meanClosing: sumC / nSum, final, maxOffAngleDeg: maxOff };
}
