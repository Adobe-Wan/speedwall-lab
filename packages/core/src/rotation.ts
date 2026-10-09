// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Rotation, PLAN.md §4.8. Linear per axis; a stick vector longer than 1 is scaled back to unit length (measured,
// round 11: pitch + yaw at full stick turns the nose at 62.6 °/s, slower than pitch alone, 68). Pure functions.
import type { FlightProfile, Input, Vec3 } from "./types.js";

export const RAD = Math.PI / 180;

/** The stick as (roll, pitch, yaw), each −1..1, scaled to unit length when the profile's rule says so. */
export function stickScaled(u: Pick<Input, "pitch" | "yaw" | "roll">, p: Pick<FlightProfile, "rotationRule">): Vec3 {
  const r = u.roll ?? 0, pi = u.pitch ?? 0, y = u.yaw ?? 0;
  const len = Math.hypot(r, pi, y);
  const k = p.rotationRule === "unitLength" && len > 1 ? 1 / len : 1;
  return [r * k, pi * k, y * k];
}

/**
 * Angular velocity in rad/s about the ship's axes, right-handed frame (+x nose, +y left, +z up):
 * roll right = +x, pitch up = −y, yaw right = −z.
 */
export function angularVelocity(u: Pick<Input, "pitch" | "yaw" | "roll">, p: FlightProfile, boosted: boolean): Vec3 {
  const R = boosted ? p.boost.rotationDps : p.scm.rotationDps;
  const [r, pi, y] = stickScaled(u, p);
  return [r * R.roll * RAD, -pi * R.pitch * RAD, -y * R.yaw * RAD];
}

/**
 * Turn a velocity (the core's ship-frame vector: +y right) as the ship rotates with `w` (from angularVelocity)
 * for `dt`: the velocity stays fixed in space, so in the ship frame it turns by −w·dt.
 */
export function turnVelocity(v: Vec3, w: Vec3, dt: number): Vec3 {
  const mag = Math.hypot(w[0], w[1], w[2]);
  if (mag < 1e-12) return v;
  const th = -mag * dt, k: Vec3 = [w[0] / mag, w[1] / mag, w[2] / mag];
  const a: Vec3 = [v[0], -v[1], v[2]]; // core +y is right; the rotation frame has +y left
  const c = Math.cos(th), s = Math.sin(th), d = k[0] * a[0] + k[1] * a[1] + k[2] * a[2];
  const cr: Vec3 = [k[1] * a[2] - k[2] * a[1], k[2] * a[0] - k[0] * a[2], k[0] * a[1] - k[1] * a[0]];
  const r: Vec3 = [a[0] * c + cr[0] * s + k[0] * d * (1 - c), a[1] * c + cr[1] * s + k[1] * d * (1 - c), a[2] * c + cr[2] * s + k[2] * d * (1 - c)];
  return [r[0], -r[1], r[2]];
}
