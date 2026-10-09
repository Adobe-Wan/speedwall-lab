# Coach review, 2026-10-09 (sc-flight-coach persona, Gladius, decoupled, game 4.x LIVE)

Scope: critical review of the numbers, the ten lessons and three coaching claims. Nothing in `site/`, `packages/`, `research/` or elsewhere was edited.
Labels: **M** measured (test ID), **F** fitted, **Mod** model/formula (computed, not flown), **A** assumed. General Star Citizen knowledge is tagged **GK**.
Method: read the listed docs, the fixture, the raw series/vision CSVs for the tests I cite, `tools/sc-flighttest/sctest/runner.py`, and ran the repo's own core (`packages/core/dist`, scratch scripts outside the repo) for the Mod rows. The wiki API was not reachable; only the values quoted in `flight-model-findings.md` section 3 were audited.

## 0. Headline findings

| # | Finding | Why it matters |
|---|---|---|
| 1 | **`r7_spacebrake_nose` never pressed the spacebrake.** `sctest/runner.py:206` builds the in-test pad as `{"boost": ..., "brake": False}`; `commands.csv` has no brake column; after the ship reached 224 m/s (t = 12.4 s) it sat at 224 m/s with the G meter at 0.0 to the end of the record (16.5 s), 2.7 s of that inside the 8 s "brake" step (7.15-15.15 s). The harness's own between-test braking (`brake_to_stop`) does stop the ship. So the test is a second release trace, not a brake trace. | "The spacebrake above SCM is no faster than letting go" is **unsupported**. It is stated in findings sec. 2 and 4, HANDOFF-REPLY sec. 1/3/6, PLAN 4.6, the fixture (`releaseTraces.spacebrake_at_boosted_nose`), the `let-go` lesson, a button caption (`index.html:356`) and the coach persona. The app's brake model is **A** (index.html:494). |
| 2 | The "measured" lateral-room table is the limacon cross-section (**Mod**), not a measurement; the "20/20 exact" test checks code against its own formula. | Coach persona and sec. 7 call it measured. |
| 3 | Widest sideways speed is about **409-412 m/s, not 394**. `sw_f10_l100` (414 total at 80.9 deg) and `sw_f25_l100` (441 at 68.1 deg) both have a sideways component of 409 m/s (**M**, by plateau x sin of thrust angle). | Lesson `rest` says 394 is "the widest point of the egg". |
| 4 | `r7_dodge_mid_boost` is in the raw data (session 133222) but not in the fixture, while the `dodge-mid` lesson says "not measured". The trace shows the side push at 290-380 m/s forward starting near 12 G and fading to about 8.5 G. | The 358 m/s step in `boostSide` is the only thing separating "dodge-nose" from "dodge-mid" and it has no merged test. |
| 5 | At the boosted nose, 10 s of sustained side load: up 5.9 G is clear after the launch; lateral 6.5 G keeps the HUD at 0.65-0.80 for about 10 s; down 3.8 G keeps it at 0.63-0.70 (`r9_vis_bst_f100_{up,lat,down}_r50`, n=1 each). | Best direct support for "strafe up". Not in any doc. |
| 6 | Corkscrew claim (b) is **not supported** and the existing corkscrew lessons target a shoot-back/target-ahead objective, not fleeing a tail-chaser (sec. 3). | |

## 1. Part 1: the numbers

### 1.1 Arithmetic: multipliers (API as quoted vs our ratios)

| Axis | Measured boost / SCM | Ratio | API | Gap | API x our SCM | Comment |
|---|---|---|---|---|---|---|
| fwd | 21.2 / 13.7 | 1.547 | 1.55 | -0.2 % | 21.23 | OK with the G-meter value. The three `sw_f100_*` speed slopes give 20.72 (ratio 1.512, -2.4 %): the 0.6 s boost ramp depresses slopes. |
| back | 5.96 / 4.24 | 1.406 | 1.40 | +0.4 % | 5.94 | OK |
| lateral | 12.9 / 9.95 | 1.297 | 1.30 | -0.3 % | 12.93 | OK |
| up | 12.99 / 10.02 | 1.296 | 1.30 | -0.3 % | 13.03 | OK |
| down | 6.8 / 4.97 | **1.368** | 1.35 | **+1.3 %** | 6.71 | Findings sec. 3 still prints "6.6/4.97 = 1.33" (the superseded spviewer value). Our 6.8 is a speed slope (6.77-6.79); the G meter read 6.7 (ratio 1.348, matches API). Forward uses the meter, down uses the slope: selective. Treat 6.7-6.8 as the honest range. |

