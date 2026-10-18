# ADR-004: Ship models derived from third-party meshes

- **Status:** proposed, for review
- **Date:** 2026-10-18

## Context
The 3D views draw the Gladius at true size (20 m) so a pilot can read its attitude against the egg. The hand-typed glyph (`gladiusGeometry`, about 380 triangles) was built from the fixture's dimensions and a fan data sheet; four hand-modelling passes in Blender (up to about 5k triangles) still read as the wrong ship. The project is non-profit and educational, and its users already run a PC that runs Star Citizen, so shape accuracy matters more than a tiny triangle budget. The source meshes we can reach are third-party extractions of the game's models, which the "no CIG assets" rule previously forbade outright.

## Decision
- **Option 1:** derive each ship's hull from a third-party reference mesh instead of modelling it by hand. For the Gladius the reference is the Sketchfab model by lechatfantome (labelled CC BY 4.0; likely a game extraction, so its provenance is unverified). The hull keeps the reference's outer surface and drops everything else: landing gear and gear bays, cockpit interior, decals and text, internal and hidden islands. The engine nozzles get a filled glow cap. No texture: the ship is plain white vertex colour (0.92), the canopy dark, the glow emissive, and the lighting carries the detail.
- **Budget:** 200k triangles per ship, lazy-loaded after the first paint, never on the first-visit transfer. The Gladius is 173,785 triangles, 150,069 vertices, 3 primitives (3 draw calls), 3.15 MB raw / 1.61 MB gzipped.
- **Licence:** the models under `site/assets/ships/` are excluded from the MIT and CC BY grants, carry their provenance in `NOTICE.md`, `REUSE.toml` and this ADR, and are removed on request. The raw reference meshes are never committed. This is the one exception to "no CIG assets" (CLAUDE.md, PLAN.md §10).
- **Format:** glTF 2.0 binary with `KHR_mesh_quantization`: int16 positions (the node's translation and scale undo the quantisation), int8 normals, uint8 RGBA colours (alpha 0 marks emissive faces), uint16 indices. No material, texture, skin or animation. Frame: +Y up, x nose, z starboard, metres, which is the page's render frame.
- **Loader:** `site/js/glb.mjs` (MIT), about 2 KB gzipped: parses the two GLB chunks and hands each primitive to OGL as a `Geometry` of typed-array views on the downloaded buffer, so nothing is copied before the upload. No new runtime dependency.
- **Fallback:** the page keeps the hand-typed glyph. The model loads from `requestIdleCallback` after the first paint; on any failure (offline, old browser, bad file) the glyph stays and a warning goes to the console.

## Export
From the author's Blender scene (`gladius_v3.blend`, Blender 5.2 LTS; the scene and the build scripts live outside this repository):
1. Blender glTF export of the derived `GLADIUS_v3` object only: GLB, `use_selection`, `use_active_scene`, `export_apply`, `export_yup`, `export_normals`, colours on, no materials, no texcoords, tangents, animation or skins.
2. Quantise: `python3 -I glb_quantize.py gladius_v3.glb site/assets/ships/gladius.glb` (the script is in the project's model workspace, not in this repository). Expected: 3 primitives, `extensionsRequired: ["KHR_mesh_quantization"]`, bbox x ±10.0 m.

## Alternatives
- Keep hand-modelling: four passes showed the author cannot get the shape right at a cost that fits the project.
- Draco or meshopt compression: halves the download but adds a runtime decoder (a new dependency and ADR) and decode time on the main thread. Revisit if the per-visit download becomes a complaint.
- Decimate below 200k: not needed for the Gladius; the full reference surface already fits the budget.

## Consequences
- The egg view goes from 9 to 11 draw calls (glyph 1 → hull 3), inside the 12 budget of PLAN.md §9.
- Each first visit downloads the model once it is idle: 1.61 MB if the host gzips `model/gltf-binary`, 3.15 MB if not. GitHub Pages caching limits the repeat cost.
- A takedown request removes the file and the page falls back to the glyph with no other change.
- The F7A Mk II Hornet follows the same recipe when it is built.
