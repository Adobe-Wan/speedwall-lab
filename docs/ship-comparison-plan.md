# Ship comparison plan: Arrow vs Gladius (docs only, 2026-10-11)

**Status: a plan, not data.** There is no Arrow measurement in this repository, and project rules forbid new third-party data (`CLAUDE.md`, `NOTICE.md`, `PLAN.md` §10). So nothing about the Arrow goes on the page, into the fixture or into `packages/core` until the tests in §3 have been flown. This document says which of Alex's claims each measurement could support, what to measure, what the comparison would then show, and what stays a gap. **No Arrow number appears here, not even as an example.** Every number below is a Gladius value from `research/gladius-v1-fixture.json` or plain arithmetic on it.

Labels follow `docs/ingame-test-scenarios.md`: **M** measured (test ID), **Mod** model (computed, not flown), **A** assumed, **GK** game knowledge, **Gap** needs something the project cannot do now.

## 0. The ask

Alex (2026-10-11): *"Eventually how your ship's accelerations and turn rates (pitch yaw roll) affect their combat style. For example, the Arrow is smaller, has half the shields, but can out-DPS the Gladius at range due to its smaller size (Gladius needs to be within 3-400 m to be accurate) but it can also 'rate' the Gladius to get above/below it when up close if the pilot understands movement."*

Standing rules for everything that follows:

1. Math and geometry over assumptions. Measured fixture values or named constants with a source; never an invented number.
2. The harness (`tools/sc-flighttest`) runs only in Arena Commander free flight, single pilot, Alex present, Decoupled, G-Safe Off, 4K, 100° FOV. Never the PU, never PvP.
3. Two-pilot tests are not available (Alex, 2026-10-09). Anything that needs one is a **Gap**, and nothing below depends on it.
4. Engagement range in examples is 500–600 m (Alex, 2026-10-09). Never 1 km.
5. Sources: Apprentice_One, Shadow Moses, Jonathan Winters; post-3.23 only, dated.

## 1. Claim table

Alex's example, split into atomic claims. **Now** = computable today from Gladius data alone (one side of the comparison). **Arrow (1P)** = computable after the single-pilot Arrow measurements in §2–§3. **Weapons** = needs weapon data the repo does not hold (damage, fire rate, spread, projectile speed per gun). **2P** = needs a two-pilot test (a Gap today).

