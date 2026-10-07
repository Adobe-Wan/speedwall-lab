// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT AND CC-BY-4.0
//
// Wall and transient constants fitted to the measured traces in research/gladius-v1-fixture.json
// by tools/fit-gladius.mjs. Regenerate with `pnpm fit`; do not edit by hand.
import type { WallParams } from "@speedwall-lab/core";

export const FITTED_WALL: WallParams = {
  slewGps: 46.2,
  boostSide: { factor: 0.469, fromFwd: 354, toFwd: 354 },
  letOffBleed: { G: 5.15, side: 0.625, fromFwd: 0, toFwd: 520 },
  retroEaseK: 1.023,
  releaseK: 0.002275,
};
