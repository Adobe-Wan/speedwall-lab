# sc-flighttest

Repeatable Star Citizen flight tests. A virtual joystick (vJoy) holds **exact** inputs for **exact** durations while the HUD speed, G meter and boost readouts are recorded, roughly 60 times a second. Afterwards everything is read automatically into CSV files: no stopwatch, no hand on the stick.

> **Use responsibly.** Run tests only in **Arena Commander free flight**, stay at your PC while they run, and never use this in the persistent universe or PvP. Inputs are only sent while the Star Citizen window is focused. **Press F12 at any time to release every input and stop.**

---

## 1. One-time setup

### vJoy
1. Open **Configure vJoy** and set device **1** to have axes **X, Y, Z, Rx, Ry, Rz** and at least **8 buttons**. Apply.
2. Leave vJoy installed and enabled.

### Python + this tool
1. Install **Python 3.12** from python.org, and tick "Add python.exe to PATH".
2. Double-click **`setup.bat`** in this folder. It creates a private environment (`.venv`) and installs everything.
3. From then on, open a terminal in this folder and run commands as `.venv\Scripts\python run.py ...`. Or run `.venv\Scripts\activate` once per terminal, then plain `python run.py ...`.

### Star Citizen profile (fastest: load a file instead of binding by hand)
`star-citizen\speedwall-vjoy-js4.xml` binds the vJoy device, which the game sees as **joystick 4** (`js4`), to the eight actions the tests use, and nothing else:

| vJoy | Star Citizen action |
|---|---|
| X / Y / Z | Strafe Left-Right / Forward-Backward / Up-Down |
| Rx / Ry / Rz | Pitch / Yaw / Roll |
| button 1 / button 2 | Afterburner / Spacebrake |