| # | Claim | Now | Arrow (1P) | Weapons | 2P | What decides it |
|---|---|---|---|---|---|---|
| 1 | The Arrow is smaller than the Gladius | Gladius 20 × 17 × 5.5 m (fixture, author-specified) | Hull dimensions: §2.8 (method with a stated assumption, else Gap) | | | Width, length, height of each hull |
| 2 | Smaller is harder to hit | Gladius angular width = width ÷ range (geometry, §4.5) | Same formula once the Arrow's width exists | | **Hit rate** (`hit_radius`, `lead_hits` in `ingame-test-scenarios.md` §6.4) | Angular size is geometry. Whether a smaller angle means fewer hits depends on spread, pip behaviour and the shooter: not computable |
| 3 | The Arrow has half the shields | | | Shield HP per ship (ship systems data, not flight data; the harness reads only the flight HUD) | | **Gap**: no source the rules allow. Only a game-side readout Alex captures himself, if one exists, could fill it |
| 4 | The Arrow out-DPSes the Gladius at range | | | Damage, fire rate and spread per weapon and hardpoint | Hits landed at range | **Gap**: DPS on paper needs weapon data; DPS delivered needs hits (2P) |
| 5 | The Gladius needs to be within 300–400 m to be accurate | | | Spread and projectile speed of the Gladius guns | Hits by range | **Gap**, and it conflicts with the project's 500–600 m engagement range: see §5 |
| 6 | The Arrow out-turns the Gladius | Gladius pitch 68.0 / yaw 52.1 / roll 199.9 °/s SCM; 81.6 / 62.7 / 240.0 boosted (M, `rg_*`) | `arrow_rg_*` (rotation gauges, §3 block 1) | | | Per-axis rotation rate, per mode. A straight comparison of measured rates |
| 7 | The Arrow can "rate" the Gladius to get above or below it up close | Gladius `outrateRadius(v) = v / ω` and `orbitLimit(r)` (§4.3–4.4; Brief C1's `docs/engagement-math.md` once merged) | Same two formulas with the Arrow's pitch rate and forward G | | **Outcome** of a rate fight between two pilots | Geometry says which ship keeps its nose on a target crossing at speed *v* inside radius *r*. Whether a pilot wins that exchange is 2P |
| 8 | "If the pilot understands movement" | | | | | Not a measurable claim; it is the lesson's job (Brief C2) |
| 9 | Accelerations shape a ship's combat style | Gladius G per axis, SCM and boost (M, round 1, 4) | `arrow_scm_*`, `arrow_boost_*` (§3 blocks 2–3) | | | Per-axis G and plateau speeds. The comparison in §4.1–4.2 (egg shape, time to the wall, sideways room) is arithmetic on them |
| 10 | One ship closes or opens range faster than the other | Gladius forward 13.7 G SCM / 21.2 G boost, plateaus 225 / 520 m/s (M) | Arrow forward G and plateaus | | | Closing speed = difference of the two ships' speeds along the line; `timeToRange` (C1) |
| 11 | One ship has more dodge room at the wall | Gladius sideways room: 394 m/s at rest, 128 at 500 forward, 29 at 519 (M, `lateralRoom`) | Arrow egg cross-section (§3 block 4) and wall traces (block 7) | | | Room at forward speed *v* (§4.1); side G at the wall (`dd_wall_*` pattern) |

Reading the table: rows 6, 7 (geometry half), 9, 10 and 11 are what one Arrow session buys. Rows 1 and 2 (geometry half) need the hull dimensions, which have a method but also an assumption to check. Rows 3, 4, 5 and the outcome halves of 2 and 7 stay Gaps; the page may describe them only as "not measured".

## 2. Measurement list for the Arrow

This mirrors the Gladius fixture field by field, with the Gladius test that produced each value, so the Arrow fixture (`research/arrow-v1-fixture.json`, a later PR) has the same shape and the comparison code needs no special cases. The test IDs are defined in `docs/ingame-test-scenarios.md` §12.

| Fixture field | Gladius source | Arrow test(s) | Notes |
|---|---|---|---|
| `constants.scm.speedCap_mps` and the SCM egg shape | round 1 (`scm_*`, plateau 225–226 on every axis: a sphere) | `arrow_scm_fwd/back/lat/up/down` | Equal plateaus on all five axes confirm a sphere; unequal ones mean the SCM egg is not a sphere and needs the §2.4 fit too |
| `constants.scm.G` (fwd, back, lat, up, down) | round 1 speed slopes; `r4_scm_up` | same five tests, speed slope from rest | `analyze` fits the slope; read both the slope and the HUD G meter |
| `constants.scm.rotation_dps` (pitch, yaw, roll) | round 3 `rg_pitch_100`, `rg_yaw_100`, `rg_roll_100` | `arrow_rg_pitch_100`, `arrow_rg_yaw_100`, `arrow_rg_roll_100` | Rotation gauge: a gentle 25 % strafe plus one rotation axis; the speed swings once per revolution (README "How rotation is measured") |
| `constants.boost.F_mps`, `B_mps`, `A_mps` | round 1 and hand tests (519–520, 267–268, 394) | `arrow_boost_fwd`, `arrow_boost_back`, `arrow_boost_lat`, `arrow_boost_up`, `arrow_boost_down` | Lateral, up and down give three side readings; the Gladius has a real down asymmetry (391 vs 394), so keep all three |
| `constants.boost.G` (fwd, back, lat, up, down) | round 1, round 4 (`r4_boost_back/down/up`) | same five tests | Read the slope between about 10 % and 70 % of the plateau, where the boost ramp and the soft wall are both out of the way |
| `constants.boost.rotation_dps` | round 3 `rg_*_boost` | `arrow_rg_pitch_100_boost`, `arrow_rg_yaw_100_boost`, `arrow_rg_roll_100_boost` | |
| `rollCurve` (is the stick linear?) | round 3 `rg_roll_010..100` | `arrow_rg_roll_050` | One midpoint is enough to confirm linearity; add 25 % if it is off |
| `rotationCombination` | round 11 `r11_rot_pitchyaw_fwd` | `arrow_rg_pitchyaw_100` | Full pitch + full yaw. Unit-length rule, independent axes or capped: `rotation.ts` already has all three |
| `thrustRule` and partial throttle | round 1 `scm_fwd_50`, `boost_fwd_50`; round 3 `sw_*` | `arrow_scm_fwd_50`, `arrow_boost_fwd_50`, `arrow_sw_*` (§2.4) | Is 50 % throttle 50 % thrust? Does boost scale it? |
| `constants.boost.egg` (limaçon or not) and `lateralRoom` | round 3 `sw_f*_l100` sweep (9 points) | `arrow_sw_f25_l100`, `arrow_sw_f50_l100`, `arrow_sw_f75_l100`, `arrow_sw_f100_l50`, `arrow_boost_fwd_up` | Four points in the horizontal plane and one in the vertical. If the limaçon `r(θ) = A + (F − A) cos θ` fits them within the Gladius's 1 %, the shape is settled with `B = 2A − F` as the check; if not, fly the full nine-point sweep in a second session |
| `tankDrain_pct_per_s`, `tankRegen_pct_per_s`, `redZonePct` | round 7 `r7_tank_cycle` | `arrow_tank_cycle` | Every boosted test also logs the AB column, so drain gets about 15 free cross-checks |
| `releaseTraces`, `releaseFloorG` | round 6 `r6_release_all`, `r6_release_fwd_held`, `r6_release_fwd_lat`, `r6_release_450/350` | `arrow_release_all`, `arrow_release_fwd_held`, `arrow_release_fwd_lat`, `arrow_release_mid` | The boost-release bleed and its floor. `arrow_release_mid` releases part-way up; its run-up time is set on the day from `arrow_boost_fwd`'s series (§3), not guessed |
| `wallTraces` (side push at the wall) | round 3 `dd_wall_lat`, `dd_wall_lat_boost` | `arrow_dd_wall_lat`, `arrow_dd_wall_lat_boost` | Supports row 11 of the claim table. P2: the egg and the Gs already give the room; this gives the measured G profile |
| `dimensions_m`, `dimensions_note` | author-specified (`dimensions_note`: matches spviewer; scunpacked lists 21 × 17.5 × 5.5) | `arrow_dim_*` (manual, §2.8) | See §2.8: a geometric method with one assumption, otherwise a Gap |
| `gloc` | rounds 7–10 | not planned | G-LOC is a pilot property, not a ship property, as far as the Gladius data shows (equal-G boosted and SCM pairs agree). Re-test only if the Arrow's Gs sit above the Gladius's tolerances, in which case the `g0*` tests of §4 apply with an `arrow_` prefix |

Not mirrored, on purpose: `corkscrewAtWall`, `turnTraces`, the round 8–12 evasion and brake material. Those are lesson-level questions; the comparison needs the profile first.

### 2.8 Hull dimensions without third-party data

The Gladius's 20 × 17 × 5.5 m is "author-specified" and matches spviewer, which is why the fixture carries a `dimensions_note`. For the Arrow there are three ways to get a width, length and height, none of them a fan site:

1. **CIG's own published figures** (the in-game vehicle information panel or the ship's RSI page). This is the game's own first-party data, not a fan database, but whether it counts as "third-party data" under the project's rule is **a question for Alex** (`NOTICE.md` names only spviewer today). If allowed, record it as `source: "CIG published spec, <date>"` with the same `dimensions_note` treatment as the Gladius.
2. **Geometry from the external camera, against the Gladius as the ruler.** In Arena Commander, with the same camera key, zoom and FOV: an external-view screenshot of the Gladius (known 20 × 17 m) and one of the Arrow, each parked, nose-on and side-on. Width = pixel span × 17 m ÷ Gladius pixel span. The **assumption** is that the external camera sits at the same distance from both ships. It is checkable: if the camera distance scales with the ship, both ships fill the same fraction of the frame and the ratio comes out near 1 whatever the hull, which would show as the Arrow reading the same width as the Gladius. Two screenshots per ship, no flight, pilot present. Label the result **M (ratio method)** with the assumption stated.
3. **Gap.** Keep `dimensions_m: null`, draw no Arrow glyph, and state "size not measured" wherever the comparison shows the ship. Row 1 and the geometry half of row 2 then wait.

