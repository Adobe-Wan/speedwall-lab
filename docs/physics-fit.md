# Physics fit (phase P1)

The core model (`packages/core/src/physics.ts`) follows PLAN.md §4. Its wall and transient behaviour has six constants, fitted to `research/gladius-v1-fixture.json` by `tools/fit-gladius.mjs` (`pnpm fit`). Everything else is copied from the fixture.

## Acceptance: 197 of 230 checks pass

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

Plus the measured soft-wall gain K = 1.3 /s (fixture).

## What still misses, and why

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
