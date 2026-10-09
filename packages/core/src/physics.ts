// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Decoupled translation, PLAN.md §4. Pure and deterministic: the same inputs give bit-identical states.
// Ship frame: +x nose, +y right, +z up. In V1 the attitude is fixed, so world = ship.
import { eggRadiusAlong, interp, lateralRoom } from "./egg.js";
import type { AxisG, FlightProfile, Input, Readouts, State, Vec3 } from "./types.js";

/** Fixed physics timestep, seconds (PLAN.md §3). */
export const DT = 1 / 240;
export const G0 = 9.80665;

const hyp = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (x: number, from: number, to: number) => (to === from ? (x >= to ? 1 : 0) : clamp01((x - from) / (to - from)));

/** Boost is on while held, unless the tank is empty or still refilling through the red zone. */
export const boostActive = (s: State, u: Input) => u.boost && (!!u.unlimitedBoost || (!s.boostLocked && s.tank > 0));

/** Tank after one step: drains only while boost is actually on, otherwise refills; empty locks boost out until the red zone is passed. */
function nextTank(s: State, u: Input, p: FlightProfile, boosted: boolean, dt: number): { tank: number; boostLocked: boolean } {
  if (u.unlimitedBoost) return { tank: 100, boostLocked: false }; // trainer option: always a full tank
  const tank = Math.min(100, Math.max(0, s.tank + (boosted ? -p.boost.tankDrainPctPerS : p.boost.tankRegenPctPerS) * dt));
  const boostLocked = tank <= 0 ? true : s.boostLocked && tank < p.boost.redZonePct;
  return { tank, boostLocked };
}

/**
 * Requested thrust in G, ship frame (PLAN.md §4 items 1–3), and the C2 cap it is held to.
 * Per-axis G times stick; with a strafe stick at ≥ 0.95 that is at least the forward stick, the boosted
 * forward part follows the measured effectiveForwardG (reproduces the 455 m/s plateau for 40–60 % forward).
 * The cap |a| ≤ max|wᵢ| / max|uᵢ| uses the plain request (measured 15.67 G at 75 % forward + full strafe).
 */
export function requestG(u: Input, p: FlightProfile, boosted: boolean): { w: Vec3; cap: number } {
  const G: AxisG = boosted ? p.boost.G : p.scm.G;
  const w: Vec3 = [u.fwd * (u.fwd >= 0 ? G.fwd : G.back), u.lat * G.lat, u.up * (u.up >= 0 ? G.up : G.down)];
  const maxU = Math.max(Math.abs(u.fwd), Math.abs(u.lat), Math.abs(u.up));
  if (maxU < 1e-9) return { w: [0, 0, 0], cap: 0 };
  const cap = Math.max(Math.abs(w[0]), Math.abs(w[1]), Math.abs(w[2])) / maxU;
  const strafe = Math.max(Math.abs(u.lat), Math.abs(u.up));
  if (boosted && u.fwd > 0 && strafe >= 0.95 && strafe >= u.fwd) w[0] = interp(p.thrustRule.fullStrafeForwardCurve.effectiveForwardG, u.fwd);
  return { w, cap };
}

/** The requested acceleration with the C2 cap applied, m/s² (what you get away from any wall). */
export function capped(u: Input, p: FlightProfile, boosted: boolean): Vec3 {
  const { w, cap } = requestG(u, p, boosted), n = hyp(w), k = n > cap ? cap / n : 1;
  return [w[0] * k * G0, w[1] * k * G0, w[2] * k * G0];
}

/**
 * Keep each thruster bank within its G while holding the outward part at `limit`. If the most-violated
 * bank has to be clamped, the other axes are scaled back so the velocity still doesn't push outward.
 */
function bankLimit(a: Vec3, n: Vec3, limit: number, G: AxisG): Vec3 {
  const lo: Vec3 = [-G.back * G0, -G.lat * G0, -G.down * G0], hi: Vec3 = [G.fwd * G0, G.lat * G0, G.up * G0];
  let k = -1, worst = 0;
  for (let i = 0; i < 3; i++) {
    const over = a[i]! < lo[i]! ? lo[i]! - a[i]! : a[i]! > hi[i]! ? a[i]! - hi[i]! : 0;
    if (over > worst) { worst = over; k = i; }
  }
  if (k < 0) return a;
  const r: Vec3 = [...a];
  r[k] = Math.min(hi[k]!, Math.max(lo[k]!, r[k]!));
  let rest = 0;
  for (let i = 0; i < 3; i++) if (i !== k) rest += r[i]! * n[i]!;
  const need = limit - r[k]! * n[k]!;
  if (rest > need) {
    const f = rest > 1e-12 ? Math.max(0, need / rest) : 0;
    for (let i = 0; i < 3; i++) if (i !== k) r[i] = r[i]! * f;
  }
  return r;
}