The recommendation is 2 as the measurement, with 1 only if Alex rules it allowed, and 3 until either lands.

## 3. The test session, by count

The full test list with step lists is in `docs/ingame-test-scenarios.md` §12 (round A1). Counted by test, not by time, since the harness's per-test overhead (brake, flip, refill, about 30 s) is the same for any ship and the flight time depends on the Arrow's own numbers, which are the thing being measured.

| Block | Tests | Priority | Buys |
|---|---|---|---|
| 0. Setup (manual) | `calibrate` (the Arrow's HUD puts the digits elsewhere), `ocrcheck`, `fpscheck`, `dircheck`, `throttlecheck` | P0 | Nothing runs without it |
| 1. Rotation gauges | 8 | P0 | Claim rows 6 and 7; `turnaround_s` for the rest of the session (180 ÷ the measured pitch rate) |
| 2. SCM plateaus and G | 6 | P0 | Rows 9, 10, 11 (SCM half); the SCM egg |
| 3. Boost plateaus and G | 6 | P0 | Rows 9, 10, 11 (boost half); F, B, A of the egg |
| 4. Egg shape | 5 | P1 | `lateralRoom` for the Arrow; the side-by-side egg |
| 5. Tank | 1 | P1 | Drain, regen, red zone |
| 6. Boost release | 4 | P1 | The bleed and floor; the flee comparison |
| 7. Wall traces | 2 | P2 | Measured side G at the wall |
| 8. Dimensions (manual) | 4 screenshots (2 per ship) | P1 | Rows 1 and 2 (geometry) |
| **Automated total** | **32** | | |

**Session 1 is blocks 0–3 (20 automated tests).** That alone fills every "Arrow (1P)" cell in the claim table except row 11's egg shape. Round 3 flew 29 Gladius tests in about 25 minutes of harness time, so 20 is one sitting with margin. **Session 2 is blocks 4–8 (12 automated tests plus the screenshots).** Block 1 must run first within session 1, with `turnaround: false`, because the harness flips the ship between tests by holding full pitch for `turnaround_s` seconds, and that number is the Gladius's; after `arrow_rg_pitch_100` set `turnaround_s = 180 / measured rate` and turn the flip back on.

Things that change for a different ship, all in `tools/sc-flighttest/config.yaml` and the test file, none in the harness code:
- `roi`: re-run `calibrate`; the defaults are the Gladius cockpit.
- `turnaround_s`: as above.
- `expect:` on every Arrow test is **empty**. `analyze` prints Gladius model predictions next to the results; ignore that column for Arrow tests. There is no Arrow prediction to print.
- Step durations in the Arrow tests are the Gladius pattern's durations with margin, so a slower ship still reaches its plateau. They are harness inputs, not Arrow numbers; the plateau and slope are read from the series.

## 4. What the comparison would show, once measured

Formulas only. The Gladius column is arithmetic on the fixture (Mod); the Arrow column stays empty until §3 is flown. Everything here is already in `packages/core` or in Brief C1's `engage.ts`, so the comparison view is a second profile fed through the same functions, not new physics.

Symbols: `cap` SCM speed cap; `F`, `B`, `A` the boost egg's forward, backward and side speeds; `a_i = G_i × 9.80665` the acceleration on axis *i*; `ω` a rotation rate in rad/s; `w`, `l`, `h` hull width, length, height.

### 4.1 Egg shapes side by side

- SCM: a sphere of radius `cap`. Sideways room at forward speed *v*: `√(cap² − v²)`. Gladius: 202 m/s at 100 forward, 168 at 150, 103 at 200.
- Boost: the limaçon `r(θ) = A + (F − A) cos θ`, with `B = 2A − F` as the consistency check (Gladius: 394 + 126 cos θ, and 2 × 394 − 520 = 268 ✓). Sideways room at forward speed *v*: the egg's cross-section at *v* (`limaconRoom` in `egg.ts`). Gladius: 394 at rest, 293 at 400, 128 at 500, 29 at 519 (fixture `lateralRoom`).
- The side-by-side view draws both eggs in one velocity space at the same scale. A longer egg is a faster ship; a fatter one has more room at the same forward speed. The comparison is the two cross-section curves on one axis.

### 4.2 Time to the wall and the flee case

- Time from rest to the forward plateau, ignoring the soft wall: `t ≈ v_plateau / a_fwd`. Gladius: 1.7 s SCM, 2.5 s boosted (Mod; the measured trace takes about 6 s to the last metre per second because of the soft wall, fixture `releaseTraces`).
- Closing speed between the two ships along the line is the difference of their speeds along it; time to close from `r0` to `r1` is `(r0 − r1) / closing` (C1 `timeToRange`). With both ships at their boosted plateau the closing speed is `F_arrow − F_gladius`, sign and all. That one subtraction is the whole "who catches whom in a straight line" story.
- Wall-to-wall time on an axis (constant G, no roll): `2 × cap / a_axis`. Gladius SCM lateral: 4.6 s.

### 4.3 Orbit limit (the pole drill geometry)

Holding the nose on a point at radius *r* while moving tangentially at *v* needs rotation `v / r` and centripetal acceleration `v² / r` from forward thrust. So `vRotation = ω × r`, `vThrust = √(a_fwd × r)`, `vMax = min(vRotation, vThrust, mode cap)`, and `limitedBy` says which one bit (C1 `orbitLimit`).

| r | Gladius SCM, pitch | Gladius SCM, yaw | Gladius Boost, pitch | Gladius Boost, yaw | Arrow |
|---|---|---|---|---|---|
| 100 m | 116 m/s (thrust; rotation allows 119) | 91 m/s (rotation) | 142 m/s (rotation; thrust allows 144) | 109 m/s (rotation) | after `arrow_rg_*` and `arrow_*_fwd` |
| 200 m | 164 m/s (thrust) | 164 m/s (thrust; rotation allows 182) | 204 m/s (thrust) | 204 m/s (thrust; rotation allows 219) | |
| 300 m | 201 m/s (thrust) | 201 m/s (thrust) | 250 m/s (thrust) | 250 m/s (thrust) | |

The comparison reads directly: at each radius, the ship with the higher `vMax` can circle the other faster while keeping its nose on. Which limit bites (rotation at short range, thrust further out) is itself the lesson.

### 4.4 Outrate radius (rate fighting)

`outrateRadius(v) = v / ω`: inside this radius a target crossing at speed *v* outruns your nose on that axis. The ship with the higher `ω` has the smaller radius and keeps its nose on where the other cannot. Gladius, SCM pitch: 84 m at a crossing speed of 100 m/s, 126 m at 150, 190 m at 225. Boosted pitch: 70 / 105 / 158 m. The Arrow column is `v / ω_arrow` at the same three speeds. "Get above or below it up close" is the vertical (pitch) case of this radius; whether the pilot wins the exchange is the 2P gap of claim row 7.

### 4.5 Time to put the nose on a target

For a target `θ` off the nose: direct yaw `θ / ω_yaw`; roll `φ` then pitch `φ / ω_roll + θ / ω_pitch`; a diagonal stick by the unit-length rule in `rotation.ts` (C1 `timeToNose`).

| θ | Gladius SCM yaw | Gladius SCM pitch | Gladius SCM roll 90° then pitch | Gladius Boost yaw | Gladius Boost pitch | Gladius Boost roll 90° then pitch | Arrow |
|---|---|---|---|---|---|---|---|
| 30° | 0.58 s | 0.44 s | 0.89 s | 0.48 s | 0.37 s | 0.74 s | after `arrow_rg_*` |
| 60° | 1.15 s | 0.88 s | 1.33 s | 0.96 s | 0.74 s | 1.11 s | |
| 90° | 1.73 s | 1.32 s | 1.77 s | 1.44 s | 1.10 s | 1.48 s | |

For a one-off snap the yaw column beats roll-then-pitch at every angle shown; the case for pitch rests on sustained tracking (Apprentice_One, 2024-05-09, claims ESP "magnetizes" more easily in pitch; not modelled, cited as his claim). The Arrow column needs only its three rates.

### 4.6 Angular size (the geometry half of "smaller is harder to hit")

`α = 2 × atan(w / 2R)`, in practice `w / R` radians. Gladius width 17 m: 3.25° at 300 m, 2.43° at 400, 1.77° at 550, 1.62° at 600; height 5.5 m: 1.05° / 0.79° / 0.57° / 0.53°. The ratio of the two ships' angular widths equals the ratio of their widths at every range, so one number (`w_arrow / 17`) carries the whole comparison. This is as far as geometry goes; hit rate needs spread, pip behaviour and a second pilot (claim row 2).

### 4.7 What the comparison would not say

Shields, damage, DPS, accuracy, hit rate, pip behaviour, ESP, and the outcome of a rate fight. Each needs weapon data or a two-pilot test, both out of reach now. The comparison page states these as "not measured" rather than leaving them blank, so a new pilot does not read silence as "equal".

## 5. Open question on range (for Alex, not resolved here)

The project's engagement range is **500–600 m** with the Gladius and Panther repeaters (Alex, 2026-10-09), and every lesson and example uses it. The example at the top of this document says the **Gladius needs to be within 300–400 m to be accurate**. Both can be true (fights are joined at 500–600 m and a Gladius pilot then wants to close to 300–400 m), but that is a reading, not a measurement, and the two ranges lead to different lessons:

- If 500–600 m is where hits land, the lesson is "hold the range you have"; closing speed is distance management and claim row 10 is the one that matters.
- If 300–400 m is needed for hits, the lesson is "close 150–300 m first"; then `timeToRange` with the two ships' forward plateaus decides who gets to choose the range, and the Arrow's DPS-at-range claim (row 4) becomes the one to test.

Neither accuracy figure is measured; both would need the `proj_*` and `hit_radius` tests of `ingame-test-scenarios.md` §6.4, which are two-pilot. The question for Alex: **which range should lessons and examples use, and is the 300–400 m figure his own observation or a creator's claim (with date)?** Until answered, this document and the Arrow round keep 500–600 m.

## 6. After the data arrives

1. Unpack the session under `research/raw/`, read `summary.csv`.
2. Write `research/arrow-v1-fixture.json` with the same shape as the Gladius fixture, every value with its test ID and session, dimensions per §2.8 with their `dimensions_note`, licence CC BY 4.0, "Measured in-game by AdobeWan".
3. `packages/data-arrow` mirroring `packages/data-gladius`; `pnpm fit` against the new fixture; physics acceptance within the Gladius's 1 %.
4. Only then a comparison view, fed by §4's formulas, with every Gap labelled "not measured".
