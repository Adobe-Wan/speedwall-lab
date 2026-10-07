// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT
// Zod is a devDependency: this module is validation tooling (CI, data build,
// host adapters that opt in), not part of the zero-dependency runtime. See ADR-003.
import { z } from "zod";

const num = z.number().finite();
const pair = z.tuple([num, num]);

const axisG = z.object({ fwd: num, back: num, lat: num, up: num, down: num }).strict();
const rotation = z.object({ pitch: num, yaw: num, roll: num }).strict();

export const provenanceEntrySchema = z
  .object({
    kind: z.enum(["measured", "fitted", "gameFile", "thirdParty", "assumed"]),
    source: z.string().min(1),
  })
  .strict();

export const flightProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1),
    dimensionsM: z.object({ length: num.positive(), width: num.positive(), height: num.positive() }).strict(),
    scm: z.object({ speedCap: num.positive(), G: axisG, rotationDps: rotation }).strict(),
    boost: z
      .object({
        F: num.positive(),
        B: num.positive(),
        A: num.positive(),
        G: axisG,
        rotationDps: rotation,
        softWallK: num.positive(),
        tankDrainPctPerS: num.nonnegative(),
        tankRegenPctPerS: num.nonnegative(),
      })
      .strict(),
    thrustRule: z
      .object({
        name: z.literal("c2"),
        fullStrafeForwardCurve: z
          .object({ settledSpeed: z.array(pair).min(2), effectiveForwardG: z.array(pair).min(2) })
          .strict(),
      })
      .strict(),
    provenance: z.record(z.string(), provenanceEntrySchema),
  })
  .strict()
  .superRefine((p, ctx) => {
    // Limaçon: r(0) = F = A + C and r(π) = B = A − C, so F + B = 2A.
    if (Math.abs(p.boost.F + p.boost.B - 2 * p.boost.A) > 2) {
      ctx.addIssue({ code: "custom", path: ["boost"], message: "F + B must equal 2A (limaçon, ±2 m/s)" });
    }
  });
