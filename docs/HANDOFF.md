# Hand-off: what the build session changed, and where it departs from PLAN.md

Written 2026-10-08 by the Claude Code session that built P0, P1 and the live alpha. It is for the chat that ran the in-game tests and wrote `PLAN.md`, so that the two stay consistent. **`PLAN.md` has not been edited.** Everything below that contradicts it is listed in §3 for you to accept or reject. Nothing here changes a measured number.

## 1. Where things stand
- **Live:** https://adobe-wan.github.io/speedwall-lab/ (alpha v0.7). It is one static page, `site/index.html`, deployed from `main` by `.github/workflows/pages.yml`. Its physics is the real core (`packages/core`, `packages/data-gladius`) bundled into `site/vendor/speedwall-core.mjs`; CI checks the bundle is current.
- **PLAN.md phases:** P0 (repo, compliance) and P1 (core physics) were built and reviewed as phases. The alpha page was built **outside the phase order** at the author's request, so P2 to P6 exist only as that prototype, not as the planned packages (`render`, `element`). The prototype already contains pieces of P2, P3, P4, P5 and P6 (see §3).
- **Physics acceptance:** 189 of 222 checks pass (`pnpm test:physics`; the 33 misses are listed in `docs/physics-fit.md`). All 30 plateaus, 26 accelerations, the 20-row lateral-room table and the 12 release samples pass. (An earlier note said 197 of 230; the runner has reported 222 checks and 33 misses since before the release change, so that older figure looks like a miscount rather than a regression.)
- **Name:** stays "Speedwall Lab" (a rename to a name containing a game trademark was declined).

