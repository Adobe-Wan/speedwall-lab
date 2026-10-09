# In-game test scenarios still to fly (sc-flight-coach, 2026-10-09)

Written by the coach persona (`.claude/agents/sc-flight-coach.md`) after `docs/coach-review-2026-10-09.md`. Gladius, game 4.x LIVE. Labels: **M** measured (test ID), **F** fitted, **Mod** model (computed, not flown), **A** assumed, **GK** game knowledge. Every "predicts" number below is **Mod** unless it cites a test ID. No file other than this one was edited; the YAML is not yet in a `tests_round*.yaml`.

## 0. Standing conditions (every test)

Decoupled, **G-Safe OFF**, 4K (3840x2160, 16:9), in-game FOV 100 (horizontal or vertical is itself unverified, see `fov_*`), Gladius, **Arena Commander free flight**, pilot present at the PC, F12 ready. Never the PU, never PvP. SCM unless a step says `boost: true`. Open space, nothing ahead. Two-player items need a second human in the same free-flight instance.

Reading the tables: **P0** blocks a lesson or a claim we already make; **P1** sharpens a number a lesson leans on; **P2** completeness. **Auto**: `A` flies as-is with `tools/sc-flighttest`; `HC1..HC5` needs that harness change (section 1); `M` manual (video and a stopwatch); `2P` two pilots. Each test costs flight time plus about 30 s of harness braking, flipping and refilling. The harness starts every test from rest, so "start at speed" is a run-up in the step list; the actual start speed is read from the series.

Standard record for every test (already written by `run.py`): `series.csv` (speed, G, tank), `vision.csv` (centre, ring and edge darkness, red share, HUD fade), `commands.csv`, `meta.json`. Use `gloc: hold`, `probe: 0` (no camera presses) for every G-LOC test so the cockpit view and `vision.csv` are continuous. Pilot note after each G-LOC run: what you saw first (edge, centre, red tint, HUD digits) and roughly when.

## 1. Harness changes wanted (all small)

| ID | Change | Unlocks |
|---|---|---|
| HC1 | **TVI capture**: save the central screen at 10 Hz, 960 px wide (`full_w`, `full_every_s` already exist, so mostly config), plus a marker detector in `analyze`. The TVI is the HUD velocity marker; needs the FOV result to turn pixels into degrees | `tvi_*`, `fov_tvi_*`, real acceleration direction (G-LOC H5), sideways metres in `sp_*`, `pf_*` |
| HC2 | **Record the between-test brake** (`brake_to_stop`) into its own series with its entry speed, and add the `brake` column to `commands.csv` (the audit found it missing). About 95 brakes per session from varied speeds come free | `b_*`, a brake-vs-speed curve at no flight cost |
| HC3 | `gloc: pause` policy: at HUD gone (or darkness above 0.9) drop all inputs for `pause_s`, then run a `then:` step list | `g11_*`, `g12_*` |
| HC4 | `until:` key on a step (end when HUD speed reaches X, with a max `t`) | exact run-up speeds for `sp_*`, `pf_*`, `b_*`; optional |
| HC5 | Event marks: log a fire button (vJoy button 4) and a pilot hotkey ("I am greying now") into `commands.csv` | `proj_*`, subjective screen-versus-HUD timing; optional |

## 2. Free first: re-analysis of data already on disk (no flying)

| ID | P | Question and method | Why it is cheap |
|---|---|---|---|
| d01 | P0 | **Merge `r7_dodge_mid_boost`** (session 20261008-133222) into the fixture; plot G column, speed and `hud_level`. My hand re-integration of the logged G with the documented dose rule (stress += G/T - 1 per s above T; T 6.6 lateral, 13.5 forward; drain 0.33/s; grey 1, gone 1.8, black 2.3) gives peak stress 1.6 for the lateral part alone and 2.2 with the 21 G forward launch (**Mod**, not run through the app code). Observed: HUD minimum 0.77 at 3 s into the strafe, screen darkness at most 0.03 (edge), HUD 1.0 by 6 s (**M**). Mean lateral G in the first 2 s was about 10.5, the same as the 10 G corkscrews that grey in 2.0 s (**M** `r10_rec_lat_*`, `r9_vis_scm_f0_lat_r50`) | The puzzle is therefore not "blackout predicted, none seen": it is "same mean G, dose about 1.6-2.2, observed about 1.0" |
| d02 | P0 | **HUD fade versus screen darkness timing**: in every `vision.csv` of rounds 9-11 read the time `hud_level` crosses 0.8 and 0.5 and the time `dark_edge` and `dark_centre` cross 0.5. In `r10_rec_lat_30` the centre was fully black (1.0) from about 5 s while the HUD was already 0 at 3.4 s; in `r7_dodge_mid_boost` the HUD dipped while the screen never darkened | Tells whether the HUD digits and the screen are one dose clock or two |
| d03 | P1 | **Recovery and carry-over from the existing pairs**: `r10_rec_lat_15/30/60` released after 7 s at 10 G, waited 1.5/3/6 s, reapplied. Extract the grey time of the second exposure against the gap. Dose rule (drain 0.33/s from stress 1.8 at HUD gone) predicts the second exposure greys at once after the 1.5 s and 3 s gaps (stress still above 1) and at once or within about 1.4 s after 6 s, depending on whether stress is capped at 2.3 (physics-fit.md does not say) (**Mod**). First read of `r10_rec_lat_30` by eye: HUD back to 0.98 within 1.3 s of restart after a 3 s gap, grey about 2.3-2.8 s after restart | Decides whether `g11_*` is needed |
| d04 | P1 | **Angular boost cost**: in the `r10_turn*`, `r11_turn*` and `r8` roll-100 % runs, regress the AB column against time while boosting. If it is 5.0 %/s with a spin on, the API's "angular cost 0" is confirmed for roll and pitch combined with translation | Settles most of `tk_ang_*` |
| d05 | P1 | **Backward G**: thrusters cap backward at 5.96 G boosted, below the fitted 8 G, so backward tolerance can only be reached by the release bleed (12-13 G for about 1 s, `r6_release_all`). Read `hud_level` through that second in the `r6_release_*` files | No backward test is needed unless the HUD dips there |
| d06 | P1 | **Real acceleration versus meter**: in the reversal tests below the V-shaped speed gives dv/dt; in existing data compare slope with the G meter wherever the ship moves along a line (`r1_*`, `r4_*`) | If slope equals meter everywhere along a line, H5 can only be tested with the TVI |

