# Notices

## Third-party software
- **OGL** v1.0.11 (https://github.com/oframe/ogl), public domain (Unlicense). Vendored as `site/vendor/ogl.mjs`; see `site/vendor/OGL-LICENSE`.

- **Stay On Target** (https://github.com/Adobe-Wan/stay-on-target), MIT, Copyright (c) 2026 Stay On Target contributors. The controller matching and "move it to map it" capture in `site/js/controls.mjs` are adapted from it.

## Third-party data (not covered by this repository's licenses)
Two Gladius values (boosted back 5.9 G and down 6.6 G) were first taken from **SC Ships Performances Viewer (spviewer.eu) by Olakeen**, used with the author's permission. Round 4 (2026-10-08) replaced both with the author's own measurements (5.96 G and 6.8 G), so no spviewer value remains in `research/gladius-v1-fixture.json` or `site/`. `docs/RESEARCH.md` still quotes spviewer figures in its research notes; those may not be reused under MIT or CC BY.

The chaser readout in `site/index.html` assumes a projectile speed of **1500 m/s**, a round figure chosen because the **Star Citizen Wiki** (starcitizen.tools, CC BY-SA) lists 1480 m/s for the CF-337 Panther in 4.10.1. The wiki value itself is not copied into the fixture or the app; the 1500 is an `assumed` input until it is measured in game (`proj_speed`, `docs/ingame-test-scenarios.md`).

## Cockpit HUD
`site/js/hud.mjs` is an original drawing. Its layout follows the in-game Advanced HUD (crosshair, throttle bar, AB bar, G meter); no game art, fonts or shapes are used.

## Ship model (not covered by this repository's licenses)
The Gladius hull in the 3D view, `site/assets/ships/gladius.glb`, is derived from the Sketchfab model by lechatfantome (labelled CC BY 4.0; likely a game extraction, provenance unverified), decimated and modified: landing gear, cockpit interior, decals and hidden geometry removed, engine glow added, no textures. It is shown in a plain light grey with no livery. It is used for this non-profit educational fan project only, is excluded from the MIT and CC BY grants, and is removed on request. The raw source mesh is not in this repository. See `docs/adr/004-ship-models.md`.

The hand-typed glyph (`gladiusGeometry` in `site/index.html`, about 380 triangles) and the top-down outline in the slice views are original low-poly drawings from the ship's 20 × 17 × 5.5 m size in the fixture and the proportions of a public fan data sheet; the page falls back to the glyph when the model has not loaded.

## Trademarks
Star Citizen®, Squadron 42®, Roberts Space Industries®, Cloud Imperium® and the Aegis Dynamics Gladius name are registered trademarks of Cloud Imperium Rights LLC. This is an unofficial fan project, not affiliated with the Cloud Imperium group of companies. No game art, logos, fonts or HUD graphics are used; the one derived ship model is listed above.