/** The most acceleration (G) the thruster banks can give along unit direction `d`: each bank at its own rating. */
export function bankRating(G: AxisG, d: Vec3): number {
  const lim = (x: number, pos: number, neg: number) => (Math.abs(x) < 1e-9 ? Infinity : (x > 0 ? pos : neg) / Math.abs(x));
  return Math.min(lim(d[0], G.fwd, G.back), lim(d[1], G.lat, G.lat), lim(d[2], G.up, G.down));
}

/** Advance the simulation by one fixed step. Pure: returns a new state. */
export function step(s: State, u: Input, p: FlightProfile, dt: number = DT): State {
  const boosted = boostActive(s, u), W = p.wall;
  const v = s.vWorld, sp = hyp(v), scm = p.scm.speedCap;
  const { w, cap: capG } = requestG(u, p, boosted);
  let cap = capG * G0;
  const tgt: Vec3 = [w[0] * G0, w[1] * G0, w[2] * G0];
  if (boosted && u.fwd <= 0.05) {
    // Fitted: forward stick released at high boosted forward speed, IFCS bleeds forward speed with retro
    // thrust and the side thrust is reduced (wall trace dd_wall_lat_boost: 519 → 435 m/s at 6–7.5 G).
    const L = W.letOffBleed, k = ramp(v[0], L.fromFwd, L.toFwd);
    if (k > 0) {
      const side = 1 - (1 - L.side) * k;
      tgt[1] *= side; tgt[2] *= side;
      tgt[0] = Math.min(tgt[0], -L.G * G0 * k);
      cap = Math.max(cap * side, hyp(tgt));
    }
  }
  // Thrusters change their output at a limited rate, per axis (fitted: G-meter ramps and jink reversals).
  const maxStep = W.slewGps * G0 * dt;
  const cmd: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) cmd[i] = s.cmd[i]! + Math.max(-maxStep, Math.min(maxStep, tgt[i]! - s.cmd[i]!));

  let a: Vec3 = [...cmd];
  if (sp > 1e-9) {
    const n: Vec3 = [v[0] / sp, v[1] / sp, v[2] / sp];
    const releasing = !boosted && sp > scm + 0.5;
    const r = eggRadiusAlong(p, boosted, v);
    // PLAN.md §4.4, in order. (1) Trim the outward request: to 0 at the SCM sphere (you may reach it this
    // step, not pass it), to K·(r − |v|) at the boosted soft wall, to 0 while bleeding down after boost.
    // Past the egg (after a turn, say) the pull back onto it uses its own gain, weaker toward the tail (measured, rounds 10-11).
    const over = boosted && sp > r, kOver = W.overspeedK * (1 - (1 - W.overspeedTail) * Math.max(0, -n[0]));
    const limit = releasing ? 0 : boosted ? (over ? kOver : p.boost.softWallK) * (r - sp) : Math.max(0, r - sp) / dt;
    // The C2 cap limits what the pilot asks for, not the IFCS pulling the speed back onto the egg.
    if (over) cap = Math.max(cap, -limit);
    let along = a[0] * n[0] + a[1] * n[1] + a[2] * n[2];
    const atWall = along > limit;
    if (atWall) { a = [a[0] - (along - limit) * n[0], a[1] - (along - limit) * n[1], a[2] - (along - limit) * n[2]]; along = limit; }
    // Dodge past 45° off the nose: the retros keep bleeding forward speed at their full rating (easing as it
    // runs out), and the side thrust fills in just enough to hold the speed on the wall (dd_wall_lat:
    // the G meter holds ~4.2 G, the back thrust, until forward speed is gone).
    if (atWall && !releasing && cmd[0] <= 0 && v[0] > 0 && n[0] < Math.SQRT1_2) {
      const retro = Math.min((boosted ? p.boost.G.back : p.scm.G.back) * G0, W.retroEaseK * v[0]);
      const sideReq = Math.hypot(cmd[1], cmd[2]), sideNow = Math.hypot(a[1], a[2]);
      if (-a[0] < retro && sideReq > 1e-9 && sideNow > 1e-9) {
        const d1 = a[1] / sideNow, d2 = a[2] / sideNow, dn = d1 * n[1] + d2 * n[2];
        if (dn > 1e-9) {
          const mag = Math.min(sideReq, Math.max(0, (limit + retro * n[0]) / dn));
          a = [-retro, d1 * mag, d2 * mag];
          along = a[0] * n[0] + a[1] * n[1] + a[2] * n[2];
        }
      }
    }
    if (boosted) {
      // Fitted: at high boosted forward speed only part of the thrust that TURNS the velocity takes effect.
      // From rest the velocity grows along the thrust, so plateaus and initial G are untouched; at the nose the
      // velocity swings slowly (wall traces: 3–7.5 G of 12.9).
      const f = 1 - (1 - W.boostSide.factor) * ramp(v[0], W.boostSide.fromFwd, W.boostSide.toFwd);
      a = [along * n[0] + (a[0] - along * n[0]) * f, along * n[1] + (a[1] - along * n[1]) * f, along * n[2] + (a[2] - along * n[2]) * f];
    }
    // (2) the C2 cap
    const an = hyp(a);
    if (an > cap && an > 0) a = [(a[0] * cap) / an, (a[1] * cap) / an, (a[2] * cap) / an];
    // (3) what's left must be held by real thrust, bank by bank (e.g. retros bleeding forward speed in a dodge)
    if (atWall || releasing) a = bankLimit(a, n, Math.min(limit, a[0] * n[0] + a[1] * n[1] + a[2] * n[2]), boosted ? p.boost.G : p.scm.G);
    if (releasing) {
      // Boost released (or tank empty) above the SCM cap: IFCS bleeds the excess (fitted), never weaker than
      // the floor (measured, 4.26 G), and stops at the cap instead of overshooting below it.
      // The floor is the SCM thruster rating along the way the IFCS has to push: 4.26 G (the retros) with the nose on the
      // velocity, ~10 G after a 90° turn (the up thrusters: r10_turn90_release). A held side thrust shares the thrusters:
      // a full lateral stick lowers the floor (r6_release_fwd_lat: 2.2 G below 300 m/s instead of 4.26).
      const side = Math.min(1, Math.hypot(cmd[1], cmd[2]) / (p.scm.G.lat * G0));
      const floor = (W.releaseFloorG ?? 0) * (bankRating(p.scm.G, [-n[0], -n[1], -n[2]]) / p.scm.G.back) * G0 * (1 - (1 - (W.releaseSideFactor ?? 1)) * side);
      const dec = Math.min(Math.max(W.releaseK * (sp - scm) ** 2, floor), (sp - scm) / dt);
      a = [a[0] - dec * n[0], a[1] - dec * n[1], a[2] - dec * n[2]];
    }
  } else {
    const an = hyp(a);
    if (an > cap && an > 0) a = [(a[0] * cap) / an, (a[1] * cap) / an, (a[2] * cap) / an];
  }

  let vn: Vec3 = [v[0] + a[0] * dt, v[1] + a[1] * dt, v[2] + a[2] * dt];
  if (!boosted && sp <= scm + 0.5) {
    const sn = hyp(vn);
    if (sn > scm) vn = [(vn[0] * scm) / sn, (vn[1] * scm) / sn, (vn[2] * scm) / sn];
  }
  const applied: Vec3 = [(vn[0] - v[0]) / dt, (vn[1] - v[1]) / dt, (vn[2] - v[2]) / dt];
  const { tank, boostLocked } = nextTank(s, u, p, boosted, dt);
  return {
    vWorld: vn,
    xWorld: [s.xWorld[0] + vn[0] * dt, s.xWorld[1] + vn[1] * dt, s.xWorld[2] + vn[2] * dt],
    q: s.q,
    tank,
    boostLocked,
    t: s.t + dt,
    cmd,
    aWorld: applied,
  };
}