Verdict: four of five multipliers agree within 0.4 %; down is the outlier and the only one where the method was chosen to give the higher number.

### 1.2 Other arithmetic checks

| Check | Result |
|---|---|
| Boost rotation x1.2 | 68 x 1.2 = 81.6 (M 81.6); 199.9 x 1.2 = 239.9 (M 240); 52.1 x 1.2 = 62.5 (M 62.7, +0.3 %). API integers 82/62/240 cannot resolve the 0.2 deg/s. RESEARCH.md still says 62.4 (line 332). |
| Limacon 394 + 126 cos | Nose 520, tail 268, mean = 394 exactly: the three measured anchors (519-520, 394, 267-268) are linear-consistent. Settle rows: 518/514/508 (8.6/16.9/24.5 deg, limacon 518.6/514.6/508.7), 394, 331, 301, 285, 268. Max error 1 m/s. Caveat: the first three headings are inferred from thrust direction (C2 + rule A), the 120/137/150 deg rows from "pitch rate x seconds" (rate assumed instant). A 5 deg heading error at 150 deg moves the limacon by 6 m/s, so the agreement is also evidence that the ramp-up is short. |
| Fwd G (C2) vs plateaus | thrust angle atan(12.99/21.2) = 31.5 deg -> limacon 501.4 (M 501, `r1_boost_fwd_up`); atan(6.8/21.2) = 17.8 deg -> 514.0 (M 514). Independent, good. |
| `effectiveForwardG` curve | "Derived: forward G that points thrust at the measured settle angle (limacon inverse)" - circular as a test of the limacon; only the end points and rule A predictions (442 vs 441) are independent. Also uses 12.9 lateral, not 12.99. |
| Release | 354 -> 228 m/s in 3.0 s (`r6_release_all`) = 4.28 G. Consistent with 4.26. But 4.26 vs the retro rating 4.24 is 0.5 %: "measured 4.26 replaces assumed 4.24" is false precision; they are the same number within OCR error (G meter shows 4.2). 519 -> 225 takes 5.3 s from the input (n=2 from the nose: `r6_release_all`, `_fwd_held`). The HUD lags 0.3 s (fixture) or 0.4 s (physics-fit replays): the two documents disagree, and the lag cannot be separated from the 0.3 s ramp-down. |
| Release names | `r6_release_450/350` really released at 440/338 (peaks 457/367): the fixture notes it; the test IDs mislead. |
| Flip arithmetic | 180 / 81.6 = 2.21 s; test flew 2.2 s (179.5 deg). 363 -> 63 m/s in 1.5 s = 20.4 G (rating 21.2, -4 %). Yaw 180/62.7 = 2.87 s. Roll 90 deg = 0.375 s. The 135/90/45 deg tables in findings sec. 4 recompute correctly. |
| `flip-burn` "down to ~17 m/s" | One 4 Hz sample (8.28 s). At 200 m/s^2 a sample is 50 m/s apart, so 17 is a sampling accident, and the HUD speed is a magnitude. |
| Tank | 1/20 = 5.0 %/s, 0.75/20 = 3.75 %/s. M 5.00 (about 40 tests) and 3.73-3.75. The 25 % re-engage: one test (`r7_tank_cycle`) + API threshold 0.25 (the unit is not stated in the quote). |
| Miss formula | a t^2 f(wt) reproduces RESEARCH: 5.4 G, 240 deg/s, 1 s -> 16 m; 29 deg/s -> 26 m; SCM 9.8 G, 200 deg/s -> 34 m. Fine as math. It assumes a velocity-only lead pip (**A**, untested). |
| Boosted side G vs rating | Corkscrew G-meter means at the nose: up 5.7-6.0, lateral 6.1-6.3, down 3.7-4.1 (r8/r9). Ratio to the boosted rating: 0.45, 0.48, **0.57**. A single 0.47 factor under-states down by about 20 %. The ratio also compares a G-meter total with a rating, not a velocity swing (see 1.5). |
| Constants | `boostSide` is 0.469 and "above 354 m/s" in findings/persona, 0.47 and a hard step at **358** in `fitted.ts`. Hard step = no ramp, fitted from one wall trace. |
| Wall-trace fit | physics-fit: boosted wall traces pass 37/58 (64 %). That is exactly the data behind `dodge-nose`, `letoff`, `ck-*`. Overall 610/656. |

### 1.3 Measurement quality

