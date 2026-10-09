# Physics fit (phase P1)

The core model (`packages/core/src/physics.ts`) follows PLAN.md §4. Its wall and transient behaviour has six constants, fitted to `research/gladius-v1-fixture.json` by `tools/fit-gladius.mjs` (`pnpm fit`). Everything else is copied from the fixture.

## Acceptance: 189 of 222 checks pass

| Check (PLAN.md §4) | Result |
|---|---|
| Every plateau within 1 % or ±3 m/s | **30 / 30** |
| Acceleration within 5 % | **26 / 26** (peak G in the first 1.5 s; see note 1) |
| Lateral-room table exact | **20 / 20** |
| Boost release within ±15 m/s | **12 / 12** (with the fixture's 0.3 s HUD latency; see note 2) |
| Determinism | **2 / 2** |
| SCM wall traces, G within ±1 per sample | 61 / 75 |
| Boosted wall traces, G ±1.5 and speed ±10 per sample | 37 / 58 |

Notes:
1. The fixture's `accel_G` values are G-meter plateaus or speed-slope fits. In game the thrust ramps up: the G meter reads 7.3 of 9.9 G after 0.25 s. The P0 test read the first 1/240 s frame, so it now takes the peak over the first 1.5 s.
2. The fixture's `boostRelease` note says the HUD responds about 0.3 s after release. The test compares the model at t with the sample at t + 0.3 s.

## Fitted constants (Gladius)

| Constant | Value | What it does | Fitted to |
|---|---|---|---|
| `slewGps` | 46.2 G/s | Each thruster axis changes its output at most this fast | G-meter ramps; jink reversals (±9.9 G flips in ~0.5 s) |
| `boostSide.factor`, `fromFwd`/`toFwd` | 0.469 above 354 m/s forward | Boosted, at high forward speed: only this share of the thrust **perpendicular to your velocity** (the part that turns it) takes effect | `dd_wall_fwdlat_boost`: ~3–6 G of side push at the nose instead of 12.9 |
| `letOffBleed.G`, `side`, ramp | 5.15 G, side × 0.625, ramping in over 0–520 m/s forward | Boosted with the forward stick released: IFCS bleeds forward speed, and side thrust is reduced | `dd_wall_lat_boost`: 519 → 435 m/s |
| `retroEaseK` | 1.02 /s | In a dodge past 45° off the nose, the retros bleed forward speed at full rating, easing as it runs out | `dd_wall_lat`: G meter holds 4.2 (the back thrust) for ~2 s |
| `releaseK` | 0.002275 /m | Boost released above 225: deceleration = k·(speed − 225)² | `boostRelease`: 18.8 G falling to 6.9 G |
| `releaseFloorG` | 4.24 G (**assumed**) | …but never less than the SCM retro rating, until the speed is back at 225 | Not fitted. The trace ends at 393 m/s (1.4 s), and the quadratic alone would leave you at 246 m/s 20 s later. Round 6 measures the tail. |

Plus the measured soft-wall gain K = 1.3 /s (fixture).

## What still misses, and why

- **The release tail (below ~360 m/s) is assumed.** A pilot reported that after letting go of boost the speed stayed above SCM. The fitted quadratic matches the measured 1.4 s, but it fades to nothing near 225 (still 263 m/s after 10 s). The model now brakes at least at the SCM retro rating (4.24 G, measured), so it reaches 225 about 5 s after release from the nose. `tools/sc-flighttest/tests_round6.yaml` measures the real tail.

- **`dd_wall_fwdlat` (SCM, forward + strafe at the wall): 10 samples.** The G meter jumps between ~1 and ~5 G every ~1.75 s (2.0, 2.25, 3.75, 4.0, 6.0 s), and stays at 1–1.7 G after the model has settled. No smooth model reproduces that. It may be IFCS hunting, or OCR. A repeat run would tell.
- **`dd_wall_lat_boost` (boosted, forward released, strafe): 21 samples.** The model follows the speed dip (519 → 435) within 10 m/s for most of the run. It rises too fast after 6.5 s and reads 1.5–2.6 G low throughout.
- **Dodge start: 3 samples.** At 0.25 s the three dodge traces read 7.3, 8.4 and 9.1 G for nearly the same input. Some timing jitter; the model reads 9.8.
- **`dd_wall_lat` at 1.25 s.** A one-sample dip to 4.2 G between 9.5 and 8.4. Probably a misread.

## The egg's shape

The boosted egg stays a limaçon, r(θ) = 394 + 126·cosθ: nose 520, sides 394, tail 268. It is nearly round: 788 m/s long, 824 wide. The data supports that shape near the nose:

- **From rest, the velocity grows along the thrust until it hits the wall.** Round 3's full forward + 25 / 50 / 75 % strafe point the thrust 8.6° / 16.9° / 24.5° off the nose (from the measured 21.2 G and 12.9 G). They stopped at **518 / 514 / 508 m/s**; the limaçon gives 518.6 / 514.5 / 508.6. That puts 150 m/s of sideways speed at 492 forward. A narrow nose can't do that.
- **What *is* tight at the nose is the sideways room and the side push:**
  - room: 29 m/s at 519 forward, 91 at 510, 128 at 500;
  - side push: 3–6 G instead of 12.9 (fitted above).

**Open question (round 5).** In `dd_wall_fwdlat_boost` (pinned at the nose, then forward + strafe), the speed held 517–518 for 6 s. On the limaçon, that means the TVI stalled about 12–14° off the nose. The G meter's steady ~3 G says the velocity kept swinging: the fitted model reaches ~24° and 510 m/s by 7 s, inside the ±10 m/s tolerance but on the low side. `tools/sc-flighttest/tests_round5.yaml` settles it. It measures the egg's radius by heading (a slow yaw sweep with the speed bleeding to r(δ)) and repeats the nose slide for 13 s.

## Update 2026-10-09: rounds 4-11 merged

Source: `docs/HANDOFF-REPLY.md`, `docs/flight-model-findings.md`, `research/gladius-measurements-2026-10-08.json` (merged into the fixture with test IDs; raw data in `research/raw/2026-10-08/`).

**Now measured (were assumed):** `releaseFloorG` 4.26 G, boost red zone 25 %, tank drain 5.0 %/s and regen 3.75 %/s, boosted back 5.96 G and down 6.8 G (the spviewer values are gone), boosted up 12.99 G, SCM up 10.02 G, rotation rule (a diagonal stick is scaled to unit length).

**Changed in the model:**
- Release floor = the SCM thruster rating along the way the IFCS has to push (4.26 G nose-on, ~10 G after a 90 degree turn; `r10_turn90_release` is matched without being fitted). A held lateral stick scales it by `releaseSideFactor` 0.63 (fitted to `r6_release_fwd_lat` only).
- Past the egg (after a turn) the IFCS pulls back at `overspeedK` 1.15 /s, falling to half of that toward the tail (`overspeedTail` 0.5). Fitted to the five turn-to-egg traces (rms 5 m/s). The soft wall K 1.3 /s still applies below the egg.
- Rotation: `packages/core/src/rotation.ts`; the page uses it.
- HUD lag after a boost drop: 0.4 s in the replays (fitted; the game's ramp-down is 0.3 s).

**Acceptance now: 610 of 656 physics checks pass (46 miss; before this update 189 of 222, 33 miss).** The 33 old misses are unchanged (the wall traces above). The 13 new misses:
- `r10_turn90_boost_fwd` (turn with throttle held), 8 samples: the model dips to ~463, the game to 441, and recovers ~25 m/s too high.
- `r6_release_fwd_lat` 3 samples, `r10_flip_and_burn` 1 sample, `r9_vis_bst_f100_up_r50` (G-LOC model grey-out time) 1 sample.
- Not modelled: the boost ramp-up (0.6 s per the wiki API) makes the model reach ~410 m/s at 2.3 s where the game shows ~390; replays set the speed at the release, so only launch samples are affected and none is asserted.

**G-LOC (a MODEL).** Per-direction tolerance and a stress dose: stress rises at (G / tolerance - 1) per second above the tolerance, HUD grey at 1, gone at 1.8, blackout at 2.3, drains at 0.33/s. Up 8.1 G, lateral 6.6 G, down 3.85 G are fitted to `glocTrials`; forward 13.5 G and backward 8 G are each fitted to a single scenario (flip and burn; boost release). Not settled: how long recovery takes after a held lateral load (the model says ~4 s from the start of the blackout, because thrust is cut; the lateral tests show 4 s after the stick is released), the forward and backward tolerances, and the HUD-gone time for up (predicted ~2 s late). The page runs it in free flight only (off during lessons) and flags it "model".

**G-LOC review, 2026-10-09 (`tools/fit-gloc.mjs`, `--onset --fit`).** The dose model was scored against the measured HUD brightness over time (36 flown tests; the ones where the harness let go at a blackout are left out), not only against grey-out times. HUD rms error is 0.126 for the current model and about 0.09 to 0.10 for the best refits (linear or exponential recovery, with or without a low-pass filter on the felt G; the filter fits to a time constant near 0, so it does not help). The refits keep the tolerances close to the current ones (up 7.5-7.9, lateral 6.8-7.0, down 3.8-4.0), so the tolerances are not the main error. The structure is:
- **The dodge (`r7_dodge_mid_boost`) is overpredicted.** With a swinging G vector of 6 to 12 G the model reaches a blackout; the game only greyed the HUD to 0.77 and recovered at once. Dose accumulating from the instantaneous G overstates stress when the load reverses or comes in short pulses. A real game rule probably integrates something else (a signed, direction-specific load that can unwind, or a rate limit); the data cannot say which.
- **Recovery is a latch, not a decay.** Vision returns about 4 s after the load is released (`r10_rec_*`), whatever the depth of the greyout; the model drains at a fixed rate from wherever it got to.
- **Hold versus release.** Boosted down with the stick held came back 4 to 4.5 s after the blackout began; lateral tests came back 4 s after the stick was released. The model cannot do both.
- **Roll versus no roll** at the same G is not separable with the data so far.
Nothing was changed in `pilot.ts` or the core: a refit to this data would be a new set of numbers on the wrong structure. The app still flags it "model" and runs it in free flight only. `docs/ingame-test-scenarios.md` lists the tests that would settle the structure.
