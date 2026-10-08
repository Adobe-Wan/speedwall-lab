# Flight model findings, 2026-10-08 (rounds 4–9) and what comes next

Hand-off for the Claude Code project. Ship: Gladius, decoupled, game version 4.x LIVE (Arena Commander). Raw data:
`research/raw/2026-10-08/` (two sessions, 95 tests, series + meta + vision + probe per test, no frames).
Everything below is **measured** unless marked *model* (computed from measured constants) or *hypothesis*.

## 1. Corrections that change how earlier data is read

- **The forward axis is the game's throttle, not a forward strafe.** This game version has no forward/backward strafe
  binding; vJoy Y is bound to *Throttle – Forward / Back*. While the axis is deflected it commands forward
  acceleration in proportion (0.5 → about 7 G, i.e. half the 13.7 G rating; `throttlecheck.log`). When the axis
  returns to centre the game **keeps a throttle setting**: after a 50 % test the ship sat at ~105 m/s and took off
  again whenever the spacebrake was released. A short tap back (−1.0 for 0.15 s) clears it. The harness now checks
  and clears it after every brake (`settle_throttle`).
  - Full-forward (100 %) and zero-forward results are unaffected.
  - The 25 % / 50 % forward results are "throttle at 25 / 50 %", and the setting a pilot leaves behind matters.
    Round 10 C pins down what the setting does.
- **Round 8's G-LOC numbers are noisy.** Pressing the camera key every second leaves the cockpit view (the only view with
  HUD digits and a vision baseline) up only part of the time; several rows have implausible plateaus (3–8 m/s) or
  G-meter means (28.9). Use round 8 for the camera-key verdict only (black checks: "key still works" vs "dead"), and
  round 9 for onset times and the vision gradient.

## 2. New measurements

| Quantity | Value | Source | Replaces |
|---|---|---|---|
| Boosted backward acceleration | **5.96 G** (plateau 268) | `r4_boost_back` | spviewer 5.9 |
| Boosted down acceleration | **6.6 G** (G meter 6.7) | `r4_boost_down` | spviewer 6.6 |
| Boosted up acceleration | 12.99 G (plateau 394) | `r4_boost_up` | confirms 12.9 |
| SCM up acceleration | 10.02 G (plateau 226) | `r4_scm_up` | confirms 9.9 |
| Boosted egg radius by heading | 408 m/s at the sweep's end heading; limaçon predicts 406 | `r5_yawsweep_left/right` | confirms r(θ) = 394 + 126 cos θ |
| Nose slide (forward + strafe at the boosted wall) | 519 → 506 m/s; "slide continues" predicted 501, "stalls" 515 | `r5_nose_slide_long` | settles physics-fit.md's open question: it keeps sliding, slower than the model |
| Boost release, from the nose (519) | 225 m/s after **5.2 s**; 12.6–13.0 G in the first second, then **4.26 G** from 300 to 235 | `r6_release_all`, `_fwd_held` | `releaseFloorG` 4.24 was *assumed*; now measured (4.26) |
| Boost release with a lateral strafe held | 7.6 s to 225; only 2.2 G below 300 | `r6_release_fwd_lat` | new |
| Boost release from 406 / 294 | 4.9 s / 3.8 s to 225 | `r6_release_450/350` | new |
| **Spacebrake at the boosted nose** | **identical to just releasing** (5.2 s to 225, 4.27 G tail) | `r7_spacebrake_nose` | new: the spacebrake does not stop you faster above SCM |
| Boost tank | drain 5.0 %/s, regen 3.75 %/s | round 7 | fixture still says 4.8 / 4.0 |
| Yaw at 15 % stick, boosted | 16.2 °/s, linear would be 9.4 | `r5_yawcal_15_boost` | **unexplained**; round 10 A re-measures low-stick yaw and pitch |

### Vision (round 9: cockpit view throughout, no camera presses)

Seconds from input start. *grey* = HUD digits down to 80 % brightness; *HUD gone* = below 50 %; *t50* = centre of the
screen half dark; *red* = peak red share above neutral (0 = none). G is the HUD G meter (late mean, or peak).