| Quantity | Value | Evidence | Quality / dependency |
|---|---|---|---|
| SCM G fwd/back/lat/down | 13.7 / 4.24 / 9.95 / 4.97 | round 1, speed slope, n=1 each; back also from `dd_wall_lat` 4.2 G and release tail | Fine (about 1 %). Up: 9.9 (r2) vs 10.02 (`r4_scm_up`): 1.2 % scatter between rounds. |
| Boost G | 21.2 / 5.96 / 12.9 / 12.99 / 6.8 | fwd: meter, many; lat: round 1, no test ID in provenance ("measured"); back, up: n=1 each | Good, within about 1 %. Lateral needs an ID. |
| Egg shape | limacon | 9 settle rows + 30 plateaus | **Strong.** Weak spots: down plateau by thrust is 391 (`hand_down`, "real asymmetry"), later called round (394 by turning). Three "hand" plateaus have no harness trace. |
| Release from nose | 5.2 s, 12 G then 4.26 G | n=2 plus `r10_turn90_release` | Good. HUD latency 0.3-0.4 s shifts times by about 6 %. |
| Release from 440 / 338 | 4.8 / 3.7 s | n=1 each | OK, small effect on lessons. |
| Release with strafe held | 7.6 s, 2.2 G | n=1; step list shows **forward AND lateral held** (`strafe_long` 1.0 + `strafe_lat` 1.0), lesson says "hold a strafe" | Thin; description incomplete. |
| Spacebrake | "no faster" | **invalid** (finding 1) | Nothing measured, above or below SCM. |
| Turn settles 90-150 deg | 394 / 331 / 301 / 285 | `r10_turn90_boost`, `r11_turn*`; 90 deg twice | Good; bleed rate is not one constant (fitted 1.15/s, half toward the tail). |
| Turn with throttle held | dips to 441, back to 483 | `r10_turn90_boost_fwd`, n=1 | Model misses it (463 dip, +25 m/s on recovery). Most realistic pilot case, worst fit. |
| Flip and burn | -300 m/s in 1.5 s | `r10_flip_and_burn`, n=1 | Good for the stop; see G-LOC below. |
| Rotation | 68/52.1/199.9, x1.2 | round 3 gauges n=1 each; linear partials | Good. Instant onset is assumed (angular accel not measured). |
| Diagonal stick | 62.6 / 74.8 | one test each, SCM and boosted | Both 3 % above the unit-length prediction (60.6 / 72.8), same sign: the rule is an approximation. Fastest-180 = pure pitch holds anyway (68 vs 62.6). |
| Boost tank | 5.0 / 3.75 %/s | about 40 tests | Best number in the repo. |
| G-LOC thresholds | up 8.1, lat 6.6, down 3.85 G (F) | brackets: up (7.5 ok, 10 grey 4.4 s), lat (5 ok, 7.5 grey 7.4 s, 10 grey 1.7-2.1 s x4), down (3.7 ok, 5 grey 3.4-3.6 s x4) | n=1 per level, all SCM, all with 100 % roll. Lateral bracket is 50 % wide. `dark50At` is scene-dependent (0.76 s for up 10 G while grey is at 4.4 s): do not use it. HANDOFF-REPLY says 8-9 / 6 / 4.2, physics-fit 8.1 / 6.6 / 3.85. |
| G-LOC forward / back | 13.5 / 8 G (F) | one scenario each (flip and burn; boost release) | The 8 G backward is an inequality ("did not black out at 12 G for 1 s"), not a fit. Forward is anchored by the ~20 G launches (grey 1.7-2.2 s, n=3) only. |
| Side push at the nose | 0.47 of rating | one wall trace + about 10 corkscrews | Mid-speed side push has no merged data (finding 4). |
| TVI angle, helix radius, omega | 13 deg -> 27 deg/s etc. | none; HUD TVI never captured | Pure Mod from a G-meter mean. The roll direction "does not matter" is Mod reasoning; RESEARCH.md line 180 says it does. |
| Miss distances | 16 / 27 m | Mod on an **A** lead pip | Every corkscrew lesson number. |
| Harness policy | `gloc: release` | `r7_onset_*`, `r4_boost_down` let go at blackout by design | Onsets stand; plateaus after the cut do not. Round 8 camera presses corrupt the HUD G (28.9). |

### 1.4 Internal contradictions (doc vs doc)