## 3. G-LOC: what the pilot has told us and the hypotheses

**The facts (M).** Constant-G corkscrews (strafe plus roll held) grey in 1.7-2.1 s at 10 G lateral SCM (`r10_rec_lat_15/30/60`, `r9_vis_scm_f0_lat_r50`), 4.2-4.4 s at 10 G up (`r10_g_up_100`), 2.8-3.6 s at 5 G down. The dose rule reproduces these (my run: lateral 9.95 G greys at 2.0 s; up 10 G at T 8.1 greys at 4.2; down 4.97 G at 3.85 greys at 3.4). It was fitted to **those** tests, almost all with roll and a constant G. `r7_dodge_mid_boost` (boost plus forward 1.6 s, then full lateral, no roll): lateral G 11.9 falling to 8.4 over about 2 s (the ship runs into the egg wall), HUD minimum 0.77, back by 6 s. Existing no-roll evidence is on **down only**: `r9_vis_hold_down_scm` (no roll) greys at 2.87 s against 2.76 s (`r9_vis_scm_f0_down_r50`) and 3.42 s (`r10_g_down_100`) with roll, so roll made no difference for down (n=1 each).

| H | Hypothesis | Predicts | Tests that separate it |
|---|---|---|---|
| H1 | Fixed per-axis tolerance, stress integrates (current model) | Constant G without roll greys exactly as with roll; falling G and pulses follow the integral | `g01`, `g04`, `g05`, `g09_*` |
| H2 | The load that counts is filtered or delayed (low-pass of G, or stress starts only after G stays above T for a moment) | Short or falling exposures are tolerated more than the integral says; a 10 G step still greys at about 2 s | `g09_fall`, `g09_ramp`, `g09_pulse_*` |
| H3 | Roll or spin adds to the load (the tolerance was only ever measured while spinning) | No-roll constant G greys much later than 2.0 s (lateral); grey time falls as roll rate rises | `g01`, `g02`, `g03_*` |
| H4 | History matters: the 21 G forward launch before the strafe changes the tolerance (up or down) or the dose carried over | `g10_*` and `g07d_*` differ from a cold start; the HUD recovers faster than the dose rule's 0.33/s drain | `g07d_*`, `g10_*`, `g11_*` |
| H5 | The game uses real acceleration (velocity change), not the thrust the meter shows | In `sp_*`/`tvi_*` the grey time follows the measured velocity change, not the meter | HC1 (TVI) with `sp_*`, `pf_*`, `g07d_*` |
| H6 | Direction mix or onset rate matters (jerk, forward plus lateral together) | Ramps tolerate more G than steps; mixed vectors differ from the sum of axes | `g09_ramp`, `pf_*` vision |
| H7 | Speed or boost state changes the tolerance | Boosted equals SCM at the same G for lateral/down at rest (M, within 0.25 s, round 10) but not tested at speed | `g07d_bst_lowfwd`, `g10_nose_lat` |

**Pattern to read first.** `g01` (lateral, constant 9.95 G, no roll): grey at 2.0 s and gone at 3.5 s means H1 holds for that axis, roll is not the answer, and the dodge difference must be profile, history or meter (H2/H4/H5). No grey by 4.6 s means H3: every G-LOC claim we made came from spinning tests.

## 4. G-LOC tests

Constant G **without roll** is only possible for a few seconds in decoupled flight (the speed wall ends the push). The trick used below: build up speed in one direction at a gentle stick (G below every tolerance, M no grey up to 2.5 G lateral, 6.5 G up, 3.7 G down, `r10_g_*`), then reverse at full stick: the ship runs wall to wall at a constant G (SCM lateral: 450 m/s at 97.6 m/s^2 = 4.6 s; boosted up from -225 to +394: 4.9 s; forward SCM -225 to +225: 3.35 s). The speed trace is then a V: its slope is the **real** acceleration and a flat bottom is a thrust cut.

```yaml
# --- A. constant G, no roll (H1 vs H3), thrust cut per axis. Leg 1 gentle, leg 2 full.
- id: g01_lat_rev_noroll_scm       # P0 A   flight 15.5 s
  gloc: hold
  steps: [{t: 10, strafe_lat: 0.25}, {t: 5.5, strafe_lat: -1.0}]
- id: g05_lat_rev_noroll_bst       # P0 A   16 s   (12.9 G lateral)
  gloc: hold
  steps: [{t: 10, strafe_lat: 0.25}, {t: 6, strafe_lat: -1.0, boost: true}]
- id: g04_up_rev_noroll_bst        # P1 A   16 s   (12.99 G up; leg 1 is DOWN so the push is up)
  gloc: hold
  steps: [{t: 10, strafe_vert: -0.5}, {t: 6, strafe_vert: 1.0, boost: true}]
- id: g06_down_rev_noroll_scm      # P1 A   20 s   (4.97 G down, red-out; leg 1 is UP)
  gloc: hold
  steps: [{t: 10, strafe_vert: 0.5}, {t: 10, strafe_vert: -1.0}]
# --- B. forward G tolerance (fitted 13.5 from ONE scenario). Leg 1 is BACKWARD throttle.
- id: g07_fwd_rev_scm              # P0 A   16.5 s (13.7 G)
  gloc: hold
  steps: [{t: 12, strafe_long: -0.5}, {t: 4.5, strafe_long: 1.0}]
- id: g07_fwd_rev_bst065           # P1 A   18 s   (13.8 G, at the fitted tolerance)
  gloc: hold
  steps: [{t: 12, strafe_long: -0.5}, {t: 6, strafe_long: 0.65, boost: true}]
- id: g07_fwd_rev_bst085           # P0 A   16.7 s (18.0 G)
  gloc: hold
  steps: [{t: 12, strafe_long: -0.5}, {t: 4.7, strafe_long: 0.85, boost: true}]
- id: g07_fwd_rev_bst100           # P0 A   16 s   (21.2 G)
  gloc: hold
  steps: [{t: 12, strafe_long: -0.5}, {t: 4, strafe_long: 1.0, boost: true}]
```

