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

### Bind vJoy in Star Citizen
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

Each test:
1. Spacebrakes until the speed reads 0–1 m/s three times in a row.
2. Waits for a full boost tank (boosted tests only).
3. Refuses to start if the ship is still moving.
4. Holds its inputs, then records a short coast.

Results go to `results\<date-time>\<test id>\`.

**Map boundary.** After braking, the ship yaws about 180° before the next test, so tests alternate direction and the run stays near where it started. A yaw reverses both forward and left/right, so nothing accumulates. Start in the middle of the map. If the turn is badly over- or under-shot, set `turnaround_s` in `config.yaml` (180 ÷ yaw rate). Round 3's `rg_yaw_100` measures the yaw rate.

**Blackouts (G-LOC).** If the HUD digits fade (grey-out or blackout), the harness:
- releases every input and ends that test early;
- marks it in the results;
- waits for your vision to come back, plus 8 s, before the next test.

Sustained **up** strafe is what blacks you out, so round 3 pushes sideways with left/right strafe.

### How rotation is measured (no sky camera)
In decoupled mode, a strafe thrust is fixed to the ship. Rotating the ship spins that thrust vector, so the velocity traces a circle and the HUD speed rises and falls once per full rotation. The period gives the rotation rate, and the size of the swing gives the thrust. A fit on round 2's roll + up test gave **239.9 °/s** and **12.9 G**, against a spec of 240 °/s and 12.9 G, with 0.25 m/s error. The `rg_*` tests use a gentle 25% strafe, so the G-load stays around 2–3 G.

## 4. Read the results
```
python run.py process <session-folder-name>
python run.py analyze <session-folder-name>
```
`analyze` writes `summary.csv`. For each test, next to the model's prediction:
- `start_speed`, `gloc_at`;
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
