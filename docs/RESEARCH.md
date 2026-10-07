> **Archived research record (2026-10-07).** This was the build plan through test round 3. The active build spec is now `/PLAN.md`; where they differ, PLAN.md wins. Kept intact for its research, test data and later-version designs (fleet, corkscrew, duel, TVI anchoring).

# Speedwall Visualizer — Build Plan for Claude Code

> Hand-off plan. Put this file at the repo root, with `research/gladius-v1-fixture.json` beside it, and start Claude Code with:
> *"Read PLAN.md. Build Version 1 (section 0) only. Start with V1-0 and stop for my review at the end of each V1 phase."*
>
> **Section 0 is the build target.** Sections 1–10 are the long-term design and research record. Keep them; don't build from them until V1 ships. Where they conflict with section 0, section 0 wins for V1.

## 0. Version 1 — the Gladius boost egg

### 0.1 Goal
One ship (the **Gladius**), one idea. A pilot sees a **3D, semi-transparent boost egg**, holds inputs, and watches their velocity point move inside it. The headline lesson:

> **Holding forward pins you at the nose of the egg, and the nose is narrow. The faster you're going forward, the less sideways speed (and dodge) you have left.**

At 0 m/s forward a boosted Gladius can strafe to 394 m/s. At 500 m/s forward, only 128 m/s of sideways room is left; at 519, 29.

### 0.2 In scope / out of scope
**In:**
- Gladius only.
- Decoupled translation: forward/back, left/right, up/down.
- Boost on/off, with the tank.
- Boost egg (3D) plus SCM sphere.
- Velocity point and trail.
- **Lateral-room disc.**
- Settle-direction ghost.
- Readouts.
- 2D top-down inset.
- Keyboard, touch and basic gamepad.
- Input presets.
- Four short guided scenes.
- Credits, disclaimer and responsive layout.