| ID | Question | Dose rule predicts (Mod) | Confirms / kills |
|---|---|---|---|
| g01 | Does roll matter for lateral? | Grey 2.0 s, gone 3.5 s, black 4.5 s (V bottom near 2.3 s) | Greys 1.7-2.4 s: H3 dead for lateral. HUD above 0.8 for all 4.6 s: H3 alive, re-fit with roll as a term. Flat V bottom (speed stays at 0 for more than 0.5 s) = lateral thrust cut by the blackout |
| g05 | Same boosted; also the reaction to 12.9 G, the pilot's dodge number | Grey 1.1 s, gone 1.9 s, black 2.4 s | A mean 10.5 G falling profile (dodge_mid) greyed at 4 s; a constant 12.9 G greying at about 1 s makes the **profile** the cause (H2) |
| g04 | Up, boosted, no roll | Grey 1.7 s, gone 3.0, black 3.8 | Compare the 1.7-2.2 s launch greying (M, forward) to separate boost/forward from up |
| g06 | Down, red-out, no roll, 9 s | Grey 3.4, gone 6.2, black 7.9; red share above 0.5 | Matches `r9_vis_hold_down_scm` 2.87 s: roll irrelevant for down confirmed. Also gives a second boosted/SCM down slope for the 6.7 vs 6.8 G question (audit item 8) |
| g07 | Forward tolerance by G, constant, eyeballs-in | SCM 13.7: no grey. 13.8: none. 18.0: grey 3.0 s. 21.2: grey 1.8, gone 3.2 | Grey at 13.7 SCM kills T=13.5. No grey at 18.0 kills it the other way. Three points give the real forward curve |

### Time profile and history (SCM lateral, wall-riding with roll so G stays constant while the stick moves)

```yaml
- id: g09_lat_ramp                 # P1 A   14.5 s  stick 0.3 -> 1.0 in 8 steps, then hold
  gloc: hold
  steps: [{t: .86, strafe_lat: .3, roll: .5}, {t: .86, strafe_lat: .4, roll: .5}, {t: .86, strafe_lat: .5, roll: .5}, {t: .86, strafe_lat: .6, roll: .5}, {t: .86, strafe_lat: .7, roll: .5}, {t: .86, strafe_lat: .8, roll: .5}, {t: .86, strafe_lat: .9, roll: .5}, {t: 8, strafe_lat: 1.0, roll: .5}]
- id: g09_lat_fall                 # P0 A   15 s  1.0 -> 0.7 (the dodge_mid shape: G falls about 30 %), then hold 0.7
  gloc: hold
  steps: [{t: .75, strafe_lat: 1.0, roll: .5}, {t: .75, strafe_lat: .9, roll: .5}, {t: .75, strafe_lat: .8, roll: .5}, {t: 12, strafe_lat: .7, roll: .5}]
- id: g09_pulse_1_1                # P0 A   20 s  10 x (1 s full, 1 s off), roll held
  gloc: hold
  steps: [{t: 1, strafe_lat: 1.0, roll: .5}, {t: 1, roll: .5}]   # repeat the pair 10 times (or add `repeat: 10`)
- id: g09_pulse_2_2                # P1 A   24 s  6 x (2 s on, 2 s off)
  gloc: hold
  steps: [{t: 2, strafe_lat: 1.0, roll: .5}, {t: 2, roll: .5}]   # repeat 6 times
- id: g09_pulse_0p5_0p5            # P2 A   24 s
  gloc: hold
  steps: [{t: .5, strafe_lat: 1.0, roll: .5}, {t: .5, roll: .5}] # repeat 24 times
- id: g02_lat_wall_roll50          # P1 A   8 s   control (repeat of r9_vis_scm_f0_lat_r50) at the start of the session
  gloc: hold
  steps: [{t: 8, strafe_lat: 1.0, roll: .5}]
- id: g03_lat_wall_roll15          # P1 A   8 s   roll 30 deg/s (just above the 25 deg/s the wall needs)
  gloc: hold
  steps: [{t: 8, strafe_lat: 1.0, roll: .15}]
- id: g03_lat_wall_roll25          # P1 A   8 s   roll 50 deg/s (r9 was 100, r10_rec was 200)
  gloc: hold
  steps: [{t: 8, strafe_lat: 1.0, roll: .25}]
```