| Where | Says | Versus |
|---|---|---|
| findings sec. 3 | 6.6/4.97 = 1.33 | fixture 6.8 -> 1.37 |
| findings/persona vs fitted.ts | side cut above 354 m/s, 0.469 | 358 m/s, 0.47 |
| persona | "Sideways room (measured table)" | fixture: limacon-derived |
| `rest` lesson | 394 is the widest point | `lateralRoom`: 412 at 100 m/s; physics-fit "824 across" |
| fixture `corkscrewAtWall.note` | "V1 excludes rotation; kept for V2" | rotation is in the app |
| physics-fit sec. update | HUD lag 0.4 s (fitted) | fixture/physics-fit note 2: 0.3 s |
| RESEARCH line 180 vs 215 | roll direction matters / does not | neither tested |
| `ck-spin` lesson cites 5.4 G (round 2, 15 fps) | newer `r8_bst_f100_up_r100`: 513 m/s, 5.96 G | use the newer |
| `ck-escape` text | "spiral wide enough to spoil their lead" (radius a/w^2 = 13 m at 120 deg/s, less than the 20 m ship) | `ck-spin` text calls a 3 m radius the problem; RESEARCH says the miss comes from the lead error, not the helix size |
| HANDOFF-REPLY "140 tests" | findings "95 tests" | cosmetic |

### 1.5 API versus measurement versus nothing

| | Status |
|---|---|
| Speeds, rotation, multipliers, tank, ramps | API agrees (rounded integers); our numbers are finer. The 0.6 s up / 0.3 s down ramp is not tested separately from the HUD lag. |
| API thruster G (9.76 main, 22.05 manoeuvring) | Disagrees with every IFCS limit we measure: our per-direction G cannot be checked against the API. |
| No API value | per-direction IFCS G, egg shape, wall/bleed, rotation combination, G-LOC, the 0.47 factor, spacebrake. |
| API "angular boost cost 0" | **Not measured.** Lessons that boost through long rolls/flips assume it (tank drain is 5 %/s regardless of what you do, but only forward flight was checked). |

Unverified in the repo's own logic: the G meter is thrust (total), the corkscrew arithmetic needs the **velocity swing** a/w. At the nose speed barely changes, so the swing is invisible in `speed`. No test has measured it.

### 1.6 Weakest numbers, ranked by how much a lesson leans on them

| Rank | Number | Lessons / claims that lean on it | Single test that firms it up |
|---|---|---|---|
| 1 | Spacebrake decel (A) | `let-go`, `flip-burn`, claim (a), app brake model | Fix runner.py:206 (`brake: buttons.get("brake")`), brake from 225 SCM and from 400 boosted, boost key held and not held; read G. |
| 2 | Lead-pip rule (A) | every miss figure, `ck-*`, claim (b), (c) | Two-pilot hit count: 60 s of fire at a corkscrewing Gladius at 27 / 60 / 240 deg/s; or a shooter with an acceleration-aware pip. |
| 3 | Side push at 150-500 m/s forward (F step at 358) | `dodge-mid`, `dodge-nose`, `letoff`, `ck-*` | Merge `r7_dodge_mid_boost`; fly 5 dodges from 200/300/400/450/500 m/s, forward released vs held; log the velocity direction. |
| 4 | Real TVI offset and swing in a corkscrew | `ck-shoot` (13-15 deg), `ck-escape` | Screenshot ROI on the TVI marker at roll 27 vs 120 deg/s at the nose; compare angle with a/(w v). |
| 5 | G-LOC at the nose over 10 s, per axis, with forward load | `ck-escape` axis advice, claim (b) | Repeat `r9_vis_bst_f100_{up,lat,down}_r50` x3, 14 s, from 450 m/s instead of rest. |
| 6 | Forward/back G tolerance (F, 1 scenario) | `flip-burn`, claim (a) | Throttle-only forward at 10 / 14 / 18 G to grey, and boosted retro 6 G for 10 s. |
| 7 | Down boost G (6.7 vs 6.8) | minor | One more `r4_boost_down` with `gloc: hold`, read both slope and meter. |

## 2. Part 2: the ten lessons

Pilot-pedagogy check: each lesson starts from a standstill and runs 5-10 s of run-up first. For most lessons the run-up *is* the lesson (it hides the cost of the launch).

