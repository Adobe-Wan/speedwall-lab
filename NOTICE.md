# Notices

## Third-party software
- **OGL** v1.0.11 (https://github.com/oframe/ogl), public domain (Unlicense). Vendored as `site/vendor/ogl.mjs`; see `site/vendor/OGL-LICENSE`.

- **Stay On Target** (https://github.com/Adobe-Wan/stay-on-target), MIT, Copyright (c) 2026 Stay On Target contributors. The controller matching and "move it to map it" capture in `site/js/controls.mjs` are adapted from it.

- **IBM Plex Sans** and **IBM Plex Mono** (https://github.com/IBM/plex), Copyright 2017-2018 IBM Corp., SIL Open Font License 1.1. Unmodified latin woff2 subsets from Fontsource (`@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.1.1) in `site/assets/fonts/`; licence text in `site/assets/fonts/OFL.txt`. They are the UI and data faces of the Verseglass design system (ADR-005).

## Third-party data (not covered by this repository's licenses)
Two Gladius values (boosted back 5.9 G and down 6.6 G) were first taken from **SC Ships Performances Viewer (spviewer.eu) by Olakeen**, used with the author's permission. Round 4 (2026-10-08) replaced both with the author's own measurements (5.96 G and 6.8 G), so no spviewer value remains in `research/gladius-v1-fixture.json` or `site/`. `docs/RESEARCH.md` still quotes spviewer figures in its research notes; those may not be reused under MIT or CC BY.

Bullet flight times (`WEAPON.projectileSpeed_mps` in `packages/core/src/engage.ts`, used by `site/index.html` and `docs/engagement-math.md`) use a projectile speed of **1480 m/s** for the CF-337 Panther Repeater (`KLWE_LaserRepeater_S3`), taken from the **Star Citizen Wiki API** (api.star-citizen.wiki, item `cf-337-panther-repeater`, game build 4.10.2-LIVE.12881860, fetched 2026-10-17). Star Citizen Wiki content is **CC BY-SA 4.0**; this one value is reproduced with that attribution and is not covered by this repository's MIT or CC BY licences. It is not an in-game measurement (`proj_speed`, `docs/ingame-test-scenarios.md`). The chaser readout no longer models projectile speed, so its earlier round 1500 m/s figure is gone.

## Cockpit HUD
`site/js/hud.mjs` is an original drawing. Its layout follows the in-game Advanced HUD (crosshair, throttle bar, AB bar, G meter); no game art, fonts or shapes are used.

## Ship model (not covered by this repository's licenses)
The Gladius hull in the 3D view, `site/assets/ships/gladius.glb`, is derived from the Sketchfab model by lechatfantome (labelled CC BY 4.0; likely a game extraction, provenance unverified), decimated and modified: landing gear, cockpit interior, decals and hidden geometry removed, engine glow added, no textures. It is shown in a plain light grey with no livery. It is used for this non-profit educational fan project only, is excluded from the MIT and CC BY grants, and is removed on request. The raw source mesh is not in this repository. See `docs/adr/004-ship-models.md`.

The hand-typed glyph (`gladiusGeometry` in `site/index.html`, about 380 triangles) and the top-down outline in the slice views are original low-poly drawings from the ship's 20 × 17 × 5.5 m size in the fixture and the proportions of a public fan data sheet; the page falls back to the glyph when the model has not loaded.

## Trademarks
Star Citizen®, Squadron 42®, Roberts Space Industries®, Cloud Imperium® and the Aegis Dynamics Gladius name are registered trademarks of Cloud Imperium Rights LLC. This is an unofficial fan project, not affiliated with the Cloud Imperium group of companies. No game art, logos, fonts or HUD graphics are used; the one derived ship model is listed above.