| ID | Dose rule predicts (grey / gone / black, s, Mod) | Reading |
|---|---|---|
| g09_lat_fall | grey 5.8 s (stress only 0.56 after 2.25 s) | The dodge_mid shape in a roll test. Grey near 6 s: H1 is fine for falling G. Grey at 2-3 s: falling G is not forgiven. No grey in 15 s: the game is far more generous than the integral (H2) |
| g09_lat_ramp | grey 6.5, gone 8.1, black 9.1 | Earlier than 6.5 s: onset rate does not help. Much later: H2/H6 (slow onset is tolerated) |
| g09_pulse_1_1 | grey 6.9 (wall time), gone 16.7 | Grey near 2 s of **on** time (4 s wall) means the stress barely drains between pulses; far later than 7 s means faster recovery than 0.33/s |
| g09_pulse_2_2 | grey 2.0 s, i.e. in the first pulse; gone 13.5 | Pulses inside the grey time test recovery only; compare the second-pulse HUD with d03 |
| g02/g03 | all about 2 s if H1 and roll does not matter | Grey time rising as roll falls from 50 to 30 deg/s: roll is a load (H3). Mind that at 30 deg/s the wall can only just hold the G; read the measured G, not the stick |

### Dodge decomposition (boosted, forward then lateral, no roll)

```yaml
- id: g07d_dodge_mid_repeat        # P0 A   x3, 5.6 s   exact repeat of r7_dodge_mid_boost (only n=1)
  gloc: hold
  steps: [{t: 1.6, strafe_long: 1.0, boost: true}, {t: 4, strafe_lat: 1.0, boost: true}]
- id: g07d_dodge_scm               # P0 A   7 s  no forward launch dose (13.7 G, below T), same lateral step
  gloc: hold
  steps: [{t: 3, strafe_long: 1.0}, {t: 4, strafe_lat: 1.0}]
- id: g07d_dodge_bst_lowfwd        # P0 A   7 s  gentle run-up to about 300 m/s (10.6 G forward), then the same lateral step
  gloc: hold
  steps: [{t: 2.9, strafe_long: .5, boost: true}, {t: 4, strafe_lat: 1.0, boost: true}]
- id: g07d_dodge_bst_rest          # P1 A   4 s  boosted lateral from rest (no speed, no launch), 12.9 G
  gloc: hold
  steps: [{t: 4, strafe_lat: 1.0, boost: true}]
```

Reading: `repeat` x3 gives the scatter (n=1 now). `scm` and `lowfwd` remove the 21 G launch: if the HUD minimum drops to or below 0.5 the launch was protective or irrelevant and the dose rule's forward carry-over (about 0.8 of the 2.2) was the wrong part; if it stays at 0.8-0.9, the forward launch is the reason the model predicted too much (H4). `bst_rest` has no wall on the lateral push for 3 s (G stays 12.9): grey at about 1.1 s says the **falling G** of dodge_mid (not the boost) protected the pilot.

```yaml
# --- History / carry-over (H4, H7). Same 6.5 G side load (below the 6.6 G lateral tolerance) with and without the launch.
- id: g10_lat65_cold               # P1 A   10 s  boosted lateral 0.5 + roll from rest, no forward
  gloc: hold
  steps: [{t: 10, strafe_lat: .5, roll: .5, boost: true}]
- id: g10_lat65_after_launch       # P1 A   14 s  launch 3 s at the nose, then the same load (M: r9_vis_bst_f100_lat_r50 sat at HUD 0.65-0.80 for 10 s)
  gloc: hold
  steps: [{t: 3, strafe_long: 1.0, boost: true}, {t: 11, strafe_long: 1.0, strafe_lat: 1.0, roll: .5, boost: true}]
- id: g10_up65_wait4               # P1 A   launch, 4 s coast (boost held, stick 0), then 6.5 G up + roll
  gloc: hold
  steps: [{t: 3, strafe_long: 1.0, boost: true}, {t: 4, boost: true}, {t: 8, strafe_vert: .5, roll: .5, boost: true}]
```

Reading: `cold` stays at HUD 1.0 (no dose, 6.45 G < 6.6) while `after_launch` sits at 0.65-0.80: the nose result is carry-over or the 0.47 side-push factor, not the lateral tolerance (H4). `wait4`: if the HUD is clear again by 4 s after a 3 s launch, carry-over lasts under 4 s.

### Recovery depth and what blackout does (needs HC3, not in the 2 h plan unless d03 fails)

| ID | P | Auto | Procedure | Reading |
|---|---|---|---|---|
| g11_rec_depth | P2 | HC3 | SCM lateral 1.0 + roll .5; at HUD 0.8 (grey) / 0.5 (gone) / dark 0.9 (black) release for 0 / 2 / 4 s, then reapply. 9 cells | Time to the second grey. Dose rule (drain 0.33/s): after a grey release, gap 0/1/2/3 s gives grey on restart after 0 / 0.7 / 1.3 / 2.0 s |
| g12_black_rot | P2 | HC3 | Boosted forward 2 s (about 270 m/s, nose on velocity), then up 1.0 + roll .5 until HUD gone; then `then:` pitch 1.0 for 2.65 s, then throttle 1.0 boosted for 1 s | Speed at the end rises if the ship **did not rotate** while blacked out, falls if it flipped 180 deg. Settles "does a blackout also cut rotation" (thrust and boost cut: M `r9_vis_hold_down_boost`, `r11_boost_down_long`; rotation never checked) |

## 5. Spacebrake (round 12 first, then the missing cases)

Round 12 (`tests_round12.yaml`) is the basic six: 150 and 225 SCM, 400 boosted and the nose, boost released and held. Skilled pilots say "it cancels all thrust with counter thrust". There are three simple readings, which the extras below separate: **retro only** (4.24 G SCM, 5.96 boosted, any direction), **per axis** (each bank cancels its own velocity component: lateral 9.95 G, up-moving uses the down bank 4.97, down-moving uses the up bank 10.02, forward-moving uses the back bank 4.24), or **all banks at once** (larger than any single rating). From a pure forward speed the first two are identical; **lateral is the decisive axis**. Expected stop time from 225 SCM: retro 5.4 s, per axis lateral 2.3 s, up-moving 4.6 s, down-moving 2.2 s (all **Mod**).

