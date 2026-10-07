# Contributing to Speedwall Lab

Thanks for helping. This is a small, MIT-licensed teaching tool for the Star Citizen flight model. Read `PLAN.md` (the build spec) and `CLAUDE.md` first.

## Ground rules
- **Never invent a number.** Physics values come from `research/gladius-v1-fixture.json`. Anything not in the fixture is out of scope or labelled `assumed`.
- **No CIG assets** (art, models, fonts, logos, HUD graphics) and **no third-party data** we cannot relicense. Spviewer-sourced values are listed in `NOTICE.md` until replaced.
- **New runtime dependencies need an ADR (`docs/adr/`) and a license check.** Allowed licenses: MIT, BSD-2/3-Clause, ISC, Apache-2.0, Unlicense, 0BSD, CC0-1.0. CI enforces this.
- **Respect the performance budgets** in `PLAN.md` §9. A change that breaks `size-limit` or Lighthouse CI does not merge.
- **Write physics tests before physics code.**

## Setup
```sh
corepack enable          # or install pnpm 10
pnpm install
pnpm check                  # typecheck, lint, unit tests, license check
pnpm test:physics        # physics acceptance tests (fail until phase P1 lands)
pnpm size                # build and check size-limit budgets
reuse lint               # pip install reuse
```

## Licensing and headers
- Code: MIT. Data: CC BY 4.0. Layout follows [REUSE](https://reuse.software).
- Every new source file starts with:
  ```ts
  // SPDX-FileCopyrightText: <year> <your name>
  // SPDX-License-Identifier: MIT
  ```
- Files that cannot carry a header (JSON, lockfiles, prose) are covered by `REUSE.toml`. Add new ones there.

## Developer Certificate of Origin (DCO)
Every commit must be signed off, certifying the [DCO 1.1](https://developercertificate.org/): you wrote the change or have the right to submit it under the project's license.

```sh
git commit -s -m "core: add lateral-room readout"
```

This appends `Signed-off-by: Your Name <you@example.com>`. CI fails a pull request with an unsigned commit. To fix one: `git commit --amend -s --no-edit` (last commit) or `git rebase --signoff main` (a branch).

## Pull requests
- Keep them small and phase-scoped. Say what is verified and what is assumed.
- Do not add ads, paywalls or donation links. Fan-site rules forbid them.
- Be kind: see `CODE_OF_CONDUCT.md`.