**Out (kept in sections 1–10 for later):**
- Other ships, ship picker and the data pipeline.
- Pitch, yaw and roll (the ship's attitude is fixed; nose = +X).
- Corkscrew Lab, Duel Lab and the TVI gauge.
- Coupled mode and G-LOC.
- HOTAS mapping wizard, record/replay and compare overlay.

### 0.3 Data — `research/gladius-v1-fixture.json` (measured; copy into `src/data/gladius.ts`)
Everything V1 needs is in that file. Never invent a value; anything not in it is out of scope.

| | SCM | Boost |
|---|---|---|
| Speed egg | sphere r = 225 m/s (hard wall) | limaçon of revolution about the nose: `r(θ) = 394 + 126·cosθ` (F 520, B 268, sides 394), soft wall K ≈ 1.3 s⁻¹ |
| G: fwd / back / lat / up / down | 13.6 / 4.2 / 9.95 / 9.9 / 4.97 | 21.1 / 5.9 / 12.9 / 12.9 / 6.6 |
| Tank | — | drain ≈ 4.8 %/s, regen ≈ 4 %/s (approx.) |
| Glyph | 20 × 17 × 5.5 m (author-specified; scunpacked lists 21 × 17.5 × 5.5) | |

The fixture also holds:
- **30 measured plateaus**, from hand tests and rounds 1–3, with inputs, boost flag, settled speed and accel G.
- **`fullStrafeForwardCurve`**: measured settle speeds and the derived effective forward G when strafe is at full.
- **`lateralRoom`**: egg cross-section radius vs forward speed.
- **`wallTraces`**: 0.25 s samples of speed and G-meter after a dodge starts from the forward wall. SCM: strafe only, forward + strafe, jinks. Boost: strafe only, forward + strafe.
- **`boostRelease`**: deceleration after boost is released.

### 0.4 Physics (pure TS, `src/physics/`, no React)
State: velocity (m/s, ship frame) and boost tank. Inputs `u ∈ [-1, 1]³` (fwd, lat, up) plus the boost flag. Fixed timestep (e.g. 240 Hz), deterministic.

1. **Requests.** `w_i = u_i · G_i(direction)`, using boost Gs while boost is on and the tank > 0.
2. **Cap (C2, measured).** `|a| ≤ max_i|w_i| / max_i|u_i|`; scale `w` down if over.
3. **Full-strafe forward clamp (measured, provisional).** When a strafe stick is ≥ 0.95 and the strafe request is the biggest, replace the forward request with `effectiveForwardG(u_fwd)`, interpolated from the fixture. Otherwise use rule A.
4. **Wall, in this order (measured):**
   1. Trim the outward (radial) part of the request: to 0 at the SCM sphere, to `K·(r − |v|)` in boost.
   2. Apply the cap.
   3. Cancel any remaining outward part with real thrust, limited per bank (e.g. retros, 4.2 G in SCM). This produces the measured SCM behavior: a 9.9 G dodge for ~1.3 s, then ~4.2 G while the retros bleed forward speed.
5. **Boosted-wall side thrust.** The plain model over-predicts it. Fit one or two constants in V1-1 so the boost `wallTraces` match: strafe only ≈ 6–7.5 G while speed bleeds 519 → ~435; forward + strafe ≈ 3 G at ~517.
6. **Boost release / empty tank.** The egg shrinks to the SCM sphere and IFCS decelerates; fit to `boostRelease` (≈ 18 G peak; 515 → ~390 m/s about 1.4 s after release, including ~0.3 s HUD lag).
7. **Readouts from the state:** total speed, forward and sideways components, actual acceleration in G, `pinned` (within 1% of the wall), lateral room at the current forward speed, and the predicted settle point for the held input (thrust direction ∩ egg).

### 0.5 The 3D view (react-three-fiber)
- **Frame.** Velocity space in the ship frame: nose = +X, 1 unit = 1 m/s. Orbit camera; default 3/4 view from behind and above. Reset-view button.
- **Boost egg.** Revolved limaçon mesh, **semi-transparent** (~15–20% opacity) with a fresnel edge so the silhouette reads. Latitude rings every 100 m/s of forward speed. Labels at the nose (520), sides (394) and tail (268). Its shape shows plainly how narrow the nose is.
- **SCM sphere** (225) inside: fainter, toggleable.
- **Ship glyph** at the origin. Readable size by default; a "true scale (1 m = 1 m/s)" toggle shows the honest 20 m dart inside a 788 m-long egg.
- **Velocity point** with an arrow from the origin and a 3 s trail. It glows when pinned.
- **Lateral-room disc (the key visual).** The egg's cross-section at your current forward speed, drawn as a ring through the velocity point, perpendicular to the nose. It shows the radius in m/s ("sideways room: 128 m/s") and shrinks visibly as forward speed climbs:

  | Forward m/s | 0 | 100 | 200 | 300 | 400 | 450 | 480 | 500 | 510 | 519 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Sideways room (boost) | 394 | 412 | 403 | 367 | 293 | 232 | 179 | 128 | 91 | 29 |

- **Thrust arrow** from the velocity point. When pinned, the outward part is drawn grey and dashed: "dead thrust".
- **Settle ghost.** A dashed ray from the origin along the held-input thrust direction to the egg surface: "where this input ends up". It shows predicted speed and sideways speed (full forward + full strafe → 501 m/s, 261 sideways).
- **2D inset.** Top-down slice (forward × lateral) of the same state; the primary view on phones.
- **Readouts:** speed, forward, sideways, G now, boost tank, "PINNED".
- Values tagged **measured** in the fixture show a small "measured in-game" badge; fitted constants show "fitted".

### 0.6 Inputs
- **Keyboard** (Star Citizen default feel):
  - W/S forward/back, A/D strafe, Space/Ctrl up/down, Shift boost;
  - 1–4 set forward to 25/50/75/100% while held;
  - P pause, `.` step, R reset to rest, N reset pinned at the nose.
- **Touch.** On-screen throttle slider plus a strafe pad, and a boost button.
- **Gamepad** (Gamepad API, analog, default mapping, invert toggles only).
- **Presets** (scripted inputs, then hand back control):
  - Strafe from rest;
  - Full forward, then strafe;
  - Forward + strafe from rest;
  - 25% / 50% forward + strafe;
  - Release forward to make room.
- A timescale slider (0.25×–1×).

### 0.7 Guided scenes (V1 teaching layer)
1. **"This is your boost egg."** Orbit it; the numbers at the nose, sides and tail. The SCM sphere inside it for comparison.
2. **"Strafe from rest."** You reach 394 sideways. The disc is at its widest.
3. **"Now hold forward first."**
   - You pin at 520 and the disc shrinks to ~30 m/s.
   - Add strafe: the point slides along the wall and settles at 501 m/s, only 261 sideways.
   - Measured: the sideways push at the boosted nose wall is ~3 G with forward held, vs 6–7.5 G without.
4. **"Let off forward to make room."**
   - Drop forward and the disc grows.
   - With full strafe, 40%, 50% and 60% forward all settle at the same 455 m/s (measured), so easing off a little buys nothing until you ease off a lot.
   - In SCM, forward + strafe at the wall fades to ~1 G within ~2.5 s.

Each scene is about 30–60 s, uses presets, then says "now try it yourself".

### 0.8 V1 phases (stop for review after each)
- **V1-0 Scaffold.**
  - Vite + React + TS (strict), r3f/drei, Zustand, Vitest, Playwright.
  - Fixture imported and Zod-validated.
  - Failing physics tests written from the fixture.
- **V1-1 Physics.** Implement 0.4 until it passes:
  - every fixture plateau within 1% (or ±3 m/s);
  - accel G within 5%;
  - SCM wall traces within ±1 G per sample after 0.5 s;
  - boost wall traces within ±1.5 G and ±10 m/s;
  - boost release within ±15 m/s;
  - lateral-room table exact;
  - determinism.

  Report fitted constants.
- **V1-2 3D view.** Everything in 0.5, plus the 2D inset, at 60 fps on a mid-range laptop.
- **V1-3 Inputs.** Everything in 0.6; responsive at 375 / 768 / 1440 px.
- **V1-4 Scenes and release.**
  - The four scenes.
  - Footer disclaimer, trademark line and credits (Olakeen/spviewer for Gs; the author's in-game measurements for speed caps and walls).
  - `check:release` subset: disclaimer strings, credit, no CIG assets, no monetization, glyph bbox = 20 × 17 × 5.5.

### 0.9 V1 file layout
```
src/physics/   gladius.ts (constants from fixture), egg.ts (limaçon/sphere, lateralRoom, settle point),
               thrust.ts (C2 + forward clamp), wall.ts, step.ts (+ *.test.ts against the fixture)
src/sim/       loop.ts, presets.ts
src/input/     keyboard.ts, gamepad.ts, touch.tsx
src/views/     Egg3D.tsx, LateralRoomDisc.tsx, SettleGhost.tsx, Inset2D.tsx, Readouts.tsx, ShipGlyph.tsx
src/scenes/    01-egg.ts … 04-make-room.ts
research/      gladius-v1-fixture.json (source of truth), plus everything already there
```


## 1. Goal

A responsive, educational web app that shows Star Citizen pilots **why they get "stuck" at the speed wall in SCM**. The user picks a ship, flies it with **their own inputs** (keyboard, gamepad, HOTAS, or touch), and sees their current velocity as a point inside their ship's **velocity envelope ("the egg")**, with the ship's **acceleration envelope** drawn around that point. When the point reaches the wall, the part of the acceleration envelope that pushes outward is visibly "dead" — that is the speed wall.

A second headline feature is the **Corkscrew Lab**: showing how **roll + lateral strafe** turns a straight-line approach into a helix, why that makes you hard to hit, and what limits how tight or wide the corkscrew can be for a given ship.

Two layers everywhere: **unboosted** and **boosted**.

Audience: newer pilots. Every visual needs a plain-language explanation next to it. Visual tone: **coaching-whiteboard** — simple, bold, slightly hand-drawn diagrams like a flight instructor sketches on stream, not a glossy HUD.

## 2. The core mental model (get this right before any code)

There are **two different eggs**, and the teaching moment is how they interact:

1. **Acceleration envelope (the "G egg")** — how hard the ship can push in each direction. Asymmetric: forward (main thrusters) is usually much stronger than retro; up is often stronger than down; strafe left/right is usually symmetric. Lives in *acceleration space* (m/s² or G). Boost scales it.
2. **Velocity envelope (the "speed egg")** — the maximum speed IFCS allows in each direction in SCM. Forward and backward limits can differ (boosted values certainly do). Lives in *velocity space* (m/s). Boost enlarges it.

**The speed wall, visually:** draw the current velocity `v` as a point inside the speed egg. Center a scaled copy of the G egg on that point — it shows every velocity change available right now. Where the G egg pokes **outside** the speed egg, that thrust is unusable (IFCS clamps it). At max forward speed, the forward half of the G egg is entirely outside the wall, so only the sideways component survives — and even that only *rotates* the velocity vector along the wall rather than adding a clean strafe. That's "stuck."

### The corkscrew, in one paragraph

In coupled mode, strafe input asks for a velocity **in the ship's own frame** ("keep me drifting right at 40 m/s"). If you roll while holding that strafe, "right" keeps rotating around your direction of travel, so IFCS has to keep re-aiming your sideways velocity. In world space your path becomes a **helix** around your line of travel. To an attacker looking down that line, you trace a **circle**, so a lead indicator that assumes straight-line motion keeps pointing at where you aren't.

The physics that makes it teachable (the model's prediction — verify in-game during Phase 0 calibration):

- Holding a constant sideways speed `v_lat` while rolling at rate `ω` (rad/s) needs a **centripetal acceleration of `a = ω · v_lat`**.
- That acceleration points along the ship's **local up/down axis** (perpendicular to both the strafe and the roll axis). So a strafe-right + roll corkscrew is paid for by the **vertical** thrusters, and which way you roll decides whether it lands on **up** (usually stronger) or **down** (usually weaker). Roll direction matters.
- The **sustainable sideways speed** is `v_lat ≤ a_vertical / ω`, and the **helix radius** is `r = v_lat / ω = a_vertical / ω²`. Halving the roll rate quadruples the radius. Fast roll = tight, twitchy corkscrew; slow roll = wide, lazy one.
- The sideways speed is also capped by the **speed egg's cross-section at your current forward speed**. At the forward wall that cross-section is small, so the corkscrew collapses. Coming off the wall a little buys corkscrew room. This ties the two features together.

*Worked example — Gladius, using spviewer's measured Gs (up 9.9 G, down 4.9 G) and file roll rate 200 °/s (≈3.49 rad/s):*

| Roll direction loads… | Sustainable sideways speed | Helix radius |
|---|---|---|
| **up** thrusters (9.9 G ≈ 97 m/s²) | ≈ 28 m/s | ≈ 8 m |
| **down** thrusters (4.9 G ≈ 48 m/s²) | ≈ 14 m/s | ≈ 4 m |

Rolling the "wrong" way halves the corkscrew. At 90 °/s roll on the up thrusters, the same ship holds ≈ 62 m/s sideways in a ≈ 40 m helix. These are model predictions until calibrated.

### Rotation (pitch / yaw / roll) and the Maneuver Coach

**The frame rule everything rests on.** Both eggs (the G egg and the speed egg) are **bolted to the ship**. Your velocity is **fixed in the world**. So:
- **Pitch and yaw** swing the eggs relative to your velocity. Your velocity dot moves to a different spot on the speed egg, and the G egg aims differently.
- **Roll** spins both eggs about the nose. It chooses **which thruster bank faces which world direction**.
- **Translation inputs** choose which banks push.

The coach reasons about all three levers together.

#### Lever 1: pitch/yaw — where your velocity sits on the egg
- **Boosted.** Pointing the nose δ away from your velocity lowers your cap to `r(δ)`, and IFCS bleeds the excess.

  | Nose off velocity (Gladius, boosted) | 0° | 10° | 20° | 30° | 45° | 90° |
  |---|---|---|---|---|---|---|
  | Speed cap | 520 | 518 | 512 | 503 | 483 | 394 |

  Small aim corrections are nearly free; big ones cost speed.
- **SCM.** The egg is a sphere, so **turning never costs cap speed**. Only the G egg's aim changes. This contrast is a lesson of its own: "In SCM, turn freely. In boost, every degree off-nose has a price."
- **Turning to brake** (mockup section 03): yaw/pitch so your strong axis (main thrusters, 21.1 G) opposes your velocity instead of retro (5.9 G). The coach shows time-to-stop either way: `t = v / (a × 9.81)`.

#### Lever 2: roll — put the strong bank where you need the push
- Generalized rule ("lift vector"): to accelerate in a world direction **d**, roll so **d** maps onto your strongest local axis in that plane. That's usually **up** (canopy side), never down. The coach computes `rollAngle* = argmax_φ G_egg(R(φ)·d)` live and shows it as a ghost roll indicator.
- **Decoupled corkscrew** (the validated mode): strafe + roll = **a rotating thrust vector**. Sideways velocity swings on a circle of radius `a/ω`; the helix radius is `a/ω²`. **Roll direction doesn't matter. Strafe axis does:** spin your strongest translation axis (up or lateral, never down). The miss-distance formula below applies unchanged, because it is a rotating constant acceleration either way.
- **Coupled corkscrew** (unverified): keep the center of the corkscrew over your canopy. Strafing right while rolling **left** loads the up thrusters; rolling right loads the weak down thrusters. Ships whose strafe is stronger than their up (e.g. Talon, Guardian) should instead **strafe up** and roll either way, which puts the load on the symmetric lateral thrusters. `research/corkscrew-fleet.csv` gives each ship's best setup.

#### Lever 3: roll rate — how fast to spin the corkscrew
**Measured (round 2): roll keeps its full spec rate while translating.** A boosted Gladius holding full up strafe + full roll rolled at **239.9 °/s** (spec 240) with 12.9 G of up thrust. In corkscrews at the wall, the G meter pulses once per roll: **244 °/s boosted, ~200 °/s SCM**. Round 1's "corkscrews self-limit to ~20 °/s" was a wrong inference from a model that assumed full side thrust.

**What a corkscrew actually gets at the forward wall (decoupled, full forward + full side + roll):**

| | Speed | Side thrust (G meter, mean) | Side-velocity circle `a/ω` at max roll | Helix radius `a/ω²` |
|---|---|---|---|---|
| Boosted (any roll 12–100%) | 513–514 | **5.4–6.3 G**, pulsing ±1 G at the roll rate | ≈ 13 m/s at 240 °/s | ≈ 3 m |
| SCM | 225 | **9.8 G** (the full strafe G) | ≈ 27 m/s at 200 °/s | ≈ 8 m |

- **At the boosted wall, a corkscrew keeps less than half its side thrust.** In SCM it keeps all of it. Why is unexplained: none of the simple wall models reproduces 514 m/s at 5.4 G. Round 3 (`ck_*` tests) maps it with partial forward and partial strafe. The app shows these as measured values, not derived ones.
- **At max roll, the helix is smaller than the ship** (Gladius 20 × 17 m). The evasion comes from the lead error, not from the size of the helix.
- **Miss distance** against an attacker whose lead pip extrapolates your current velocity, for projectile flight time `t`: `a·t² × f(ω·t)`, with `f(x) = √((x − sin x)² + (1 − cos x)²) / x²`.

  | ω·t | 0.25 | 0.5 | 1 | 2 | 3.5 | 4.2 |
  |---|---|---|---|---|---|---|
  | f | 0.50 | 0.50 | 0.49 | 0.45 | 0.35 | 0.30 |

  Gladius, measured values, 1 s flight time:
  - Boosted at max roll: 5.4 G and ωt = 4.2 → **≈ 16 m**.
  - Boosted at ~29 °/s (12% roll, which sustained the same 5.4 G in round 1): **≈ 26 m**.
  - SCM at max roll: 9.8 G and ωt = 3.5 → **≈ 34 m**.

  At 0.5 s flight time, roll rate barely matters (f ≈ 0.45–0.5).
- **Rules the coach teaches:**
  1. What evades is **sustained side thrust**. At the boosted nose wall you only keep ~5.5 G of it; in SCM you keep it all.
  2. Roll rate matters only for long projectile flight times. Keep `ω·t ≲ 2`: for a 1 s shot, that's ≲ 115 °/s, about half stick.
  3. The old "optimal roll ω* = a_c / v_side_max" idea is dropped. The measured side thrust doesn't depend on roll rate, so there is no thrust-vs-egg crossover to optimize. Keep `corkscrewBudget` for the egg-limited slow-roll case only.
- **G-LOC is a real limit.**
  - Up strafe + roll blacked out after about 7 s at ~10 G (SCM) and about 4 s at 12.9 G (boosted).
  - **Lateral strafe + roll greyed out after only about 2–3 s** (round 3; SCM and boosted, even at 25% roll).
  - Held strafes and jinks at similar G never did.
  - The coach flags sustained corkscrew G, with lateral + roll as the highest risk.

#### Roll input: binary keys vs an analog axis
- **A held key (Q/E) sends full deflection.** That is the ship's max roll rate (Gladius 200 °/s, 240 °/s boosted), and translation does **not** reduce it (round 2). Whether the roll curve is linear for analog axes is measured by round 3's `rg_roll_010…100` tests.
- **Why it matters.** At max roll, ω·t reaches 3.5–4.2 for a 1 s projectile flight time. That throws away about 30–40% of the miss distance a ~30–100 °/s roll would give (table above). A binary key can't hold a partial rate: pilots either over-spin or pulse the key. An **analog roll axis** (twist stick, throttle slider, rudder pedals, gamepad stick) holds it directly.
- **App support:**
  - The input wizard asks "Roll on keys or on an axis?".
  - In key mode, the sim applies full-rate roll with the IFCS angular ramp. The coach shows the duty cycle needed to average the target rate, with a live "average roll rate" meter.
  - In axis mode, the coach shows the target deflection as a marker on the roll gauge.
  - A lesson, "Why serious pilots put roll on an axis", compares the two modes on the same corkscrew, with predicted miss distance for each.

#### Duel tactics: "never combine strafes", diagonals and rolls
Model: `research/duel_sim.py`; results in `research/duel-tactics-gladius.csv`. Validated against round 3's `dd_*` wall tests (G-meter traces and jink speed dips match).
- **Setup.** Gladius, decoupled, nose on the target, starting pinned at the forward wall.
- **Attacker.** Leads with your *current* velocity. Miss = sideways error, averaged over 6 s.
- **"% missing"** = share of time the miss is over 5 m.
- Rows marked * use measured boosted-wall side thrust.

| Mode | Tactic | Miss 0.5 s | % missing | Miss 1 s | Closing m/s |
|---|---|---|---|---|---|
| SCM | Left held | 4.3 m | 31% | 15.9 m | 131 |
| SCM | **Forward + left held** | **2.4 m** | 18% | 8.7 m | 196 |
| SCM | Up + left / down + left held | 4.3 m | 23–28% | 15.9 m | 129–136 |
| SCM | Down held | 3.9 m | 32% | 15.2 m | 180 |
| SCM | Left/right jink, 1.5 s | 10.3 m | 89% | 35.2 m | 191 |
| SCM | Forward + jink | 8.7 m | 84% | 30.2 m | 220 |
| SCM | Strafe + full roll | 11.2 m | 100% | 34.4 m | 218 |
| SCM | Forward + strafe + full roll | 10.9 m | 100% | 33.5 m | 223 |
| SCM | **TVI-anchored: forward + up, roll ≈110 °/s** | **11.0 m** | 100% | **40.8 m** | 219 |
| Boost | Left held* | 7.4 m | 93% | 29.2 m | 451 |
| Boost | Forward + left held* | 3.8 m | 0% | 15.2 m | 502 |
| Boost | Forward + strafe + full roll* | 6.0 m | 100% | 16.2 m | 520 |
| Boost | **TVI-anchored: forward + up, roll ≈27 °/s*** | **6.8 m** | 100% | **26.8 m** | 497 |
| Boost | Left/right jink (model only) | 13.6 m | 92% | 46.2 m | 484 |

**Measured in round 3 (Gladius):**
- **Down + left = 9.93 G**, the lateral thrusters' G. Down alone is 4.97 G, and the two do not add up to 11.1.
- **SCM, at the wall, strafing only.** Full 9.9 G for about 1.3 s, then about **4.2 G (the retro thrusters' G)** until the forward speed is gone (about 5.5 s). At the SCM wall, a sideways dodge is limited by how fast your **retros** can bleed forward speed, not by your strafe thrusters.
- **SCM, at the wall, forward + strafe.** It starts at 9.9 G but decays to about 1 G by about 2.5 s: the velocity settles on the diagonal.
- **SCM jinks.** After the first leg each reversal drops you below the wall (about 194 m/s), so every reversal gets the full 9.9 G.
- **Boosted, at the nose wall.** Side thrust is about half the spec:
  - strafe only: 6–7.7 G (spec 12.9), while speed bleeds from 519 to 435 m/s;
  - forward + strafe: about 3 G;
  - corkscrews: 5.4–6.2 G at full strafe, 3.3 G at half strafe.

**What it says about the folk rule:**
1. **Two strafes together (up + left, down + left) are neutral to positive.** The total is capped at the strongest commanded axis, so you never lose G. Pairing the weak down axis with lateral doubles it.
2. **Forward + strafe *held* is where the rule is right.** It cuts the dodge roughly in half (SCM 2.4 vs 4.3 m; boost 3 G vs 6–7 G of side thrust), because the velocity settles on the diagonal and you become a constant-velocity target.
3. **The real rule is "never let your strafe settle".** A changing acceleration vector (roll or jinks) misses 84–100% of the time. A held input misses 0–93%, and less the longer you hold it.
4. **Forward plus roll or jinks costs little in SCM** and keeps about 220 m/s of closing speed.
5. **In decoupled mode, momentum keeps you closing without forward input.**

**Caveats:** decoupled only; the lead pip is assumed to use velocity only (see the TVI section); the boosted jink is unmeasured.

#### The TVI-anchored corkscrew (training rule: TVI off-center, level or vertical, about one AB-element away)
**The TVI** is the velocity marker: where you're actually going, relative to the nose. Holding it at a **fixed** spot off the crosshair while rolling means your sideways velocity rotates *with* the ship. That only happens when your side thrust exactly supplies the centripetal force:

```
roll rate ω = a_side / (v · sin δ)        δ = TVI angle off the crosshair
```

**What the rule actually encodes:**
- **"Level horizontally" means you're on the up (canopy) thrusters. "Vertical" means the lateral thrusters.** Side velocity ends up 90° from the thrust. So:
  - Up strafe + roll right puts the TVI **left** of the crosshair. Up strafe + roll left puts it **right**.
  - If the TVI sits level on the **same** side you're rolling toward, you're on the weak **down** thrusters.
  - Lateral strafe + roll puts the TVI above or below the crosshair.
- **The distance sets your roll rate.** The AB element is about 0.11 screen-widths from centre, so roughly 12–17° depending on FOV:
  - **Boosted at the nose wall** (~515 m/s, measured ~5.5 G side): δ 13° → **≈27 °/s** (5° → 69 °/s, 20° → 18 °/s).
  - **SCM** (225 m/s, 9.9 G): δ 13° → **≈110 °/s** (20° → 72 °/s).
  - In SCM you **can't hold the TVI closer than about 7°**, because that would need more than the 200 °/s max roll.
- **Is it best practice? Under a velocity-only lead pip, yes.**
  - It keeps all your side thrust working (the strafe never settles).
  - It picks a moderate roll rate that keeps `ω·t` low.
  - It beats max roll by about 20% (SCM) to 65% (boost) at 1 s projectile flight times, and ties it at 0.5 s.
  - It also keeps the target from spinning around your crosshair at 200+ °/s, so you can still shoot back.
  - The exact distance matters little: anything from about 5–20° (boost) gives nearly the same miss. Boosted cap cost is small: 13° off-nose costs ~3 m/s of top speed.
- **Two cautions:**
  1. **If the lead pip also uses target acceleration,** a steady corkscrew is predictable, and faster roll or jinks win. This isn't known yet; it needs a two-pilot hit-count test.
  2. **G-LOC.** In round 3, **lateral strafe + roll greyed the pilot out in about 2–3 s** (SCM and boost, even at 25% roll), while held lateral and jinks at similar G never did. Up strafe + roll at the boosted wall (~5.5 G) held 14 s. So prefer the **level/horizontal (up-thruster) variant** for sustained corkscrews.

**Pitch and yaw in a corkscrew:**
- They are for **aiming**, not for the dodge. In SC, strafe makes side force without pointing the nose (no lift needed). Pitching or yawing just repoints the eggs: free in SCM, and in boost it lowers your cap to `r(δ)`.
- **Pitch is faster than yaw** (measured 68 vs 52 °/s SCM; 81.6 vs 62.4 °/s boosted). When you must track, keep the target's drift on your pitch axis.
- **A slow, TVI-anchored roll keeps tracking feasible.** Your sideways motion makes the target drift about `v_side / range` (e.g. 150 m/s at 1.5 km ≈ 6 °/s), well within pitch and yaw authority. At max roll, that drift direction spins at 200–240 °/s.

**Relation to real flight:**
- The TVI is the HUD **flight-path marker / velocity vector**. Its offset from the boresight is angle of attack plus sideslip.
- Aircraft can only push sideways with **lift**. Lift is perpendicular to the wings and comes from pulling angle of attack, so the marker sits *below* the boresight in a pull. That's the vertical-offset case, using the wing as an "up thruster".
- "Roll to put the lift vector where you want to go, then pull" is the same idea as Lever 2.
- Real gun defense ("jink") changes the plane and G of the turn about every bullet time of flight, because lead-computing sights solve steady maneuvers. That matches finding 3.
- SC adds translation (side force with the nose on target) and removes drag and energy.

**App:**
- A **TVI gauge** in the Corkscrew Lab shows the roll rate that would anchor your current TVI offset, given measured side G.
- It flags "TVI drifting out: strafe is settling" versus "TVI orbiting: rolling faster than thrust can follow".
- It tells you which thruster bank the TVI side implies.

#### How rotation rates are measured (no camera)
In decoupled mode, a strafe thrust is fixed to the ship, so rotating the ship spins the thrust vector. Velocity traces a circle of radius `R = a/ω` around a fixed centre `c`, and the HUD speed follows:

```
|v|² = c² + R² + 2cR·cos(ωt + φ)
```

For a fixed ω this is linear in its unknowns, so a grid search over ω plus least squares fits it. On synthetic data from 10 to 240 °/s it recovers the rate within 0.1%. On round 2 data it gave 239.9 °/s, 12.9 G, with 0.25 m/s error.
- Roll uses a lateral strafe, pitch an up strafe, yaw a lateral strafe. 25% strafe keeps the load at 2–3 G.
- The sim's `stepAngular` rates and response curve should be calibrated from these `rg_*` tests.

#### Automated test round 1 (sc-flighttest, 2026-10-06, Gladius, decoupled, 18 tests)
Exact vJoy inputs with HUD OCR at 12 fps.

**Confirmed (within 1%):**
- spviewer base Gs, measured directly from the speed slope:
  - forward 13.7 (spviewer 13.6)
  - reverse 4.24 (4.2)
  - strafe 9.95 (9.9)
  - down 4.97 (4.9)
- **Throttle is linear thrust:** 50% forward = 6.84 G.
- **Boost scales partial throttle:** 50% boosted forward = 10.6 G.
- **Per-axis boost multipliers confirmed.** G meter reads 21.2 boosted forward and 12.9 boosted up and strafe.
- **SCM egg is a sphere:** 226 m/s forward, back, right and down.
- **Boosted caps:** forward 519, forward+up 501, forward+down 514, up+left 394. All match the limaçon and the earlier hand tests.

**Findings:**
1. **Combining full axes doesn't add thrust.** Forward + up = 21.2 G (not 24.7); up + left = 12.9 (not 18.2); 50% forward + up = 12.9. Refined by round 2 (below).
2. **The boosted wall is soft; the SCM wall is hard.**
   - SCM: full G right up to 224–226 m/s, then 0.
   - Boosted: acceleration fades as you approach the cap, roughly `a = min(a_cmd, K·(r(θ) − |v|))` with **K ≈ 1.3 s⁻¹** (time constant ≈ 0.77 s). Full-thrust boosted forward starts fading about 160 m/s below the cap.
   - Consequence: 0 → 480 boosted takes 3.3 s, not the 2.3 s pure 21 G would give.
3. **Thrusters idle at the wall in straight flight** (G meter → 0). In corkscrews they keep working; see Lever 3.
4. ~~Corkscrews self-limit to ~20 °/s of roll.~~ **Wrong.** Round 2 measured full-rate roll (Lever 3).

#### Automated test round 2 (2026-10-06, 14 tests, 15 fps)
**Partial inputs, boosted, from rest.** Rule A means the direction comes from per-axis requests (input × that axis's boosted G).

| Inputs (fwd, side) | Plateau | Rule A | Accel (speed slope ≈ G meter) |
|---|---|---|---|
| 25%, 100% up | **441** | 442 ✓ | 12.9 G |
| 50%, 50% up | **501** | 502 ✓ | **12.4 G**: the per-axis requests add (10.55 ⊕ 6.45). The "largest request" rule would give 10.6. |
| 50%, 100% left | **455** | 474 ✗ | 12.9 G. Same as round 1's 50% + up, so up and lateral behave alike. |
| SCM 50%, 100% up | 225 | 226 ✓ | 9.9 G |
| 75%, 100% up · 100%, 50% up | *invalid* | | Started at 225 m/s (failed brake), so redone in round 3. |

**Thrust magnitude: two candidate rules** that fit every round 1 + 2 point:
- **C1** *(rejected in round 3)*: per-axis requests add, capped at the full-stick G of whichever axis has the biggest request.
- **C2:** cap = biggest request ÷ biggest stick deflection.

They differ only when the biggest request isn't on the most-deflected axis. For 75% forward + full side: C1 gives 20.4 G, C2 gives 15.8 G. Round 3's `sw_*` sweep decides.

**Direction:** Rule A holds except at 50% forward + full side (455, three independent runs). The `sw_*` sweep maps the whole curve.

Round 3 settled this: **C2**, and a forward clamp (below).

#### Automated test round 3 (2026-10-06, 36 tests, 60 fps, rotation from the speed swing)
**Rotation rates** (`rg_*`; fit error 0.3–0.9 m/s):
- **Roll stick→rate is linear:** 10/25/50/75/100% → 20.1 / 50.1 / 100.0 / 149.9 / 199.9 °/s. Boosted 50/100% → 120.3 / 240.0.
- **Pitch** 68.0 °/s (boosted 81.6). **Yaw** 52.1 °/s (boosted 62.7). All match spec.
- **Full lateral strafe doesn't slow roll** (200 °/s).

**Thrust combination, boosted, from rest, forward + full left:**

| Forward % | 10 | 25 | 40 | 50* | 60 | 75 | 90 | 100 |
|---|---|---|---|---|---|---|---|---|
| Plateau | 414 | 441 | **455** | **455** | **455** | 480 | 498 | 501* |
| Rule A | 414 | 442 | 463 | 474 | 482 | 492 | 498 | 501 |
| Accel G | 12.9 | 12.9 | 13.0 | 12.9 | 12.8 | **15.7** | **18.7** | 21.2 |

\*From rounds 1–2.

- Full forward + 25/50/75% left → 518 / 514 / 508 (rule A ✓). 25+25 → 501 at 6.2 G; 75+75 → 501 at 18.6 G. Both rule A, and per-axis requests add.
- **Magnitude = C2:** `|a| = min(|w|, max_i|w_i| / max_i|u_i|)`, where w = per-axis requests and u = stick deflections. It fits all 20+ points; C1 is rejected (75% + full side gave 15.7 G, not 20.4).
- **Direction:** rule A holds except when a strafe axis is the biggest request and forward is between ~40% and 75%. There, forward thrust is clamped near **6.3 G**, so 40–60% forward all settle at the same 455. Store this as a measured curve (`fullStrafeForwardCurve`) until it's understood. Teaching point: with full strafe, forward beyond ~40% buys nothing until ~75%.
- **Walls, the G-LOC pattern and the corkscrew measurements** are in Lever 3 and the Duel sections.


**Harness fixes from round 2:**
- **Capture capped at 15 fps.** Each of 4 separate screen grabs waited for one 60 Hz refresh. Fixed with one grab per frame.
- **Sky camera retired.** Rotation now comes from the speed swing.
- **Brake check.** Braking now needs 3 consecutive ≤ 1 m/s reads, and a test refuses to start while moving.
- **G-LOC guard.** When the HUD fades, inputs are released, the test is marked, and the run waits for recovery.


#### Maneuver Coach outputs (Phase 4–5)
Each output is a live readout next to the eggs:
- **Roll ghost** showing the recommended roll angle.
- **Corkscrew budget chart** (V7): predicted miss vs roll rate for the chosen projectile flight time, your current roll rate, and the measured side thrust at your current wall position.
- **Speed-cost strip** for the current nose-off-velocity angle.
- **Time-to-stop**, retro vs. turned.
- **Predicted miss distance** for a chosen weapon flight time.

Every number is tagged measured / derived / predicted.

### Physics core (pure functions, fully unit-tested)

The model is now **6-DOF**, because roll changes which way "right" points.

- **State:** orientation (quaternion), angular velocity, world velocity, world position, boost capacitor.
- `envelope(dir: Vec3, profile, boosted) -> number` — radius of an egg in a ship-local direction. Model each egg as **six semi-axes** (+fwd, −back, +left, −right, +up, −down) blended per octant as an ellipsoid. This gives the asymmetric egg shape from six numbers.
- `availableAccel(vLocal, requestedDir, profile, boosted) -> Vec3` — requested accel limited by the G egg. At the wall, velocity is clamped **radially** to the limaçon speed egg (see §5 "The speed egg formula"), so it settles aligned with the thrust vector.
- `stepAngular(state, stick, dt, profile)` — stick → target pitch/yaw/roll rates (boosted rates when boosting; **not reduced by translation**, measured); approach targets with a first-order lag. The stick→rate curve and lag are calibrated from the `rg_*` gauge tests.
- `stepCoupled(state, input, dt, profile)` — simplified coupled-mode IFCS: desired **local** velocity = strafe/throttle input × speed envelope; rotate to world with the current orientation; accelerate toward it limited by the G egg (applied in the ship's local frame); clamp to the speed egg. Includes boost capacitor drain and regen.
- `thrustAllocation: "c2" | "linf" | "independent"` — how IFCS combines per-axis G. Default **c2** (measured, round 3): per-axis requests add; total capped at `max_i|w_i| / max_i|u_i|`; plus the measured `fullStrafeForwardCurve` clamp.
- **Wall order (measured):** first trim the outward request (SCM to 0; boosted to `K(r−|v|)`), then apply the cap, then cancel any remaining outward part with real thrust inside each bank's G. This reproduces the SCM retro floor (≈4.2 G) and jink dips. Boosted-wall side thrust uses the measured table (strafe only ≈6.3 G, forward + strafe ≈3.1 G, corkscrew ≈5.5 G, Gladius).
- `corkscrewWallSideG` (measured table, per mode): side thrust actually sustained in a corkscrew at the forward wall. Gladius: boosted ≈ 5.5 G (≈ 3.3 G at half strafe), SCM = full strafe G.
- `glocRisk`: measured pattern. Lateral + roll greys out in ~2–3 s at full strafe; up + roll ~4–7 s at 10–13 G; held strafes and jinks were fine for 6 s.
- `boostWallK` ≈ 1.3 s⁻¹ — soft approach to the boosted cap; the SCM cap is hard.
- `maneuverCoach(state, profile) -> { rollAngleStar, rollRateForTof, speedCostAtNoseAngle, timeToStop, predictedMiss(tof), glocRisk }`.
- `corkscrewBudget(profile, vFwd, rollRate, rollDir, boosted) -> { vLatMax, radius, limitedBy: "thrust" | "speedEgg" }` — the closed-form numbers above, used by the Corkscrew Lab gauges and checked against the full sim in tests.

**Important caveat to surface in the UI:** this is a *teaching approximation* of IFCS, not a reimplementation. The real controller is a closed-loop system, and CIG has a new flight model in development (NAV mode removal, quantum boost, aerodynamics) with no firm PU date. Keep the physics module swappable (`src/physics/models/v1-master-modes.ts`) so a future model can be added beside it.

## 3. Visualization catalog

> **Primary visual reference: the user's Figma mockup** `research/reference/figma-mockup-gladius.jpg` ("Flight School / Field Manual 01 — Aegis Gladius"). Match its art direction: dark navy, cyan/amber line work, monospace labels, "field manual" sections. Its sections map onto this catalog:
> - **01 The thrust egg** → V2 (G egg; top view and side view with asymmetric up/down).
> - **02 Velocity lives in a different space** (low speed / approaching / at the limit) → V1 + V2 + V3.
> - **03 Put the strong axis where you need it** (nose-first, turn to brake, bank the stronger side) → Phase 5 lessons.
> - **04 Speedwall and corkscrew** → V3, V5, V6.
> - **05 Corkscrew allocation** → V7.
>
> **Secondary reference:** `research/reference/legacy-egg-diagram.png`, an older community series' egg (pre-4.x numbers: 500 fwd / 275 back / 385 lateral). It confirms the lateral ≈ (fwd + back)/2 rule has held across patches: (500 + 275)/2 = 387.5. It draws an ellipse centered between nose and tail; the measured shape is the **limaçon**, with zero velocity (the ship) offset toward the tail, as in that diagram.
>
> Two corrections now that data exists:
> - the speed egg is no longer a placeholder silhouette — draw it from the §5 speed-egg formula, with F, B and the measured lateral cap labeled;
> - replace the mockup's jet silhouette with the dimensioned glyph (§6).
> Keep the mockup's honesty labels ("schematic", "illustrative") wherever a value is derived rather than measured.

These are the target visuals, sketched crudely on purpose — build them as clean, simple diagrams that keep this "instructor's whiteboard" feel. Optionally render with **rough.js** to get a hand-drawn line style; keep a toggle for a crisp style.

> **Reference video:** Apprentice_One, *"COMBAT COACHING CLASS, A1 & Activee"* (youtu.be/O-fjpCVdH5A). The plan author couldn't view the video's frames when writing this, so V1–V8 are inferred from the concepts it teaches. **Before Phase 2, the user will drop screenshots of the on-stream drawings into `research/reference/a1-coaching/`** (with timestamps in a `NOTES.md`). Match the look and framing of those drawings where they differ from the sketches below, and list any visual from the video that isn't covered here.

### V1 — The speed egg (top-down slice, ship-local)

```
                    FWD  (SCM wall)
                 . - ~ ~ ~ - .
             . '   . - - - .   ' .      ← dashed: boosted shell
           /    /             \    \
          |    |       ●──►    |    |   ● = your velocity right now
   LEFT   |    |       ·       |    |   RIGHT
          |     \             /     |   · = zero (standing still)
           \      ' - . . - '      /
             ' .               . '
                 ' - ~ ~ ~ - '
                    BACK  (flatter, closer to center)
```

Two slices side by side: **top-down** (fwd/back × left/right) and **side** (fwd/back × up/down). Egg is lopsided because forward ≠ back and up ≠ down.

### V2 — Hitting the wall (G egg riding on your velocity dot)

```
   inside the egg               at the forward wall
   (all thrust usable)          (front of G egg is dead)

        .---.                         |░░░.
       /  ●  \                        |░●  \      ░ = thrust IFCS throws away
       \     /                        |░   /
        '---'                         |░░'
                                   wall ┘
```

Shade the dead region and print, in words: *"62% of your thrust can't make you faster forward right now. Only the sideways part still works."*

### V3 — Wall scrape (velocity trail)

```
            wall
   ───────────────────────────
     ● ● ●●●●●●●●●●●●●●●●   ← trail slides ALONG the wall
    ●                          when you strafe at full forward
   ●                           instead of moving outward
```

A fading trail of the velocity dot. When the pilot strafes at full forward, the trail visibly slides along the wall instead of moving outward.

### V4 — Corkscrew, world view (3D)

```
   travel ───────────────────────────────►

      .-.       .-.       .-.       .-.
     /   \     /   \     /   \     /   \
  ✈ /     \   /     \   /     \   /     \
         \ '-'     \ '-'     \ '-'     \
```

Ship drawn as the dimensioned glyph (§6) with a ribbon trail. Toggle: straight-line ghost vs actual helix.

### V5 — Corkscrew, attacker's view (looking down your line of travel)

```
           . - ~ - .
         /     ✈     \        you, circling
        |      ⊕      |       ⊕ = attacker's lead pip
         \           /           (aimed for straight-line motion)
           ' - _ - '
```

Show the lead pip aiming where a straight-line target would be, and the miss distance over time. This is the "why it works" payoff.

### V6 — Corkscrew, velocity-space view

```
     side slice at your current forward speed
              ┌──── speed egg cross-section ────┐
              │          . - - .                │
              │        /    ●    \   ← dot      │
              │       |     ·     |    orbits   │
              │        \         /     a ring   │
              │          ' - - '                │
              └─────────────────────────────────┘
```

The velocity dot orbits a ring. The ring's radius is `v_lat`. If the ring would poke outside the egg's cross-section, it gets clipped. That shows that corkscrewing at the forward wall doesn't work.

### V7 — Corkscrew budget chart

```
  predicted
  miss (m)
   │‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾───___            curve: a·t²·f(ω·t) for the chosen
   │                     ‾‾──___       projectile flight time t
   │                            ‾‾──── 
   └──────────────┬─────────────┬────► roll rate ω
                ω·t = 2      max roll (Q key)
                  ▲
           you are here (live)
```

A live operating point on the miss-vs-roll-rate curve.
- `a` is the side thrust actually sustained at your current wall position. It's measured: Gladius boosted at the nose wall ≈ 5.5 G, SCM = full strafe G.
- A toggle switches flight time (0.3 / 0.5 / 1.0 s) to show that roll rate only matters for long shots.
- A second curve shows the same corkscrew in SCM vs boosted.

### V8 — Input overlay

Live stick/throttle/strafe/roll gauges in a corner of every view, so viewers can connect "what my hands did" to "what the dot did." Essential for recorded replays and streams.

## 4. Live inputs ("hook up your sticks")

The app is a **simulator driven by the user's real controls**, not a reader of the live game. Star Citizen exposes no telemetry API, so say that clearly in the UI.

- **Gamepad API** first. Many HOTAS and joysticks show up as gamepads in Chromium browsers; Firefox and Safari support varies. Provide a test panel that lists detected devices and live axis values.
- **Mapping wizard:** "Move the axis you use for strafe left/right" → auto-detect. Supports invert, deadzone, curve (linear/expo), and multiple devices at once (dual-stick, stick + throttle). Save mappings per device in `localStorage` (per-viewer convenience; wrap in try/catch and work without it).
- **Optional, later:** import the user's Star Citizen keybind export (`actionmaps.xml`) to pre-fill mappings. Treat the format as unverified until Phase 0 confirms it. **WebHID** as a fallback for devices the Gamepad API doesn't expose.
- **Keyboard** defaults matching SC's (WASD strafe/throttle, Q/E roll, Space/Ctrl vertical, Shift boost) and an on-screen **dual-stick for touch**.
- **Record / replay:** capture input streams at a fixed tick into a small JSON file the user can download, re-load, and replay deterministically. This allows "coach recorded this corkscrew, now you fly against the ghost" and side-by-side comparisons. Determinism requires the fixed-timestep sim and no wall-clock in physics.

## 5. Data: where the ship numbers come from

### Recommendation: datamined data via the community pipeline, snapshotted per patch. Do **not** scrape spviewer or erkul.

| Option | Verdict |
|---|---|
| Official CIG API | None exists for ship flight stats. |
| Scrape spviewer.eu / erkul.games | **No.** Undocumented internal endpoints, can change without notice, and taking another hobbyist's processed data without permission is bad etiquette (and likely against their terms). Use them only as **manual cross-checks**. If you want their data, ask the authors directly. |
| **Star Citizen Wiki API** (`https://api.star-citizen.wiki/api/vehicles/{slug}`) | **Primary source for v1.** Public, no auth, JSON, version-scoped (`?version=`, list via `/api/game-versions`), sourced from game files. Swagger at docs.star-citizen.wiki. Gives SCM speed, boost forward/backward, pitch/yaw/roll (+ boosted), afterburner capacitor/regen/ramp, mass, and thruster-group G. **Missing what the egg needs most:** per-direction linear acceleration (up/down/left/right/fwd/back) and boosted linear multipliers. |
| **scunpacked-data** (GitHub `StarCitizenWiki/scunpacked-data`) | **Source for the missing fields.** Raw per-ship JSON produced by **ScDataDumper** (`octfx/ScDataDumper`), the same pipeline behind the Wiki API. Pin to a commit per patch. |
| **Run ScDataDumper yourself** | **Fallback / patch-day path.** Unpack `Data.p4k` with unp4k + unforge, then `php cli.php load:vehicles import export --with-raw`. Requires the game installed (Windows), so this is a **local script run on patch day**, not a CI job. Use when scunpacked-data lags a patch, or when you need raw `IFCSParams` blocks it doesn't expose. |

So: **datamining is the right long-term answer, but you don't need to run it yourself on day one** — the Wiki community already does it every patch. Build the adapter so the source can be swapped (Wiki API → scunpacked-data → your own dump) without touching the app.

### How the directional G egg is built (findings from the Gladius, 4.10.1-LIVE)

The egg needs two things per direction: a **base G** and a **boost multiplier**. They come from different places.

**Boost multipliers — in the game files. Solved.**
scunpacked-data (commit `e961320`, 2026-09-22) `ships/aegs_gladius.json` → `FlightCharacteristics.IFCS.Afterburner`:

| Block field | X (strafe) | Y (fwd / back) | Z (up / down) |
|---|---|---|---|
| `AccelerationMultiplierPositive` | 1.3 | **1.55** (forward) | **1.3** (up) |
| `AccelerationMultiplierNegative` | 1.3 | **1.4** (backward) | **1.35** (down) |
| `AngularMultiplier` (pitch/yaw/roll) | — | — | 1.2 / 1.2 / 1.2 |

Axis convention: **Y = forward(+)/back(−), Z = up(+)/down(−), X = strafe**. These match spviewer's "Boost Multiplier" radar exactly, and its boosted Gs are exactly base × multiplier (13.6 × 1.55 = 21.1, 4.2 × 1.4 = 5.9, 9.9 × 1.3 = 12.9, 4.9 × 1.35 = 6.6). So spviewer reads the **legacy `Afterburner` block**. Its boosted rotation (81.6 / 62.4 / 240 °/s = base × 1.2) confirms this.

**Open question — legacy vs new block.** The file also has `AfterburnerNew` with different values for the Gladius: backward 1.2 (not 1.4), down 1.3 (not 1.35), and rotation 1.15 / 1.0 / 1.15. Fleetyards decided to use legacy too, but nobody has shown which one the live game uses. **Cheapest in-game test:** boost while holding full roll. Legacy predicts 240 °/s; New predicts 200 °/s (no change). Put this first in `CALIBRATION.md`.

**Base directional G — NOT in the extracted data. This is the real gap.**
- The files give only thruster-*group* capacity divided by *hull* mass: main 95.73 m/s² (9.76 G), retro 3.95 m/s² (0.4 G), maneuver 216 m/s² (22 G). Gladius `Timing.ZeroToScm` (2.36 s ≈ 226 / 95.73) shows the dump uses the same math.
- spviewer shows a Gladius at **13.6 fwd / 4.2 retro / 9.9 up / 4.9 down / 9.9 strafe G**. Those can't be derived from the group numbers. Forward is ~40% above main-thruster-only, and retro is 10× the retro thrusters alone. In other words, gimballed maneuvering ("joint") thrusters contribute to every direction, and how much depends on where each one is mounted and how far it can swivel.
- Thruster **mount positions and orientations are not in scunpacked-data**. The JSON lists hardpoint names and thrust capacities only. That geometry lives in the ship's 3D asset files, not the data tables.
- spviewer labels this panel **"Last check 80 days"**, unlike its file-derived panels. That strongly suggests its directional Gs are **measured in-game** and periodically re-verified, not computed. Unconfirmed: check the (i) tooltip on that panel, or ask the author.

**Strategy for base G (in priority order):**
1. **✅ spviewer data — permission granted.** Olakeen (spviewer.eu author) approved use of the Flight Performances / acceleration data via Discord on 2026-10-06, with attribution. A snapshot for 61 fighters and interceptors (4.10.1 LIVE, scraped 2026-10-06) is in `research/spviewer-flight-performances.json` / `.csv` with `provenance: "spviewer"`. Import it as the primary base-G source. Each patch, re-check spviewer's "Previous Patch Comparison" for changes. Keep the per-ship `last_check_days` value so the UI can show how fresh each measurement is.
2. **Own in-game measurement**, crowdsourced through a `CALIBRATION.md` protocol and a simple submission form/issue template. Measure Δv/Δt on the steady part of each burn (skip IFCS ramp-in), per direction, boosted and not. Store as `provenance: "measured"` with patch + date + tester.
3. **Compute from thruster geometry (research spike, optional).** Extract thruster helper transforms from the ship geometry in `Data.p4k`, then solve for max force per direction including gimbal limits. This is a big job, and IFCS may also cap accelerations independently of thrust. Only attempt it if 1 and 2 stall, and validate against measured values.

Until base G is sourced, the app **must not draw the G egg** for that ship. Show the speed egg only, with a "needs measurement" badge. A guessed egg shape would teach the wrong thing.

### Flight mode: everything above was measured in DECOUPLED

All in-game validation (2026-10-06) was flown in **decoupled** mode. There, translation inputs command **thrust (acceleration) fractions**, not velocity targets, and IFCS applies no damping. Consequences:
- **Decoupled is the validated, primary model for v1.** Implement `stepDecoupled` first. Coupled mode (`stepCoupled`, with velocity targets and lateral damping) is a second model needing its own calibration. Label it "unverified" until then.
- The **settle law** (velocity aligns with your thrust vector at the wall) is exactly what decoupled physics predicts.
- **Throttle = thrust fraction.** 50% forward unboosted keeps accelerating until the SCM wall (measured 224–226), so any sustained thrust ends at the wall.
- **Partial throttle while boosted** (~50% fwd + full up → 455 m/s): the settle speed implies the thrust pointed about 61° off-nose, i.e. forward thrust ≈ 7 G, not 0.5 × 21.1 = 10.6 G. Two candidate explanations:
  - partial throttle uses the **unboosted** forward G (0.5 × 13.6 = 6.8 G → predicts 453 m/s);
  - or the throttle sat below 50%.

  **Test:** time 0 → 300 m/s on boosted 50% forward alone. About 2.9 s means boost applies; about 4.5 s means it doesn't.

### The speed egg formula — confirmed in-game (Gladius + Arrow, 2026-10-06)

The files give two boosted caps: `BoostSpeedForward` (F) and `BoostSpeedBackward` (B). Every other direction follows from them.

**Two layers, exactly as the original concept intended:**
- **Unboosted (SCM) egg = a sphere** of radius `ScmSpeed` (Arrow 229 m/s, measured in every direction).
- **Boosted egg = a limaçon** (below).

Boost ramps the egg from sphere to limaçon over `AfterburnerRampUpTime` (0.6 s). Releasing boost shrinks it back over `RampDownTime` (0.3 s), after which IFCS brings you back inside the sphere. Animate both transitions; they're a teaching moment of their own.

**The boosted egg (a limaçon, rotationally symmetric about the nose).** For a ship-local unit direction `u`, with `cosθ = u · forward`:

```
r(θ) = A + C·cosθ      A = (F + B) / 2      C = (F − B) / 2
```

- Nose → F. Tail → B.
- Any direction perpendicular to the nose (left, right, up, down, or any mix) → A. So the cross-section at θ = 90° is a **circle**, not a box.

**How the wall behaves (the key teaching insight).** At the wall, IFCS keeps your velocity on the egg surface while your thrust keeps pushing. The velocity settles where it **points in the same direction as your applied acceleration vector**. From full inputs on two axes, the settle angle off the nose is `θ* = atan(a_side / a_fwd)`, and your speed there is `r(θ*)`. So weaker side thrust settles closer to the nose: faster overall, but less sideways velocity.

**Validation (Gladius: F 520, B 268, A 394; boosted G fwd 21.1, strafe 12.9, up 12.9, down 6.6):**

| Input (boosted, from rest) | Model | Measured |
|---|---|---|
| Full forward | 520 | 520 (file) |
| Full reverse | 268 | 267 |
| Full left strafe | 394 | 394 |
| Full up | 394 | 394 |
| Full down | 394 | 391 (held the full boost tank: real; store as a `measuredTable` override) |
| Up + left | 394 | 394 (circle cross-section, not a box) |
| Forward + left → settles at 31.4° | 501.5 | 501–502 |
| Forward + up → settles at 31.4° | 501.5 | 502 |
| Forward + down → settles at 17.4° | 514.3 | 515–516 |
| *Hornet Mk II* full strafe / reverse | 364 / 249 | 364 / 249 |
| *Arrow* forward + up → settles at 33.6° | 494.1 | 493 |
| *Arrow* forward + down → settles at 18.5° | 508.5 | 508 |
| *Arrow* unboosted, any direction | 229 (sphere) | 229 |
| *Gladius* unboosted, any direction | 226 (sphere) | 225–226 |

All are within 1%, across three ships. An elliptical egg was ruled out: it predicts 474–483 for forward + strafe.

**Teaching payoff, from the same numbers.** Pinned at the forward wall, a Gladius that strafes **up** gets about **262 m/s** of sideways velocity. Strafing **down** gets only about **154 m/s**, while keeping just 13 m/s more top speed. Roll to put the strong side to work. This is the "bank the stronger side in" lesson from the mockup, now with real numbers.

**Implementation consequences for the physics core:**
- The speed-egg strategy defaults to `sphere` (SCM) and `limacon` (boosted), with `measuredTable` as an override. Blend between the two during boost ramp-up and ramp-down.
- The wall clamp in `stepCoupled` is **radial**: after integrating the acceleration, if `|v| > r(θ_v)`, scale `v` to `r(θ_v)`. The tangential part of thrust slides you along the wall until velocity aligns with thrust.
- Unit tests must reproduce every row of the validation table, within 1%, using the Gladius, Hornet Mk II and Arrow profiles.

**Remaining checks** (low priority, in `CALIBRATION.md`):
1. Thrust budget and roll-rate tests listed under "Thrust budget" (roll count with and without translation, G meter while rolling, fwd+down and up+left G predictions).
2. Input mapping: 50% forward alone, then 25/75%.
3. Gladius down is a confirmed 391 (not 394); check whether other ships also have a slightly low down cap.

**Unboosted wall behaves the same way.** Velocity settles aligned with thrust; only the radius is constant. Using unboosted Gs, an Arrow at SCM holding forward + up settles 38° off the nose with about 142 m/s sideways. Forward + down settles at 21° with about 82 m/s sideways.

**Fleet table:** `research/speed-egg-fleet.csv` holds, for all 61 ships:
- F, B and derived A;
- dimensions and boosted Gs;
- time-to-cap per axis;
- predicted wall speed, settle angle and sideways velocity for forward + strafe / up / down.

The Gladius and Hornet Mk II are marked `measured`; all others are `derived`.

### Remaining data traps (Phase 0)

- **Angular response.** Files give `AngularAccelDecay: 12` and `LinearAccelDecay: 6` (IFCS smoothing terms; units/meaning unconfirmed). Treat as hints for the lag model, not truth; calibrate.
- **Mass basis.** Files divide by hull mass (48,552 kg); a loaded Gladius is 55,646 kg. spviewer/measured Gs already include the loadout.
- **Dimension sources disagree slightly.** spviewer shows the Gladius as 20 × 17 × 5.5 m; scunpacked/Wiki API give 21 × 17.5 × 5.5 m. Pick **one** source for every ship (default: scunpacked `Length/Width/Height`, the game's own values) and show it in the ship card, so comparisons are consistent.
- **Sabre Raven EX:** files say boost forward 560, spviewer says 600. Prefer the files; flag it.
### Normalized schema (what the app consumes)

```ts
// src/data/schema.ts — validate with Zod at build time
type Axis6 = { fwd: number; back: number; left: number; right: number; up: number; down: number };

interface FlightProfile {
  id: string;              // e.g. "aegs-gladius"
  name: string;
  manufacturer: string;
  gameVersion: string;     // e.g. "4.10.1-LIVE.12660092"
  massKg: number;
  speed: { scm: Axis6; boost: Axis6 };            // m/s, the speed egg (boost lateral/vertical derived via speedEgg until measured)
  accelG: {
    base: Axis6 | null;          // G, measured or licensed; null = don't draw the G egg
    boostMultiplier: Axis6;      // from IFCS Afterburner AccelerationMultiplierPositive/Negative  (Y=fwd/back, Z=up/down, X=strafe)
    afterburnerBlock: "legacy" | "new";   // which block the multipliers came from
  };                             // boosted = base × boostMultiplier, computed, never stored
  angularDegPerSec: { pitch: number; yaw: number; roll: number;
                      pitchBoost: number; yawBoost: number; rollBoost: number };
  angularResponseSec?: { pitch: number; yaw: number; roll: number }; // time to ~63% of target rate
  boost: { capacitor: number; regenPerSec: number; regenDelay: number;
           rampUp: number; rampDown: number };
  provenance: Record<string, "wiki-api" | "scunpacked" | "spviewer" | "own-dump" | "measured" | "assumed">;
  dimensionsM: { length: number; width: number; height: number }; // glyph size, one source for all ships
  speedEgg: { boosted: "limacon" | "measuredTable"; scm: "sphere" | "measuredTable"; F: number; B: number; scm: number }; // §5 speed egg formula
}
```

`provenance` is per field and shown in the UI ("measured in-game" vs "from game files" vs "assumed"). This is an educational tool — be honest about uncertainty.

### Data pipeline

- `scripts/sync-data.ts` (Node, run with `tsx`): fetch → normalize → Zod-validate → write `public/data/<gameVersion>/ships.json` and `public/data/manifest.json` (versions + default).
- `scripts/diff-versions.ts`: prints per-ship deltas between two snapshots (great for "what changed in the patch" content).
- GitHub Action: weekly + manual dispatch; runs sync, opens a PR if data changed. No secrets needed (public sources).
- App is fully static. No backend.

### Fan-site notices & credits (no Fankit use)

The app uses **no Fankit or other CIG assets**. The Fankit Agreement and Guidelines therefore don't apply: no Made-by-the-Community logo, and no URL report to CIG. Two things still apply to any fan site:

1. **Fan-site disclaimer** (RSI Fankit & Fandom FAQ), in the footer of every page: *"This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies."* Add the trademark line: *"Star Citizen®, Squadron 42®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC."*
2. **FAQ rules for fan sites.**
   - No brand or in-game names in the domain.
   - Don't present the app as official.
   - Keep it free: no ads, paywalls, or donation/tip links, which the FAQ prohibits for fan content.
   - Ship and manufacturer **names** in text are fine (factual references). Ship visuals are the generic glyph only.

**Credits** (footer + About page):
- "Acceleration and flight performance data courtesy of **SC Ships Performances Viewer (spviewer.eu) by Olakeen**, used with permission." Also show it next to the G readout.
- Game data: Star Citizen Wiki API / scunpacked-data / ScDataDumper.
- Speed-cap measurements: the user's in-game tests (date and patch on the Credits page).
## 6. Tech stack

- **Vite + React + TypeScript** (strict).
- **react-three-fiber + drei** for 3D (egg view, corkscrew world view). **SVG** for 2D slices, attacker's view, and budget chart. **rough.js** (optional) for the whiteboard line style. On phones, default to 2D — it teaches better and is cheaper.
- **Zustand** for app state; physics stays pure TS with no React imports.
- **Zod** for data validation. **Vitest** for physics/unit tests. **Playwright** for responsive smoke tests at 375 / 768 / 1440 px.
- Input: keyboard, **Gamepad API**, optional **WebHID**, and an on-screen dual-stick for touch.
- Deploy: Cloudflare Pages or GitHub Pages.

```
src/
  physics/        quat.ts, envelope.ts, accel.ts, angular.ts, ifcs.ts, corkscrew.ts,
                  models/v1-master-modes.ts  (+ *.test.ts)
  data/           schema.ts, loader.ts
  sim/            loop.ts (fixed-timestep, deterministic), recorder.ts, replay.ts
  input/          keyboard.ts, gamepad.ts, webhid.ts, touch.ts, mapping.ts, MappingWizard.tsx
  views/          EggSlice2D.tsx, Egg3D.tsx, WallScrape.tsx, CorkscrewWorld3D.tsx,
                  AttackerView.tsx, CorkscrewRing.tsx, BudgetChart.tsx, InputOverlay.tsx,
                  Hud.tsx, ShipPicker.tsx, CompareOverlay.tsx
  lessons/        lesson definitions (markdown + scripted input scenarios)
scripts/          sync-data.ts, diff-versions.ts, dump-local.md (ScDataDumper how-to)
public/data/      <gameVersion>/ships.json, manifest.json
research/         raw/, FIELDS.md, CALIBRATION.md, speed-egg-fleet.csv, corkscrew-fleet.csv, reference/ (figma-mockup-gladius.jpg, a1-coaching/),
                  spviewer-flight-performances.json/.csv
```

### Ship glyph (no CIG art: a dimensioned diamond)

**No CIG artwork, models, logos or fonts anywhere in the app**, including no Fankit assets. Every ship is drawn as the same simple glyph, sized from game-data dimensions in metres.

- **Shape.** A flat-bottomed diamond or arrowhead (a 3D octahedron-style "dart"):
  - nose point at +L/2 forward, tail edge at −L/2;
  - widest point (W) at about 60% of length from the nose;
  - height H as a thin ridge;
  - nose clearly distinguishable from tail.
  - 2D views draw its top (L × W) or side (L × H) silhouette.
- **Exact dimensions.** The glyph's bounding box equals the ship's L × W × H. Example: Gladius **21 × 17.5 × 5.5 m** from game data (spviewer lists 20 × 17 × 5.5). A unit test asserts bounding box = data.
- **Proportion to the egg.** The egg lives in **velocity space (m/s)** and the ship in **physical space (m)**, so "true scale" means drawing 1 m = 1 m/s. At that scale a 21 m Gladius inside a 520 m/s egg is about 4% of the egg's length, the honest picture. Offer two modes:
  - **True scale** (default in the "how big is the egg?" lesson). Glyph and egg share one scale; label "1 m = 1 m/s".
  - **Readable** (default elsewhere). Glyph at a fixed on-screen size at the egg's origin, with true L:W:H proportions preserved. Comparing ships side by side always uses one shared scale, so a Hornet visibly out-sizes a Gladius.
- **Orientation.** The glyph rotates with the ship's attitude in 3D views. In ship-local 2D slices it stays fixed (nose up), matching the mockup.
- **Teaching overlays** (thrust arrows sized by G per axis, the G egg, velocity vector) attach to the glyph.
**Layout:** desktop is a three-pane layout: world view | egg slices | budget + input overlay. Tablet uses two panes. Phone uses tabs (World / Egg / Corkscrew) with the input overlay pinned.

## 7. Post-V1 roadmap phases (keep — start only after V1 ships)

### Phase 0 — Data spike (stop for review)
1. Pull Gladius, Arrow, Cutlass Black, Hornet Mk II (or current equivalents) from the Wiki API and from scunpacked-data at its latest commit. Save raw responses to `research/raw/`.
2. Find every field that could define per-direction linear accel (separate up and down), boosted multipliers, and angular response. Write `research/FIELDS.md` mapping raw paths → `FlightProfile` fields, with confidence notes.
3. Resolve the data traps above. Where files are ambiguous, mark the field `assumed` and list it for in-game measurement.
4. Write `research/CALIBRATION.md`: an in-game test protocol the user can run, in this priority order:
   1. **Legacy vs new afterburner block:** boost + full roll — 240 °/s (legacy) or 200 °/s (new)?
   2. **Base G per direction** (fwd, back, up, down, left, right): from rest, burn one axis, record Δv over a timed window after the ramp-in; then repeat boosted. Compare to spviewer's numbers.
   3. **Speed walls:** max steady speed per direction, boosted and not (is 520 m/s the SCM boosted forward wall?).
   4. **Corkscrew:** strafe right + full roll right for 5 s, then roll left; note which holds sideways speed better. This validates the up-vs-down prediction.
   Include a CSV template (`ship, patch, loadout, direction, boosted, dv, dt, tester, date`) and an `npm run ingest:calibration` script that turns it into `measured` profile fields.
5. Import `research/spviewer-flight-performances.json` (permission granted) as base G for the 61 covered ships; reconcile its class names with scunpacked-data and flag any ship whose spviewer boosted/base ratios disagree with the file multipliers.
6. Create `research/reference/a1-coaching/` with a `NOTES.md` template for the user's screenshots and timestamps.

**Exit:** a filled `FlightProfile` JSON for the four ships plus a list of open questions.

### Phase 1 — Physics core (6-DOF)
Quaternion orientation, `stepAngular`, `stepCoupled`, `envelope`, `availableAccel`, `corkscrewBudget`. Tests:
- the symmetric case reduces to a sphere;
- at the wall, the outward component is zero;
- boost enlarges both eggs;
- the capacitor drains and regenerates;
- the octant blend is continuous (no seams);
- **corkscrew:** constant roll + strafe produces a helix with radius ≈ `v_lat / ω`, with the required accel on the local vertical axis; when `ω · v_lat` exceeds the vertical limit, achieved `v_lat` drops to ≈ `a_vertical / ω`; swapping roll direction swaps which thrusters (up/down) carry the load;
- determinism: the same input stream produces bit-identical replays.

### Phase 2 — 2D slices, keyboard/touch, sim loop
Fixed-timestep loop. V1 (both slices), V2 (G egg + dead zone with plain-language %), V3 (wall-scrape trail), V8 (input overlay). Keyboard and touch input. Responsive from 375 px up. Match the reference screenshots' look if provided.

### Phase 3 — Hook up your inputs
Gamepad/HOTAS detection panel, mapping wizard (invert, deadzone, curve, multi-device), saved mappings, record/replay to JSON, ghost replay. Optional `actionmaps.xml` import behind a flag once its format is confirmed.

### Phase 4 — 3D + Corkscrew Lab
r3f egg view (translucent nested eggs, velocity point, G egg, dead zone, orbit controls). Corkscrew Lab: V4 world helix with straight-line ghost, V5 attacker's view with lead-pip miss distance, V6 velocity-space ring clipped by the egg cross-section, V7 live miss-vs-roll-rate chart (SCM vs boosted). Respect `prefers-reduced-motion` (static diagrams + step controls).

### Phase 5 — Teaching layer
Guided lessons with scripted input scenarios that the user can then re-fly with their own sticks:
- "Why can't I strafe at full forward?"
- "Boost makes the egg bigger — and empties fast"
- "Why reversing is slow"
- "Corkscrew 101: roll + strafe"
- "Roll direction matters (up vs down thrusters)"
- "Come off the wall to make room to dodge"
- "Ship A vs Ship B"

Also a compare overlay (two ships' eggs in one view) and a glossary (SCM, coupled, IFCS, speed wall, G, lead pip).

### Phase 6 — Data automation + polish
Sync script, version switcher in the UI, diff script, GitHub Action, provenance badges, attribution footer, accessibility pass (keyboard-only, color-blind-safe palette, text alternatives for every visual), Lighthouse ≥ 90 on mobile.

**Release checklist.** `npm run check:release`:
- The fan-site disclaimer and trademark line are present on every route; Playwright asserts the strings.
- Olakeen/spviewer credit appears in the footer and next to the G readout.
- No monetization links anywhere.
- No image, model, font or logo files from CIG anywhere in the repo or build.
- Glyph bounding boxes match the data dimensions for all ships.

## 8. Reference fixture (Gladius, Wiki API, 4.10.1-LIVE — verify in Phase 0)

For V1, `research/gladius-v1-fixture.json` supersedes this table wherever they differ.


| Field | Value |
|---|---|
| SCM speed | 226 m/s |
| boost_forward / boost_backward | 520 / 268 m/s (confirmed in-game: reverse measured 267) |
| unboosted (SCM) egg | sphere, r = 226 m/s (measured 225–226 in all directions) |
| boosted lateral / vertical caps | 394 / up 394 / down 391 m/s (measured; model (520+268)/2 = 394) |
| forward + strafe / up / down (boosted) | 501–502 / 502 / 515–516 m/s (measured; limaçon model 501.5 / 501.5 / 514.3) |
| dimensions | 21 × 17.5 × 5.5 m (scunpacked); spviewer 20 × 17 × 5.5 |
| pitch / yaw / roll | 68 / 52 / 200 °/s |
| boosted pitch / yaw / roll | 81.6 / 62.4 / 240 °/s |
| boost capacitor | 20, regen 0.75/s, ramp-up 0.6 s |
| total mass | 55,646 kg (hull 48,552) |
| thruster groups (files) | main 9.76 G, maneuver 22.05 G, retro 0.4 G — thrust ÷ hull mass, **not directional** |
| boost accel multipliers (files, legacy block) | fwd 1.55 · back 1.4 · up 1.3 · down 1.35 · strafe 1.3 |
| boost accel multipliers (files, `AfterburnerNew`) | fwd 1.55 · back 1.2 · up 1.3 · down 1.3 · strafe 1.3 |
| directional G (spviewer by Olakeen, used with permission, 4.10.1, "last check 80 days") | fwd 13.6 (21.1) · retro 4.2 (5.9) · up 9.9 (12.9) · down 4.9 (6.6) · strafe 9.9 (12.9) |

## 9. Out of scope (beyond section 0's own list)
Coupled-mode calibration (v1 ships it as "unverified"; decoupled is the validated model), atmospheric flight, G-safe/blackout modeling, loadout effects on mass, NAV mode, multiplayer, reading live game telemetry. Note them in a "Coming later" section of the README.

## 10. Working agreements for Claude Code
- Stop for review at the end of every phase; summarize what's verified vs assumed.
- Never invent a stat. If a value can't be sourced, mark it `assumed` and surface it.
- Physics changes require tests first.
- Keep the physics model swappable for the upcoming flight-model rework.
- Model predictions (like "roll direction matters") are labeled as predictions in the UI until in-game calibration confirms them.
- No CIG assets of any kind (models, logos, fonts, art). Ships are always the dimensioned glyph.
- Speed caps: lateral/vertical boosted caps come from the speed-egg model until measured. Label derived values as derived.