```yaml
- id: r12x_brake_050_scm           # P1 A   speeds 50 / 100 m/s (does the decel depend on speed?)
  steps: [{t: .75, strafe_long: .5}, {t: 6, brake: true}]
- id: r12x_brake_100_scm           # P1 A
  steps: [{t: 1.5, strafe_long: .5}, {t: 6, brake: true}]
- id: r12x_brake_lat225_scm        # P0 A   decisive axis
  steps: [{t: 3, strafe_lat: 1.0}, {t: 6, brake: true}]
- id: r12x_brake_up225_scm         # P0 A
  steps: [{t: 3, strafe_vert: 1.0}, {t: 8, brake: true}]
- id: r12x_brake_down225_scm       # P1 A   (stop a downward drift: the up bank)
  steps: [{t: 5, strafe_vert: -1.0}, {t: 6, brake: true}]
- id: r12x_brake_diag_scm          # P1 A   velocity 36 deg off the nose (13.7 G along the diagonal, rule C2)
  steps: [{t: 3.5, strafe_long: 1.0, strafe_lat: 1.0}, {t: 8, brake: true}]
- id: r12x_brake_plus_fwd          # P1 A   brake while throttle is held: who wins?
  steps: [{t: 3, strafe_long: 1.0}, {t: 6, brake: true, strafe_long: 1.0}]
- id: r12x_brake_plus_counter      # P1 A   brake plus a counter-strafe: do they add?
  steps: [{t: 3, strafe_lat: 1.0}, {t: 6, brake: true, strafe_lat: -1.0}]
- id: r12x_brake_plus_same         # P2 A   brake with the strafe still pushing along the motion
  steps: [{t: 3, strafe_lat: 1.0}, {t: 6, brake: true, strafe_lat: 1.0}]
- id: r12x_brake_300_bst_late      # P2 A   brake pressed 1.5 s into the release bleed (about 330 m/s), boost released
  steps: [{t: 2.3, strafe_long: 1.0, boost: true}, {t: 1.5}, {t: 8, brake: true}]
# brake versus flip and burn (stop time to the speed minimum), same entry speeds as r12 so the pairs compare
- id: r12x_flip_burn_100_scm       # P0 A   v about 100: flip 2.65 s then burn
  steps: [{t: 1.5, strafe_long: .5}, {t: 2.65, pitch: 1.0}, {t: 3, strafe_long: 1.0}]
- id: r12x_flip_burn_150_scm       # P0 A
  steps: [{t: 1.2, strafe_long: 1.0}, {t: 2.65, pitch: 1.0}, {t: 3.5, strafe_long: 1.0}]
- id: r12x_flip_burn_225_scm       # P0 A
  steps: [{t: 3, strafe_long: 1.0}, {t: 2.65, pitch: 1.0}, {t: 4, strafe_long: 1.0}]
- id: r12x_flip_burn_400_bst       # P1 A   flip 2.21 s boosted, burn boosted (21 G)
  steps: [{t: 2.3, strafe_long: 1.0, boost: true}, {t: 2.21, pitch: 1.0, boost: true}, {t: 3, strafe_long: 1.0, boost: true}]
# what the brake does to rotation: brake plus pitch for 1 s from 100 m/s, then a 0.5 s burn
- id: r12x_brake_rotation          # P1 A
  steps: [{t: 1.5, strafe_long: .5}, {t: 1, brake: true, pitch: 1.0}, {t: .5, strafe_long: 1.0}, {t: 1}]
```

| Group | Reading (Mod unless stated) |
|---|---|
| lat225 | Stop in 2.3 s (9.95 G): per axis, pilots are right. 5.4 s: retro only. Under 2.3 s: all banks. The G meter shows which bank fired |
| up225 / down225 | Up-moving 4.6 s and down-moving 2.2 s: per axis, asymmetric. Equal times: one bank (retro or all) |
| diag | |v| linear in time for retro-only; lateral component gone first and |v| curving for per axis (forward 182 and lateral 132 m/s: lateral zero at 1.35 s, forward at 4.4 s) |
| plus_fwd / plus_counter | Speed keeps rising with the throttle held means the throttle beats the brake; a stop at the usual brake time means the brake wins; counter-strafe plus brake faster than 9.95 G means the effects add (rule C2 says combined thrust is capped at the strongest axis) |
| flip_burn pairs | Flip beats `r12_brake_*` above about 160 m/s only if the brake is retro-only (**Mod**, `coach-review` 3(a)); if lat225 shows per-axis banks the crossover moves and may vanish. Cut the throttle at zero is built in: the burn is timed, read the speed minimum |
| rotation | Speed after the burn about 104 m/s if the ship rotated about 68 deg while braking, about 125 m/s if the brake froze the rotation (start 100 m/s, brake 4.24 G for 1 s, 0.5 s burn at 13.7 G; **Mod**) |

## 6. The evasion gaps

### 6.1 Side push by forward speed (the 358 m/s step in `boostSide` is F, from one wall trace)

```yaml
# run-up forward boosted for T, then a strafe-only dodge 3 s: forward RELEASED and forward HELD. T for about 200/300/400/450/500 m/s.
- id: sp_200_rel      # P0 A (HC4 makes T exact)  4.2 s
  steps: [{t: 1.2, strafe_long: 1.0, boost: true}, {t: 3, strafe_lat: 1.0, boost: true}]
- id: sp_300_rel      # = r7_dodge_mid_boost repeated
  steps: [{t: 1.7, strafe_long: 1.0, boost: true}, {t: 3, strafe_lat: 1.0, boost: true}]
- id: sp_400_rel
  steps: [{t: 2.3, strafe_long: 1.0, boost: true}, {t: 3, strafe_lat: 1.0, boost: true}]
- id: sp_450_rel
  steps: [{t: 2.5, strafe_long: 1.0, boost: true}, {t: 3, strafe_lat: 1.0, boost: true}]
- id: sp_500_rel
  steps: [{t: 3.4, strafe_long: 1.0, boost: true}, {t: 3, strafe_lat: 1.0, boost: true}]
- id: sp_300_held     # same five with strafe_long: 1.0 kept in the second step (_held for 200/400/450/500 too)
  steps: [{t: 1.7, strafe_long: 1.0, boost: true}, {t: 3, strafe_long: 1.0, strafe_lat: 1.0, boost: true}]
```

