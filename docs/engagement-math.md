# Engagement math (brief C1, 2026-10-11)

The geometry under the fighting-fundamentals lessons: the closing-speed number on the target box, bullet flight time and
lead, how long it takes to put the nose on a target, and the orbit limits behind the pole drill and rate fighting. Pure
functions in `packages/core/src/engage.ts`, tests in `packages/data-gladius/test/engage.test.ts`. Every number below is
either **measured** (the Gladius fixture, `research/gladius-v1-fixture.json`) or arithmetic on a **named constant** whose
source, date and status are stated. Where the math makes a popular claim small, the math wins and this page says so.

Labels: **M** measured, **S** sourced (a dated creator statement, not measured by us), **A** assumed, **Mod** model.

## 1. Inputs

| Input | Value | Status | Source |
|---|---|---|---|
| SCM rotation, °/s | pitch 68.0, yaw 52.1, roll 199.9 | M | fixture `constants.scm.rotation_dps` (rotation gauges, round 3) |
| Boost rotation, °/s | pitch 81.6, yaw 62.7, roll 240.0 | M | fixture `constants.boost.rotation_dps` (round 3) |
| Forward thrust, G | SCM 13.7, Boost 21.2 | M | fixture `constants.*.G.fwd` (speed slopes, G meter) |
| Speed limit 90° off the nose, m/s | SCM 225 (sphere), Boost 394 (egg side, A) | M | fixture `speedCap_mps`, `A_mps` |
| Stick combination | unit-length rule | M | fixture `rotationCombination` (round 11) |
| `WEAPON.projectileSpeed_mps` | 1,800 | S | Apprentice_One, 2024-11-08, laser repeaters, 3.24.x. **Not measured for the CF-117 Panther; Alex has not yet confirmed it.** One constant, one place to update. |
| Projectiles inherit the shooter's velocity | yes | A | Alex, 2026-10-11; still on the in-game test list |
| Sign of the target box's bracket, e.g. `166.9m [51m/s]` | + = closing in this module | A | the game's convention is **unconfirmed** (`CLOSING_SIGN`); treat the game's number as \|Δ\| until Alex checks |
| g₀ | 9.80665 m/s² | — | SI |

Engagement range for every example: 300–600 m (never 1 km).

## 2. Closing speed (Δ)

`closingSpeed(relPos, relVel) = −(r·v) / |r|`, the rate the range shrinks, with `relPos` = target − you and `relVel` =
target velocity − yours, in any common frame. Positive while the range is falling. A target crossing your line of sight
has Δ = 0 whatever its speed; Δ says nothing about crossing motion.

## 3. Bullet flight time and lead

`timeOfFlight(range, Δ, v_p = 1,800) = range / (v_p + Δ)` under the inheritance assumption (the bullet carries your speed
along the line of sight). `leadDistance(crossing, tof) = crossing × tof`. A bullet that never arrives
(`v_p + Δ ≤ 0`) returns Infinity; a non-positive range returns 0.

Flight time, s, at 1,800 m/s:

| Range (m) | Δ −100 | Δ −51 | Δ 0 | Δ +51 | Δ +100 |
|---|---|---|---|---|---|
| 300 | 0.176 | 0.172 | 0.167 | 0.162 | 0.158 |
| 450 | 0.265 | 0.257 | 0.250 | 0.243 | 0.237 |
| 550 | 0.324 | 0.314 | 0.306 | 0.297 | 0.289 |
| 600 | 0.353 | 0.343 | 0.333 | 0.324 | 0.316 |

Lead distance, m, at Δ 0, for a target crossing at 50 / 100 / 150 / 225 m/s:

| Range (m) | Flight (s) | 50 m/s | 100 m/s | 150 m/s | 225 m/s |
|---|---|---|---|---|---|
| 300 | 0.167 | 8.3 | 16.7 | 25.0 | 37.5 |
| 450 | 0.250 | 12.5 | 25.0 | 37.5 | 56.3 |
| 550 | 0.306 | 15.3 | 30.6 | 45.8 | 68.8 |
| 600 | 0.333 | 16.7 | 33.3 | 50.0 | 75.0 |

