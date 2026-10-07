# ADR-001: OGL for the 3D renderer

- **Status:** accepted (PLAN.md §3)
- **Date:** 2026-10-07

## Context
The egg and pilot views need WebGL: one revolved mesh, a sphere, lines, points, a dart glyph and a single dust shader. The 3D chunk has a 60 KB min+gz budget (PLAN.md §9), and the public UI must not force a framework on its host.

## Decision
Use [OGL](https://github.com/oframe/ogl) (Unlicense, public domain). It is about 29 KB min+gz for the whole library, less after tree-shaking, and is built for hand-written shaders. Keep it behind a small interface (`createEggScene`, `createPilotScene`) so the renderer can be swapped.

## Alternatives
- **three.js:** tree-shakes only to about 320 KB minified for simple scenes. Breaks the budget.
- **react-three-fiber:** adds React to every host.
- **Raw WebGL2:** smallest, but more code for little gain.

## Consequences
- OGL is the only allowed runtime dependency (PLAN.md §10). It is Unlicense, on the allow-list.
- We write our own shaders (dust, egg rim). Text and HUD are DOM/SVG overlays, not WebGL.
- Dependency is added to `packages/render` in P3, not before. The live alpha already vendors OGL 1.0.11 (`site/vendor/`, see `NOTICE.md`).