Record: G meter at 0.25 s steps, speed, and with HC1 the TVI angle (sideways speed = speed x sin angle; sideways metres after 2 s = integral). **Reading:** the model's step: side push about 12.9 G below 358 m/s forward and 0.47 of that above (**F**). Measured 12 G falling to 8.4 over 2 s at 300 (**M** `r7_dodge_mid_boost`). A smooth fall of side G from 12.9 at 200 to about 6 at 500 replaces the step; a jump between 400 and 450 keeps it. Priority P0 because `dodge-mid`, `dodge-nose` and `letoff` quote it; the "released" runs also give the `letoff` sideways metres. 10 tests, about 1 min each.

### 6.2 TVI capture and the in-game FOV (the TVI is where the velocity points, **GK**)

```yaml
# FOV by rate (M: yaw 25 % = 13.0 deg/s, pitch 25 % = 17.0 deg/s, r10_rot_yaw_025, r10_rot_pitch_025). SCM, stopped, any fixed bright feature.
- id: fov_yaw    # P0 A + M video   12 s
  steps: [{t: 12, yaw: .25}]
- id: fov_pitch  # P0 A + M video   8 s
  steps: [{t: 8, pitch: .25}]
# FOV by the TVI: thrust angle at the plateau is known (M plateaus 518/514/508, r3_*; angles 8.6/16.9/24.5 deg are Mod from 21.2 and 12.9 G)
- id: fov_tvi_25 # P0 HC1   8 s   (_50 and _75 with strafe_lat .5 and .75; repeat with strafe_vert for the vertical axis)
  steps: [{t: 8, strafe_long: 1.0, strafe_lat: .25, boost: true}]
- id: tvi_roll27  # P1 HC1  10 s  boosted, forward + up, roll 27 / 60 / 120 / 240 deg/s = stick .1125 / .25 / .5 / 1.0
  steps: [{t: 10, strafe_long: 1.0, strafe_vert: 1.0, roll: .1125, boost: true}]
```

**FOV reading.** Edge-to-edge time of a distant feature = FOV / rate. Horizontal 100: 7.7 s across (yaw), vertical field 67.7 deg so 3.98 s top to bottom (pitch). Vertical 100: horizontal field 129.5 deg so 9.96 s across, 5.88 s top to bottom (rectilinear projection assumed, **GK**). By the TVI at 4K: horizontal 100 puts the 8.6 / 16.9 / 24.5 deg TVI at 244 / 489 / 734 px right of centre; vertical 100 puts it at 137 / 275 / 413 px. Two independent methods; if they agree, the app's FOV helper (PLAN section 6, "90 deg default") gets one fixed rule. Feature with no landmark? A stationary parked ship or the sun works; record the screen with the capture at 60 fps and read the frame counts.
**TVI reading.** `ck-shoot` says the TVI sits about 13-15 deg off the nose at roll 27 deg/s once anchored; the model says 33 deg at the start, 29 at 5 s, 10 deg at 10 s (**Mod**, coach rerun). At 60 and 120 deg/s and 240 the model's TVI is smaller still. Confirm: TVI within 10-15 deg at 10 s on the 27 deg/s run. Kill: it is still at 25 deg or more at 10 s, or it does not swing at all. Also gives the real velocity direction for H5.

### 6.3 Partial-forward corkscrew at speed (the flee case; round-8 data blacked out and is noisy)

```yaml
# gentle run-up (10.6 G forward, below T) to about 450 m/s, then forward F, up 1.0, roll r, 14 s, boost held. F = 1.0, .75, .5, .25. r = .25 (60 deg/s), .5 (120).
- id: pf_f50_r25   # P1 A (+HC1 for TVI)   18.6 s   boosted: 93 % of the tank
  gloc: hold
  steps: [{t: 4.6, strafe_long: .5, boost: true}, {t: 14, strafe_long: .5, strafe_vert: 1.0, roll: .25, boost: true}]
# eight tests: f100/f75/f50/f25 at r25, plus f100/f50/f25 at r50, plus f50 at r.125 (30 deg/s)
```

**Reading.** Model: partial forward ends at the wall (486-501 m/s of away speed at roll 27 deg/s; **Mod**, `evasion-analysis` 5). Round 8 game runs read 262-398 m/s (noisy). Hold the speed at 10-14 s: 480 or more means forward at the wall is idle and the model stands; under 400 means the throttle acts as a speed target, not a thrust, and every "less forward" row in `evasion-analysis` section 3 is replaced by these numbers. Also record `hud_level` and the G meter: round 8 read 8.7-12.4 G of side push at 260-400 m/s forward (noisy), the model gives 0.47 of 12.99 G (about 6 G) above 358 m/s; an up push above 8.1 G held for 14 s greys by the dose rule, a direct test of H5/H6 at speed. At 15-30 deg/s roll the egg may be too thin to sustain the push (needs omega >= a / room).

### 6.4 Lead pip rule, hit radius, projectile speed and inheritance (two pilots)