1. Back up `...\StarCitizen\LIVE\user\client\0\Profiles\default\actionmaps.xml`.
2. Copy the XML into `...\StarCitizen\LIVE\user\client\0\controls\mappings\` (create the folder if it isn't there).
3. In game: **Options → Keybindings → Advanced Controls Customization**, then the profile list at the bottom, select `speedwall-vjoy-js4`, **Load**.
4. Select the **vJoy** device and set **deadzone 0, curve linear, saturation 100 %** on every axis. The file can't set these.
5. In free flight, decoupled, SCM, ship stopped: `python run.py dircheck`. It pushes each axis in turn and tells you what the ship must do. Invert in game any axis that went the wrong way; never change `config.yaml`.

CIG doesn't document this file format; the profile is written from community knowledge and the app's importer reads it back correctly, but I couldn't try it in the game. If Star Citizen ignores it, or your vJoy isn't joystick 4 (the number is in the `js4_` names and `instance="4"`; find-and-replace it), use the manual steps below.

### Bind vJoy in Star Citizen by hand
In Star Citizen: **Options → Keybindings → Advanced Controls Customization**, under *Flight – Movement*. For each row below:
1. Double-click the action in Star Citizen.
2. Alt-Tab to the terminal and run the command.
3. Alt-Tab back within 4 seconds. The tool sweeps that one vJoy axis or presses that one button, and Star Citizen picks it up.

| Control | Star Citizen action | Command |
|---|---|---|
| strafe_long | Strafe Forward / Backward (abs.) | `python run.py bind strafe_long` |
| strafe_lat | Strafe Left / Right (abs.) | `python run.py bind strafe_lat` |
| strafe_vert | Strafe Up / Down (abs.) | `python run.py bind strafe_vert` |
| roll | Roll | `python run.py bind roll` |
| pitch | Pitch | `python run.py bind pitch` |
| yaw | Yaw | `python run.py bind yaw` |
| boost | Afterburner | `python run.py bind boost` |
| brake | Spacebrake | `python run.py bind brake` |

Then, in **Options → Keybindings → Advanced Controls Customization → Devices**, select the **vJoy** device and set **deadzone 0, curve/exponent linear (1.0), saturation 100%** for every axis. The tests depend on 50% meaning 50%.

**Direction check (in flight, decoupled):** `python run.py hold strafe_vert 1 3` should push the ship **up** for 3 s; `python run.py hold roll 1 2` should roll **right**. If one is reversed, invert that axis in Star Citizen.

Keep your own joysticks and pedals centered and untouched during runs, or their noise adds to the test inputs.

## 2. Check the HUD readout regions
The default regions match a **Gladius, default FOV, 16:9** (taken from your screenshot). With Star Citizen open in the cockpit, run:

```
python run.py ocrcheck
```

It prints live `speed / g / ab` readings for 10 seconds. If they're wrong or `None`, run `python run.py calibrate` (add `--monitor 2` if the game is on your second screen) and drag a box over:
- the speed digits;
- the G number;
- the AB (boost) percent.

Skip the last "sky" box: press `c` to keep it. It's no longer used.

Then run `python run.py fpscheck`. "one grab per frame" should read **30 fps or more** (ideally about 60).

## 3. Fly the tests
1. **Arena Commander → Free Flight**, **Gladius**, open space, nothing ahead of you. Tests cover up to ~8 km.
2. Switch to **decoupled** mode and **SCM** master mode.
3. In a terminal: `python run.py list --tests tests_round3.yaml` to see the tests, then `python run.py run --tests tests_round3.yaml` (29 tests, about 25 minutes) or a few by id.
4. Click back into Star Citizen within 5 seconds. Hands off.

**All the outstanding rounds at once:** `run_campaign.bat` (or `python run.py campaign`). It flies rounds 6, 7, 5 and 4 as one list, processes and analyzes them, and zips the results. `--rounds 6 7` picks some. See `docs/flight-model-tests.md` for the order and what each round settles.

Each test:
1. Spacebrakes until the speed reads 0–1 m/s three times in a row.
2. Flips the ship 180° with a full **pitch** (2.8 s at the Gladius's 68 °/s), so consecutive tests fly in opposite directions and stay inside the arena. Forward and up/down reverse; left/right does not, so every second lateral test is flown with `strafe_lat` negated (the ship is left/right symmetric; `lat_mirrored` in `meta.json` says which). Set `turnaround_axis: yaw` or `mirror_lateral: false` in `config.yaml` to change this.
3. Waits for a full boost tank (boosted tests only).
4. Refuses to start if the ship is still moving.
5. Holds its inputs, then records a short coast.

Results go to `results\<date-time>\<test id>\`.

**Map boundary.** After braking, the ship yaws about 180° before the next test, so tests alternate direction and the run stays near where it started. A yaw reverses both forward and left/right, so nothing accumulates. Start in the middle of the map. If the turn is badly over- or under-shot, set `turnaround_s` in `config.yaml` (180 ÷ yaw rate). Round 3's `rg_yaw_100` measures the yaw rate.

**Blackouts (G-LOC).** Each test picks how the harness reacts when the HUD digits fade:
- `gloc: release` (the default): on a blackout (HUD below 50 % brightness), let go of every input, mark it in the results (`gloc_at`), and end the test early.
- `gloc: ease`: the way a pilot flies it. On a grey-out (HUD below 80 %), cut the test's `ease_axes` by `ease_step` (15 %) and keep flying, at most once every 1.5 s. The level that stops the grey-out is the sustainable one (`ease_events`, and `sustained_scale` in `analyze`). It still lets go on a blackout, or once the inputs are below `ease_min` (25 %).

After a let-go, the run waits for your vision to come back, plus 8 s, before the next test.

A held strafe only pulls G until it reaches the wall (about 2.3 s in SCM), so it can't black you out. Sustained G comes from corkscrews (strafe + roll). Round 3 found lateral + roll greys out in 2–3 s and up + roll in 4–7 s; round 7 measures it.

**What the harness can and can't know.** It sees only the HUD digits' brightness. It marks two moments in every test: the **grey-out** (HUD below 80 %, `grey_at`) and the **blackout** (below 50 %, `gloc_at`). The gap between them (`grey_to_black_s`) is how long you keep useful control while greying out. After a let-go, `recovery_s` is how long vision took to come back. Star Citizen's actual G-LOC rule isn't published and isn't assumed anywhere: the onset times, the `ease` levels and the recovery times are the data from which the simulator's model gets built.

### How rotation is measured (no sky camera)
In decoupled mode, a strafe thrust is fixed to the ship. Rotating the ship spins that thrust vector, so the velocity traces a circle and the HUD speed rises and falls once per full rotation. The period gives the rotation rate, and the size of the swing gives the thrust. A fit on round 2's roll + up test gave **239.9 °/s** and **12.9 G**, against a spec of 240 °/s and 12.9 G, with 0.25 m/s error. The `rg_*` tests use a gentle 25% strafe, so the G-load stays around 2–3 G.

## 4. Read the results
```
python run.py process <session-folder-name>
python run.py analyze <session-folder-name>
```
`analyze` writes `summary.csv`. For each test, next to the model's prediction:
- `start_speed`, `gloc_at`, and for G-LOC: `grey_at`, `grey_to_black_s`, `recovery_s`, `ease_events`, `sustained_scale`;
- for boost-release tests (a boosted step followed by a boost-free one): `rel_start_mps`, `rel_speed_at_*s`, `rel_t_to_226` (and 400/300/260/240/230), `rel_decel_G_first1s`, `rel_decel_G_300_to_235`, `rel_end_above_scm_mps`;
- plateau speed and `plateau_drift_mps_per_s` (non-zero means it was still settling);
- time to 100/200/300/400/480 m/s;
- fitted acceleration in G;
- G-meter readings;
- `rot_dps_osc` (rotation rate from the speed swing) and `roll_dps_gmeter` (corkscrews). Tell Claude when a session is done; it can read the `results` folder directly.

## Files
- `config.yaml`: vJoy mapping, safety, screen regions, timings.
- `tests.yaml`: the test suite; add your own (steps hold inputs for `t` seconds).
- `run.py`: the commands above.
- `sctest/`: vJoy output, safety guard, capture, OCR, roll tracking, analysis.

## Troubleshooting
- **`pyvjoy` can't find the DLL:** copy `vJoyInterface.dll` from `C:\Program Files\vJoy\x64\` next to `run.py`.
- **"game window lost focus":** the run stops whenever another window takes focus. That's by design.
- **Low speed-read rate in `summary.csv`:** recalibrate the speed box tighter around the digits.
- **Capture below 30 fps:** run `python run.py fpscheck`. On some PCs, each screen grab waits for a display refresh. That's why separate grabs ran at only 15 fps in round 2; the runner now grabs once per frame. If "one grab per frame" is still slow, try borderless windowed mode, and turn off HDR for the game.
