# Speedwall Lab

**See how your speed limits your maneuvers.** An interactive teaching tool for the Star Citizen flight model, starting with the Gladius. You see your velocity inside the ship's speed egg, the space dust streaming past, and the TVI, built from in-game measurements.

**▶ Try the alpha:** https://adobe-wan.github.io/speedwall-lab/
**💬 Send feedback:** [open an alpha feedback form](https://github.com/Adobe-Wan/speedwall-lab/issues/new?template=alpha-feedback.yml) (needs a free GitHub account)

> Unofficial fan project. Not affiliated with the Cloud Imperium group of companies.

## What's in the alpha (v0.3)
- **Egg view.** The 3D boost egg (520 at the nose, 394 at the sides, 268 at the tail) and the SCM sphere (225). The **ship rides on your velocity point**, with lines out to the wall showing how much sideways room is left. Camera views: 3/4, **Side** (the egg's true profile) and **Follow ship**. White dots are the settle speeds measured in game.
- **Pilot view.** Space dust fixed in space streams out of the **TVI**, next to the crosshair. Rolling swirls the dust; the TVI stays true.
- **Slice view.** A flat, top-down version of the egg. It's the main view on phones.
- **Controls.** Star Citizen default keys (W/S, A/D, Space, L Ctrl, Q/E roll, L Shift boost, X spacebrake), a throttle with a sticky zero, a strafe pad, roll buttons with an adjustable roll rate, and **Map controllers** for HOTAS, gamepads and pedals.
- **Maneuvers.** Five translation maneuvers and five **corkscrews** (roll + strafe at the nose), each with what to watch and the in-game result.

**Physics status.** Settled speeds match the author's in-game measurements within 0.5% (30 test points). Boosted-wall dodge strength and boost-release timing are approximate and still being fitted. Decoupled mode only; no rotation yet.

## Repository map
| Path | What |
|---|---|
| `site/` | The alpha, a single static page deployed to GitHub Pages. `site/vendor/ogl.mjs` is a 15 KB (gzipped) build of [OGL](https://github.com/oframe/ogl). |
| `PLAN.md` | Build spec for the full app (packages, physics, views, budgets, licensing, phases). |
| `docs/RESEARCH.md` | Research record: test rounds 1–3, wall behavior, corkscrews, duels, TVI. |
| `research/gladius-v1-fixture.json` | Measured Gladius data, the source of truth for physics tests. |
| `tools/sc-flighttest/` | The automated in-game test harness (vJoy + HUD OCR) used to measure everything. Arena Commander only. |
| `CLAUDE.md` | Working notes for Claude Code. |

## Licenses
- **Code:** MIT (`LICENSE`).
- **Measured data:** CC BY 4.0 (`LICENSE-DATA.md`), credit "AdobeWan". The exceptions are listed in `NOTICE.md`.
- **Third-party:** see `NOTICE.md`.

## Credits
- Directional-G research and permission: [SC Ships Performances Viewer](https://www.spviewer.eu/) by **Olakeen**.
- In-game measurements and design: AdobeWan.

*Star Citizen®, Squadron 42®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC. This project uses no game assets.*
