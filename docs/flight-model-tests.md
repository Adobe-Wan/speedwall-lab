# In-game tests still needed (Gladius, decoupled)

What the simulator still guesses, and the test that would replace each guess. All runs are in **Arena Commander free flight, with the pilot present**, using `tools/sc-flighttest` (vJoy + HUD OCR). Rounds 1–3 are in the fixture; rounds 4–7 haven't been run yet.

## Run it

One-time setup is in `tools/sc-flighttest/README.md` (vJoy with 6 axes and 8 buttons, `setup.bat`). The commands, in order, from `tools\sc-flighttest`:

| Step | Command | What it does |
|---|---|---|
| 1 | Load `star-citizen\speedwall-vjoy-js4.xml` in game | Binds vJoy (joystick 4) to the 8 actions the tests use. Then set deadzone 0 / linear / saturation 100 % on the vJoy device. |
| 2 | `.venv\Scripts\python run.py dircheck` | Pushes each axis in turn; the ship must go forward, right, up, nose up, yaw right, roll right. Invert in game what's wrong. |
| 2b | `.venv\Scripts\python run.py camcheck` | Round 8 only: presses vJoy button 3 (bound to the camera key) twice and checks that the middle of the screen changes. Prints the `cam_state_thr` to put in `config.yaml`. |
| 3 | `.venv\Scripts\python run.py ocrcheck` | Live HUD readings. If any is `None`: `python run.py calibrate`. Then `python run.py fpscheck` (30 fps or more). |
| 4 | **`run_campaign.bat`** | Rounds 6, 7, 8, 5, 4 as one run: the ship flips 180° by pitch between tests, then processes, analyzes and zips. About 70 minutes. `--rounds 6` flies just the release tests; `--rounds 8` just the corkscrew map. |
| 5 | Send back `results\<session>-data.zip` | Contains `summary.csv`, every test's `series.csv`, `meta.json`, `commands.csv` and the `config.yaml` used (no raw frames). |

Free flight, decoupled, **SCM**, open space, nothing ahead, **G-safe off**. F12 releases every input and stops. Never in the persistent universe or PvP.

To fly one round or a few tests: `python run.py run --tests tests_round6.yaml` or `python run.py run r6_release_all --tests tests_round6.yaml`; then `python run.py process <session>` and `python run.py analyze <session>`.

## What each round settles

Run order is 6 → 7 → 5 → 4. Round 6 fixes a reported bug, round 7 changes what the lessons teach, and rounds 5 and 4 refine numbers that are already close.

| Round / file | What it settles | Now in the model | Tests |
|---|---|---|---|
| **6** `tests_round6.yaml` | **Speed after boost is let go, above the SCM cap:** the whole fall from 519 m/s down to 225 m/s, from the nose (all inputs released; forward held; forward + strafe held) and from ~450, ~350 and ~280 m/s | Assumed: the bleed never drops below the SCM retro rating (4.24 G), so ~5 s to 225 from the nose. The fitted quadratic alone left the ship above SCM 20 s later, which pilots noticed. | 6 |
| **8** `tests_round8.yaml` | **The corkscrew map:** 30 corkscrews (a strafe axis + roll, with forward held) at different points of the SCM sphere and the boost egg, at slow and fast roll, up and sideways. With the camera-key probe, each reports when it greyed you out, when you blacked out, and when the camera key stopped working | Only the qualitative round 3 note | 30 |
| **7** A `tests_round7.yaml` | **G-LOC onset by axis:** seconds to grey-out and to blackout at ~10 G lateral vs up, and ~5 G up vs down | One qualitative note: lateral + roll greys out in 2–3 s, up + roll in 4–7 s | 4 |
| **7** B | **Managing G-LOC:** the strafe or roll level you can hold for 20 s, easing instead of letting go | Not modeled | 3 |
| **7** C | **Boosted escape corkscrew:** speed kept and side G at roll 25/50/75 %, up vs lateral | Only roll 100 % is measured (514 m/s, 5.4 G) | 4 |
| **7** D | **Dodge from mid-egg** (~300 m/s) | Model only (~180 m in 2 s) | 1 |
| **7** E | **Boost tank:** drain, regen, and whether boost really comes back at 25 % | Drain 4.8 %/s and regen 4 %/s have no stated source; the 25 % red zone is assumed | 1 |
| **7** F | **Spacebrake** from the boosted nose | Not measured | 1 |
| **5** `tests_round5.yaml` | **Egg shape near the nose** (yaw sweep) and the long nose slide | Limaçon, validated within 1 % from rest | 5 |
| **4** `tests_round4.yaml` | **Boosted back and down G** (the last third-party values) | 5.9 G and 6.6 G from spviewer | 4 |