**What Δ does and does not do.** Alex's screenshot shows `[51m/s]` at 167 m. At 550 m, 51 m/s of closing shortens the
flight from 0.306 s to 0.297 s: **about 3 %**, 9 ms. Even 100 m/s is 5.5 %. With a 1,800 m/s bullet, Δ barely changes
the lead. Its real effect is on the range itself: `timeToRange(r0, r1, Δ) = (r0 − r1) / Δ`.

| | Δ 25 | Δ 51 | Δ 100 | Δ 150 |
|---|---|---|---|---|
| 550 → 300 m, s | 10.0 | 4.9 | 2.5 | 1.7 |
| 600 → 300 m, s | 12.0 | 5.9 | 3.0 | 2.0 |
| 600 → 550 m, s | 2.0 | 1.0 | 0.5 | 0.3 |

So the lesson Δ supports is distance management: at +51 m/s a 550 m fight is a 300 m fight in five seconds. The lesson
it does not support is "Δ is added to your bullets, so closing makes you accurate": the arithmetic says the gain is a
few percent. If the Panther's real speed is lower than 1,800 m/s the share grows (at 1,500 m/s, 51 m/s is 3.3 %); it
stays small unless the bullet is far slower than any sourced figure.

## 4. Time to put the nose on a target

A target `θ` off the nose that a roll of `φ` would bring into the pitch plane (0° = straight above or below, 90° = in
the yaw plane). Rates are the fixture's; no rotational inertia is modelled (the rotation gauges show none at this scale).

- **No roll:** one fixed pitch+yaw stick along the great circle, scaled to unit length:
  `t = θ · √((cos φ / R_pitch)² + (sin φ / R_yaw)²)`. Pure yaw at φ = 90°.
- **Roll then pitch** (Apprentice_One, 2024-05-09, "roll so you track in pitch"): `t = φ / R_roll + θ / R_pitch`.
- **Diagonal stick** (`noseSim`): roll toward the pitch plane and pitch toward the target at the same time, both
  proportional near the end, the combined stick scaled to unit length, the nose's turning radius held inside a
  quarter of the angle still to go so it never loops around a close target. **Idealised geometry, one policy among
  many a pilot could fly, not a pilot model.** Simulated at 240 Hz.

Seconds, SCM (no roll / roll then pitch / diagonal); the last column is the off-angle past which rolling first wins
over the no-roll blend (`noseCrossoverDeg`):

| Roll needed | 15° | 30° | 45° | 60° | 90° | 120° | 150° | Crossover |
|---|---|---|---|---|---|---|---|---|
| 0° | 0.22 / 0.22 / 0.22 | 0.44 / 0.44 / 0.44 | 0.66 / 0.66 / 0.66 | 0.88 / 0.88 / 0.88 | 1.32 / 1.32 / 1.32 | 1.76 / 1.76 / 1.77 | 2.21 / 2.21 / 2.21 | never |
| 30° | 0.24 / 0.37 / 0.33 | 0.48 / 0.59 / 0.53 | 0.72 / 0.81 / 0.74 | 0.96 / 1.03 / 0.95 | 1.44 / 1.47 / 1.39 | 1.91 / 1.91 / 1.83 | 2.39 / 2.36 / 2.27 | 121° |
| 45° | 0.26 / 0.45 / 0.42 | 0.51 / 0.67 / 0.60 | 0.77 / 0.89 / 0.80 | 1.03 / 1.11 / 1.01 | 1.54 / 1.55 / 1.44 | 2.05 / 1.99 / 1.88 | 2.56 / 2.43 / 2.30 | 94° |
| 60° | 0.27 / 0.52 / 0.51 | 0.55 / 0.74 / 0.68 | 0.82 / 0.96 / 0.88 | 1.09 / 1.18 / 1.08 | 1.64 / 1.62 / 1.50 | 2.18 / 2.06 / 1.93 | 2.73 / 2.51 / 2.35 | 86° |
| 90° | 0.29 / 0.67 / 0.70 | 0.58 / 0.89 / 0.87 | 0.86 / 1.11 / 1.06 | 1.15 / 1.33 / 1.27 | 1.73 / 1.77 / 1.68 | 2.30 / 2.21 / 2.08 | 2.88 / 2.66 / 2.46 | 100° |

