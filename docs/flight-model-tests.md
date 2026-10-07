# In-game tests still needed (Gladius, decoupled)

What the simulator still guesses, and the test that would replace each guess. All runs are in **Arena Commander, with the pilot present**, using `tools/sc-flighttest` (vJoy + HUD OCR). Rounds 1–3 are in the fixture; round 4 onward hasn't been run yet.

Run order: 7 → 6 → 5 → 4. Round 7 changes what the lessons teach, round 6 fixes a reported bug, and rounds 5 and 4 refine numbers that are already close.

| # | Round / file | What it settles | Now in the model | Tests | Time |
|---|---|---|---|---|---|
| 1 | **7** `tests_round7.yaml` A | **G-LOC onset by axis:** seconds to grey-out at ~10 G lateral vs up, and ~5 G up vs down | One qualitative note: lateral + roll greys out in 2–3 s, up + roll in 4–7 s | 4 | ~6 min |
| 2 | **7** B | **Managing G-LOC:** the strafe or roll level you can hold for 20 s, easing instead of letting go | Not modeled | 3 | ~4 min |
| 3 | **7** C | **Boosted escape corkscrew:** speed kept and side G at roll 25/50/75 %, up vs lateral | Only roll 100 % is measured (514 m/s, 5.4 G) | 4 | ~7 min |
| 4 | **7** D | **Dodge from mid-egg** (~300 m/s) | Model only (~180 m in 2 s) | 1 | ~1 min |
| 5 | **7** E | **Boost tank:** drain, regen, and whether boost really comes back at 25 % | Drain 4.8 %/s and regen 4 %/s have no stated source; the 25 % red zone is assumed | 1 | ~2 min |
| 6 | **7** F | **Spacebrake** from the boosted nose | Not measured | 1 | ~1 min |
| 7 | **6** `tests_round6.yaml` | **Boost-release tail** from 393 m/s down to 225 | Assumed: the bleed never drops below the SCM retro rating (4.24 G), so ~5 s back to 225 | 3 | ~2 min |
| 8 | **5** `tests_round5.yaml` | **Egg shape near the nose** (yaw sweep) and the long nose slide | Limaçon, validated within 1 % from rest | 5 | ~6 min |
| 9 | **4** `tests_round4.yaml` | **Boosted back and down G** (the last third-party values) | 5.9 G and 6.6 G from spviewer | 4 | ~4 min |

## How the G-LOC tests fly

- **A held strafe can't test G-LOC.** It pulls G only until the ship reaches the wall (about 2.3 s in SCM), then 0 G. That's why held strafes never greyed out in round 3. Sustained G needs the side push to keep turning, so every G-LOC test is a corkscrew.
- **Ease off; don't let go.** A test marked `gloc: ease` works the way a pilot does. When the HUD starts to grey, the harness cuts the chosen inputs by 15 % and keeps flying, at most once every 1.5 s. The level that stops the grey-out is the sustainable one: `ease_events` in `meta.json`, and `sustained_scale` in the analysis. The harness lets go only on a full blackout, or once the inputs are down to 25 %.
- **Two ways to ease:**
  - Ease the strafe: less G, same spin.
  - Ease the roll rate: same G, slower spin.

  If easing the roll never clears the grey-out, G-LOC follows G, not spin. Spiral radius = side acceleration ÷ roll rate² (rad/s), so a slower roll also makes a wider spiral.
- **Onset tests** (round 7 A) keep the default release, because the time to grey-out is the measurement.

## Not automatable yet
- **Does the lead pip use target acceleration?** This needs two pilots and a hit count. It decides whether a steady corkscrew beats changing the plane.
- **Coupled mode.** The alpha is decoupled only.
- **Other ships.** Each needs rounds 1–3 again.

## After each round
1. `python run.py analyze <session>`, then add the results to `research/gladius-v1-fixture.json` with provenance.
2. `pnpm fit`, then `pnpm test:physics`.
3. Replace each `assumed` value it settles, in `packages/data-gladius/src/profile.ts`, `docs/physics-fit.md` and the lesson copy.