| Test | G | grey | HUD gone | t50 | edge t50 | centre t50 | red peak |
|---|---|---|---|---|---|---|---|
| SCM, full fwd + right + roll 100 % | 9.1 | 3.75 | 5.58 | 5.82 | 5.62 | 6.13 | 0.26 |
| SCM, full fwd + up + roll 100 % | 9.5 | 6.80 | 8.37 | 8.60 | 8.73 | 9.24 | 0.15 |
| SCM, full fwd + DOWN + roll 100 % | 4.9 | 5.43 | 9.35 | 5.77 | 5.67 | 7.72 | **0.89** |
| SCM, from rest, right + roll 50 % | 10 | 2.00 | 3.32 | 3.97 | — | 4.14 | 0.16 |
| SCM, from rest, up + roll 50 % | 10 | 4.20 | 5.87 | 6.39 | 6.11 | 6.61 | 0.22 |
| SCM, from rest, DOWN + roll 50 % | 5.0 | 2.76 | 4.86 | 3.00 | 5.64 | 3.60 | 0.49 |
| **Boosted**, full fwd + right + roll 50 % | 6.6 | **1.77** | 2.69 | 2.95 | 3.11 | — | 0.22 |
| **Boosted**, full fwd + up + roll 50 % | 5.9 | **2.21** | 3.32 | 2.71 | — | — | 0.11 |
| **Boosted**, full fwd + DOWN + roll 50 % | 3.8 | **1.68** | 2.25 | 2.29 | 2.10 | 2.61 | 0.43 |
| SCM, DOWN strafe held | 5.0 | 2.87 | — | 4.07 | 3.63 | 3.63 | 0.62 |
| Boosted, DOWN strafe held | 6.7 | 1.71 | 2.97 | 2.71 | 2.10 | 2.61 | 0.72 |

What it says:
- **Down strafes red out**, up and lateral grey out. The red share reached 0.89 in the SCM forward + down corkscrew.
- **Up is the most tolerant direction** (grey at 6.8 s at 9.5 G), then lateral (3.75 s at 9.1 G); down greys/reds at
  half the G (5 G).
- **Boosting roughly halves the time to grey-out, at a *lower* G-meter reading** (lateral: 1.77 s at 6.6 G boosted vs
  3.75 s at 9.1 G in SCM). *Hypothesis*: the pilot model counts something the HUD G meter does not show (the forward
  thrust at the nose wall, or a boost multiplier). Round 10 D's equal-G pairs (from rest, no forward thrust) separate
  "boost" from "forward thrust".
- Darkness closes in from the edge first in most tests (edge t50 before centre t50), which the pilot view can draw as a
  vignette that tightens, then a full fade.

## 3. The Star Citizen wiki API

`api.star-citizen.wiki` (data from game version `4.10.1-LIVE`) publishes the Gladius flight controller
(`Controller_Flight_AEGS_Gladius`). It **independently confirms** our measurements and gives the structure behind them:

| | API | Measured |
|---|---|---|
| SCM speed | 226 | 225–226 |
| Boost forward / backward | 520 / 268 | 519–520 / 267–268 |
| Pitch / yaw / roll | 68 / 52 / 200 | 68.0 / 52.1 / 199.9 |
| Boosted pitch / yaw / roll | 82 / 62 / 240 (×1.2) | 81.6 / 62.7 / 240 |
| Boost accel multipliers | fwd 1.55, back 1.4, lateral 1.3, up 1.3, down 1.35 | 21.2/13.7 = 1.55, 5.96/4.24 = 1.41, 12.9/9.95 = 1.30, 12.99/10.02 = 1.30, 6.6/4.97 = 1.33 |
| Boost tank | capacity 20, idle cost 1/s, regen 0.75/s → 5.0 %/s, 3.75 %/s | 5.0 %/s, 3.75 %/s |
| Boost ramp | up 0.6 s, down 0.3 s | consistent with the boost-forward slope note |
| Angular boost cost | 0 (turning does not drain the tank faster) | not measured |

