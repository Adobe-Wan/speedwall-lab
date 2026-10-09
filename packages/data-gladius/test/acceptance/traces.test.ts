// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
// Acceptance: the 2026-10-08 flight-test traces (fixture releaseTraces, turnTraces, throttleTraces), the egg shape at
// every heading, and the rotation rule. Each sample is one check; a miss stays a visible failure (docs/physics-fit.md).
import { describe, expect, it } from "vitest";
import { angularVelocity, eggRadius } from "@speedwall-lab/core";
import { launchRows, releaseRows, turnRows, type Row, type SpeedTrace } from "@speedwall-lab/data-gladius/replay";
import { fixture, profile } from "../fixture.js";

const lazy = <T>(f: () => T) => { let v: T | undefined; return () => (v ??= f()); };
const entries = (g: Record<string, unknown>): [string, SpeedTrace][] => Object.entries(g).filter(([k]) => k !== "_note") as [string, SpeedTrace][];
/** Every second sample (0.5 s apart), like the wall traces' 0.25 s grid thinned; keeps the check count readable. */
const thin = (rows: Row[]) => rows.filter((_, i) => i % 2 === 0).map((r): [number, number, number] => [Math.round(r.t * 100) / 100, r.measured, r.model]);

function group(title: string, g: Record<string, unknown>, rowsOf: (tr: SpeedTrace) => Row[], tol: number) {
  describe(`${title}: speed within ±${tol} m/s per sample`, () => {
    describe.each(entries(g))("%s", (_k, tr) => {
      const rows = lazy(() => thin(rowsOf(tr)));
      const n = thin(rowsOf(tr)).length; // sample count is known without the model's result being needed to pass
      it.each(Array.from({ length: n }, (_, i): [number] => [i]))(`${tr.test}: sample %d`, (i) => {
        const [t, measured, model] = rows()[i]!;
        expect(Math.abs(model - measured), `t = ${t} s: measured ${measured}, model ${model.toFixed(0)}`).toBeLessThanOrEqual(tol);
      });
    });
  });
}

const run = (rowsOf: typeof releaseRows) => (tr: SpeedTrace) => rowsOf(profile, tr);
group("boost release (r6, r7)", fixture.releaseTraces, run(releaseRows), 10);
group("turn onto the egg (r10, r11)", Object.fromEntries(entries(fixture.turnTraces)), run(turnRows), 15);
group("throttle from rest (r10)", fixture.throttleTraces, run(launchRows), 10);

describe("the boosted egg is the limaçon at every measured heading (within 1.5 m/s)", () => {
  it.each(fixture.eggSettle.rows.map((r): [string, number, number] => [`${r.test} @ ${r.headingDeg}°`, r.headingDeg, r.settle_mps]))("%s", (_n, deg, settle) => {
    expect(Math.abs(eggRadius(profile, true, Math.cos((deg * Math.PI) / 180)) - settle)).toBeLessThanOrEqual(1.5);
  });
});

describe("rotation: the stick vector is scaled to unit length (nose rate within 5 % of measured)", () => {
  it.each(fixture.rotationChecks.rows.map((r): [string, (typeof fixture.rotationChecks.rows)[number]] => [r.test, r]))("%s", (_n, r) => {
    const w = angularVelocity(r.stick, profile, r.boosted);
    const nose = (Math.hypot(w[1], w[2]) * 180) / Math.PI; // pitch is about y, yaw about z
    expect(Math.abs(nose - r.measured_dps) / r.measured_dps).toBeLessThanOrEqual(0.05);
  });
});
