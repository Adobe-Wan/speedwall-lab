// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import type { FlightProfile, Vec3 } from "./types.js";

/** Speed-egg radius (m/s) in the direction whose cosine with the nose is `cosNose`. */
export function eggRadius(p: FlightProfile, boosted: boolean, cosNose: number): number {
  if (!boosted) return p.scm.speedCap;
  const { A, F } = p.boost;
  return A + (F - A) * cosNose; // limaçon r(θ) = A + C·cosθ, C = F − A
}

/** Radius of the egg along the direction of `v` (nose radius for a zero vector). */
export function eggRadiusAlong(p: FlightProfile, boosted: boolean, v: Vec3): number {
  const s = Math.hypot(v[0], v[1], v[2]);
  return eggRadius(p, boosted, s > 1e-9 ? v[0] / s : 1);
}

/** Linear interpolation in a sorted [x, y] table, clamped at both ends. */
export function interp(table: readonly (readonly [number, number])[], x: number): number {
  const first = table[0]!, last = table[table.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!, [x0, y0] = table[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/** The limaçon's cross-section radius at forward speed `x` (bisection on θ ∈ [0, π]). */
export function limaconRoom(A: number, C: number, x: number): number {
  if (x >= A + C) return 0;
  if (x <= -(A - C)) return 0;
  let lo = 0, hi = Math.PI;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if ((A + C * Math.cos(mid)) * Math.cos(mid) > x) lo = mid; else hi = mid;
  }
  const th = (lo + hi) / 2;
  return (A + C * Math.cos(th)) * Math.sin(th);
}

/**
 * Sideways speed still available at forward speed `vFwd`: the egg's cross-section radius.
 * Boosted uses the measured table when the profile has one (it is the acceptance reference),
 * otherwise the limaçon. SCM: √(cap² − v²).
 */
export function lateralRoom(p: FlightProfile, boosted: boolean, vFwd: number): number {
  if (!boosted) return Math.sqrt(Math.max(0, p.scm.speedCap ** 2 - vFwd ** 2));
  const t = p.lateralRoomTable;
  if (t && vFwd >= t[0]![0] && vFwd <= t[t.length - 1]![0]) return interp(t, vFwd);
  return limaconRoom(p.boost.A, p.boost.F - p.boost.A, vFwd);
}