| Lesson | Claims | Data support | Model, not measured | Pedagogy and change |
|---|---|---|---|---|
| `rest` Strafe from a stop | Boost + strafe from rest gives 394 m/s, "the widest point of the egg" | 394: M (`hand_lat`, `r1_boost_up_left`) | Nothing, but "widest" is wrong: 409-412 (`sw_f10/f25_l100`) | Low value as is. Say "394 straight out; add 10 % forward and the sideways speed rises to 409 (measured)". Or drop it and open on `turn-cost`. |
| `dodge-nose` | At 520 side push is 3-6 G, 2 s dodge = about 90 m | G: M (`dd_wall_fwdlat_boost` 5.8 -> 3.1 G; lat-only 6.3-7.7 G includes retro bleed) | 90 m is Mod (my rerun: 92 m); the lesson holds forward + strafe, so it is the 3 G case | OK and labelled. Lumping "3-6" merges two regimes (forward held 3-4 G, released 6-7). Change: show both side by side. |
| `dodge-mid` | At 300 forward: full about 10 G, about 180 m, "twice the nose" | "Not measured" is wrong: raw `r7_dodge_mid_boost`: 12 G falling to 8.5 G over 2 s; implied lateral distance roughly 200 m (mean 10 G over 2 s; n=1, forward component not logged, HUD lag) | Model gives 165 m (my rerun) | Merge the trace into the fixture, cite it, and note the model is low. Pilot point is right: dodge from mid-egg, not the wall. |
| `letoff` Ease off | Releasing forward drops speed to 435 and opens the ring | 519 -> 435: M (`dd_wall_lat_boost`, n=1, model misses 1.5-2.6 G low) | Distance gained: my rerun gives 68 m in 2 s forward-released vs 92 m held, the **opposite** of the measured G (6.3-7.7 vs 3-5 G) | "Lowest speed" is the wrong readout: pilots want sideways distance/speed. Change the result to sideways m/s after 2 and 4 s; flag that the model under-pushes in this case. |
| `ck-escape` | Forward + up + roll 120 deg/s holds 513 m/s with about 5.9 G; launch grey at about 2 s, then clear | M: `r9_vis_bst_f100_up_r50` (513 m/s, 5.88 G, HUD 0.84 at 2 s, about 0.5 at 3.6 s, 1.0 after 5 s); `r8_bst_f100_up_*` 513 m/s at roll 25-100 % | Radius about 13 m, "wide enough to spoil their lead": Mod on **A** lead pip; n=1 for the grey timeline | See sec. 3(c): no chaser, starts from a standstill, "opening the range" is trivial against a non-boosting target. Roll 120 deg/s is near my model's optimum for 1 s flight time, so the number is right for a different reason than the text gives. |
| `ck-shoot` | Roll 27 deg/s, TVI "steady about 15 deg", miss 27 m vs 16 m | Roll 27: none (marked). 513-518 m/s: M | TVI angle, 27 m: Mod. My rerun: TVI 33 -> 29 -> 10 deg over 10 s, only near 10-12 deg after 10 s | "Steady from the first second" is not what the model shows. For a target ahead the logic holds; for fleeing it does not. Tell the pilot it takes about 10 s from a standstill to anchor. |
| `ck-spin` | Full roll throws away about 40 % of the miss, radius 3 m | 514 m/s, 5.4 G: M but old (use r8 5.96 G) | 40 % holds only for 1 s flight time (f 0.30 vs 0.49); at 0.5 s "barely matters" (RESEARCH). Lesson omits that | Add the flight-time condition. The pedagogy "slower is not always better" is useful; "spiral smaller than ship" is a red herring. |
| `turn-cost` | 520 -> 394 in about 4 s; free in SCM | **Strong:** `r10_turn90_boost`, `r11_turn90_pitchdown`, `r10_turn90_scm`, rows 120-150 | Bleed rate is fitted | Best lesson. But it teaches only the coasting case. With throttle held (`r10_turn90_boost_fwd`) you dip to 441 and recover to 483: the realistic pilot case, and the model's worst fit. Add it as a second run. |
| `flip-burn` | Flip 2.2 s, burn removes 300 m/s in 1.5 s | **Good:** `r10_flip_and_burn` (n=1) | "17 m/s" is a sampling artefact. G-LOC omitted: vision `hud_level` 0.98 -> 0.92 through the 1.8 s stop, but 0.52 at 3.1 s and 0.25 at 3.6 s of continued 20 G; a 0.78 dip already from the boosted run-up (3.1 s) | Add the comparison (the lesson has none): release + retro, boosted reverse, flip and burn, time to stop. Say "cut the throttle at zero". Replace "17" with "through zero". |
| `let-go` | 225 in 5.2 s; spacebrake no faster; strafe makes 7.6 s | M for 5.2 s and the 12 G -> 4.26 G shape; 7.6 s n=1 (with forward held too) | **Spacebrake clause: unsupported (finding 1)** | Delete the spacebrake sentence from the lesson and the caption (index.html:356) until re-flown. Teaching point stands: letting go is not instant. |

