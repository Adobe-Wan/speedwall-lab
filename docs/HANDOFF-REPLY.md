# Reply to the build session's hand-off (docs/HANDOFF.md on `claude/ui-updates`)

> **Correction, 2026-10-09:** `r7_spacebrake_nose` never pressed the spacebrake (the harness hard-coded `brake: False`; fixed in `sctest/runner.py`). It is a second release trace, so every statement below that the spacebrake is "no faster than releasing" is unsupported. The spacebrake's deceleration is not measured; round 12 (`tests_round12.yaml`) re-flies it. See `docs/coach-review-2026-10-09.md`.

Written 2026-10-08 by the chat that ran the in-game tests and wrote `PLAN.md`. It answers `docs/HANDOFF.md` point by
point and carries everything the flight tests found today, so the physics and every view can use it.

**Read in this order:**
1. this file;
2. `docs/flight-model-findings.md` (the evidence, sections 1–9);
3. `research/gladius-measurements-2026-10-08.json`: the new measured constants and speed traces, ready to merge into
   `research/gladius-v1-fixture.json`;
4. `research/raw/2026-10-08/`: 140 tests, raw (series, vision, meta per test).

All of this is on branch `claude/probe-3view-redout` (draft PR #1). Rounds 4–11 have now been flown.

---

## 1. Your departures from PLAN.md: verdicts

All nine were the author's requests, so the build wins on every one. Two need a physics caveat.

| # | Departure (your §3) | Verdict | PLAN.md edit |
|---|---|---|---|
| 1 | Rotation, controls wizard, `actionmaps.xml` import, boost tank and Unlimited toggle are in V1 | **Build wins.** | §1 Scope table: Rotation → "V1: pitch/yaw/roll at measured, linear rates; a diagonal stick is scaled to unit length (see §4.8)". Input → add "controls wizard and SC actionmaps import". Translation → "boost + tank (drain 5.0 %/s, regen 3.75 %/s, re-engage at 25 %: measured)". |
| 2 | Boost release: fitted quadratic + assumed 4.24 G floor | **Build wins, and the floor is now measured: 4.26 G.** Replace "assumed". | §4.6: "Boost release or empty tank: IFCS bleeds to the SCM sphere. Measured from the nose (519): ~11.9 G over the first second (12.5 G peak), then **4.26 G** from 300 to 235; 225 after 5.2 s. Released at 440 (peaked 457): 4.8 s; released at 338 (peaked 367): 3.7 s. With a strafe held: 7.6 s (only 2.2 G below 300). The **spacebrake above SCM is no faster than releasing** (5.2 s, same curve). Acceptance: the six release traces in the measurements file, ±10 m/s." |
| 3 | Egg and ship turn with attitude; true-size low-poly Gladius on the velocity point; no size toggle; SCM sphere always on | **Build wins.** The egg shape is now measured all round (§3 below), so the mesh is final. | §5: replace the glyph bullet with "Low-poly Gladius at true size (20 × 17 × 5.5 m) on the velocity point. Frame option: egg turns with the ship (default) or ship frame." Drop the toggle text. |
| 4 | Chase camera in the egg view | **Build wins.** | §5: add "Chase camera (default at lesson start): follows the ring centre and zooms to keep the sideways room and the wall in frame; world-fixed orientation." |
| 5 | Fixed advanced HUD layout at 0.11 view-widths | **Build wins.** | §6.3: add the layout sentence. The 0.11 constant is still unverified (§4 Q4). |
| 6 | Desktop-first; phones only play lessons | **Build wins.** | §7 Layout: "Desktop-first. Touch phones play the lessons only (no controls); narrow desktop windows keep the controls." |
| 7 | Seven lessons from a standstill, "jink" removed | **Build wins, with figure corrections** (§4 Q5): the escape corkscrew needs the measured launch grey-out (§4 Q5). | §7: replace the preset list with the seven lessons; add "lesson figures cite the fixture; any figure without a test ID is marked model". |
| 8 | Screen-reader work deferred | **Build wins.** | §7 Accessibility: "Screen-reader pass deferred (qa-2026-10-07 item 7)." |
| 9 | P2–P5 not built as packages | **Build wins.** | §11: "P2–P5 are re-planned as porting the prototype page into `render` and `element`; P6 rotation is in the prototype." |

## 2. Your "assumed" values: settled

| Item | Was | Now | Evidence |
|---|---|---|---|
| `releaseFloorG` | assumed 4.24 | **measured 4.26** | 4.26–4.27 G between 300 and 235 m/s in four release tests and the spacebrake test |
| `redZonePct` | assumed 25 | **measured 25** | `r7_tank_cycle`: boost held through empty; boost re-engaged when the tank refilled to ~25 % and drained again |
| Tank drain / regen | 4.8 / 4.0, no source | **5.0 / 3.75 measured** | 100 → 0 % in 20.2 s (5.00 %/s; ~40 other boosted tests 4.95–5.02); refill 3.73–3.75 %/s. The wiki API agrees (5.0 / 3.75). |
| Boosted back / down G | spviewer 5.9 / 6.6 | **measured 5.96 / 6.8** (6.77–6.79) | `r4_boost_back`, `r4_boost_down` (accel only: see §5) → drop the spviewer provenance, update NOTICE.md |
| G-LOC | not modelled | **data for a first model** | §4 Q1 |

## 3. Physics the build should take on (priority order)

1. **The forward axis is the game's throttle.** The game has no forward strafe binding; "Throttle – Forward / Back"
   moves the ship. While deflected it gives thrust in proportion (25 % → 3.4 G, 50 % → 6.9 G, held until the 225 cap),
   which is what `requestG` already does, so no change while held. Two notes for lessons and the controls wizard:
   - the game keeps a throttle setting when the axis returns to centre (after a 50 % test the ship sped back up to
     ~105 m/s whenever the spacebrake was let go; a tap back clears it);
   - your `ROW_NAMES.f` label "Throttle (strafe forward / back)" is right; the wizard should bind *Throttle – Forward / Back*.
2. **The boosted egg is the limaçon everywhere, and round in cross-section.** Settle speeds after turning at boosted
   speed: 394 at 90° (below and above; 394 to the side from round 1), **331 at 120°**, **~301 at ~137°**, **285 at 150°**;
   268 straight back (round 1, boosted reverse from rest; the 180° turn test had not settled when it ended); plus round 3's
   518/514/508 at 8.6°/16.9°/24.5°. The limaçon gives 394/331/302/285/268 and 518.6/514.6/508.7. Answer to your Q2:
   keep the limaçon; the "narrow nose" is the weak side push (0.469), as you modelled.
3. **Turning sheds speed toward the egg, at a rate that is not one constant.** After a boosted 90° pitch at 510 the speed
   bleeds to 394 with the excess shrinking ~e-fold per second (K ≈ 1.0 /s, fixture 1.3); after 120–180° the bleed is
   slower near the tail (~4 G). Fit `softWallK` (or a G-limited bleed) to the five `turn*` traces. Also measured:
   - **SCM turn: no loss** (sphere);
   - **turn with throttle held:** dips to 441, then forward thrust drags the velocity back onto the new nose (485 and climbing);
   - **turn with boost released:** 225 about 3.0 s after the release (1.7 s after the turn ends);
   - **flip and burn:** at ~363 m/s after the flip, full throttle + boost removes ~300 m/s in 1.5 s (≈20 G, the boosted
     forward rating), through zero, and re-accelerates.
4. **Rotation (P6): linear per axis, but a diagonal stick is scaled back.** Pitch 25 % → 17.0, yaw 25/50 % → 13.0/26.1 °/s
   (linear). Pitch + yaw at full stick turns the nose at **62.6 °/s (boosted 74.8)**, *slower* than pitch alone (68 /
   81.6, round 3). That matches scaling the stick vector to unit length (60.6 / 72.7) within ~3 %. Implement: if
   `|(pitch, yaw, roll)| > 1`, divide by the length, then multiply each axis by its rate. Consequences for lessons:
   the fastest 180° is **pure pitch** (2.65 s SCM, 2.21 s boosted); a diagonal pull is not a shortcut. Roll + pitch was
   measured with a weaker method (212 °/s) and should be treated as unverified.
5. **G-LOC model (new; see Q1 for the data).** The pieces a pilot model needs: per-direction tolerance, onset time
   above it, a ~4 s recovery after the load stops, edge-first vignette, red tint for down, and what blackout does to
   the ship: **the camera key stops working and boost drops (speed bleeds back to 225)**; in the boosted-down case the
   ship also stopped accelerating (250 m/s before the blackout, 224 when vision returned 4.5 s later, then it
   accelerated again). Whether strafe thrust is cut in every direction is not settled (see Q1, recovery).
6. **Fixture merge.** Add the constants and traces from `research/gladius-measurements-2026-10-08.json` (each with its
   test ID and session), add acceptance checks for the release, turn and throttle traces, and mark
   `r4_boost_down`'s plateau invalid.

## 4. Your open questions

**Q1. G-LOC rule.** Not a single G limit; a per-direction tolerance with time-to-onset falling as G rises above it.
Strafe + full roll from rest (constant G, SCM unless noted; `r10_g_*`, `r10_geq_*`, `r10_rec_*`, round 9):

| Direction | No grey within 20 s at | Greys out | Notes |
|---|---|---|---|
| Up (eyeballs down) | 2.5, 5, 6.5, 7.5 G | 10 G: grey 4.4 s, HUD gone 5.3 s | most tolerant |
| Lateral | 2.5, 5 G | 7.5 G: grey 7.4 s, HUD gone 16 s; 10 G: grey 1.7–2.1 s, HUD gone 3.4–3.8 s, fully black ~4.4 s | |
| Down (red-out) | 2.5, 3.7 G | 5 G: grey 3.4–3.6 s, HUD gone 5.9–6.3 s, strong red | boosted and SCM equal-G pairs agree within 0.25 s, so **boost itself is not the cause** |

- **Recovery:** in the three `r10_rec_*` tests (10 G lateral held 7 s, black from ~4.5 s) the HUD came back **~4.0 s
  after the stick was released** (11.0 s, all three). In two of them the stick was pushed again at 8.5 / 10.0 s while
  still black, and vision still came back at 11.0 s: re-applying the load during a blackout did not extend it. In the
  boosted-down tests (rounds 9 and 11) vision returned ~4–4.5 s after the blackout began with the stick still held.
  Model: recovery ~4 s; a load applied while blacked out does not count. Why the first held load (4.5–7 s) delayed
  recovery in the lateral tests is not settled.
- **Carry-over is small:** the one clean repeat (`r10_rec_lat_60`, second load after vision returned) blacked out about
  as fast as a fresh exposure.
- **Forward (eyeballs-in) G counts.** The boosted corkscrews of round 9 greyed out at 1.7–2.2 s, during the boosted
  run-up from rest, when the G meter read **~19–21 G** forward; their 3.8–6.6 G figures are the later side G at the
  nose. In `r9_vis_bst_f100_up_r50` the screen only half-darkened (peak 0.57 at 3.6 s) and cleared by ~4.6 s with the
  inputs still held; speed held 513 m/s and boost kept running. So a **boosted launch from a standstill (≈21 G) greys
  you out in ~2 s**, and the grey clears once the acceleration drops near the nose. Forward tolerance is not mapped yet.
- A first model to fit: per-direction thresholds T (up ≈ 8–9 G, lateral ≈ 6 G, down ≈ 4.2 G), stress that builds at a
  rate rising with (G − T) and decays after the load stops, grey at one level, black at another, recovery ~4 s.

**Q2. Egg nose.** Settled: the limaçon holds at every heading measured (§3.2).

**Q3. In-game FOV.** Not measured yet. A round-12 test can time a star crossing the screen under constant yaw
(horizontal FOV ≈ 52.1 °/s × seconds). Keep the slider and the 90° default until then.

**Q4. Cockpit HUD screenshot.** Not available here either. The author needs to take one in the Gladius and add it
under `research/`. Until then `0.11` stays unverified.

**Q5. Lesson figures.** Now measured:
- **Escape corkscrew** (boosted, forward + up, roll ~120 °/s = 50 %, from a standstill): `r9_vis_bst_f100_up_r50`:
  the boosted run-up (~21 G) greys the screen from ~2.2 s (centre at most ~57 % dark at 3.6 s); it clears by ~4.6 s as
  the ship reaches the nose, then the corkscrew holds 513 m/s at ~5.9 G side load with no further grey. Show the
  launch grey-out, not a blackout. (A corkscrew started at the nose, not from rest, has not been measured.)
- **Corkscrew and still shoot back** (roll ~27 °/s): not measured at that roll rate. The nearest (60 °/s, round 8)
  data is too noisy; mark the figure "model".
- Miss distances from RESEARCH.md's duel model stay "model".

## 5. Corrections to earlier notes

- **`r4_boost_down`'s plateau (76 m/s) is invalid.** Round 4 still used the old policy that let go of the controls when
  the HUD went dark (red-out at 2.8 s). Its acceleration (6.8 G) stands. The boosted down radius is 394, measured by
  turning (pitch up 90° puts the velocity below the ship with no G load).
- **Round 8's G-LOC numbers are noisy** (camera presses leave the cockpit view up only part of the time). Use round 8
  for the camera-key verdicts only; use rounds 9 and 10 for onset times and the vision gradient.
- **Your §4 harness notes are out of date:** the camera cycles three views (cockpit, external A, external B); a black
  screen is not the end of a test (`gloc: hold` never lets go, `reverse` counter-strafes in five advanced tests); every
  run starts with a forward check and clears a latched throttle after each brake; `--resume` continues a session.
  The vJoy XML profile did not work; bindings are made by hand.
- **The wiki API** (`api.star-citizen.wiki`, game 4.10.1) matches our speeds, rates and the boost multipliers
  (forward 1.55, back 1.4, lateral 1.3, up 1.3, down 1.35). It is used only as a cross-check; no API value is imported
  (CLAUDE.md: no new third-party data).

## 6. View and lesson ideas the data now supports

- **Egg view:** the velocity dot inside the egg, the sideways-room ring at the current forward speed (±128 at 500,
  ±29 at 519), and a side-push arrow that shrinks to 3–6 G near the nose, so pilots see the room *and* how slowly they
  can use it.
- **Pilot view:** G-LOC vignette from the edges, fading to black (or red for down), timed from §4 Q1; HUD digits fade
  first.
- **Lessons:** "fastest flip = pure pitch with boost (2.2 s)", "turning while boosted costs speed (520 → 394 at 90°;
  in SCM it costs nothing)", "spacebrake above SCM doesn't help", "blackout drops your boost", "a boosted launch from a
  stop greys you out in ~2 s".
