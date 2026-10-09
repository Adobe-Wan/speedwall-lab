// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
// Zod schema for research/gladius-v1-fixture.json. Validation tooling only (ADR-003).
import { z } from "zod";

const num = z.number().finite();
const pair = z.tuple([num, num]);
const axisG = z.object({ fwd: num, back: num, lat: num, up: num, down: num });
const rotation = z.object({ pitch: num, yaw: num, roll: num });
const inputs = z
  .object({ fwd: num.optional(), lat: num.optional(), up: num.optional() })
  .strict();

const traceStep = z
  .object({
    t: num.positive(),
    strafe_long: num.optional(),
    strafe_lat: num.optional(),
    boost: z.boolean().optional(),
  })
  .strict();

const wallTrace = z.object({
  steps: z.array(traceStep).min(2),
  note: z.string(),
  /** [t after dodge input starts, HUD speed m/s, G meter] */
  samples: z.array(z.tuple([num, num, num])).min(2),
});

const traceStepAll = z
  .object({
    t: num.positive(),
    strafe_long: num.optional(),
    strafe_lat: num.optional(),
    strafe_vert: num.optional(),
    pitch: num.optional(),
    yaw: num.optional(),
    roll: num.optional(),
    boost: z.boolean().optional(),
    brake: z.boolean().optional(),
  })
  .strict();

/** A 2026-10-08 flight-test trace: samples = [t seconds after the inputs start, HUD speed m/s]. */
const speedTrace = z.object({
  test: z.string(),
  session: z.string(),
  steps: z.array(traceStepAll).min(1),
  samples: z.array(pair).min(2),
  note: z.string().optional(),
});
const traceGroup = z.object({ _note: z.string() }).catchall(speedTrace);

const glocRow = z.object({
  test: z.string(),
  session: z.string(),
  dir: z.enum(["up", "lat", "down"]),
  boosted: z.boolean(),
  forwardLaunch: z.boolean(),
  steps: z.array(traceStepAll).min(1),
  gPeak: num.nullable(),
  greyAt_s: num.nullable(),
  hudGoneAt_s: num.nullable(),
  dark50At_s: num.nullable(),
  redPeak: num.nullable(),
});

const glocRecoveryRow = z.object({
  test: z.string(),
  session: z.string(),
  dir: z.enum(["up", "lat", "down"]),
  boosted: z.boolean(),
  steps: z.array(traceStepAll).min(1),
  gPeak: num,
  hudOutAt_s: num,
  visionBackAt_s: num,
  greyAgainAt_s: num.nullable(),
});

export const fixtureSchema = z.object({
  ship: z.literal("Gladius"),
  patch: z.string(),
  mode: z.literal("DECOUPLED"),
  provenance: z.string(),
  constants: z.object({
    scm: z.object({
      speedCap_mps: num,
      egg: z.literal("sphere"),
      G: axisG,
      rotation_dps: rotation,
      G_provenance: z.string(),
      rotation_provenance: z.string(),
    }),
    boost: z.object({
      egg: z.literal("limacon"),
      F_mps: num,
      B_mps: num,
      A_mps: num,
      G: axisG,
      rotation_dps: rotation,
      softWallK_per_s: num,
      tankDrain_pct_per_s: num,
      tankRegen_pct_per_s: num,
      /** After the tank empties, boost stays off until it refills to this percentage (measured, r7_tank_cycle). */
      redZonePct: num,
      tank_provenance: z.string(),
      /** Boost released above SCM: the bleed never falls below this many G (measured, round 6). */
      releaseFloorG: num,
      releaseFloor_provenance: z.string(),
      /** How a stick vector longer than 1 is scaled (measured, round 11). */
      rotationCombination: z.enum(["unitLength", "independent"]),
      rotationCombination_provenance: z.string(),
      G_provenance: z.record(z.string(), z.string()),
      speedEgg_provenance: z.string(),
      rotation_provenance: z.string(),
    }),
    dimensions_m: z.object({ length: num, width: num, height: num }),
  }),
  thrustRule: z.object({
    name: z.literal("C2"),
    fullStrafeForwardCurve: z.object({
      points: z.array(pair).min(2),
      effectiveForwardG: z.array(pair).min(2),
    }),
  }),
  plateaus: z.array(
    z.object({
      id: z.string(),
      inputs,
      boost: z.boolean(),
      plateau_mps: num.nullable(),
      accel_G: num.nullable(),
      source: z.string(),
    }),
  ),
  wallTraces: z.record(z.string(), wallTrace),
  boostRelease: z.object({ note: z.string(), samples: z.array(z.tuple([num, num, num])).min(2) }),
  lateralRoom: z.object({ note: z.string(), boost: z.array(pair).min(2) }),
  releaseTraces: traceGroup,
  turnTraces: traceGroup,
  throttleTraces: traceGroup,
  redoutTraces: traceGroup,
  referenceManoeuvres: traceGroup,
  eggSettle: z.object({
    _note: z.string(),
    rows: z.array(z.object({ test: z.string(), headingDeg: num, settle_mps: num, limacon_mps: num, note: z.string().optional() })).min(1),
  }),
  rotationChecks: z.object({
    _note: z.string(),
    rows: z
      .array(z.object({ test: z.string(), stick: z.object({ pitch: num.optional(), yaw: num.optional(), roll: num.optional() }), measured_dps: num, boosted: z.boolean() }))
      .min(1),
  }),
  glocTrials: z.object({ _note: z.string(), rows: z.array(glocRow).min(1) }),
  glocRecovery: z.object({ _note: z.string(), rows: z.array(glocRecoveryRow).min(1) }),
  gloc: z.string(),
  invalid: z.record(z.string(), z.string()),
  forwardAxis: z.string(),
});

export type Fixture = z.infer<typeof fixtureSchema>;
export type FixturePlateau = Fixture["plateaus"][number];
export type FixtureWallTrace = z.infer<typeof wallTrace>;
export type FixtureSpeedTrace = z.infer<typeof speedTrace>;
export type FixtureGlocRow = z.infer<typeof glocRow>;
export type FixtureGlocRecoveryRow = z.infer<typeof glocRecoveryRow>;