## 2. Numbers: measured, fitted, assumed
| Item | Value | Status |
|---|---|---|
| Plateaus, accelerations, lateral room, release samples | fixture | measured |
| `slewGps` 46.2, `boostSide` 0.469 above 354 m/s forward, `letOffBleed` (5.15 G, side x0.625, ramp 0-520), `retroEaseK` 1.023, `releaseK` 0.002275 | `packages/data-gladius/src/fitted.ts` | fitted to the fixture |
| **Boost-release floor, 4.24 G** (the SCM retro rating) | `releaseFloorG` | **assumed.** The fixture's `boostRelease` trace stops at 393 m/s, 1.4 s after release. The fitted quadratic alone left the ship at 246 m/s 20 s later (a pilot noticed speed staying above SCM); with the floor it reaches 225 m/s about 5 s after release from the nose. Round 6 measures the real tail. |
| **Boost red zone, 25 %** | `redZonePct` | **assumed** (the author's description of the AB meter) |
| Tank drain 4.8 %/s, regen 4 %/s | fixture | no stated source; round 7 E measures them |
| Rotation rates (SCM 68/52.1/199.9, boost 81.6/62.7/240 deg/s) | fixture | measured; same as PLAN section 11, P6 |
| G-LOC | not modelled | the rule is unknown (see section 5) |

## 3. Departures from PLAN.md (each one was a request from the author)
| PLAN.md says | The build now | Suggested PLAN.md edit |
|---|---|---|
| Section 1 scope: V1 has **no rotation**; HOTAS wizard and boost tank are later | Rotation (P6) is in the alpha. A controls wizard (keyboard, mouse, stick, pedals, pad), Star Citizen `actionmaps.xml` import, the boost tank with a 25 % lockout, and an Unlimited boost toggle are in | Move these from "later" to V1/V1.1; mark the red zone assumed |
| Section 4.6: release decelerates to the SCM sphere, fitted to `boostRelease` | Fitted quadratic **plus an assumed floor** (above) | Note the floor and its replacement by round 6 |
| Section 5: **egg view in the ship frame**; ship glyph "at the origin", a dimensioned dart, readable size with a true-scale toggle; SCM sphere toggleable | The egg and ship **turn with the ship's attitude** and the velocity stays put in space (button "Egg turns with ship" returns to the ship frame). The ship is a **low-poly Gladius at true size, on the velocity point** (hand-drawn, about 380 triangles). **No** ship-size toggle; the SCM sphere is always shown | Replace the glyph and toggle text; add the frame option |
| Section 6.4: Chase is a **pilot-view** camera | The **egg view** has a Chase camera (start of every lesson): it follows the ring centre and zooms to keep the dodge room and the wall in frame; world-fixed orientation so pitch and roll show | Add to section 5 |
| Section 6.3: crosshair at centre; FOV match from the AB readout at about 0.11 screen-widths | Consistent. The advanced HUD is now a **fixed layout**: throttle bar and AB bar equidistant from the crosshair at 0.11 of the view width, both centred on its row, G readout beside the AB bar, TVI drawn on top. (A keep-out band that slid the bars around was removed.) | none; mention the HUD layout |
| Section 7: **mobile-first** (phone touch pad, three-pane layout) | **Desktop-first.** On a touch phone the app only plays the lessons (no controls, no view buttons, explanation under the view). A narrow desktop window keeps the controls | Rewrite the layout paragraph |
| Section 7 presets: six scripted presets | Seven **lessons, each starting from a standstill** (speed builds, then the maneuver): strafe from a stop, dodge at top speed, dodge from mid-egg, ease off to make room, escape corkscrew (boosted, forward + up, roll about 120 deg/s), corkscrew and still shoot back (roll about 27 deg/s), over-spinning. The "jink" lesson was removed | Replace the preset list |
| Section 7 accessibility: live region, keyboard | Keyboard and live region done. **Screen-reader work (item 7 of docs/qa-2026-10-07.md) was skipped on purpose** | Mark as deferred |
| Section 11: P2-P5 as separate packages | Not built as packages; the prototype page stands in | Re-plan P2-P5 around porting the prototype |

## 4. In-game test harness (`tools/sc-flighttest`)
- Rounds 4 to 8 are written but **not yet flown**. `docs/flight-model-tests.md` lists what each settles; run order 6, 7, 8, 5, 4 with `run_campaign.bat`.
- **Round 6** = boost release from the nose and from about 450/350/280 m/s (25 s windows); `analyze` reports `rel_t_to_226`, `rel_decel_G_300_to_235`, `rel_end_above_scm_mps`.
- **Rounds 7 and 8** = G-LOC. A held strafe cannot test it (it pulls G only until the wall, about 2.3 s in SCM), so every test is a corkscrew. Round 8 is a 30-test map (forward fraction picks the point on the egg, roll 25/50/100 %, up vs sideways, SCM and boosted).
- **Harness changes:** a pitch flip between tests (2.8 s at 68 deg/s) with every second lateral test mirrored so sideways drift cancels; per-test `gloc: ease` (cut strafe or roll 15 % on a grey-out and keep flying) instead of letting go; every test records `grey_at` (HUD 80 %) and `gloc_at` (50 %); and a **camera-key probe** (vJoy button 3 bound to the camera cycle): the last press that visibly switches the camera marks control lost, and a press in the dark is judged afterwards from the camera state. The probe assumes a two-view toggle and that the middle of the screen differs between views; `python run.py camcheck` verifies both.
- `star-citizen/speedwall-vjoy-js4.xml` binds vJoy (joystick 4) to the test actions. Written from community knowledge of the format and **untested in the game**.

## 5. Open questions for the original chat
1. **G-LOC rule.** Unknown and not assumed. Round 3 shows lateral + roll greys out faster (2-3 s) than up + roll (4-7 s) at similar G, so it is not a simple G limit. Round 8 and the probe are meant to map it.
2. **Egg nose.** The model keeps the limacon r = 394 + 126 cos(theta) (validated within 1 % from rest). The fitted effect of a "narrow nose" is the weak boosted side push (factor 0.469), not a narrower egg. Round 5 tests this directly; if it disagrees, the egg shape changes.
3. **In-game FOV** (horizontal or vertical) is still unverified; the alpha uses a 90 deg horizontal default with an FOV slider.
4. **The cockpit HUD screenshot** the author referred to was not available to the build session; the HUD spacing uses the recorded screen fractions in `tools/sc-flighttest/config.yaml` plus the 0.11 note in PLAN section 6.3. If the screenshot shows different spacing, the one constant to change is `0.11` in `layout()` of `site/js/hud.mjs`.
5. **Lessons' "in game" figures** come from the fixture; the corkscrew miss distances come from RESEARCH.md's duel model, not from a measurement.

## 6. Rules that still hold (CLAUDE.md)
Never invent a stat (anything not in the fixture is out of scope or marked assumed). MIT code, CC BY data, no CIG assets (the Gladius mesh is hand-typed from the fixture's size and a public fan data sheet; nothing extracted). No new runtime dependency without an ADR. Respect the PLAN section 9 budgets (draw calls are 12 a frame with both 3D views flying). `sc-flighttest` only in Arena Commander with the author present, never in the PU or PvP.

## 7. Where to look
`docs/qa-2026-10-07.md` (QA findings and the UI proposals), `docs/physics-fit.md` (constants and misses), `docs/flight-model-tests.md` (tests still needed), `NOTICE.md` (provenance), `README.md` (what the alpha does). Commits since the v0.5.1 alpha: `git log 7ec45b0..main`.
