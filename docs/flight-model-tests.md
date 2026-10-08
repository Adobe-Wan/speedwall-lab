# In-game tests still needed (Gladius, decoupled)

What the simulator still guesses, and the test that would replace each guess. All runs are in **Arena Commander free flight, with the pilot present**, using `tools/sc-flighttest` (vJoy + HUD OCR). Rounds 1–3 are in the fixture; rounds 4–9 are in progress (6 and 7 have been flown; 8 and 9 are the vision and camera-key rounds).

## Run it

One-time setup is in `tools/sc-flighttest/README.md` (vJoy with 6 axes and 8 buttons, `setup.bat`). The commands, in order, from `tools\sc-flighttest`:

| Step | Command | What it does |
|---|---|---|
| 1 | Load `star-citizen\speedwall-vjoy-js4.xml` in game | Binds vJoy (joystick 4) to the 8 actions the tests use. Then set deadzone 0 / linear / saturation 100 % on the vJoy device. |
| 2 | `.venv\Scripts\python run.py dircheck` | Pushes each axis in turn; the ship must go forward, right, up, nose up, yaw right, roll right. Invert in game what's wrong. |
| 2b | `.venv\Scripts\python run.py camcheck` | Rounds 8 and 9: presses vJoy button 3 (bound to the camera key) until the cockpit view comes back, shows each press's cut, counts the views (three: cockpit, external A, external B) and prints the `probe_views` to put in `config.yaml`. |
| 3 | `.venv\Scripts\python run.py ocrcheck` | Live HUD readings. If any is `None`: `python run.py calibrate`. Then `python run.py fpscheck` (30 fps or more). |
| 4 | **`run_campaign.bat`** | Rounds 6, 7, 8, 9, 5, 4 as one run: the ship flips 180° by pitch between tests, then processes, analyzes and zips. About 90 minutes. `--rounds 8 9 5 4` skips rounds 6 and 7 (already flown); `--rounds 8` just the corkscrews, `--rounds 9` just the vision gradient. |
| 5 | Send back `results\<session>-data.zip` | Contains `summary.csv`, every test's `series.csv`, `vision.csv`, `probe.json`, `meta.json`, `commands.csv` and the `config.yaml` used (no raw frames; keep the `results` folder, the frames are there if a threshold has to be re-tuned). |

Free flight, decoupled, **SCM**, open space, nothing ahead, **G-safe off**. F12 releases every input and stops. Never in the persistent universe or PvP.

To fly one round or a few tests: `python run.py run --tests tests_round6.yaml` or `python run.py run r6_release_all --tests tests_round6.yaml`; then `python run.py process <session>` and `python run.py analyze <session>`.

## What each round settles

Run order is 6 → 7 → 8 → 9 → 5 → 4. Round 6 fixes a reported bug, round 7 changes what the lessons teach, and rounds 5 and 4 refine numbers that are already close.

| Round / file | What it settles | Now in the model | Tests |
|---|---|---|---|
| **6** `tests_round6.yaml` | **Speed after boost is let go, above the SCM cap:** the whole fall from 519 m/s down to 225 m/s, from the nose (all inputs released; forward held; forward + strafe held) and from ~450, ~350 and ~280 m/s | Assumed: the bleed never drops below the SCM retro rating (4.24 G), so ~5 s to 225 from the nose. The fitted quadratic alone left the ship above SCM 20 s later, which pilots noticed. | 6 |
| **8** `tests_round8.yaml` | **What corkscrews do to the pilot, and which one is worth flying:** 53 tests, all one-direction (101/201) except five advanced countermeasures. A the 30-corkscrew map (strafe axis + roll with forward held, started together from rest, at the SCM sphere and the boost egg); B boosted escapes from rest and from a ~300 m/s running start, with the 75 % roll rate and down strafes; C red-out in SCM; D held down strafes; E onset by axis; F countermeasures (reverse the corkscrew when practically black). Every test presses the camera key; when the screen goes dark a black check says whether the blackout is TRUE | Only the qualitative round 3 note and round 7's HUD-only onset times | 53 |
| **9** `tests_round9.yaml` | **The vision gradient, uninterrupted:** the main stimuli again with no camera presses, so the cockpit view is up throughout. `vision.csv` per test = darkness of the centre, middle ring and edge, red tint, HUD fade and inputs against time, for the simulator's pilot view | Not modeled | 11 |
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

