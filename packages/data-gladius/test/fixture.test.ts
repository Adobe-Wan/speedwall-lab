// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { flightProfileSchema } from "@speedwall-lab/core/schema";
import { fixtureSchema } from "@speedwall-lab/data-gladius/fixture-schema";
import { fixture, profile, rawFixture } from "./fixture.js";

/** Solve the limaçon cross-section: radius of the ring at forward speed x. */
function limaconRoom(x: number, A: number, C: number): number {
  // x(θ) = (A + C cosθ) cosθ is monotone decreasing on [0, π] for A > 2C.
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if ((A + C * Math.cos(mid)) * Math.cos(mid) > x) lo = mid;
    else hi = mid;
  }
  const th = (lo + hi) / 2;
  return (A + C * Math.cos(th)) * Math.sin(th);
}

describe("fixture import", () => {
  it("validates against the Zod schema", () => {
    expect(fixtureSchema.safeParse(rawFixture).success).toBe(true);
  });

  it("rejects a broken fixture", () => {
    const broken = structuredClone(rawFixture) as { constants: { boost: { F_mps: unknown } } };
    broken.constants.boost.F_mps = "520";
    expect(fixtureSchema.safeParse(broken).success).toBe(false);
  });

  it("has a measured value or a trace for every plateau entry", () => {
    expect(fixture.plateaus.length).toBeGreaterThanOrEqual(30);
    for (const pl of fixture.plateaus) expect(pl.plateau_mps !== null || pl.accel_G !== null).toBe(true);
  });
});

describe("FlightProfile from fixture", () => {
  it("validates against the FlightProfile schema", () => {
    expect(flightProfileSchema.parse(profile)).toEqual(profile);
  });

  it("copies the headline numbers unchanged", () => {
    expect(profile.scm.speedCap).toBe(225);
    expect(profile.boost).toMatchObject({ F: 520, B: 268, A: 394, softWallK: 1.3 });
    expect(profile.boost.G.fwd).toBe(21.2);
  });

  it("labels the spviewer values as thirdParty, and only those", () => {
    // NOTICE.md: these two must be replaced by round-4 measurements before the repo goes public.
    const third = Object.entries(profile.provenance)
      .filter(([, e]) => e.kind === "thirdParty")
      .map(([k]) => k)
      .sort();
    expect(third).toEqual(["boost.G.back", "boost.G.down"]);
  });

  it("gives every numeric group a provenance label", () => {
    for (const k of ["scm.G.fwd", "boost.F", "boost.G.lat", "boost.softWallK", "boost.rotationDps"]) {
      expect(profile.provenance[k]).toBeDefined();
    }
  });
});

describe("lateral-room table vs the limaçon", () => {
  const C = profile.boost.F - profile.boost.A;
  // Finding for P1: with A = 394, C = F − A = 126 the exact limaçon is up to 0.38 m/s
  // off the table (worst at 519 m/s, nearest the nose). The "lateral-room table exact"
  // acceptance test therefore compares against the table, not the formula.
  it("agrees with r(θ) = A + C·cosθ within 0.5 m/s at every tabulated point", () => {
    for (const [vFwd, room] of fixture.lateralRoom.boost) {
      expect(Math.abs(limaconRoom(vFwd, profile.boost.A, C) - room)).toBeLessThan(0.5);
    }
  });
});
