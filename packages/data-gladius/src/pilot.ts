// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT AND CC-BY-4.0
//
// G-LOC model parameters (a MODEL, not a measured rule). Tolerances for up, lateral and down and the stress curve were
// fitted by hand to fixture glocTrials (time from the start of a constant side load to HUD grey-out: t = greyDose /
// (G / tolerance - 1)); see docs/physics-fit.md "G-LOC". Forward and backward tolerances are not mapped: see PILOT_PROVENANCE.
import type { PilotParams, ProvenanceEntry } from "@speedwall-lab/core";

export const FITTED_PILOT: PilotParams = {
  tolG: { up: 8.1, lat: 6.6, down: 3.85, fwd: 13.5, back: 8 },
  kappa: 1,
  greyDose: 1,
  goneDose: 1.8,
  blackDose: 2.3,
  clearDose: 1,
  recoverPerS: 0.33,
};

const rows = "fixture glocTrials (r9_vis_*, r10_g_*, r10_geq_*, r10_rec_*)";
export const PILOT_PROVENANCE: Record<string, ProvenanceEntry> = {
  "pilot.tolG.up": { kind: "fitted", source: `${rows}: no grey in 20 s up to 7.5 G, grey at 10 G in 4.2-4.4 s` },
  "pilot.tolG.lat": { kind: "fitted", source: `${rows}: no grey at 5 G; 7.5 G greys at 7.4 s, 10 G at 1.7-2.1 s` },
  "pilot.tolG.down": { kind: "fitted", source: `${rows}: no grey at 3.7 G; 5 G greys at 2.8-3.6 s (red-out); boost itself is not the cause` },
  "pilot.tolG.fwd": { kind: "fitted", source: "one scenario only, not mapped: a boosted launch from rest (~19 G for ~1.7 s) only dims the edge (r6_release_all: HUD 85 %), while ~21 G held ~4 s after a flip blacks out (r10_flip_and_burn, HUD gone at 10.7 s). The grey-outs in r9_vis_bst_* come from the side component of the capped launch thrust, not from forward G" },
  "pilot.tolG.back": { kind: "fitted", source: "one scenario only, not mapped: boost release from the nose (~12.9 G for ~1 s, then 4-8 G) only dims the HUD to 76-85 % (r6_release_*, r10_turn180_boost)" },
  "pilot.kappa": { kind: "fitted", source: "stress rate = (G / tolerance - 1) per second; one curve fits up, lateral and down within about a second" },
  "pilot.greyDose": { kind: "fitted", source: "HUD digits at 80 % (grey_at)" },
  "pilot.goneDose": { kind: "fitted", source: "HUD below 50 % (hud_black_at); up is the outlier (predicted ~2 s late)" },
  "pilot.blackDose": { kind: "fitted", source: "fully black ~4.4 s at 10 G lateral (r10_rec_*)" },
  "pilot.clearDose": { kind: "assumed", source: "thrust returns when vision does (boosted-down staircase, r11_boost_down_long)" },
  "pilot.recoverPerS": { kind: "fitted", source: "vision back ~4 s after the load stops; NOT SETTLED: lateral tests held the stick, and vision returned 4 s after the stick was released, while boosted down returned 4-4.5 s after the blackout began with the stick held" },
};
