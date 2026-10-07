# Speedwall Lab: notes for Claude Code

- **Build spec:** `PLAN.md`. Build phase by phase (P0 → P7) and stop for review after each. `docs/RESEARCH.md` is background; where they disagree, PLAN.md wins.
- **Source of truth for numbers:** `research/gladius-v1-fixture.json`. Never invent a stat; anything not in the fixture is out of scope or marked `assumed`.
- **The live alpha:** `site/index.html`, a single file deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.
  - Keep it working while the real app is built. Once P5 ships, replace it with the built app (same `site/` folder or the Vite `dist/`).
  - Its physics is a prototype port; `PLAN.md` §4 is the spec.
- **Rules:**
  - MIT code, CC BY data. No CIG assets.
  - No new third-party data. Spviewer values stay listed in `NOTICE.md` until replaced.
  - New runtime dependencies need an ADR and a license check.
  - Respect the performance budgets in PLAN.md §9.
- **Harness:** `tools/sc-flighttest` drives Star Citizen through vJoy. Use it only in Arena Commander, with the user present. Never in the PU or PvP.
