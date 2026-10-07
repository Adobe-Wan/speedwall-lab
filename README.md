# Speedwall Lab

**See how your speed limits your maneuvers.** An interactive teaching tool for the Star Citizen flight model, starting with the Gladius. You see your velocity inside the ship's speed egg, the space dust streaming past, and the TVI, built from in-game measurements.

**▶ Try the alpha:** https://adobe-wan.github.io/speedwall-lab/
**💬 Send feedback:** [open an alpha feedback form](https://github.com/Adobe-Wan/speedwall-lab/issues/new?template=alpha-feedback.yml) (needs a free GitHub account)

> Unofficial fan project. Not affiliated with the Cloud Imperium group of companies.

## What's in the alpha (v0.5)
- **Controls setup on first visit**, like Stay On Target: pick keyboard, mouse, joystick/HOTAS, pedals or gamepad, then press each control once (strafe up/down/left/right, throttle forward/back, pitch, yaw, boost, roll left/right, spacebrake). Or use the Star Citizen keyboard defaults, or **import your Star Citizen bindings file** (`actionmaps.xml`). The mouse can fly the nose.
- **Fly full screen.** The simulator takes over the keyboard (Chrome/Edge), so Left Ctrl + W or Q strafes and rolls instead of closing the tab. Hold Esc to leave.
- **Speed egg (3D).** The boost egg (520 forward, 394 sideways, 268 back) and the no-boost ball (225). Your ship rides on your velocity, with lines out to the edge showing your dodge room. Views: Overview, Side, Close-up. Dots are speeds measured in game.
- **Cockpit.** Space dust, the TVI, and an original HUD laid out like the game's: crosshair, throttle/speed bar, AB (boost) bar with its red zone, G meter, rotation rates. Pitch, yaw and roll at the measured rates.
- **Boost tank** drains 4.8 %/s and refills 4 %/s. Run it empty and boost stays off until it refills past the 25 % red zone. An **Unlimited boost** toggle is there for practice.
- **Maneuvers**, condensed to what each one teaches: dodging at top speed vs mid-egg (about twice the distance in 2 s), easing off to make room, jinks, and three corkscrews (best escape, still shooting back, over-spinning).

**Physics status.** The tested core model (`packages/core`): all 30 measured settle speeds within 1 %; wall traces mostly match (see `docs/physics-fit.md`). Decoupled mode only. Rotation and the 25 % boost red zone are previews (rates measured; red-zone lockout as described by the author, not yet measured).

## Repository map
| Path | What |
|---|---|
| `site/` | The alpha, a single static page deployed to GitHub Pages. `site/vendor/ogl.mjs` is a 15 KB (gzipped) build of [OGL](https://github.com/oframe/ogl). |
| `PLAN.md` | Build spec for the full app (packages, physics, views, budgets, licensing, phases). |
| `docs/RESEARCH.md` | Research record: test rounds 1–3, wall behavior, corkscrews, duels, TVI. |
| `research/gladius-v1-fixture.json` | Measured Gladius data, the source of truth for physics tests. |
| `tools/sc-flighttest/` | The automated in-game test harness (vJoy + HUD OCR) used to measure everything. Arena Commander only. |
| `packages/` | The real app, built phase by phase (P1 core physics done; the alpha page uses it): `core` (physics, 0 deps), `data-gladius` (profile + fixture adapter), `render` and `element` (placeholders until P3/P2). |
| `docs/adr/` | Architecture decision records (OGL, custom element, Zod). |
| `CLAUDE.md` | Working notes for Claude Code. |

## Development
`pnpm install`, then `pnpm check` (typecheck, lint, unit tests, license check). `pnpm test:physics` runs the physics acceptance tests (197 of 230 pass; see `docs/physics-fit.md`). `pnpm fit` refits the wall constants, and `pnpm build:alpha` rebuilds the alpha page's physics bundle from `packages/core`. See `CONTRIBUTING.md` (DCO sign-off required).

## Licenses
- **Code:** MIT (`LICENSE`).
- **Measured data:** CC BY 4.0 (`LICENSE-DATA.md`), credit "AdobeWan". The exceptions are listed in `NOTICE.md`.
- **Third-party:** see `NOTICE.md`.

## Credits
- Directional-G research and permission: [SC Ships Performances Viewer](https://www.spviewer.eu/) by **Olakeen**.
- In-game measurements and design: AdobeWan.

*Star Citizen®, Squadron 42®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC. This project uses no game assets.*