| ID | P | Auto | Procedure | What it settles |
|---|---|---|---|---|
| proj_inherit | P0 | M | Ship stopped: boost + lateral 1.0 for 3.3 s then coast (harness `[{t: 3.3, strafe_lat: 1.0, boost: true}, {t: 10}]`), nose fixed. Fire a burst by keyboard during the coast (sideways drift 394 m/s, **M**) and record the tracers at 60 fps. Then the same with boost + forward and fire forward at 519 | If bullets inherit the shooter's velocity, the tracer goes along the crosshair in the cockpit frame. If not, it deviates by atan(394 / bullet speed): 21 deg at 1000 m/s (**Mod**), and forward fire at 519 m/s leaves the muzzle at (bullet speed - 519) relative to the ship |
| proj_speed | P0 | 2P + M | Parked target at 500 / 1000 / 1500 m (HUD range); shooter stopped; single burst; muzzle flash to impact flash on a 60 fps recording | Bullet speed and any drop-off. The 1 km/s in `evasion-analysis` and the flight time in every miss number are **A** |
| proj_chase | P0 | 2P + M | Shooter at 519 m/s fires at a target ahead flying at 519 m/s (range 1000 m) | If bullets do not inherit, the closing speed is (bullet speed - 519), flight time about 2 s not 1 s and **every miss figure changes**; if they inherit, the formulas stand |
| lead_hits | P0 | 2P | Pilot A (harness) flies the target: `[{t: 4, strafe_long: 1.0, boost: true}, {t: 12, strafe_long: 1.0, strafe_vert: 1.0, roll: r, boost: true}]`, `gloc: hold`. Pilot B starts 1000 m behind, boosts at the same moment, fires at the lead pip. Conditions: roll 27 / 60 / 144 / 240 deg/s (stick .1125 / .25 / .6 / 1.0), held strafe with no roll, straight line. 3 runs of 12 s each per condition, roles swapped if time. Weapons fixed or gimballed: note it. Repeat at 500 m | Hit rate per condition: **model A** (velocity-only lead) predicts about 0 % at every roll and about 43 % for the held strafe; **model B** (leads acceleration) predicts hits at 27 deg/s (miss 4.6 m, inside 8 m), a falling rate by 60 (10 m) and about 0 % at 144 and 240; the straight line is the shooter's own baseline (divide by it). Slow roll hit and fast roll missed: B. Everything missed: A. No ordering: the pip is not lead-based or the shooter's skill dominates |
| hit_radius | P1 | 2P + M | Parked target at 1000 m, shooter stopped; sweep the nose with yaw stick .05 (2.6 deg/s, 45 m/s at range) holding fire; count hit markers per sweep, then pitch sweep for the thin axis | Effective width = hits / fire rate x sweep speed x range. Compare with 17 m (width), 20 m (length), 5.5 m (height) (fixture dimensions) and the 8 m the models assume (**A**) |

## 7. Rates, tank, down G

```yaml
- id: tk_idle_boost         # P1 A  8 s   boost held, nothing else: the API says an idle cost 1/s
  steps: [{t: 8, boost: true}]
- id: tk_ang_roll           # P1 A  8 s   boost + full roll, no translation
  steps: [{t: 8, roll: 1.0, boost: true}]
- id: tk_ang_pitchyaw       # P1 A  8 s
  steps: [{t: 8, pitch: 1.0, yaw: 1.0, boost: true}]
- id: tk_regen_delay        # P2 A  boost 4 s (80 %), release 12 s; repeat from 8 s (60 %) and 14 s (30 %)
  steps: [{t: 4, strafe_lat: 1.0, boost: true}, {t: 12}]
- id: tk_reengage_tap       # P2 A  drain to empty, release, then press boost again at 20 / 25 / 30 %: the 25 % red zone was seen once (r7_tank_cycle)
  steps: [{t: 21, strafe_lat: 1.0, boost: true}, {t: 4}, {t: 2, boost: true}, {t: 4}, {t: 2, boost: true}]
# rotation onset and net lag: pitch T seconds from 100 m/s SCM, then a 1 s burn; the end speed gives the nose angle
- id: rot_onset_T25         # P2 A  (T = 0.25 / 0.5 / 1.0 s)
  steps: [{t: 1.5, strafe_long: .5}, {t: .25, pitch: 1.0}, {t: 1, strafe_long: 1.0}, {t: 1}]
- id: rot_pitchroll_fwd     # P2 A  re-measure pitch + roll with the r11 forward gauge (the 212 deg/s is from the drifting up gauge)
  steps: [{t: 10, pitch: 1.0, roll: 1.0, strafe_long: .25}]
- id: bd_down_boost_hold    # P2 A  boosted full down 5 s, read slope AND meter (6.8 vs 6.7 G)
  gloc: hold
  steps: [{t: 5, strafe_vert: -1.0, boost: true}]
```

Reading: tank drain of 5.0 %/s with an idle boost, a spinning boost and a pitch+yaw boost means the API's idle cost is the same 5 %/s and the angular cost is 0 (agrees with d04); a higher number (for example 7 %/s) is the angular cost and it changes `flip-burn`'s tank budget. `tk_regen_delay`: refill starting at once at 3.75 %/s (M) or after a delay. Rotation onset: with pitch 68 deg/s and a 100 m/s start, each degree of heading changes the end speed by about 1.1 m/s (**Mod**), so net lag is resolvable to about 0.015 s; nothing in the app changes unless it exceeds about 0.2 s (a 0.2 s lag adds about 0.1 s to the 2.65 s flip). Pitch+roll: independent axes 211, capped 200 (**Mod**).

## 8. Suggested running order for one 2-hour single-pilot session

Harness work first (HC1, HC2 at least; HC3-HC5 are not needed). Stop after any block if the pilot is fatigued: G-LOC testing is hard on the pilot, rest between blocks. Wall times include the harness's braking and refilling.

