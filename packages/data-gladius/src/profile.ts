// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import type { FlightProfile, ProvenanceEntry } from "@speedwall-lab/core";
import type { Fixture } from "./fixture-schema.js";
import { FITTED_WALL } from "./fitted.js";

const MEASURED = "Measured in-game by AdobeWan (sc-flighttest / hand tests)";

/**
 * Map the measured fixture onto the FlightProfile contract (PLAN.md §3).
 * Every number is copied from the fixture; nothing is invented. Fields whose
 * provenance the fixture does not state are labelled "assumed".
 */
export function profileFromFixture(f: Fixture): FlightProfile {
  const { scm, boost, dimensions_m } = f.constants;
  const curve = f.thrustRule.fullStrafeForwardCurve;

  const provenance: Record<string, ProvenanceEntry> = {};
  const set = (path: string, kind: ProvenanceEntry["kind"], source: string) => {
    provenance[path] = { kind, source };
  };

  for (const axis of ["fwd", "back", "lat", "up", "down"] as const) {
    set(`scm.G.${axis}`, "measured", scm.G_provenance);
    const text = boost.G_provenance[axis] ?? "";
    // Values taken from spviewer.eu are third-party data (NOTICE.md).
    set(
      `boost.G.${axis}`,
      /spviewer/i.test(text) ? "thirdParty" : "measured",
      text || "provenance not stated in fixture",
    );
  }
  set("scm.speedCap", "measured", MEASURED);
  set("scm.rotationDps", "measured", scm.rotation_provenance);
  for (const k of ["F", "B", "A"] as const) set(`boost.${k}`, "measured", boost.speedEgg_provenance);
  set("boost.rotationDps", "measured", boost.rotation_provenance);
  const unstated = "fixture gives the value but not how it was obtained (confirm in P1)";
  set("boost.softWallK", "assumed", unstated);
  set("boost.tankDrainPctPerS", "assumed", unstated);
  set("boost.tankRegenPctPerS", "assumed", unstated);
  set("thrustRule.fullStrafeForwardCurve.settledSpeed", "measured", "round 3 full-strafe sweep");
  set("thrustRule.fullStrafeForwardCurve.effectiveForwardG", "fitted", "derived from the settled speeds (limaçon inverse), per fixture note");
  const fit = "fitted to the fixture's wall and release traces by tools/fit-gladius.mjs";
  for (const k of ["slewGps", "boostSide", "letOffBleed", "retroEaseK", "releaseK"]) set(`wall.${k}`, "fitted", fit);
  set("lateralRoomTable", "fitted", "fixture lateralRoom.boost (limaçon cross-section, tabulated)");
  set("dimensionsM", "assumed", "author-specified 20 x 17 x 5.5 m (fixture dimensions_note)");

  return {
    schemaVersion: 1,
    id: "gladius",
    name: f.ship,
    dimensionsM: {
      length: dimensions_m.length,
      width: dimensions_m.width,
      height: dimensions_m.height,
    },
    scm: { speedCap: scm.speedCap_mps, G: { ...scm.G }, rotationDps: { ...scm.rotation_dps } },
    boost: {
      F: boost.F_mps,
      B: boost.B_mps,
      A: boost.A_mps,
      G: { ...boost.G },
      rotationDps: { ...boost.rotation_dps },
      softWallK: boost.softWallK_per_s,
      tankDrainPctPerS: boost.tankDrain_pct_per_s,
      tankRegenPctPerS: boost.tankRegen_pct_per_s,
    },
    thrustRule: {
      name: "c2",
      fullStrafeForwardCurve: {
        settledSpeed: curve.points.map(([a, b]) => [a, b]),
        effectiveForwardG: curve.effectiveForwardG.map(([a, b]) => [a, b]),
      },
    },
    lateralRoomTable: f.lateralRoom.boost.map(([a, b]) => [a, b]),
    wall: structuredClone(FITTED_WALL),
    provenance,
  };
}