Boost:

| Roll needed | 15° | 30° | 45° | 60° | 90° | 120° | 150° | Crossover |
|---|---|---|---|---|---|---|---|---|
| 0° | 0.18 / 0.18 / 0.18 | 0.37 / 0.37 / 0.37 | 0.55 / 0.55 / 0.55 | 0.74 / 0.74 / 0.74 | 1.10 / 1.10 / 1.10 | 1.47 / 1.47 / 1.47 | 1.84 / 1.84 / 1.84 | never |
| 30° | 0.20 / 0.31 / 0.28 | 0.40 / 0.49 / 0.44 | 0.60 / 0.68 / 0.62 | 0.80 / 0.86 / 0.80 | 1.19 / 1.23 / 1.16 | 1.59 / 1.60 / 1.52 | 1.99 / 1.96 / 1.89 | 123° |
| 45° | 0.21 / 0.37 / 0.35 | 0.43 / 0.56 / 0.50 | 0.64 / 0.74 / 0.67 | 0.85 / 0.92 / 0.84 | 1.28 / 1.29 / 1.20 | 1.71 / 1.66 / 1.56 | 2.13 / 2.03 / 1.92 | 95° |
| 60° | 0.23 / 0.43 / 0.42 | 0.45 / 0.62 / 0.57 | 0.68 / 0.80 / 0.73 | 0.91 / 0.99 / 0.90 | 1.36 / 1.35 / 1.25 | 1.81 / 1.72 / 1.60 | 2.27 / 2.09 / 1.95 | 88° |
| 90° | 0.24 / 0.56 / 0.58 | 0.48 / 0.74 / 0.72 | 0.72 / 0.93 / 0.88 | 0.96 / 1.11 / 1.06 | 1.44 / 1.48 / 1.40 | 1.91 / 1.85 / 1.73 | 2.39 / 2.21 / 2.05 | 102° |

Brief sanity (Boost, 60° off in the yaw plane): yaw 0.96 s, roll 90° then pitch 60° 1.11 s. Both reproduced.

**What this says.** For a one-off snap, rolling first is slower than simply yawing (or blending pitch and yaw) until
the target is roughly 100° off the nose, i.e. behind your wing line, so "roll to aim in pitch" cannot be justified by
snap time. The diagonal stick beats both from about 60° off (it overlaps the roll with the turn) and is the worst
option for small angles with a big roll need. The case for pitch is **sustained tracking**: once rolled, the nose
follows a crossing target 30 % faster in pitch than in yaw (68 vs 52.1 °/s in SCM, 81.6 vs 62.7 boosted, a ratio of
1.30 in both modes), which is also why every orbit and rate figure below is better in pitch. Apprentice_One's second
reason, that "ESP magnetizes easier to the firing solution in pitch", is his claim (2024-05-09, 3.23 PTU) and is not
modelled here.

## 5. Orbit limits: the pole drill

Holding the nose on a point at radius `r` while moving tangentially at `v` needs a rotation rate `v / r` and a
centripetal acceleration `v² / r`, which only the forward thrust can supply because the nose points at the centre.
`orbitLimit(p, mode, r, axis)` returns the three ceilings and the binding one:

- `vRotation = ω_axis · r`, `vThrust = √(G_fwd · g₀ · r)`, `vCap` = the egg radius 90° off the nose, `vMax = min`.
- `orbitThrottle(p, mode, r, v) = v² / (r · G_fwd · g₀)`: the forward stick that balances the circle.

SCM (m/s):

| r (m) | ω·r pitch | ω·r yaw | √(a·r) | Cap | Max, pitch orbit | Max, yaw orbit |
|---|---|---|---|---|---|---|
| 100 | 119 | 91 | 116 | 225 | 116 (thrust) | 91 (rotation) |
| 150 | 178 | 136 | 142 | 225 | 142 (thrust) | 136 (rotation) |
| 200 | 237 | 182 | 164 | 225 | 164 (thrust) | 164 (thrust) |
| 300 | 356 | 273 | 201 | 225 | 201 (thrust) | 201 (thrust) |

Boost (m/s):