| Clock | Block | Tests | Why here |
|---|---|---|---|
| 0:00-0:15 | Setup | `dircheck`, `ocrcheck`, `fpscheck` (4K; recalibrate the ROIs, the FOV is not default); throttle check; run `g02_lat_wall_roll50` as the drift control | Make sure the day looks like the baseline |
| 0:15-0:25 | FOV | `fov_yaw`, `fov_pitch` with video; `fov_tvi_25/50/75` (needs HC1) | Cheap, blocks the pilot view and the TVI maths |
| 0:25-0:50 | Spacebrake | Round 12 (6), then `r12x_brake_lat225`, `_up225`, `_down225`, `_diag`, `_plus_fwd`, `_plus_counter`, `_050`, `_100`, the four `flip_burn`, `_rotation` | P0 for three lessons and the app's brake model |
| 0:50-1:20 | G-LOC core | `g01`, `g05`, `g09_lat_fall`, `g09_pulse_1_1`, `g07d_dodge_mid_repeat` x3, `g07d_dodge_scm`, `g07d_dodge_bst_lowfwd`, `g07_fwd_rev_scm`, `_bst085`, `_bst100`, `g04`; then P1 as time allows: `g09_lat_ramp`, `g03_*`, `g10_*`, `g09_pulse_2_2`, `g06`, `g07_fwd_rev_bst065` | Hypotheses H1/H3 first (`g01`), profile second |
| 1:20-1:40 | Side push and TVI | `sp_*` ten tests, `tvi_roll27/60/120/240` | Dodge lessons and `ck-shoot` |
| 1:40-1:52 | Partial forward | `pf_f100/f75/f50/f25` at roll .25, then .5 as time allows | The flee gap; two thirds P1 |
| 1:52-2:00 | Slack | `tk_idle_boost`, `tk_ang_roll`, `proj_inherit` by video | Quick P1/P0 items; `proj_inherit` is a 5-minute single-pilot P0 and should be flown early if the session is cut short |

Not in the 2 hours (second session, two pilots, about 60 min): `proj_speed`, `proj_chase`, `lead_hits`, `hit_radius`. `proj_inherit` is the one to do in session one because it decides whether the lead-pip test is worth flying. Rest of the P2 items (`g11`, `g12`, `rot_*`, `tk_regen`, `tk_reengage`, `bd_down`) go in a spare slot.

## 9. What each result lets us change in the app

| Result | Change allowed |
|---|---|
| `r12*` brake group | The app's brake model (`site/index.html` around line 494, **A** today), the `let-go` lesson text and caption (`index.html:356`), `flip-burn` comparison table and its "flip wins above 160 m/s" line, PLAN 4.6, `evasion-analysis` section 6, the persona's brake paragraph, claim (a) |
| `g01`, `g05` | Whether roll goes into the G-LOC model; whether `ck-escape` axis advice stays "up, then lateral, never down" as stated; whether the `vision` model needs a roll term |
| `g07d_*`, `g09_*`, `g10_*` | The shape of the stress model (filter/delay, drain rate, carry-over from a forward launch) in `packages/core`; the `dodge-mid` lesson's G-LOC remark; the fixture entry for `r7_dodge_mid_boost`; the flee lesson's G-LOC overlay |
| `g07_fwd_rev_*` | Forward tolerance (13.5 G F today) and the `flip-burn` "cut the throttle at zero" warning; the backward 8 G stays inequality-only unless d05 shows a dip |
| `sp_*` | `boostSide` (smooth fall instead of the 358 m/s step); `dodge-mid`, `dodge-nose` (3-6 G versus ~12 G) and `letoff` sideways-metres readouts |
| `fov_*` | The FOV slider default and meaning, HUD layout scale (PLAN section 6), the "match my screen" helper, the TVI position in the pilot view |
| `tvi_*` | `ck-shoot` TVI numbers and the "takes 10 s to anchor" note; the TVI/helix model |
| `pf_*` | The partial-forward rule in the core, the "less forward" rows of `evasion-analysis` section 3, the flee lesson |
| `proj_*`, `lead_hits`, `hit_radius` | Flight time in every miss readout (**A** today), the chase and closing-speed model, which roll rate the corkscrew lessons recommend (27 against 144-160 deg/s), claim (b), the 8 m hit radius |
| `tk_*`, `d04` | Boost-cost figures in `flip-burn` and the roll lessons; remove "angular boost cost 0 / not measured" |
| `rot_*` | The instant-onset assumption in `rotation.ts` (only if net lag exceeds about 0.2 s) |
| `d01`, `d02`, `d03` | Fixture merge for `r7_dodge_mid_boost`; what the pilot view draws (HUD fade versus screen darkness); the recovery curve |

## 10. Update, 2026-10-09: test at gun range (500-600 m)

The pilot set the engagement range: 500-600 m with Panther repeaters, never 1 km. Every two-pilot test above that says 1000 m is
flown at **550 m** instead (`lead_hits`: 550 m and 400 m; `proj_speed`: 300 / 550 / 800 m; `proj_chase`: 550 m). Standing conditions
are unchanged: Decoupled, G-Safe OFF, 4K, FOV 100, Arena Commander free flight, pilot present, never PU or PvP.

| ID | P | Auto | Procedure | What it settles |
|---|---|---|---|---|
| chase_equal | P0 | 2P | Both Gladii boosted at the nose, shooter 550 m behind, both full forward. Target flies 12 s of: (a) up + full roll (wall); (b) up + roll 27 deg/s (far TVI); (c) forward released, up + full roll; (d) straight line as the baseline. Shooter fires at the pip throughout. Log range each second (HUD) and hit markers. 3 runs each | The coaches' rules against a same-top-speed chaser: does the range hold on the wall and close in (b) and (c), and do the hit rates follow (model: the corkscrew alone shifts shots only 2-5 m at this range) |
| chase_delta | P1 | 2P | As (a), but the shooter starts at 700 m and closes with a positive delta (target at 450 m/s forward, shooter on the wall), firing from 600 m in | How much a positive delta raises the hit rate at the same range |