## Boost release: what round 6 reports

For every release test, `analyze` writes (seconds after the release as commanded; the HUD lags about 0.3 s): `rel_start_mps`, `rel_speed_at_{0.5,1,2,3,5,8,12,20}s`, `rel_t_to_{400,300,260,240,230,226}`, `rel_decel_G_first1s`, `rel_decel_G_300_to_235` and `rel_end_above_scm_mps`.

- `rel_t_to_226` is empty when the ship was still above 225 m/s when the recording ended. That is the answer to "does speed stay above SCM": the windows are 25 s from the nose, longer than the old fit's tail.
- `rel_decel_G_300_to_235` is the number that matters most. A quadratic bleed fades toward 0 there; the model now assumes at least 4.24 G.

## How G-LOC is handled

- **The camera-key probe (round 8).** While greying out you can still switch to the external camera, until you are fully blacked out; then the key stops working. The harness presses vJoy button 3 (bound to the camera cycle) every 0.6 s during a corkscrew and watches the middle of the screen, so every test reports `probe_last_toggle_s` and `probe_control_lost_s` next to the HUD's `grey_at` and `gloc_at`. After the blackout it also presses once or twice in the dark and checks, once vision is back, whether the camera moved (`dark_press_worked`), because a black screen can't show it. Run `camcheck` once first, and `camstrip` on the first test to check the detection by eye.
- **What round 8 maps.** The forward fraction picks the point on the egg the corkscrew settles at (boosted: 0 → the sides, 394 m/s; 0.25 → 441; 0.5 → 455; 1 → near the nose, 501), so the 30 tests show how roll rate, strafe axis and position in the bubble combine. That is the limit of your corkscrews: the longest each one can be held before control is lost.

- **CIG's rule isn't known here.** It isn't published, and nothing in the simulator assumes one. Round 3 shows it isn't a simple "G over a limit": lateral + roll greyed out faster than up + roll at similar G. So the tests measure what you see instead of assuming a formula.
- **The harness sees the HUD digits' brightness**, nothing else. In every test it marks the **grey-out** (HUD below 80 %: `grey_at`) and the **blackout** (below 50 %: `gloc_at`). The gap is how long you keep useful control while greying (`grey_to_black_s`). After a let-go, `recovery_s` is how long vision took to come back.
- **Letting go isn't how a pilot flies it.** A test marked `gloc: ease` cuts the chosen inputs by 15 % each time the HUD greys (at most once per 1.5 s) and keeps flying. The level that stops the grey-out is the sustainable one (`ease_events`, `sustained_scale`). It lets go only on a blackout, or once the inputs are down to 25 %.
- **A held strafe can't test G-LOC.** It pulls G only until the ship reaches the wall (about 2.3 s in SCM). Sustained G needs a corkscrew, so every G-LOC test is one.
- **Two ways to ease** (round 7 B): the strafe (less G, same spin) or the roll rate (same G, slower spin). If easing the roll never clears the grey-out, G-LOC follows G, not spin. Spiral radius = side acceleration ÷ roll rate² (rad/s), so a slower roll also makes a wider spiral.
- **Round 7 A** keeps the default let-go, because the time to grey-out and to blackout is the measurement.

## Not automatable yet
- **Does the lead pip use target acceleration?** This needs two pilots and a hit count. It decides whether a steady corkscrew beats changing the plane.
- **Coupled mode.** The alpha is decoupled only.
- **Other ships.** Each needs rounds 1–3 again.

## After the data arrives
1. Unpack the zip under `research/raw/` (or send it) and read `summary.csv`.
2. Add the results to `research/gladius-v1-fixture.json` with provenance.
3. `pnpm fit`, then `pnpm test:physics`.
4. Replace each `assumed` value they settle, in `packages/data-gladius/src/profile.ts`, `docs/physics-fit.md` and the lesson copy.
