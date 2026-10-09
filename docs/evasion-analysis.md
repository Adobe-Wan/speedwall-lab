# Evading a chaser behind you: the maths, the numbers, and what they say about the coaches' rules

2026-10-09. Everything here is a **model** result from the tested core (`packages/core`, the Gladius fixture) and two small
tools, `tools/evasion-math.mjs` (closed form) and `tools/corkscrew-opt.mjs` (full simulation, 800+ tactics), plus
`tools/stop-opt.mjs` for stopping. Re-run them to reproduce every table. The sc-flight-coach agent's audit of the numbers and of
each lesson is in `docs/coach-review-2026-10-09.md`; this file is the optimisation it asked for.

## 0. Summary

1. **Against a chaser at your own top speed, the best thing the model finds is to stay at the boosted wall, strafe up and roll about
   140-160 deg/s.** It keeps both kinds of shooter missing by 22-25 m at a 1 s flight time; range stays constant.
2. **The TVI far out, with a slow roll, is only best against a shooter who leads your velocity and nothing else.** The same slow roll
   (27 deg/s) lets a shooter who also leads your acceleration miss by 3-5 m, inside an 8 m hit radius. Whether the game's lead pip uses
   acceleration is **not settled**. Until a two-pilot hit-count test is flown, pick the roll rate that is best against the worse of the two.
3. **"Less forward" does raise the side acceleration you can use** (measured side G is about 6 at the nose and 8.7-12.4 at 260-400 m/s
   forward; round 8, noisy) **but G-LOC caps what you can hold** (up 8.1, lateral 6.6 G sustained), so the sustainable gain is at most
   about +35 % in miss (6 G to 8.1 G), and **every 100 m/s of forward speed you give up lets a 520 m/s chaser close 100 m/s**, which cuts
   the shooter's flight time and your miss with its square. Against an equal-speed chaser the gain is wiped out in 3-5 s. It can pay
   against a slower chaser, or if the aim is to keep the chaser near your wingmen: the model cannot judge that.
4. **Stopping: flip and burn beats braking from speed**, by about 2x from the boosted wall (about 4 s against about 8 s), because the
   main thrusters are 3.2-3.6x the retro rating. The spacebrake itself has **not been measured**: the round-7 test never pressed the
   brake (a harness bug, found by the coach review and fixed). Round 12 re-flies it.

## 1. The maths

You thrust sideways with acceleration `a` (the strafe stick is fixed in the ship; the ship rolls at `omega`, so in space the thrust
rotates). A chaser behind you fires at where you will be after the projectile flight time `tau = range / projectile speed`.

- **Lead model A, velocity only.** It aims at `p + v*tau`. The miss is `a * tau^2 * f(omega*tau)` with
  `f(x) = sqrt((x - sin x)^2 + (1 - cos x)^2) / x^2`. `f` is 1/2 for small `x` and falls like 1/x: **A rewards the slowest roll.**
- **Lead model B, velocity and acceleration.** It aims at `p + v*tau + a*tau^2/2` (your current `a`). The miss is
  `a * tau^2 * g(omega*tau)` with `g(x) = |e^(ix) - 1 - ix + x^2/2| / x^2`, which is about `x/6` for small `x` and peaks near
  `x = 3.5`: **B rewards a fast roll, `omega*tau` near 3.5**, 200 deg/s at a 1 s flight time.
- **What limits a slow roll:** the circle your velocity traces has radius `a/omega` in velocity space, and it must fit inside the egg's
  cross-section at your forward speed (`room`). So `omega >= a/room`. At the boosted wall `room` is 29-128 m/s, so `omega >= 115 deg/s`
  there; at 400 m/s forward (`room` 293) it is 16 deg/s.
- **What limits a big `a`:** the side thrust available falls with forward speed (about 6 G at the nose, about 12.4 G below 300 m/s),
  and the pilot can only hold it up to the G-LOC tolerance (fitted: up 8.1, lateral 6.6 G; above that stress builds at
  `(G/T - 1)` per second, grey at 1, blackout at 2.3).