## 3. Part 3: three coaching claims

Shared inputs (all Gladius, decoupled): G ratings (M), flip times (Mod from M rates), `r10_flip_and_burn` (M, n=1), release (M).

### 3(a) "Skilled pilots never use the spacebrake; stopping by flipping and thrusting is more efficient"

**Verdict: right for stopping from high speed, wrong as "never", and not testable on the brake side with today's data.** "Skilled pilots never..." is **GK**, not checked here.

Time to stop from speed v, nose to target when you start (Mod unless M):

| v (m/s) | Retro only, boosted 5.96 G | Release then SCM retro | Flip + burn, SCM (2.65 s + v/13.7 G) | Flip + burn, boosted |
|---|---|---|---|---|
| 100 | 1.7 s | 2.4 s | 3.4 s | |
| 150 | 2.6 | 3.6 | 3.8 | |
| 225 | 3.8 | 5.4 | 4.3 | |
| 400 | 6.8 | about 4.3 (interpolated from M 3.7 s at 338, 4.8 s at 440) + 5.4 = about 9.7 s | | about 3.5-4 s (Mod) |
| 511 | 8.7 | about 10.6 s (M 5.3 s to 225 + Mod 5.4) | | **M about 4.1 s** (`r10_flip_and_burn`: 2.2 s flip, which sheds 511 -> 384 for free, then 363 -> about 0 in 1.8 s) |

- Break-even against SCM retro (4.24 G): flip wins above **about 160 m/s** (Mod). Against boosted retro (5.96 G): about 180 m/s. Below that, braking is quicker and you keep the nose on target.
- The 13.7 vs 4.24 G ratio is 3.2x (21.2 vs 5.96 is 3.6x) and measured. The boosted flip also costs about 130 m/s of speed for free (M, same test).
- **The conclusion hangs on the unmeasured brake.** Break-even speed = 2.65 / (1/a_brake - 1/a_fwd): a_brake 4.24 G -> 160 m/s; 6 G -> 277; 8.5 G -> 580 (flip never wins in SCM). If the spacebrake brings all banks to bear, the claim reverses. Today's evidence is a null test.
- **Aim:** the flip points your nose away for about 2.2-2.65 s, back through the target; spacebrake keeps the nose on it. If the goal is to stop and keep shooting, the brake wins. If the goal is to break away or reverse direction, the flip is the move.
- **G-LOC (F, one scenario):** flip and burn loads 20 G forward (eyeballs-in). In `r10_flip_and_burn` the stop phase (1.8 s) kept the HUD at 0.92 or better, but continued burn greyed it (0.52 at 3.1 s, 0.25 at 3.6 s). The test also ran a 3 s boosted launch first (HUD 0.78): carry-over, probably less in a real fight. Retro braking loads only 4-6 G backward, which is nowhere near the fitted 8 G. Forward/back tolerance is barely mapped (two fitted points).
- Efficiency in boost: flip + burn spends about 4-5 s of tank (20-25 %); SCM retro spends none. "More efficient" has to say in what.

What would change my mind: a valid brake trace with a_brake of 6 G or more from 225 and from 400; or a flip-and-burn where the HUD blacks out inside 1.8 s from a fresh start.

### 3(b) "A corkscrew to evade a chaser BEHIND works better with the TVI farther from the crosshair and less forward thrust, because it buys time for wingmen"

**Verdict: not supported by the repo's data or by the formulas. The objective differs from the duel table.** The RESEARCH duel table has the pilot nose-on to a target AHEAD (closing 497-520 m/s, shoot-back constraint). When fleeing, the nose points away, the crosshair has no job, and the "keep the TVI near the crosshair" reason disappears.

What "farther TVI" does, on the limacon with 5.5 G of side push at the nose (Mod; a = 54 m/s^2, v = r(delta)):

| TVI delta | Speed r(delta) | Away speed v cos(delta) | Sideways v sin(delta) | Roll w = a/(v sin delta) | Helix radius a/w^2 | Miss, 1 s flight |
|---|---|---|---|---|---|---|
| 5 deg | 520 | 518 | 45 | 68 deg/s | 38 m | 25.9 m |
| 13 deg | 517 | 504 | 116 | 27 deg/s | 251 m | 26.8 m |
| 20 deg | 512 | 481 | 175 | 18 deg/s | 570 m | 26.9 m |
| 30 deg | 503 | 436 | 252 | 12 deg/s | 1170 m | 26.9 m |
| 45 deg | 483 | 342 | 342 | 9 deg/s | 2160 m | 26.9 m |

