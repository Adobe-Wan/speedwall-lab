# Raw flight-test data, 2026-10-08 (Gladius, decoupled, Arena Commander)

Recorded by AdobeWan with `tools/sc-flighttest` (vJoy + HUD OCR). Licence: CC BY 4.0 (see LICENSE-DATA.md).

- `20261008-133222/`: rounds 6 and 7 (complete) and two round-8 tests.
- `20261008-150350/`: rounds 8, 9, 5 and 4 (73 tests, resumed three times; see `run.log`).
  Tests skipped in `run.log` were re-flown later in the same folder after the throttle fix.
- `throttlecheck.log`: the forward axis is the game's throttle and keeps its setting at centre.

Per test: `meta.json` (inputs, settings, camera-key probe log), `series.csv` (per-frame HUD readings and inputs),
`vision.csv` (screen darkness and red share, centre/middle/edge), `probe.json`, `commands.csv`. Frames are not included.
Findings: `docs/flight-model-findings.md`.
