# A human on the chaser's stick (aim model, 2026-10-09)

Follows `docs/evasion-analysis.md` §8 (PR #3). There the chaser was an **ideal** shooter: it fires at your motion as seen 0.25 s ago,
extrapolated perfectly, and never lags the pip. Against it, strafe taps at the wall stayed on target 91 % / 100 % of the time, so the
model could not show the benefit pilots report. This note replaces that shooter with one that tracks the pip the way a person does,
scores every flee pattern against it, and turns the gap into a two-pilot test Alex can fly (round 13).

Labels as elsewhere: **M** measured, **F** fitted, **Mod** model, **A** assumed. Everything below is **Mod** on top of **A** shooter
parameters, an **A** projectile speed (1500 m/s) and the **A** rule that shots inherit the chaser's speed (`tau = range / (v_p + closing)`).

Code: `packages/core/src/aim.ts` (`chaseTrack`, `aimTrack`, `scoreAim`), tests `packages/data-gladius/test/aim.test.ts`,
tables `pnpm build && node tools/aim-study.mjs`.

## 1. The shooter

The game draws the lead pip; the shooter's job is to keep the crosshair on it. That is a manual tracking task, and the standard
engineering description of a person doing one is the **crossover model** (McRuer & Jex, "A Review of Quasi-Linear Pilot Models",
IEEE Trans. HFE, 1967): near the crossover frequency `ωc` the person plus the thing they steer behave like `ωc·e^(−τe·s)/s`, with `τe`
the person's effective delay. A fixed gun aimed by turning the nose is a rate task, so in the model:

- the crosshair moves at a rate set by the error the shooter saw `τe` ago, corrected at `ωc`;
- a **skilled** shooter also matches the pip's own drift (rate feed-forward), so a target sliding at a steady speed is tracked with no
  error. Only a change in the pip's motion opens a gap, and the gap takes about `1/ωc` to close;
- `ωc = 0.75 / τe` in the sweeps, which keeps the loop equally damped at every delay. Published values for rate tasks span roughly
  `τe` 0.1-0.4 s and `ωc` 2-5 rad/s; the right numbers for Star Citizen aim are what round 13 measures (**A** until then).

Not in the model: ESP (aim assist), weapon spread, gimbals, netcode, the shooter's own fatigue or tunnel vision. The ship can turn its
nose far faster than tracking needs at 550 m (pitch 68 °/s is 650 m/s of crosshair travel), so ship rotation never limits the aim.

**Hit outline.** The Gladius seen from behind is 17 m wide and 5.5 m tall (fixture `dimensions_note`, spviewer value, listed in
NOTICE.md). The model uses that rectangle, turned with the target's roll. The real ship is a cross (thin wings, a taller centre), so
the outline over-counts hits; the alpha's 8 m disc is shown alongside for comparison.

## 2. Results (chaser 550 m behind at 520 m/s, shots from 1 s to 10 s)

Share of shots on the hull outline, lead A (velocity) / lead B (velocity + acceleration), %:

| pattern | range at 10 s | ideal 0.25 s (alpha) | human τe 0.15, ωc 4 | human τe 0.25, ωc 3 | human τe 0.35, ωc 2 |
|---|---|---|---|---|---|
| straight, forward held | 550 m | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |
| held up-strafe, no roll | 175 m | 60 / 96 | 74 / 100 | 60 / 83 | 41 / 49 |
| corkscrew, full roll 240 °/s | 547 m | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| escape corkscrew, 60 °/s reversing | 361 m | 10 / 100 | 28 / 100 | 2 / 29 | 0 / 0 |
| slow roll 27 °/s | 362 m | 0 / 100 | 0 / 100 | 0 / 0 | 0 / 0 |
| strafe taps (side + up), forward held | 538 m | 69 / 70 | 78 / 80 | 43 / 68 | 27 / 55 |
| strafe taps, forward released | 50 m | 87 / 94 | 91 / 95 | 77 / 79 | 54 / 56 |
| side taps only | 549 m | 97 / 100 | 100 / 100 | 80 / 100 | 47 / 75 |
| up/down taps only | 546 m | 47 / 53 | 59 / 79 | 28 / 52 | 20 / 33 |

Random tap sequences in the same style (40 each, forward held), median on the outline: side + up 59 / 78 %, side only 79 / 100 %,
up/down 27 / 48 % (human τe 0.25 s). The fixed sequences above sit inside those spreads. All patterns keep the pilot clear of G-LOC
at the nose: the side push there is ~6 G up and ~3.6 G down, under every fitted tolerance (dose stays 0).

### What it says

1. **Taps do beat a human, and only a human.** Against the ideal shooter taps stay on target ~70-80 % of the time; against a person
   with a 0.25 s delay that falls to 43-68 %, and to 27-55 % at 0.35 s. The benefit pilots report (Winters, 2024-12 and 2025-01) is
   the shooter's delay, which the alpha's readout could not show. Taps keep the range (538 m after 10 s), which nothing that bends
   the velocity does.
2. **Dodge along the Gladius's thin axis.** From behind the Gladius is three times wider than it is tall, so a shooter's error up or
   down misses after 2.75 m while a sideways error needs 8.5 m. Up/down taps are hit about half as often as side taps at every delay
   (28 / 52 % against 80 / 100 % at 0.25 s). With the 8 m disc the difference disappears, so this is pure geometry. It runs against
   the "left/right strafes are stronger" advice (Winters, 2025-03), which is about thrust. Thrust doesn't explain it: boosted, the
   fixture gives 12.9 G lateral, 12.99 G up but only 6.8 G down (**M**), so the up/down taps move the ship *less* and still win. **New, untested; round 13 tests it.**
3. **The full-rate corkscrew is fragile, not good.** Its circle has a radius of about 3.4 m across the line of sight, with the ship's belly facing
   out. A shooter who simply aims at the middle of the circle sits 3.4 m above the canopy: just off the 2.75 m outline (0 %) but well
   inside the 8 m disc (the fast human hits 100 % with lead B there). The result turns on 0.65 m and a crude outline, so it can't be
   taught either way. That fits "roll does nothing for you" (Winters, 2024-12, 2025-11).
4. **The escape corkscrew trades range for misses.** The 60 °/s reversing roll is the hardest pattern for a human to hit (2 / 29 % at
   0.25 s) but gives up 190 m in 10 s to a chaser of equal speed. Good for breaking a firing solution for a few seconds, bad as a
   way to leave. Slow roll and held up-strafe lose the range outright (362 m and 175 m).
5. **A shooter who only corrects error (no feed-forward) can't hit anything that drifts**: 0-2 % on taps that drift upward. Real
   shooters lead a drifting target, so that column is a lower bound and is left out of the table.

## 3. Round 13: measure the shooter (two pilots)

**Status, 2026-10-09: deferred.** Alex doesn't have the second pilot or the time for it now. The model's shooter parameters stay
**assumed**, and nothing in the app waits on this test. The script and protocol stay here for when it can be flown.

Script: `tools/sc-flighttest/tests_round13.yaml` (generated by `node tools/aim-study.mjs --yaml`, so the target flies exactly the
sequences scored above). Standing conditions as always: **Arena Commander free flight**, Decoupled, **G-Safe off**, 4K, FOV 100,
both pilots present. Two Gladii with stock CF-337 Panthers.

**Rule check before flying.** CLAUDE.md says the harness is never used in PvP. This test has the harness fly a target that a
friend shoots at in a private free-flight session. I read the rule as covering competitive PvP modes, but **Alex should confirm**.
If not, the target pilot flies the patterns by hand from the printed sequence with a metronome (less repeatable, still useful).

**Setup.** Both ships stopped, nose to tail, 550 m apart on the HUD range, target ahead. On a voice count both press boost and full
forward together: identical ships reach the nose together and the range holds at 550 m. The harness gives the target 6 s of run-up,
then 10 s of pattern.

**Shooter.** From the end of the run-up, fire at the pip in three 2 s bursts (2-4 s, 5-7 s, 8-10 s into the pattern) so the
weapon capacitor and shot count are the same every run. Gimbals off (fixed guns), ESP at your normal setting (note it).
**Don't tell the shooter which pattern is coming**: the order below is shuffled, and knowing the pattern lets a person anticipate it,
which is exactly what the test must exclude.

**Counting hits.** Pick one method and keep it for all runs: hit markers counted from the shooter's 60 fps recording, or the
target's shield and hull loss read before and after each run (repair between runs). Divide each pattern's hits by the straight-line
runs flown in the same session: that ratio removes spread, ESP and the shooter's baseline skill.

**Order (18 runs, about 25 min with resets):** 3 x each of `straight`, `taps_mixed`, `taps_side`, `taps_updown`, `ck_escape`,
`held_up`, shuffled, with `straight` first and last as a drift check.

### Reading the result

Hit share of each pattern divided by the straight runs, against the calibration table (`tools/aim-study.mjs`, outline, A / B, %):

| pattern | τe 0.1 | τe 0.15 | τe 0.2 | τe 0.25 | τe 0.3 | τe 0.35 | τe 0.4 |
|---|---|---|---|---|---|---|---|
| taps, side + up | 85 / 91 | 76 / 78 | 63 / 73 | 43 / 68 | 32 / 59 | 26 / 51 | 21 / 41 |
| side taps only | 100 / 100 | 100 / 100 | 100 / 100 | 80 / 100 | 61 / 94 | 44 / 73 | 40 / 60 |
| up/down taps only | 76 / 86 | 60 / 75 | 38 / 72 | 28 / 52 | 21 / 33 | 18 / 29 | 17 / 27 |
| escape corkscrew 60 °/s | 50 / 100 | 32 / 100 | 12 / 72 | 2 / 29 | 0 / 7 | 0 / 0 | 0 / 0 |
| held up-strafe | 84 / 100 | 77 / 100 | 69 / 100 | 60 / 83 | 51 / 66 | 43 / 53 | 34 / 41 |

- **The shooter's delay**: the column where the tap rows match. Expect it near 0.2-0.3 s for a practised pilot (**A**).
- **The game's lead rule**: the escape corkscrew separates A from B best. Near 0 % with taps still hit fairly often means velocity-only
  lead (A); the corkscrew hit nearly as often as the taps means the pip leads acceleration (B).
- **The thin-axis claim**: up/down taps hit clearly less than side taps (ratio under ~0.7) confirms it. Equal rates kill it, and then
  the outline is wrong (shots land on more of the ship than a rectangle says, or ESP pulls aim onto the centre).
- **Kill the whole model**: taps hit as often as the straight line. Then the delay is not what saves the target; look at ESP and
  spread first.

## 4. What this changes, once round 13 is flown

| Result | Change allowed |
|---|---|
| shooter delay `τe` | The alpha's "on target" readout switches from the ideal shooter to the human one with the measured `τe`; the 0.25 s in the readout's tooltip and the lesson texts becomes a measured number |
| lead rule A or B | The second number of every miss readout goes (one pip rule); `ck-shoot` and `flee-tvi` texts drop the "if the game leads acceleration" hedges |
| thin-axis confirmed | The Flee lessons tap up and down rather than sideways; a short lesson "dodge where the ship is thin" with the outline drawn behind the ship |
| thin-axis killed | The hit outline is wrong: replace it with the measured `hit_radius` widths (`docs/ingame-test-scenarios.md` §6.4) |

Until then the alpha keeps the ideal shooter and says so. Nothing in `site/index.html` changes in this PR.