| r (m) | ω·r pitch | ω·r yaw | √(a·r) | Cap | Max, pitch orbit | Max, yaw orbit |
|---|---|---|---|---|---|---|
| 100 | 142 | 109 | 144 | 394 | 142 (rotation) | 109 (rotation) |
| 150 | 214 | 164 | 177 | 394 | 177 (thrust) | 164 (rotation) |
| 200 | 285 | 219 | 204 | 394 | 204 (thrust) | 204 (thrust) |
| 300 | 427 | 328 | 250 | 394 | 250 (thrust) | 250 (thrust) |

Brief sanity: SCM pitch r = 100 m thrust 116, rotation 119 → 116 thrust-limited; yaw 91; r = 200 m 164; Boost r = 100 m
thrust 144, pitch 142. All reproduced (tests at ±1 %).

**What this says.** In SCM the Gladius cannot circle a point at 100 m faster than 116 m/s with the nose on it, and
that needs the full forward stick. In a flat (yaw) circle it is 91 m/s. Boost lifts the 100 m ceiling only to
142 m/s, now set by pitch rate rather than thrust. The pole drill's "faster than this and your nose falls off the
pole" number is `vMax`, and the throttle to hold it is `orbitThrottle` (1.0 for every thrust-limited row).

## 6. Rate fighting: the outrate radius

`outrateRadius(p, mode, v, axis) = v / ω_axis`: a target crossing your nose at `v` closer than this outruns your turn
on that axis. Metres:

| Crossing speed (m/s) | SCM pitch | SCM yaw | Boost pitch | Boost yaw |
|---|---|---|---|---|
| 50 | 42 | 55 | 35 | 46 |
| 100 | 84 | 110 | 70 | 91 |
| 150 | 126 | 165 | 105 | 137 |
| 225 | 190 | 247 | 158 | 206 |
| 394 | 332 | 433 | 277 | 360 |

A Gladius at the SCM cap (225 m/s) crossing a Gladius's nose inside 190 m (pitch) or 247 m (yaw) cannot be followed.
This is only the geometry of one ship's nose against one crossing speed. **Who wins a rate fight between two pilots
depends on both ships' rates, both pilots' throttle and strafe, and the ESP, and needs a two-pilot test: a gap.**

## 7. Orbit simulation (check on §5)

`orbitSim({ p, mode, r0, inputs, seconds, v0 })` runs the core `step()` with a held strafe/throttle while an idealised
nose rule (geometry, not a pilot model) turns the nose toward the target at no more than the measured pitch and yaw
rates with the unit-length stick, never rolling. Boost runs with an unlimited tank so the geometry is not cut short.
Thrusters start at the held command (no slew ramp). Means are over the second half of the run.

Started on the analytic circle (`v0 = vMax`, nose on target), 20 s:

| Mode | r₀ (m) | Forward stick | v₀ (m/s) | Mean r (m) | Mean speed | Mean Δ | Max nose-off (°) |
|---|---|---|---|---|---|---|---|
| SCM | 100 | 1.00 | 115.9 | 100.0 | 115.9 | −0.28 | 0.00 |
| SCM | 200 | 1.00 | 163.9 | 200.0 | 163.9 | −0.30 | 0.00 |
| SCM | 300 | 1.00 | 200.8 | 300.0 | 200.8 | −0.28 | 0.00 |
| Boost | 200 | 1.00 | 203.9 | 200.0 | 203.9 | −0.43 | 0.00 |
| Boost | 100 | 0.88 | 135.3 (95 % of the rate limit) | 100.0 | 135.3 | −0.36 | 0.00 |
| Boost | 100 | 1.00 | 149.5 (105 % of the rate limit) | 135.8 | 164.8 | −4.15 | 6.98 |
| SCM | 100 | 1.00 | 104.3 (90 % of the thrust limit) | 168.6 | 145.4 | −11.65 | 12.90 |
| SCM | 100 | 1.00 | 127.5 (110 % of the thrust limit) | 140.1 | 139.5 | −7.67 | 9.35 |

The thrust-limited circles hold to 0.1 % with the nose never off the target; the rotation limit holds at 95 % and
breaks at 105 % (the nose falls behind, the forward thrust gains a component along the velocity, speed and radius
grow). The last two rows show the circle is **not self-correcting**: a fixed full stick with the speed 10 % off either
way opens the orbit to 190–240 m within 20 s. Holding a radius means modulating the throttle around `orbitThrottle`,
which is what Winters describes ("I modulate my throttle as needed", 2024-12-30).

