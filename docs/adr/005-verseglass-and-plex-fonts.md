# ADR-005: Verseglass design system and self-hosted IBM Plex fonts

- **Status:** accepted (the project owner, 2026-10-27)
- **Date:** 2026-10-27

## Context
The project owner's Verseglass design system (built in the JoyViz Upgrade project for the Joystick Overlay Inputs editor, with Speedwall Lab named as its next adopter) sets the look for the alpha: navy ground, frosted glass only where something shows through, flat ink inside panels, one accent, an amber focus ring, a 4 px grid and two faces: IBM Plex Sans for UI and IBM Plex Mono for data.

PLAN.md §9 used to set the font budget to "system font stack; 0 bytes", and the page's Content-Security-Policy (`default-src 'none'`) blocked every font. Plex is not installed on most players' PCs, so the system stack would show Segoe UI instead. The project owner asked for the fonts the design system needs to be sourced and shipped.

## Decision
- Ship IBM Plex Sans 400/500/600 and IBM Plex Mono 400/500 as unmodified latin `woff2` subsets from Fontsource 5.1.1, in `site/assets/fonts/` (about 89 KB together). No remote font host: the CSP gains `font-src 'self'` only.
- `@font-face` uses `font-display: swap`; the stacks fall back to Segoe UI / Cascadia Mono, then `system-ui` / `ui-monospace`, as the design system specifies.
- The Verseglass tokens (`--vg-*`) sit at the top of the page's stylesheet with the six accent tokens re-pointed to the Speedwall Lab teal (#7CD9C8), as the design system's Adopting page sets out. The old short names (`--fg`, `--line`, `--glass`…) are aliases onto them. The diagram colours (amber boost, blue SCM, mint TVI) stay as they are and are used only for the views, their legend and the Boost control.
- The fonts are font files, not npm runtime dependencies. They are licensed under the SIL Open Font License 1.1, which allows bundling and redistribution with software; the licence text ships beside them (`site/assets/fonts/OFL.txt`, `LICENSES/OFL-1.1.txt`) and `REUSE.toml` and `NOTICE.md` list them.

## Consequences
- PLAN.md §9's font row now reads ≤ 92 KB of self-hosted Plex. The "total transfer excluding fonts" budget is unchanged.
- Cyrillic, Greek and Vietnamese glyphs fall back to the system face; add those subsets only if the page is translated.
- A token change starts in the design system and is copied here, so the two never drift.
