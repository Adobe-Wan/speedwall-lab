# ADR-002: Standard Custom Element as the public UI

- **Status:** accepted (PLAN.md §2, §8)
- **Date:** 2026-10-07

## Context
The module should drop into a host such as spviewer. Its framework is unknown (no public repo found), and hosts may use React, Angular, Vue or plain HTML.

## Decision
Ship the UI as a standard Custom Element, `<speedwall-lab>`, with properties `profile`, `view` and `fov`, a `state` event, and CSS custom properties for theming (`--swl-accent`, `--swl-bg`, …). Physics and geometry live in `@speedwall-lab/core` (pure TypeScript, zero dependencies), so a host can also use the core alone. An iframe embed (`/embed`, with a `postMessage` API) covers hosts that want no coupling.

## Alternatives
- **React (or other framework) component:** forces that framework on every host.
- **iframe only:** loses theming and tight integration.

## Consequences
- No UI framework dependency in V1.
- State and rendering stay explicit: the element owns the `requestAnimationFrame` loop and a fixed-timestep accumulator.
- Shadow DOM styling is done through custom properties and `::part`.
- Package is a placeholder (`packages/element`) until P2.