1. **Miss does not grow with delta.** f(wt) saturates at 0.5 for wt below about 1, so a velocity-only shooter's miss is about 0.5 a t^2 whatever the offset. The extra helix radius is irrelevant to a shooter who simply aims at where you are plus a lead.
2. **Range opened falls.** Away speed drops from 504 to 436 between 13 and 30 deg. Against a chaser also at 520, closing speed goes from 16 to 84 m/s: a 1 km gap lasts about 60 s at 13 deg and about 12 s at 30 deg. That is the opposite of buying time.
3. **Side acceleration is the real limiter, not the offset.** Above 358 m/s forward the side push is 0.47 of rating (F). A bigger sideways speed needs the same a for a longer time; the nose 3-6 G is the cap in all rows.
4. **Egg room:** at 436 forward the cross-section is about 250 m/s (Mod): the 252 m/s at 30 deg sits on the wall, and the IFCS pulls you in with the 1.15/s bleed. No margin.
5. **"Less forward thrust" (simulated with the app's core, fixed up strafe, steady state):** at roll 27 deg/s, fwd 100/75/50/25 % gives away speed 501/492/493/486 m/s (little change once you reach the wall; forward thrust at the wall is idle anyway, forward G about 0.2); at roll 10-20 deg/s it collapses (fwd 25 %: 191-343 m/s, 50 %: 249-400 m/s). The only measured partial-forward data are static strafes: 25 % forward + full lateral settles at 441 total, of which only **164 m/s is away** (`sw_f25_l100`; 50 % forward: 455 total, about 220 away; 100 %: 501 total, about 425 away; away = speed x cos of the thrust angle, Mod). No usable measurement of a **rolling** corkscrew at partial forward exists (`r8_bst_f25/f50_*` blacked out, plateaus 262-398 m/s with spreads of 12-165).
6. **The other side of "less forward":** keep forward speed under 358 m/s and the side push returns to about full (12.9-13 G: `r7_dodge_mid_boost`, `r8_bst_f25_up_r25` mean 10.7 G). Cost: you give away about 30 % of away speed, and 13 G sideways is above all three G-LOC thresholds. Dose model (F): up greys in about 1.7 s and blacks out in about 3.8 s; lateral and down faster. A blackout cuts thrust and boost (`r11_boost_down_long`, 224 m/s at 9.5 s), which is the worst outcome with a chaser behind.
7. **G-LOC by axis at the nose (M, n=1 each):** up 5.9 G clear after the launch; lateral 6.5 G sits at HUD 0.65-0.80 for about 10 s; down 3.8 G at 0.63-0.70 with edge darkness. So up > lateral > down holds, and a far-TVI/lateral corkscrew spends 5-10 s partially greyed.
8. **Roll rate implied:** 12-18 deg/s is slow enough that omega t < 0.3 at 1 s; a shooter whose pip includes acceleration would see an almost constant sideways acceleration over its flight time and lead it. The "farther" corkscrew is the *most* predictable one (**A**: unverified either way).

Better for fleeing (Mod, **A** lead): keep delta small and roll 40-100 deg/s, so w t is 0.7-1.7 at 1 s. App-core steady states: roll 60 deg/s gives away 516 m/s, miss 29 m (1 s) / 106 m (2 s); roll 27 gives 501 / 27 m / 105 m; roll 240 gives 520 / 18 m / 26 m. So moderate roll beats both extremes for flight time up to 2 s, and gains 15 m/s of range for free. Under an acceleration-aware shooter the answer changes: vary the roll rate and direction.

What would change my mind: a hit-count test (or a shooter log) showing a lower hit rate at 12-18 deg/s than at 60 deg/s against the same shooter; or evidence that a chaser pays a speed price to follow a lateral displacement of 250 m/s that exceeds the 68 m/s of away speed the corkscrew gives up.

### 3(c) Are `ck-escape`, `ck-shoot`, `ck-spin` optimised for evading fire from behind?

| Lesson | For evading from behind? |
|---|---|
| `ck-escape` | Closest. Boosted, forward + up (best G axis), roll 120 deg/s (Mod miss 26 m at 1 s vs 29 m best), away speed about 519 m/s. It is an **escape** in name only: no chaser, no range, no shot. From a standstill the first 4-5 s is the 21 G launch (grey at 2 s) and the spiral only exists after the speed arrives. "Opening the range on anyone not boosting" is trivially true and says nothing about a boosted chaser. |
| `ck-shoot` | Optimised for the target-ahead duel (TVI anchored at 13-15 deg, 27 deg/s). Away speed is lower (501 vs 516 at 60 deg/s). Not an evasion lesson. |
| `ck-spin` | A cautionary counter-example valid for 1 s flight time only. |

A better demonstration (describe, do not build here; another analyst owns the optimisation):
1. Start already boosted at 300-450 m/s with a chaser marker 800-1500 m behind, so the run-up and its 21 G are not the story.
2. Same ship, same chaser, five runs: straight, held strafe, TVI-anchored 27 deg/s, 60 deg/s, 240 deg/s. Readouts: range after 10 s, cumulative miss at 1 s and 2 s flight time, side G by axis against the G-LOC dose, HUD vignette.
3. Toggle the shooter's lead (velocity only / with acceleration), labelled **A** until the hit-count test is flown. If an accel-aware pip nullifies a constant roll, show the pilot varying the roll rate.
4. Teach "up, not lateral" with the r9 10 s data (up clear, lateral 0.7, down 0.65).
5. Tell the pilot the number that matters is the away speed the chaser still has to cover, not the helix size.

## 4. Priorities

### 4.1 Changes to lessons and docs (in order)

| # | Change | Where |
|---|---|---|
| 1 | Retract "spacebrake no faster" as evidence: rename `spacebrake_at_boosted_nose` to a second release trace, strike it from findings sec. 2/4, HANDOFF-REPLY, PLAN 4.6, the persona, `let-go` and the caption. Fix runner.py:206 and re-fly. | docs, site |
| 2 | Add a "what stops fastest" comparison to `flip-burn` (release + retro / boosted reverse / flip and burn / measured 4 s), plus the G-LOC cut-off warning. Mark the spacebrake row "not measured". | lesson |
| 3 | Add a **flee** lesson, replacing or beside `ck-escape`: start at speed, a chaser marker, away speed and miss readouts, the lead-pip toggle (A). | lesson |
| 4 | Merge `r7_dodge_mid_boost` into the fixture and fix `dodge-mid` ("not measured") and the 358 m/s step. Change `letoff` to show sideways metres. | fixture, lessons |
| 5 | Fix `rest` ("widest" -> 409-412 with a little forward), `ck-spin` (flight-time caveat; cite 5.96 G), `ck-shoot` (10 s to anchor), `ck-escape` (drop "wide enough"). | lessons |
| 6 | Add the throttle-held case to `turn-cost` (441 dip, 483 recovery). | lesson |
| 7 | Doc fixes: 1.33 -> 1.37, 354 vs 358, "measured" lateral table -> Mod, 0.3 vs 0.4 s lag, `corkscrewAtWall.note`, RESEARCH roll-direction line. | docs |

### 4.2 In-game tests to run next (Arena Commander, user present, never PU/PvP)

| # | Test | Settles |
|---|---|---|
| 1 | **Spacebrake** (after the harness fix): from 225 SCM and 150 SCM, from 400 boosted with boost held and released; read G and time to 0 | claim (a); `let-go`, `flip-burn`, app brake model |
| 2 | **Hit count**, two pilots: shooter fixed behind, target in an up corkscrew at 27 / 60 / 240 deg/s and a straight line, 60 s each | lead-pip rule (A); every miss figure; claim (b) |
| 3 | **TVI capture**: record the TVI marker position at the nose at roll 27 and 120 deg/s | TVI/helix model; `ck-shoot` |
| 4 | **Side push by forward speed**: strafe-only dodges from 200 / 300 / 400 / 450 / 500 m/s, forward released, 3 s each, also with forward held | the 358 m/s step; `dodge-mid`, `letoff` |
| 5 | **Flee corkscrew at speed**: start 450 m/s boosted, forward 100 / 75 / 50 %, roll 30 / 60 / 120 deg/s, up, 14 s, `gloc: hold` | claim (b); partial-forward data gap |
| 6 | **Forward/back G tolerance**: throttle-only to 10 / 14 / 18 G forward; boosted retro 6 G for 10 s; flip and burn x3 with a cold start | claim (a); forward fitted 13.5 and backward 8 G |
| 7 | **Angular boost cost** (API "0"): long boosted roll/pitch, watch the tank | API claim, flip-burn tank cost |
| 8 | One more `r4_boost_down` with `gloc: hold`: slope and meter | 6.7 vs 6.8 |
