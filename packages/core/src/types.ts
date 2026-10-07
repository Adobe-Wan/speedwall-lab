// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT

/** [x, y, z]; ship frame: +x = nose, +y = right, +z = up. In V1 the world frame equals the ship frame. */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

/** Each axis -1..1. Rotation axes arrive in V1.1 (P6). */
export interface Input {
  fwd: number;
  lat: number;
  up: number;
  boost: boolean;
  /** Trainer option: the boost tank never drains. */
  unlimitedBoost?: boolean;
  pitch?: number;
  yaw?: number;
  roll?: number;
}

export interface State {
  vWorld: Vec3;
  xWorld: Vec3;
  q: Quat;
  /** Boost tank, percent (0..100). */
  tank: number;
  /** The tank ran empty: boost stays off until it refills past the red zone. */
  boostLocked: boolean;
  /** Seconds since the start of the run. */
  t: number;
  /** Thrust command after the thrusters' slew limit, m/s², ship frame (before the speed wall trims it). */
  cmd: Vec3;
  /** Acceleration actually applied in the last step, m/s² (what the G meter shows). */
  aWorld: Vec3;
}

export type Provenance = "measured" | "fitted" | "gameFile" | "thirdParty" | "assumed";

export interface ProvenanceEntry {
  kind: Provenance;
  source: string;
}

export interface AxisG {
  fwd: number;
  back: number;
  lat: number;
  up: number;
  down: number;
}

export interface RotationDps {
  pitch: number;
  yaw: number;
  roll: number;
}

/** Versioned flight data for one ship. Schema: `@speedwall-lab/core/schema`. */
export interface FlightProfile {
  schemaVersion: 1;
  id: string;
  name: string;
  dimensionsM: { length: number; width: number; height: number };
  scm: {
    /** SCM speed cap, m/s (sphere radius). */
    speedCap: number;
    G: AxisG;
    rotationDps: RotationDps;
  };
  boost: {
    /** Limaçon r(θ) = A + C·cosθ, with C = F − A. Nose F, tail B = A − C. */
    F: number;
    B: number;
    A: number;
    G: AxisG;
    rotationDps: RotationDps;
    /** Soft-wall gain, s⁻¹. */
    softWallK: number;
    tankDrainPctPerS: number;
    tankRegenPctPerS: number;
    /** After the tank empties, boost is disabled until it refills to this percentage (the meter's red zone). */
    redZonePct: number;
  };
  thrustRule: {
    name: "c2";
    fullStrafeForwardCurve: {
      /** [forward fraction, settled speed m/s] */
      settledSpeed: [number, number][];
      /** [forward fraction, effective forward G] */
      effectiveForwardG: [number, number][];
    };
  };
  /** Boosted lateral room table, [forward m/s, sideways room m/s] (fixture lateralRoom.boost). */
  lateralRoomTable?: [number, number][];
  /** Wall and transient behaviour, fitted to the measured traces (PLAN.md §4, items 4–6). */
  wall: WallParams;
  /** Key: dotted field path, e.g. "boost.G.back". Fields not listed are unlabelled. */
  provenance: Record<string, ProvenanceEntry>;
}

export interface WallParams {
  /** How fast the thrust command can change, G per second (sets the G-meter ramps and jink dips). */
  slewGps: number;
  /** Boosted: multiplier on the thrust perpendicular to the velocity (what turns it), 1 at forward speed `fromFwd`, `factor` at `toFwd` and above. */
  boostSide: { factor: number; fromFwd: number; toFwd: number };
  /**
   * Boosted, forward stick released: retro bleed in G and a side-thrust multiplier, both ramping in from
   * forward speed `fromFwd` to `toFwd`.
   */
  letOffBleed: { G: number; side: number; fromFwd: number; toFwd: number };
  /** Retros easing off as forward speed runs out in a dodge: retro ≤ k · forward speed, 1/s. */
  retroEaseK: number;
  /** Boost released above the SCM cap: deceleration = k·(speed − SCM cap)², in 1/m. */
  releaseK: number;
}

export interface Readouts {
  speed: number;
  /** Velocity in the ship frame. */
  vShip: { fwd: number; lat: number; up: number };
  /** Magnitude of the current acceleration, in G. */
  gNow: number;
  pinned: boolean;
  /** Sideways speed still available at the current forward speed (egg cross-section radius), m/s. */
  lateralRoom: number;
  settlePoint: Vec3;
  settleSpeed: number;
  tvi: { dirShip: Vec3; offAngleDeg: number };
  tank: number;
  boostLocked: boolean;
}
