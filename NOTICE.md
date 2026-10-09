# Notices

## Third-party software
- **OGL** v1.0.11 (https://github.com/oframe/ogl), public domain (Unlicense). Vendored as `site/vendor/ogl.mjs`; see `site/vendor/OGL-LICENSE`.

- **Stay On Target** (https://github.com/Adobe-Wan/stay-on-target), MIT, Copyright (c) 2026 Stay On Target contributors. The controller matching and "move it to map it" capture in `site/js/controls.mjs` are adapted from it.

## Third-party data (not covered by this repository's licenses)
Two Gladius values (boosted back 5.9 G and down 6.6 G) were first taken from **SC Ships Performances Viewer (spviewer.eu) by Olakeen**, used with the author's permission. Round 4 (2026-10-08) replaced both with the author's own measurements (5.96 G and 6.8 G), so no spviewer value remains in `research/gladius-v1-fixture.json` or `site/`. `docs/RESEARCH.md` still quotes spviewer figures in its research notes; those may not be reused under MIT or CC BY.

## Cockpit HUD
`site/js/hud.mjs` is an original drawing. Its layout follows the in-game Advanced HUD (crosshair, throttle bar, AB bar, G meter); no game art, fonts or shapes are used.

## Ship model
The Gladius in the 3D view (`gladiusGeometry` in `site/index.html`) and the top-down outline in the slice views are original low-poly drawings (about 380 triangles), typed in by hand from the ship's 20 × 17 × 5.5 m size in the fixture and the proportions of a public fan data sheet of the ship. They are an approximation: nothing was extracted from the game, and no image or game model is included in this repository.

## Trademarks
Star Citizen®, Squadron 42®, Roberts Space Industries®, Cloud Imperium® and the Aegis Dynamics Gladius name are registered trademarks of Cloud Imperium Rights LLC. This is an unofficial fan project, not affiliated with the Cloud Imperium group of companies. No game assets (art, models, logos, fonts or HUD graphics) are used.