## How vision (G-LOC) is handled

- **A black screen is not the end.** A pilot whose screen goes dark can regain vision by counter-strafing (reversing the strafe and roll). An earlier harness let go of the controls when the HUD faded, which ended every blackout test early and could never see that. Corkscrew tests now **hold** their inputs to the end; only the five round-8 countermeasure tests **reverse**, and they are labelled an advanced tactic: the 101/201 corkscrews are flown in one direction.
- **What decides a TRUE blackout is the camera key.** Star Citizen's camera key cycles three views (cockpit, external A, external B); each press fades, cuts and fades in. When the screen is suspected black (dark for 0.5 s, or the HUD gone) the harness presses the key at once and every 0.7 s while it lasts: if the camera switches, the pilot was not truly blacked out; if it does nothing, the blackout is real. `probe_true_blackout_s`, `probe_conscious_dark_s`, `probe_key_lost_s`, `probe_black_checks_worked/dead`. A cut is visible even on a nearly black screen (it scored about 1.0 against 0.15 for anything else in a real recording).
- **The HUD digits exist only in the cockpit view,** and for about a second after cutting back to it. HUD-based marks (`grey_at`, `hud_black_at`) are read from settled cockpit frames only. The first version read the HUD while the camera was in an external view and called the first camera switch a blackout.
- **The vision gradient.** Every test records the centre of the screen in colour at 60 fps and the whole screen every 0.5 s. `vision.csv` gives, per picture, the darkness (0 clear .. 1 black) of the centre, the middle ring and the edge, each against its own pre-test level, the red share of each (red-out: a down strafe pushes the blood to the head), the HUD fade and the inputs, plus `valid` (cockpit view up and settled). Round 9 keeps the cockpit view up throughout, round 8 samples it between camera presses. `analyze` reports `dark_t20/50/80`, `dark_peak`, `edge_dark_t50`, `red_at`, `red_peak`, `vision_effect` (red or grey) and, for countermeasure tests, `vision_back_s`.
- **Corkscrews start before the speedwall.** In a fight a pilot escapes with everything at once: boost, forward, strafe and roll. Every round-8 corkscrew starts from rest (or, in the `late` tests, after 1.6 s of boost at about 300 m/s), not after pinning at the wall. Round 7 C pinned at the nose for 6 s first and is the contrast.
- **CIG's rule isn't known here.** It isn't published, and nothing in the simulator assumes one. Round 3 shows it isn't a simple "G over a limit": lateral + roll greyed out faster than up + roll at similar G. Round 7 A: lateral grey 3.6 s / HUD gone 5.1 s; up grey 6.6 s / 8.3 s; full down grey 5.6 s / 10.1 s (HUD only; the camera-key verdict is round 8's job).
- **Spiral radius** = side acceleration / roll rate² (rad/s), so a slower roll also makes a wider spiral; round 7 B tested easing the strafe or the roll instead of letting go.

## Not automatable yet
- **Does the lead pip use target acceleration?** This needs two pilots and a hit count. It decides whether a steady corkscrew beats changing the plane.
- **Coupled mode.** The alpha is decoupled only.
- **Other ships.** Each needs rounds 1–3 again.

## After the data arrives
1. Unpack the zip under `research/raw/` (or send it) and read `summary.csv`.
2. Add the results to `research/gladius-v1-fixture.json` with provenance.
3. `pnpm fit`, then `pnpm test:physics`.
4. Replace each `assumed` value they settle, in `packages/data-gladius/src/profile.ts`, `docs/physics-fit.md` and the lesson copy.
