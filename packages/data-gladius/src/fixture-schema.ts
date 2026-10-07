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
});

export type Fixture = z.infer<typeof fixtureSchema>;
export type FixturePlateau = Fixture["plateaus"][number];
export type FixtureWallTrace = z.infer<typeof wallTrace>;