**What the API does not have**, and the tests must keep supplying: the per-direction IFCS accelerations (13.7 / 4.24 /
9.95 / 9.9 / 4.97 G; the API's thruster figures, main 9.76 G and manoeuvring 22.05 G, do not match the IFCS limits we measure), the egg shape and
wall behaviour, the release/bleed curves, how rotations combine, and anything about G-LOC.

**How to use it.** The values are extracted from CIG's game files; the API's code is MIT, but it states no licence for
the data. CLAUDE.md says "no new third-party data". So: use it as a **cross-check and as a source of hypotheses**
(other ships share the same structure: speeds, rates, ×multipliers), keep shipping our own measurements, and decide
with an ADR before importing any API value. For a second ship, the API gives a strong first guess (rates and boost
multipliers exactly; accelerations only after one short round of strafe tests).

## 4. Answers to the pilot questions

### Partial throttle and combined strafes
- **Partial inputs are linear.** Roll 10/25/50/75/100 % gave 20/50/100/150/200 °/s; partial strafes and throttle give
  proportional acceleration (0.25 boosted forward ≈ 5.2 G of 21.2).
- **Combining strafes does not add acceleration (rule C2, measured).** The thrust points along the combined input, but
  its size is capped at the strongest single axis you asked for: full forward + full right = 13.7 G (the forward
  rating), not √(13.7² + 9.95²) = 16.9. Diagonal inputs *steer* the acceleration, they don't add to it.
- **Speed limits are a shape around the ship, not a number.** SCM: a sphere of 225 m/s in every direction. Boosted: the
  limaçon 394 + 126 cos θ (520 nose, 394 sides, 268 tail).
- **Caveat**: forward is a throttle. Leaving it at 50 % makes the ship try to fly at roughly half speed on its own.

### Boosting forward, then turning: what happens to your speed (*model*, round 10 B measures it)
In decoupled flight your velocity stays where it was while the nose moves. The boosted limit at the angle between
nose and velocity is 394 + 126 cos θ:

| Nose off the velocity | 0° | 30° | 45° | 60° | 90° | 120° | 150° | 180° |
|---|---|---|---|---|---|---|---|---|
| Boosted speed you can keep | 520 | 503 | 483 | 457 | 394 | 331 | 285 | 268 |
| SCM | 225 | 225 | 225 | 225 | 225 | 225 | 225 | 225 |

Above the limit the IFCS pulls you back toward it (soft wall, K = 1.3 /s: most of the excess is gone in ~1.5 s). A
boosted 90° turn at full rate (1.1 s) ends at about 470 m/s and bleeds toward 394; a 180° flip ends near 340 and bleeds
toward 268. **In SCM, turning costs no speed at all** (the egg is a sphere). Letting go of boost: 5.2 s back to 225, and
the spacebrake does not shorten that.

### Fastest 180° (target directly behind)
| Method | SCM | Boost already on |
|---|---|---|
| Pitch only | 2.65 s | **2.21 s** (2.26 s if you press boost as you start the flip: 0.6 s ramp) |
| Yaw only | 3.45 s | 2.87 s |
| Pitch + yaw together, *if* the rates add (*hypothesis*) | 2.09 s | **1.74 s** |

- Pitch, not yaw: pitch is 30 % faster.
- Boost: 17 % faster, and the API says turning costs no extra boost.
- **The open "secret sauce" question**: if the game lets each axis run at its own limit at the same time, a diagonal
  pitch + yaw flip is 21 % faster than pitch alone (1.74 s vs 2.21 s). If it caps the combined rate, it is no faster.
  Round 10 A measures it (85.7 vs 68 °/s).
- Speed: a boosted flip at 520 leaves you at roughly 340 and falling toward 268 (tail limit); in SCM you keep 225.

### Target above you, and the general rule (*model*, boost on)
The nose must rotate through the angle between it and the target, about an axis at right angles to both. Pitch is
the fastest nose-moving axis and roll is very fast (240 °/s: 90° of roll takes 0.38 s), so:

| Target | Roll then pitch | Yaw then pitch | Pitch + yaw together (if rates add) |
|---|---|---|---|
| Directly above (90°) | **1.10 s** (pitch only) | 1.10 s | 1.09 s |
| Above and behind (135°) | **1.65 s** (pitch only) | 3.42 s | 1.64 s |
| Directly behind (180°) | 2.21 s (pitch only) | 2.87 s | **1.74 s** |
| Left (90°) | 1.48 s | **1.44 s** | 1.42 s |
| Behind-left (135°) | **2.03 s** | 2.15 s | 2.14 s |
| Up-left, 45° each (60° off) | 0.88 s | 1.27 s | **0.60 s** |
| 30° to the side | 0.74 s | **0.48 s** | 0.37 s (pitch 75 % + yaw + roll, coning) |

Rules for the trainer:
1. **More than ~45° off the nose: roll the target to "straight above", then pull (pitch up).** Pitch is the fastest
   axis, and pulling up is also the most G-tolerant direction (up strafe tolerated 6.8 s vs 3.75 s lateral).
2. **Small corrections (under ~30°) to the side: yaw directly.** Rolling first costs more than it saves.
3. **If round 10 shows the rates add**, the optimum is a blend: pitch + yaw (and roll) together toward the target,
   which beats roll-then-pitch whenever the target is diagonal.

### Corkscrew escapes (rounds 8 and 9)
- **Boosted corkscrews hold ~513–517 m/s** (forward 100 % + any strafe + any roll); SCM ones hold 225.
- **Side G at the boosted nose is small** (3.7–6.8 G vs 9–10 G in SCM), so the corkscrew's sideways displacement is
  smaller, but you **grey out about twice as fast** while boosting (≈1.7–2.2 s vs 3.75–6.8 s).
- Up + roll is the corkscrew you can hold longest; down + roll red-outs fastest.
- For a 101 lesson: boosted forward + up strafe + roll 25–50 %, released (or eased) before ~2 s to stay out of the grey.
  The exact "ideal" mix needs round 10 D's dose curve; do not publish a number before it.

## 5. What we still can't model, and the round that fixes it

`tools/sc-flighttest/tests_round10.yaml` (37 tests, ~35 min, `run_campaign.bat --rounds 10`):

| Gap | Round 10 section |
|---|---|
| Do rotation rates add when combined (fastest flip, diagonal turns) | A |
| Low-stick yaw/pitch linearity (the 16.2 °/s at 15 % yaw anomaly) | A |
| Speed kept while turning at boosted speed, bleed rate, flip-and-burn | B |
| What a throttle setting does (held and after centring) | C |
| Time to grey/red-out vs G level, per direction | D |
| Boost vs forward thrust as the cause of faster blackout (equal-G pairs) | D |
| Recovery and carry-over after letting go | E |
| Held-back reference manoeuvres for validating the simulator | F |

Still out of scope after round 10: rotation ramp-up (angular acceleration; the API's `thruster_decay angular_accel 12`
suggests near-instant), coupled mode, G-safe on, other ships, ship-to-ship scenarios.

## 6. Suggested implementation order for the app

1. **Fixture update** (`research/gladius-v1-fixture.json`): boost back 5.96 G and down 6.6 G as *measured* (drop the
   spviewer provenance for those two, update NOTICE.md); tank 5.0 / 3.75 %/s; `releaseFloorG` 4.26 measured with the
   round-6 curves as new acceptance traces; add the spacebrake-equals-release fact.
2. **P6 rotation** with per-axis linear rates (table in PLAN.md), boost ×1.2, and the rotated velocity checked against
   the egg each step (that is what produces the turning speed loss). Leave the combination rule as a flag
   (`independent` / `capped`) until round 10 A.
3. **Pilot G-LOC model** (new): per-direction onset from round 9 now, the dose curve and recovery from round 10 D/E.
   Pilot view: edge vignette first, then full fade; red tint for down.
4. **Scenario prototypes**: "flip to a target behind", "target above", "boosted turn without bleeding speed",
   "corkscrew escape, stay out of the grey". Each scores time-to-nose-on and peak darkness, against the model's
   optimum above.

## 7. Round 10 first results: the boosted egg's shape (session `20261008-172622`)

Raw data: `research/raw/2026-10-08/20261008-172622/` (37 tests; the forward check passed: +0.3 throttle → 38 m/s).
An earlier attempt (`20261008-171610`) flew with the throttle axis inverted and is not used.

**The limaçon holds at the sides and toward the tail, measured by turning at speed:**

| Test | What happened | Limaçon |
|---|---|---|
| `r10_turn90_boost`: at 510, boosted pitch ~90°, boost held | bled 510 → **394** in ~4 s (excess shrinks ~e-fold per second) | 394 at 90° |
| `r10_turn180_boost`: at 510, boosted flip ~180° | 510 → 286 after 6 s, still falling slowly (~4 G of bleed) | 268 at 180° |
| `r10_turn90_release`: same 90° turn, boost released | 510 → **223** in ~2.5 s | SCM sphere 225 |
| `r10_turn90_scm`: SCM at 225, pitch 90° | **no loss** (224) | sphere |
| `r10_turn90_boost_fwd`: 90° turn with full throttle held | dips to 442, then climbs back to 483 as forward thrust drags the velocity onto the new nose | — |
| `r10_flip_and_burn`: flip at 510, then throttle + boost | 363 → 63 m/s in ~1.5 s (≈20 G: the boosted forward rating), then re-accelerates | — |

Together with round 3 (518 / 514 / 508 at 8.6° / 16.9° / 24.5°, limaçon 518.6 / 514.5 / 508.6) and round 5 (408 at the
sweep's end heading, limaçon 406), the boosted egg boundary is now measured at the nose, near the nose, the side and the
tail. Measured up (394) equals measured lateral (394), so the cross-section is round. **Not yet measured: the boosted
radius straight DOWN** (`r4_boost_down` ran out of time at 76 m/s) and the 120–150° quadrant.

**Sideways room at a given forward speed** (limaçon cross-section, `lateralRoom` in the fixture):

| Forward speed (m/s) | 0 | 200 | 300 | 400 | 450 | 480 | 500 | 510 | 519 |
|---|---|---|---|---|---|---|---|---|---|
| Max sideways speed (m/s) | 394 | 403 | 367 | 293 | 232 | 179 | **128** | 91 | 29 |

At 500 m/s forward you have ±128 m/s of sideways room, and only 3–6 G of side push to use it (`boostSide.factor` 0.469
above 354 m/s forward): the room exists, but it takes ~2–4 s to reach. Both belong in the egg view.

**The bleed is not a single constant.** Fixture `softWallK` 1.3 /s; the 90° turn shows ~1.0 /s, the 180° flip slower
(~4 G near the tail). Fit it per heading, or as a G-limited bleed.

**Rotation:** yaw 25 % / 50 % and pitch 25 % are linear (13.0 / 26.1 / 17.0 °/s), so the round-5 15 % yaw reading was an
artefact. Pitch + roll together measured ~212 °/s (independent axes predict 211, capped 200), a first sign that rates
add; the pitch + yaw tests need a proper fit (the strafe's component along the rotation axis drifts and masks the
period) before the fast-flip answer is settled.

## 8. Blackout cuts your thrust (and a correction)

- **`r4_boost_down` was cut short by the harness, not the game.** Round 4 predates the "hold" policy, so it let go of
  the controls when the HUD went dark (red-out at 2.8 s). Its 6.6 G acceleration stands; its "plateau 76" does not.
  The r7 onset tests also let go at HUD blackout, by design; their onset times stand.
- **While you are fully blacked/redded out, the ship stops responding.** `r9_vis_hold_down_boost` held boosted full down
  for 12 s: speed climbed to 229 m/s by 4.7 s, the screen went fully dark, and the speed read **229 again at 9.6 s** when
  vision returned. Then it accelerated again (373 by 13.2 s). So during a true blackout the thrust inputs do nothing; the
  G load disappears, the pilot recovers in ~4–5 s, and the inputs work again. A held high-G manoeuvre therefore becomes a
  staircase. This is the mechanism the trainer must teach: pushing past the blackout does not buy more speed, it buys
  seconds of drifting with no control. `r11_redout_stairs` measures the staircase directly.
- The boosted radius straight **down** is 394, from `r10_turn90_boost` (pitch up 90° puts the velocity below the ship,
  with no G load).
