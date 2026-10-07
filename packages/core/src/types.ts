// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT

/** [x, y, z]; ship frame, +X = nose. In V1 the world frame equals the ship frame. */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

/** Each axis -1..1. Rotation axes arrive in V1.1 (P6). */
export interface Input {
  fwd: number;
  lat: number;
  up: number;
  boost: boolean;
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
  /** Seconds since the start of the run. */
  t: number;
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
  /** Key: dotted field path, e.g. "boost.G.back". Fields not listed are unlabelled. */
  provenance: Record<string, ProvenanceEntry>;
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
}