- **Range:** the chaser holds 520 m/s along your line; you hold `v_f`; the range changes at `520 - v_f` and `tau` shrinks with it.
  Miss goes as `tau^2`, so a closing chaser quickly beats any corkscrew (below about 500 m at a 1 km/s projectile no corkscrew at 6-8 G
  keeps the miss above an 8 m hit radius).

## 2. Roll rate at the boosted nose (6 G, 1 s flight time)

Roll-rate sweep at the nose (a = 6.0 G, room 29-128 m/s so ω ≥ ~0.45 rad/s), τ = 1.0 s:
| roll °/s | miss A (m) | miss B (m) | worse of the two |
|---|---|---|---|
| 15 | 29.4 | 2.6 | 2.6 |
| 27 | 29.2 | 4.6 | 4.6 |
| 40 | 29.0 | 6.8 | 6.8 |
| 60 | 28.5 | 10.1 | 10.1 |
| 90 | 27.5 | 14.7 | 14.7 |
| 120 | 26.0 | 18.9 | 18.9 |
| 144 | 24.6 | 21.9 | 21.9 |
| 180 | 22.2 | 25.6 | 22.2 |
| 240 | 17.7 | 29.7 | 17.7 |


A is flat (27-29 m) between 15 and 90 deg/s and falls after; B climbs steadily. (Right on the wall the egg is too thin for the slowest rolls: sustaining 6 G needs `omega >= a/room`, about 50 deg/s at 513 m/s and 115 at 519; the game's own nose corkscrews at 60 deg/s held 5.7 G at 513 m/s, `r8_bst_f100_up_r25`, because the speed sags a little off the wall, so the lower bound is soft there.) The worse of the two peaks at **144-160 deg/s**.
This reproduces the simulation (`tools/corkscrew-opt.mjs`, whole tactic set below): 144 deg/s, up strafe, full forward, miss 24.9 / 21.9 m.

## 3. Forward speed: side G, closing speed and G-LOC together

Per forward speed `v_f`, sustained side G is the smaller of the measured side G and the G-LOC tolerance; the roll is chosen to maximise
the worse of A and B; the chaser holds 520 m/s from 1000 m behind and fires 1 km/s projectiles. "First time the miss drops below the
hit radius" is when the chaser's solution becomes good enough to hit you.

| forward m/s | strafe | room m/s | side G available | side G used (G-LOC cap) | best roll °/s (maximin) | slowest roll the egg allows °/s | miss A / B at the start (m) | first time the miss drops below the hit radius | range at end (m) |
|---|---|---|---|---|---|---|---|---|---|
| 519 | up | 29 | 6.0 | 6.0 | 160 | 115 | 23.6 / 23.7 | never | 992 |
| 519 | lat | 29 | 6.0 | 6.0 | 160 | 115 | 23.6 / 23.7 | never | 992 |
| 480 | up | 179 | 6.8 | 6.8 | 160 | 21 | 26.6 / 26.8 | never | 680 |
| 480 | lat | 179 | 6.8 | 6.6 | 160 | 21 | 26.0 / 26.0 | never | 680 |
| 440 | up | 244 | 7.7 | 7.7 | 162 | 18 | 30.1 / 30.8 | 4.8 s | 360 |
| 440 | lat | 244 | 7.7 | 6.6 | 159 | 15 | 26.0 / 25.9 | 4.3 s | 360 |
| 400 | up | 293 | 8.7 | 8.1 | 159 | 16 | 31.9 / 31.8 | 3.2 s | 40 |
| 400 | lat | 293 | 8.7 | 6.6 | 162 | 13 | 25.8 / 26.3 | 2.9 s | 40 |
| 360 | up | 327 | 9.8 | 8.1 | 157 | 14 | 32.1 / 31.5 | 2.4 s | -280 |
| 360 | lat | 327 | 9.8 | 6.6 | 160 | 11 | 26.0 / 26.0 | 2.2 s | -280 |
| 320 | up | 354 | 10.9 | 8.1 | 162 | 13 | 31.6 / 32.3 | 2.0 s | -600 |
| 320 | lat | 354 | 10.9 | 6.6 | 158 | 10 | 26.1 / 25.8 | 1.8 s | -600 |
| 280 | up | 376 | 11.9 | 8.1 | 161 | 12 | 31.7 / 32.1 | 1.7 s | -920 |
| 280 | lat | 376 | 11.9 | 6.6 | 157 | 10 | 26.2 / 25.7 | 1.5 s | -920 |
| 240 | up | 392 | 12.4 | 8.1 | 160 | 12 | 31.8 / 32.0 | 1.4 s | -1240 |
| 240 | lat | 392 | 12.4 | 6.6 | 165 | 9 | 25.6 / 26.6 | 1.3 s | -1240 |

Same, chaser at 450 m/s (the 519 / 440 / 400 rows, up strafe):

| 519 | up | 29 | 6.0 | 6.0 | 160 | 115 | 23.6 / 23.7 | never | 1552 |
| 440 | up | 244 | 7.7 | 7.7 | 162 | 18 | 30.1 / 30.8 | never | 920 |
| 400 | up | 293 | 8.7 | 8.1 | 159 | 16 | 31.9 / 31.8 | 7.8 s | 600 |

Chaser at 400 m/s (a slower chaser):

| 519 | up | 29 | 6.0 | 6.0 | 160 | 115 | 23.6 / 23.7 | never | 1952 |
| 440 | up | 244 | 7.7 | 7.7 | 162 | 18 | 30.1 / 30.8 | never | 1320 |
| 400 | up | 293 | 8.7 | 8.1 | 159 | 16 | 31.9 / 31.8 | never | 1000 |

Reading it: the sustainable miss rises only from about 24 m to 32 m (+35 %) between the wall and 400 m/s. Against a 520 m/s chaser,
400 m/s gets the chaser inside the hit range in 3 s; at 440, in 5 s; at the wall, never. Against a 450 m/s chaser the 400 m/s option lasts
8 s; against a 400 m/s chaser it never loses range. **So "less forward" is a trade that only wins against a slower chaser.**
Lateral strafe is worse than up at every speed (6.6 G tolerance against 8.1).

## 4. The simulation agrees at the nose, and shows where it cannot be trusted

Full-core simulation (`tools/corkscrew-opt.mjs`): boosted, nose at the wall, 9 s scored, 1000 m range, 520 m/s chaser, 8 m hit radius.
Top tactics and baselines, ranked by the worse lead model:

```
range 1000 m, projectile 1000 m/s, chaser 520 m/s, hit radius 8 m, scored 0.5-9 s, boosted, 810 policies

TOP (ranked by the worse lead model's hit share, then the smaller mean miss):
| tactic | fwd m/s | strafe | roll °/s | mean TVI δ | mean m/s | peak G | mean miss A / B (m) | time hit (r<8 m) A / B | range at 9 s (m) | peak stress |
|---|---|---|---|---|---|---|---|---|---|---|
| corkscrew | 519 | up 1 | 144 | 2.9° | 520 | 6.4 | 24.9 / 21.9 | 0 % / 0 % | 992 | 0.0 |
| corkscrew | 519 | lat 1 | 144 | 2.9° | 520 | 6.4 | 24.7 / 21.7 | 0 % / 0 % | 992 | 0.0 |
| corkscrew | 480 | up 1 | 144 | 3.4° | 518 | 7.1 | 23.7 / 20.0 | 0 % / 0 % | 955 | 0.0 |
| corkscrew | 480 | lat 1 | 144 | 3.4° | 518 | 7.0 | 23.5 / 19.9 | 0 % / 0 % | 955 | 0.0 |
| corkscrew | 519 | up 1 | 240 | 1.7° | 520 | 6.3 | 18.0 / 29.9 | 0 % / 0 % | 997 | 0.0 |
| corkscrew | 519 | lat 1 | 240 | 1.7° | 520 | 6.3 | 17.9 / 29.7 | 0 % / 0 % | 997 | 0.0 |

BASELINES:
| tactic | fwd m/s | strafe | roll °/s | mean TVI δ | mean m/s | peak G | mean miss A / B (m) | time hit (r<8 m) A / B | range at 9 s (m) | peak stress |
|---|---|---|---|---|---|---|---|---|---|---|
| straight (no evasion) | 519 | - 0 | - | 0.0° | 520 | 0.1 | 0.0 / 0.0 | 100 % / 100 % | 999 | 0.0 |
| held strafe | 519 | up 1 | - | 18.3° | 514 | 5.9 | 11.2 / 0.8 | 43 % / 100 % | 696 | 0.0 |
| jink 0.75 s | 519 | lat 1 | - | 1.8° | 520 | 6.6 | 11.3 / 19.3 | 30 % / 17 % | 995 | 0.0 |
| jink 1.25 s | 519 | lat 1 | - | 2.9° | 520 | 7.0 | 18.2 / 15.8 | 17 % / 29 % | 989 | 0.0 |
| jink 2 s | 519 | lat 1 | - | 4.4° | 519 | 7.5 | 22.1 / 9.8 | 11 % / 59 % | 975 | 0.1 |

BEST CORKSCREW AT EACH FORWARD SPEED (any strafe stick, up or lateral):
| tactic | fwd m/s | strafe | roll °/s | mean TVI δ | mean m/s | peak G | mean miss A / B (m) | time hit (r<8 m) A / B | range at 9 s (m) | peak stress |
|---|---|---|---|---|---|---|---|---|---|---|
| corkscrew | 519 | up 1 | 144 | 2.9° | 520 | 6.4 | 24.9 / 21.9 | 0 % / 0 % | 992 | 0.0 |
| corkscrew | 480 | up 1 | 144 | 3.4° | 518 | 7.1 | 23.7 / 20.0 | 0 % / 0 % | 955 | 0.0 |
| corkscrew | 440 | up 1 | 240 | 2.1° | 509 | 10.6 | 16.2 / 22.7 | 0 % / 0 % | 871 | 0.0 |
| corkscrew | 400 | up 1 | 240 | 2.2° | 490 | 13.0 | 13.4 / 15.5 | 0 % / 0 % | 692 | 0.0 |
| corkscrew | 360 | up 1 | 240 | 2.4° | 453 | 13.0 | 8.8 / 8.5 | 51 % / 60 % | 363 | 0.0 |
| corkscrew | 320 | lat 1 | 240 | 4.9° | 410 | 12.9 | 5.5 / 5.2 | 70 % / 75 % | -36 | 0.3 |
| corkscrew | 280 | up 1 | 240 | 6.6° | 371 | 13.0 | 8.0 / 7.5 | 66 % / 73 % | -397 | 2.1 |
| corkscrew | 240 | up 1 | 240 | 8.2° | 274 | 13.0 | 6.4 / 5.7 | 74 % / 79 % | -1246 | 2.3 (5.4 s out) |

BEST UP-STRAFE CORKSCREW AT EACH FORWARD SPEED THAT NEVER BLACKS YOU OUT:
| tactic | fwd m/s | strafe | roll °/s | mean TVI δ | mean m/s | peak G | mean miss A / B (m) | time hit (r<8 m) A / B | range at 9 s (m) | peak stress |
|---|---|---|---|---|---|---|---|---|---|---|
| corkscrew | 519 | up 1 | 144 | 2.9° | 520 | 6.4 | 24.9 / 21.9 | 0 % / 0 % | 992 | 0.0 |
| corkscrew | 480 | up 1 | 144 | 3.4° | 518 | 7.1 | 23.7 / 20.0 | 0 % / 0 % | 955 | 0.0 |
| corkscrew | 440 | up 1 | 240 | 2.1° | 509 | 10.6 | 16.2 / 22.7 | 0 % / 0 % | 871 | 0.0 |
| corkscrew | 400 | up 1 | 240 | 2.2° | 490 | 13.0 | 13.4 / 15.5 | 0 % / 0 % | 692 | 0.0 |
| corkscrew | 360 | up 1 | 240 | 2.4° | 453 | 13.0 | 8.8 / 8.5 | 51 % / 60 % | 363 | 0.0 |
| corkscrew | 320 | up 1 | 240 | 4.8° | 410 | 13.0 | 5.5 / 5.1 | 70 % / 75 % | -33 | 0.1 |
| corkscrew | 280 | up 1 | 240 | 6.6° | 371 | 13.0 | 8.0 / 7.5 | 66 % / 73 % | -397 | 2.1 |
| corkscrew | 240 | up 0.8 | 240 | 5.7° | 333 | 13.0 | 5.7 / 4.8 | 76 % / 81 % | -730 | 1.9 |
```

- Straight, no evasion: hit 100 % of the time. A held strafe: 43 % hit by model A and 100 % by B (a constant acceleration is predictable).
  Jinks: 11-30 % / 17-59 %. Corkscrews at 60-240 deg/s: 0 % / 0 %.
- **The simulation cannot yet say anything about partial forward.** Corkscrews at 25-75 % forward end at the nose wall (520 m/s) in the
  model, because decoupled flight keeps the momentum and the forward thrust keeps adding to it, while the round-8 game runs read 262-398
  m/s at the same inputs (noisy: camera presses). Which one is right is unknown, so the table in section 3, built from the measured
  side G and the egg, is the honest answer, not the simulated partial-forward rows.

## 5. The coaches' rules, one by one

| Rule | Verdict | Why |
|---|---|---|
| Put the TVI farther out | **Only against a velocity-only lead.** | A: the miss is flat (about 27 m) from TVI 5 to 45 degrees; B: slow rolls, which a far TVI needs (9-27 deg/s), give 3-5 m, inside the hit radius. Away speed falls 504 to 436 m/s from 13 to 30 degrees, so the chaser closes faster. |
| Use less forward | **Raises side G, costs range; wins only against a slower chaser.** | Section 3. Also caps at the G-LOC tolerance. |
| A corkscrew buys time for wingmen | **Plausible, outside the model.** | The model measures your miss, not what the chaser does in front of your wingmen. Staying alive longer is what the model supports: a mid-range roll at the wall never lets the range close. |
| Skilled pilots never use the spacebrake | **Right for stopping from speed; the brake itself is unmeasured.** | Flip and burn is about 2x quicker than retro-only braking from the boosted wall and 1.3-2x from SCM (table below). If the spacebrake only uses the retros, it is slower; if it uses every bank it could win. The flip points your nose away for 2.2-2.65 s, and below about 160 m/s plain braking is quicker and keeps the nose on target. |
| Braking is less efficient than rolling and flying backward | **Supported with the retro assumption** | Same table. "Rolling" does not turn the nose, a pitch flip does. |

## 6. Stopping (model; the spacebrake is modelled as the retro bank and is NOT measured)

Time to stop (speed below 5 m/s) from speed v0 along the nose. The flip policy tracks retrograde with the pitch and burns forward in
proportion to the alignment.

```
stopping from 225 m/s, SCM:
| tactic | time to < 5 m/s (s) | distance (m) | G-LOC stress |
|---|---|---|---|
| retro (the spacebrake modelled as the retro bank), boost off | 5.3 | 618 | 0.0 |
| retro + boost | 3.8 | 446 | 0.0 |
| flip & burn, nose tracks retrograde, boost on (21 G) | 2.8 | 497 | 0.4 |
| flip & burn, nose tracks retrograde, boost off (13.7 G) | 3.8 | 672 | 0.0 |
| pitch up 90°, up-strafe ramps in from 40° off straight below, boost on | 2.5 | 354 | 0.9 |
| pitch up 90°, up-strafe ramps in from 60° off straight below, boost on | 12.1 | 417 | 0.0 |

stopping from 225 m/s, boosted nose wall:
| tactic | time to < 5 m/s (s) | distance (m) | G-LOC stress |
|---|---|---|---|
| retro (the spacebrake modelled as the retro bank), boost off | 5.8 | 721 | 0.0 |
| retro + boost | 4.7 | 650 | 0.0 |
| flip & burn, nose tracks retrograde, boost on (21 G) | 2.9 | 543 | 0.5 |
| flip & burn, nose tracks retrograde, boost off (13.7 G) | 3.8 | 672 | 0.0 |
| pitch up 90°, up-strafe ramps in from 40° off straight below, boost on | 9.1 | 443 | 0.0 |
| pitch up 90°, up-strafe ramps in from 60° off straight below, boost on | 14.9 | 499 | 0.0 |

stopping from 519 m/s, boosted nose wall:
| tactic | time to < 5 m/s (s) | distance (m) | G-LOC stress |
|---|---|---|---|
| retro (the spacebrake modelled as the retro bank), boost off | 8.2 | 1627 | 0.0 |
| retro + boost | 9.3 | 2578 | 0.0 |
| flip & burn, nose tracks retrograde, boost on (21 G) | 3.9 | 1313 | 1.1 |
| flip & burn, nose tracks retrograde, boost off (13.7 G) | 4.0 | 1068 | 0.5 |
| pitch up 90°, up-strafe ramps in from 40° off straight below, boost on | 4.8 | 1429 | 2.3 |
| pitch up 90°, up-strafe ramps in from 60° off straight below, boost on | 10.4 | 1440 | 0.3 |
```

Measured anchors: `r10_flip_and_burn` took 363 m/s to about 63 in 1.5 s (about 20 G) after a flip that cost 511 to about 380 for free;
`r6_release_all` took 5.2 s from 519 to 225. G-LOC: the 20 G burn is eyeballs-in; the fitted forward tolerance (13.5 G) comes from one scenario
(flip and burn); in that test a burn continued beyond the stop greyed the HUD to 25 % within about 2 s. Cut the throttle at zero.

## 7. What would settle it (Arena Commander, with the pilot present)

1. **Spacebrake, for real** (`tests_round12.yaml`, six tests, runner fixed).
2. **Two-pilot hit count**: a shooter fixed behind a target in an up corkscrew at 27, 60 and 240 deg/s, and a straight line, 60 s each. It
   settles the lead-pip rule, which every number above depends on, and the "TVI farther" question.
3. **Flee corkscrew at speed**: start boosted at 450 m/s, forward 100 / 75 / 50 %, roll 30 / 60 / 120 deg/s, up strafe, 14 s,
   `gloc: hold`. The missing partial-forward data.
4. **Side push by forward speed**: strafe-only dodges from 200-500 m/s, forward held and released (the 358 m/s step is a fit to one wall trace).
5. **TVI capture** during a corkscrew at the nose, and the other items in `docs/coach-review-2026-10-09.md` section 4.

## 8. Correction, 2026-10-09: gun range is 500-600 m, not 1 km

The pilot (a Gladius flyer) corrected the setup above: 1 km is never an effective range. With the Gladius's CF-337 Panther
repeaters you fight at **500-600 m**, and a chaser with a **positive closing delta** has the advantage (shorter flight time; ESP
and the pip work in its favour; a fleeing pilot can hardly watch the chaser's delta and trajectory). Projectile speed is assumed
1500 m/s (the Star Citizen Wiki lists 1480 for the Panther, 4.10.1; not measured, and whether shots inherit the shooter's speed is
not known). Flight time `tau = range / (projectile speed + closing speed)`.

Closed form, same `f` and `g` as section 1 (**Mod**; misses in metres, A / B):

| range | closing | tau | 6 G, roll 27 °/s | 6 G, 150 °/s | 6 G, 240 °/s | 8.1 G, 240 °/s |
|---|---|---|---|---|---|---|
| 500 m | 0 | 0.33 s | 3.3 / 0.2 | 3.2 / 0.9 | 3.1 / 1.5 | 4.2 / 2.0 |
| 550 m | 0 | 0.37 s | 4.0 / 0.2 | 3.9 / 1.2 | 3.7 / 1.9 | 5.0 / 2.6 |
| 600 m | 0 | 0.40 s | 4.7 / 0.3 | 4.6 / 1.6 | 4.4 / 2.5 | 5.9 / 3.4 |
| 550 m | 85 m/s | 0.35 s | 3.5 / 0.2 | 3.5 / 1.1 | 3.3 / 1.7 | 4.5 / 2.2 |

What changes:
1. **The best roll is full rate.** The maximin roll is about `160 / tau` deg/s, about 430 deg/s at 0.37 s: above the 240 maximum.
   Against model A the roll barely matters at this range; against model B slow is worst.
2. **No corkscrew beats a good shooter at gun range.** 6-8 G for 0.35 s moves the ship 2-5 m, inside an 8 m hit radius and under half
   the Gladius's 17 m width (from behind it shows 17 m wide by 5.5 m tall). The corkscrew only punishes sloppy aim there.
3. **So range is the defence.** Staying on the boosted wall denies the chaser closing speed; a far TVI or less forward gives it away
   (app model, chaser 550 m behind at 520 m/s, 10 s: wall 547 m, far TVI with a 27 deg/s roll 360 m, forward released 50 m).
4. Sections 2-4 above remain correct for 1 km but describe a range that does not happen in a fight.

**What post-3.23 community advice says (dated sources: `/mnt/project-files/research/post-3.23-evasion-sources.md`, project
files, not in the repo).** It agrees on the range (Spectrum, 2024-09: fights moved from 200-400 m to 500-700 m with Master Modes) and on
the small-dodge physics (Spectrum, 2026-06: `½at²` over the flight time). It adds three things the model does not settle:
- **Don't hold a steady corkscrew.** Spectrum replies (2025-04, 2026-04) say to change direction often and roll both ways; the model
  only scores a steady roll, so "full rate" is the best *steady* roll, not a proven best tactic. A random-reversal case is missing.
- **Roll may not do what the model assumes.** Johnathan Winters, "Roll Isn't Doing What You Think It Is" (2025-11-29): not yet
  watched (no transcript). Treat point 1 above as provisional until it is.
- **Velocity inheritance** (`v_proj + closing`) rests on one unsourced Spectrum reply (2026-05). Still a test item (`proj_inherit`).

**Update after the transcripts (same file).** Johnathan Winters (2024-12-30, 2025-11-29): "roll does nothing for you";
the dodge is quick, delayed, unrepeated strafe taps, and roll is for aiming. Apprentice_One (2025-05-01): the escape corkscrew uses a
*gradual* roll, reversed near blackout. No source backs a full-rate roll, so point 1 above is withdrawn as advice: the maths holds for a
steady corkscrew, but the lessons no longer teach "roll faster". The app now (a) adds an assumed 0.25 s shooter reaction to the flight
time, (b) flies the escape corkscrew with a ~60 deg/s roll that reverses, and (c) flies the Flee lessons with an irregular sequence of
0.25-0.5 s strafe taps, and reports the share of time each shooter model is on target. Result (**Mod**): against the model's shooters,
which track perfectly once they have seen you, taps at the wall are on target 91 % (A) / 100 % (B) of the time, the gradual corkscrew
36 % / 99 %. The model therefore does not reproduce the benefit pilots report; what taps beat is human aim, which is not modelled.
A1 quotes laser repeaters at 1800 m/s (2024-11, 3.24.x); 1500 stays assumed.

The app (`site/index.html`) now computes the chaser's miss at 550 m (or the live range in the Flee lessons) instead of a fixed 1 s.