Winters' binary-circle input (forward ½, down-strafe ¼, 2024-12-30) held from rest at 100 m in SCM for 60 s: the ship
first flies through the point (the nose cannot follow at close range; nose-off peaks at 103°), then as the down-strafe
keeps adding tangential speed up to the 225 m/s cap the circle opens to 779 m, against `v² / (½ · a_fwd)` = 754 m. The
held strafe does not keep the circle tight; the thrust limit sets the radius for whatever speed you have built. The
orbit sample path (`path`, 10 Hz by default) keeps the target at the origin.

## 8. Bench

Node 22, one core, median of repeated loops (`engage.test.ts` asserts the per-frame candidates under 0.02 ms and
`timeToNose` under 1 ms; PLAN.md §9 budget is 0.2 ms per frame):

| Function | Per call |
|---|---|
| `closingSpeed` | 119 ns |
| `timeOfFlight` | 24 ns |
| `leadDistance` | 24 ns |
| `timeToRange` | 23 ns |
| `orbitLimit` | 68 ns |
| `orbitThrottle` | 39 ns |
| `outrateRadius` | 47 ns |
| `noseCrossoverDeg` | 89 ns |
| `noseSim` (60° off, 90° roll) | 45 µs |
| `timeToNose` (same, all three options) | 57 µs |
| `orbitSim` (20 s at 240 Hz) | 3.4 ms |

Everything but the two simulations is safe per frame. `timeToNose` is fine per frame for one target but is meant for
precomputed tables (a 7 × 7 grid is 3 ms); `orbitSim` is for tables and tests only.

## 9. What This Does Not Say

- **Whether a shot hits.** Lead distance and flight time are geometry; spread, hit boxes, netcode and the pilot's
  aim are not computed. No hit rates, no hit counts.
- **PIP or ESP behaviour.** The game's lead indicator and aim assist are not modelled. Apprentice_One's "ESP
  magnetizes easier in pitch" is cited as his claim.
- **The outcome of a rate fight.** §6 is one nose against one crossing speed. Two ships, two pilots: a two-pilot
  test, which is not available (a gap).
- **The Panther's projectile speed.** 1,800 m/s is Apprentice_One's figure for laser repeaters in 3.24.x; the Panther
  in the current patch is unmeasured. One constant to change.
- **The sign of the in-game Δ.** This module's + = closing; the game's bracket is unconfirmed.
- **Velocity inheritance.** Assumed, per Alex; it is what makes Δ enter the flight time at all.
- **Evasion.** Nothing here is a dodge. Winters' strafe taps are not modelled and are not taught (Alex, 2026-10-10).

## 10. Where the math does not support the request

- "The speed Delta affects accuracy because it is added/subtracted from your weapons velocity": true in sign,
  small in size (3 % at 51 m/s, 550 m). The lessons should present Δ as distance management, not as an accuracy
  boost.
- "Roll so you aim in pitch" as a faster way to get on target: not for a one-off snap inside ~100° off the nose. It
  holds for sustained tracking (30 % more rate), which is where the lesson should put it.
- "The Gladius needs to be within 300–400 m to be accurate" (Alex, 2026-10-11) is a hit-rate claim; nothing here can
  check it. Memory's 500–600 m engagement range is the range used in every table.
- Winters' binary circle as a tight knife-fight orbit: with the inputs he names the circle opens to the thrust-limited
  radius for the speed built (hundreds of metres at the SCM cap). A tight circle needs the throttle matched to
  `v² / r` and the speed kept under `vMax` for that radius.

## 11. Gaps (need a test that is not available)

| Gap | Test needed |
|---|---|
| Panther projectile speed and velocity inheritance | two-pilot (`proj_speed`, `proj_inherit` could be single-pilot against a static target) |
| Sign of the target box's Δ | single-pilot: close on a static target and read the bracket |
| Rate-fight outcome Gladius vs Gladius | two-pilot |
| ESP's effect on pitch vs yaw tracking | two-pilot |