/** Everything the views show for a state and the held input. */
export function derive(s: State, u: Input, p: FlightProfile): Readouts {
  const boosted = boostActive(s, u);
  const v = s.vWorld, speed = hyp(v), r = eggRadiusAlong(p, boosted, v);
  const w = capped(u, p, boosted), wn = hyp(w);
  let settlePoint: Vec3 = [0, 0, 0], settleSpeed = 0;
  if (wn > 1e-9) {
    const dir: Vec3 = [w[0] / wn, w[1] / wn, w[2] / wn];
    settleSpeed = eggRadiusAlong(p, boosted, dir);
    settlePoint = [dir[0] * settleSpeed, dir[1] * settleSpeed, dir[2] * settleSpeed];
  }
  const dirShip: Vec3 = speed > 1e-9 ? [v[0] / speed, v[1] / speed, v[2] / speed] : [1, 0, 0];
  return {
    speed,
    vShip: { fwd: v[0], lat: v[1], up: v[2] },
    gNow: hyp(s.aWorld) / G0,
    pinned: speed > 5 && speed >= 0.985 * r,
    lateralRoom: lateralRoom(p, boosted, v[0]),
    settlePoint,
    settleSpeed,
    tvi: { dirShip, offAngleDeg: speed > 1e-9 ? (Math.acos(Math.max(-1, Math.min(1, dirShip[0]))) * 180) / Math.PI : 0 },
    tank: s.tank,
    boostLocked: s.boostLocked,
  };
}

/** A state at rest, attitude identity, full tank. */
export function restState(): State {
  return { vWorld: [0, 0, 0], xWorld: [0, 0, 0], q: [0, 0, 0, 1], tank: 100, boostLocked: false, t: 0, cmd: [0, 0, 0], aWorld: [0, 0, 0] };
}
