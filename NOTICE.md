# Notices

## Third-party software
- **OGL** v1.0.11 (https://github.com/oframe/ogl), public domain (Unlicense). Vendored as `site/vendor/ogl.mjs`; see `site/vendor/OGL-LICENSE`.

- **Stay On Target** (https://github.com/Adobe-Wan/stay-on-target), MIT, Copyright (c) 2026 Stay On Target contributors. The controller matching and "move it to map it" capture in `site/js/controls.mjs` are adapted from it.

## Third-party data (not covered by this repository's licenses)
Two Gladius values come from **SC Ships Performances Viewer (spviewer.eu) by Olakeen** and are used with the author's permission:
- boosted reverse acceleration 5.9 G;
- boosted down acceleration 6.6 G.

They appear in `research/gladius-v1-fixture.json` (marked `spviewer`), in `site/index.html`, and in `docs/RESEARCH.md`. `docs/RESEARCH.md` also quotes other spviewer figures in its research notes. These values may not be reused under MIT or CC BY. They'll be replaced by the author's own measurements (`tools/sc-flighttest/tests_round4.yaml`).

## Cockpit HUD
`site/js/hud.mjs` is an original drawing. Its layout follows the in-game Advanced HUD (crosshair, throttle bar, AB bar, G meter); no game art, fonts or shapes are used.

## Ship model
The Gladius in the 3D view (`gladiusGeometry` in `site/index.html`) and the top-down outline in the slice views are original low-poly drawings (about 380 triangles), typed in by hand from the ship's 20 × 17 × 5.5 m size in the fixture and the proportions of a public fan data sheet of the ship. They are an approximation: nothing was extracted from the game, and no image or game model is included in this repository.

## Trademarks
Star Citizen®, Squadron 42®, Roberts Space Industries®, Cloud Imperium® and the Aegis Dynamics Gladius name are registered trademarks of Cloud Imperium Rights LLC. This is an unofficial fan project, not affiliated with the Cloud Imperium group of companies. No game assets (art, models, logos, fonts or HUD graphics) are used.
