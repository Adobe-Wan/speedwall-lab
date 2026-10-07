# Speedwall Lab — Build Plan (v2, optimized)

> **Hand-off.** Put this file at the repo root, with `research/gladius-v1-fixture.json` and `docs/RESEARCH.md` beside it. Start Claude Code with:
> *"Read PLAN.md. Build phase P0 and stop for my review at the end of each phase."*
>
> This file is the **build spec**. `docs/RESEARCH.md` is the full research record (earlier plan, test rounds 1–3, duel and corkscrew analysis, fleet tables). Consult it, but build from this file. Where they disagree, this file wins.

---

## 1. What we're building

A small, fast, open-source web app, and an embeddable module, that shows a Star Citizen pilot **how their current speed limits the maneuvers available to them**. V1 covers one ship, the **Gladius**, with every number measured in-game.

**One state, three linked views:**

| View | Space | What it teaches |
|---|---|---|
| **Egg view** (3D) | Velocity space, ship frame, 1 unit = 1 m/s | The semi-transparent boost egg, the SCM sphere inside it, and your velocity point. The **sideways-room disc** shrinks as forward speed climbs: 394 m/s of room at rest, 128 at 500 forward, 29 at 519. |
| **Pilot view** (3D) | Physical space, camera at the ship | What you'd see in game: **space dust** streaming past, the **crosshair** (where the nose points) and the **TVI** (where you're actually going). It links the egg to the cockpit. |
| **Slice view** (2D) | Top-down slice of the egg | The same lesson with no WebGL. It's the default on small or low-power screens and the reduced-motion fallback. |

**Headline lesson:**
> *"Hold forward and you're pinned at the egg's narrow nose. The faster you go forward, the less sideways speed and dodge you have left."*

Every visual has a one-line plain-language caption. The tone is a coaching whiteboard: clean, bold and readable on a phone.

### Scope

| | V1 (this plan) | V1.1 | Later (see RESEARCH.md) |
|---|---|---|---|
| Ship | Gladius | Gladius | Fleet (61 ships), ship picker |
| Translation | fwd/back, lat, up/down, boost + tank | same | same |
| Rotation | none: attitude fixed, so dust and TVI agree | pitch/yaw/roll at measured rates; dust swirls; TVI anchoring gauge | corkscrew and duel labs |
| Views | Egg, Pilot, Slice | same | compare overlay, attacker's view |
| Input | keyboard, touch, gamepad, presets | same | HOTAS mapping wizard, record/replay |
| Mode | decoupled (validated) | same | coupled (unverified) |

---

## 2. Principles: efficient, licensable, contributable

1. **Framework-agnostic core.**
   - Physics and geometry are pure TypeScript with **zero runtime dependencies**.
   - The renderer is a thin layer.
   - The public UI is a **standard Custom Element** (`<speedwall-lab>`), so it drops into any host: spviewer's stack is unknown (no public repo found), and it works in React, Angular, Vue or plain HTML. No React or other framework is forced on a host.
2. **Small and fast by default.**
   - Static site, no backend.
   - 3D code is lazy-loaded.
   - Render on demand.
   - Hard budgets enforced in CI (§9).
3. **Clean provenance.**
   - Code is MIT. The Gladius data is the author's own measurements, under CC BY 4.0.
   - No CIG assets, and no third-party data that we lack the right to relicense (§10).
4. **Measured, fitted or predicted, always labelled.** Never invent a number.

---

## 3. Architecture

```
speedwall-lab/                      (pnpm workspaces, TypeScript strict, ESM only)
  packages/
    core/        @speedwall-lab/core    physics, egg geometry, readouts, profile schema   — 0 deps
    render/      @speedwall-lab/render  OGL scenes: egg, dust, glyph; HTML/SVG HUD overlay — deps: ogl
    element/     @speedwall-lab/element <speedwall-lab> custom element, input, layout       — deps: core, render
    data-gladius @speedwall-lab/data-gladius  Gladius FlightProfile + fixture (CC BY 4.0)
  apps/
    site/        standalone teaching site + /embed route (iframe target)
  research/      gladius-v1-fixture.json, test harness exports
  docs/          RESEARCH.md, EMBEDDING.md, DATA.md, ADRs
```

**Why OGL, not three.js or react-three-fiber.**
- [OGL](https://github.com/oframe/ogl) is public domain (Unlicense, OSI-approved), about **29 KB min+gz for the whole library** and less after tree-shaking. It's built for people who write their own shaders. Our scenes are simple: one revolved mesh, a sphere, lines, points, a dart glyph and one dust shader.
- three.js tree-shakes only to about 320 KB minified even for simple apps ([mattdesl/threejs-tree-shake](https://github.com/mattdesl/threejs-tree-shake)).
- react-three-fiber adds React to every host.
- Keep the renderer behind a small interface (`createEggScene`, `createPilotScene`), so switching to three.js later is contained. Record the decision as ADR-001.

**Text and HUD are DOM/SVG overlays, not WebGL text.** That covers labels, crosshair, TVI marker and readouts, positioned from projected coordinates. They stay crisp at any DPI, are accessible, are cheap, and need no font assets.

### Core API (pure, deterministic)

```ts
type Vec3 = [number, number, number];
interface Input { fwd: number; lat: number; up: number; boost: boolean;      // each axis -1..1
                  pitch?: number; yaw?: number; roll?: number }              // V1.1
interface State { vWorld: Vec3; xWorld: Vec3; q: Quat; tank: number; t: number }
step(s: State, u: Input, p: FlightProfile, dt: number): State                // fixed dt = 1/240 s
derive(s: State, u: Input, p: FlightProfile): Readouts
// Readouts: speed, vShip (fwd/lat/up), gNow, pinned, lateralRoom, settlePoint, settleSpeed,
//           tvi: { dirShip, offAngleDeg }, tank
```

- In V1, `q` is the identity, so the world frame equals the ship frame.
- A fixed-timestep accumulator runs inside `requestAnimationFrame`.
- Physics costs microseconds per frame, so no Web Worker is needed.

### Data contract: `FlightProfile` (versioned JSON schema, validated with Zod)
- Speed eggs:
  - SCM: sphere.
  - Boost: limaçon `r(θ) = A + C·cosθ`, with F, B and a soft-wall K.
- Per-axis G for SCM and boost.
- Rotation rates.
- Thrust rule (`"c2"`) plus the measured `fullStrafeForwardCurve`.
- Boosted-wall side-thrust constants.
- Tank drain and regen.
- Dimensions.
- **Per-field `provenance`:** `measured | fitted | gameFile | thirdParty` + source.

A host such as spviewer can map its own ship data into this schema. `docs/DATA.md` documents each field and its mapping.

---

## 4. Physics spec (V1: decoupled translation)

The full derivations and test evidence are in RESEARCH.md §0.4 and the round 1–3 sections.

1. **Requests.** `w_i = u_i · G_i(direction)`, using boost Gs while boost is held and the tank is above 0.
2. **Cap (C2, measured).** `|a| ≤ max_i|w_i| / max_i|u_i|`.
3. **Full-strafe forward clamp (measured, provisional).** When a strafe stick is at 0.95 or more and the strafe request is the biggest, use the forward G from `effectiveForwardG(u_fwd)`. That reproduces the measured 455 m/s plateau for 40–60% forward.
4. **Wall, in this order (measured):**
   1. Trim the outward request: to 0 at the SCM sphere, to `K·(r − |v|)` in boost, K ≈ 1.3 s⁻¹.
   2. Apply the cap.
   3. Cancel any remaining outward part with real thrust, limited per bank. In SCM this gives a 9.9 G dodge for ~1.3 s, then ~4.2 G while the retros bleed forward speed.
5. **Boosted-wall side thrust.** Fit one or two constants to the fixture's boost wall traces (strafe only ≈ 6–7.5 G; forward + strafe ≈ 3 G).
6. **Boost release or empty tank.** Decelerate to the SCM sphere, fitted to `boostRelease`.
7. **Position.** `x += v·dt`, used only by the pilot view's dust.

**Acceptance (CI):**
- Every fixture plateau within 1% (or ±3 m/s).
- Accel G within 5%.
- SCM wall traces within ±1 G per sample.
- Boost wall traces within ±1.5 G and ±10 m/s.
- Release within ±15 m/s.
- Lateral-room table exact.
- Determinism: the same input stream gives bit-identical replays.

---

## 5. Egg view (velocity space)

- **Camera.** Orbit camera, defaulting to a 3/4 view from behind and above; reset-view button. Nose = +X; 1 unit = 1 m/s.
- **Boost egg.**
  - A revolved limaçon mesh (64 × 32 segments) at ~15–20% opacity, with a fresnel rim so the silhouette reads.
  - Latitude rings every 100 m/s of forward speed.
  - HTML labels at the nose (520), sides (394) and tail (268).
  - Draw back faces first, then front faces; no sorting library needed.
- **SCM sphere** (225): faint, toggleable.
- **Ship glyph** at the origin: a dimensioned dart, 20 × 17 × 5.5 m. Readable size by default; a toggle shows true scale (1 m = 1 m/s).
- **Velocity point.** An arrow from the origin plus a 3 s trail. The point carries the **TVI symbol**, the same marker used in the pilot view, and glows when pinned.
- **Sideways-room disc (the key visual).** The egg's cross-section at your current forward speed, drawn as a ring through the velocity point, with its radius in m/s:

  | Forward m/s | 0 | 100 | 200 | 300 | 400 | 450 | 480 | 500 | 510 | 519 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Sideways room (boost) | 394 | 412 | 403 | 367 | 293 | 232 | 179 | 128 | 91 | 29 |

- **Thrust arrow.** When pinned, its outward part is grey and dashed ("dead thrust").
- **Settle ghost.** A dashed ray along the held-input thrust direction to the egg surface: "this input ends up here". It shows predicted speed and sideways speed (full forward + full strafe → 501 m/s, 261 sideways).

---

## 6. Pilot view: space dust and TVI

### 6.1 What they are, and why they belong together
- **Space dust** is a field of tiny particles fixed in the local reference frame. Your ship moves through it, so the particles stream past.
- **TVI (Total Velocity Indicator)** is the HUD marker for your actual direction of travel ([Star Citizen Wiki, Acronyms](https://starcitizen.tools/Acronyms)).
- Under pure translation, the dust radiates from a single point, the **focus of expansion**, and that point *is* the direction of travel. That's standard optic-flow geometry ([Matthis et al., PLOS Comp Bio 2022](https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1009575)). So in V1 the dust visibly streams out of the TVI.
- The same research shows that rotating the viewpoint moves the flow's centre away from the heading. In V1.1, pitching, yawing or rolling makes the dust swirl and its centre wanders, but the TVI stays true. Teaching line: ***"When you rotate, the dust lies. The TVI doesn't."***

### 6.2 Space dust: implementation (one draw call, nothing updated on the CPU per particle)
- **Setup.** N particle seeds, uniformly random in a cube of side `L`, generated once from a fixed seed.
  - N: 1,500 desktop, 600 mobile.
  - L: 400 m.
- **Wrapping.** Every frame, send **one uniform**, `uShipMod = xWorld mod L`. Compute it on the CPU in float64, so long flights never lose shader precision.
- **Vertex shader:**

  ```glsl
  // relative position of a world-fixed particle, wrapped into a box around the ship
  vec3 r = mod(aSeed - uShipMod + 0.5*uL, uL) - 0.5*uL;
  // streak: head = now; tail = where it appeared tau seconds ago (r + v*tau)
  vec3 p = r + aTail * uVel * uTau;          // aTail: 0 = head vertex, 1 = tail vertex
  float edge = 1.0 - smoothstep(0.38*uL, 0.5*uL, length(r));   // hide wrap pops
  vAlpha = edge * smoothstep(1.0, 6.0, length(r)) * uDustOpacity;
  gl_Position = uProj * uView * vec4(p, 1.0);
  ```

- **Rendering.**
  - Draw as `gl.LINES`, two vertices per particle. Upgrade to instanced quads only if 1 px lines look too thin on high-DPI screens.
  - Additive blending, no depth write.
  - Streak length is `|v|·τ`: τ = 1/30 s, clamped to 40 m. Below ~5 m/s, particles become soft dots.
- **Controls.** Dust on/off, density, and a "streak exposure" slider. The defaults aim for the in-game feel. Tune by eye against the author's footage. Keep the art original: never trace CIG's effect.
- **Scope note.** Dust is relative to the local frame (open space). Star Citizen's local physics grids, such as planets and moving zones, are out of scope.

### 6.3 TVI and crosshair (HUD overlay)
- **Crosshair** is fixed at the screen centre: the nose.
- **TVI position.** Transform `v̂` into camera space, `d = q_cam⁻¹ · v̂`. If `d` points forward (angle < 85°):
  - `x = (d.x / d.z) / tan(hFOV/2)`
  - `y = (d.y / d.z) / tan(vFOV/2)`
  - Then map to pixels.
- **Behind the camera** (e.g. reversing): pin an arrow to the screen edge pointing toward the TVI, and show an **anti-TVI** marker at `−v̂`. Star Citizen's own behavior here is unverified, so mark it as a design choice.
- **Low speed.** Fade the TVI out below 5 m/s, where the direction is undefined.
- **Symbol.** Use the generic aviation flight-path-marker (a circle with wing stubs), which is a public convention, not CIG's HUD art.
- **Readouts:**
  - the **TVI offset angle δ** (nose to velocity);
  - an optional **guide ring** at the trainer's offset (default 13°, adjustable);
  - in V1.1, the roll rate that would anchor the TVI at that offset (`ω = a_side / (v·sinδ)`; see RESEARCH.md "TVI-anchored corkscrew").
- **FOV matching.** An FOV control plus a "match my screen" helper. The player enters their in-game FOV, or matches a HUD element's on-screen distance. The author measured the AB readout at about 0.11 screen-widths from centre, roughly 12–17°. With that set, TVI offsets on our screen match the pilot's game screen. Whether the in-game FOV setting is horizontal or vertical is unverified, so the helper calibrates from a screenshot.
- **Link to the egg view.** The TVI angle equals the angle of the velocity point off the egg's +X axis. The same symbol appears in both views, and the settle ghost shows where the TVI will drift for the held input.

### 6.4 Camera options
- **Cockpit** (default): camera at the glyph's nose, looking forward.
- **Chase:** camera behind and above, with the glyph visible and a world-space velocity ray.
- Both use the same dust and HUD.

---

## 7. Layout, input and scenes

**Layout (mobile-first):**
- **Phone portrait:** view tabs (Slice · Egg · Pilot), readout strip, and a touch pad at the bottom (throttle slider, strafe pad, boost button).
- **Tablet:** two panes.
- **Desktop:** Egg | Pilot side by side, with the slice inset in the egg view.

**Input:**
- **Keyboard:**
  - W/S forward/back, A/D strafe, Space/Ctrl up/down, Shift boost;
  - 1–4 set forward to 25/50/75/100% while held;
  - P pause, `.` step, R reset to rest, N reset pinned at the nose.
- **Gamepad:** Gamepad API, analog, with invert toggles.
- **Touch** as above.
- **Presets** (scripted, then hand back control):
  - strafe from rest;
  - full forward then strafe;
  - forward + strafe from rest;
  - 25% / 50% forward + strafe;
  - release forward to make room.
- **Timescale:** 0.25×–1×.

**Four guided scenes** (30–60 s each, then "now try it"):
1. **This is your boost egg.** The sphere inside it, and the pilot view at rest.
2. **Strafe from rest.** 394 sideways; the disc is at its widest; the TVI swings 90° off the nose.
3. **Hold forward first.**
   - You pin at 520 and the disc shrinks to ~30.
   - Add strafe: you slide along the wall to 501, with 261 sideways. The TVI settles about 31° off the nose and the dust streams from it.
   - Measured: the sideways push is ~3 G with forward held, versus 6–7.5 G without.
4. **Let off forward to make room.**
   - The disc grows.
   - Measured: 40–60% forward + full strafe all settle at 455.
   - In SCM, forward + strafe at the wall fades to ~1 G in ~2.5 s.

**Accessibility:**
- Full keyboard operation.
- Colour-blind-safe palette, with no colour-only meaning.
- `prefers-reduced-motion`: Slice view by default, dust off.
- A text alternative for every view: a live region with speed, sideways room and TVI angle.

---

## 8. Embedding and the spviewer path

There's no public spviewer repository or license, and the framework is unknown. So we offer **three integration levels**, each independent of the host's stack:

| Level | How | Coupling |
|---|---|---|
| 1. **iframe** | `https://<site>/embed?ship=gladius&view=egg&theme=dark`, plus a `postMessage` API (`setProfile`, `setInput`, `state` events) | none |
| 2. **Custom element** | `<speedwall-lab ship="gladius" view="egg">` from npm or an ESM CDN. Properties: `profile` (FlightProfile object), `view`, `fov`. Events: `state`. Theming via CSS custom properties (`--swl-accent`, `--swl-bg`, …) | low |
| 3. **Core only** | `@speedwall-lab/core` (0 deps) for physics and geometry; the host draws its own visuals | lowest code, most host work |

**Before proposing a contribution, ask Olakeen:**
1. Which framework does spviewer use, and is its source licensed or private?
2. Would he prefer an iframe embed, an npm package, or core-only?
3. Is he OK with the module reading his ship data at runtime through the `FlightProfile` adapter, rather than us redistributing it?
4. Does he want the author's measured wall data credited in spviewer?
5. Styling and hosting expectations.

`docs/EMBEDDING.md` covers all three levels with copy-paste examples, and `docs/DATA.md` maps spviewer-style fields to `FlightProfile`.

---

## 9. Performance budgets (CI-enforced)

| Budget | Target | Enforced by |
|---|---|---|
| Initial JS (shell + core + Slice view) | ≤ 60 KB min+gz | `size-limit` |
| 3D chunk (render + OGL + shaders), lazy-loaded | ≤ 60 KB min+gz | `size-limit` |
| Total transfer, first visit, excluding fonts | ≤ 200 KB | Lighthouse CI |
| Fonts | system font stack; 0 bytes | review |
| Lighthouse mobile performance / accessibility | ≥ 95 / ≥ 95 | Lighthouse CI |
| Frame time, iPhone-12-class device | 60 fps (≤ 8 ms render) | manual check + Playwright trace |
| Draw calls per frame | ≤ 12 (egg ~6, pilot ~4) | dev overlay |
| Physics per frame | < 0.2 ms | Vitest bench |

**Techniques:**
- **Render on demand:** only while the sim runs or the camera moves.
- Pause when the tab is hidden or the view is off-screen (`IntersectionObserver`).
- Cap `devicePixelRatio` at 2 (1.5 on mobile).
- No shadows and no post-processing.
- Allocate buffers once; no per-frame allocations.
- One dust draw call.
- Lazy-load the 3D views only on first open.
- If WebGL2 is unavailable, fall back to the Slice view.

---

## 10. Licensing and compliance

| Item | License / rule |
|---|---|
| **Code** | **MIT**. Simplest for any host, including a closed-source spviewer. SPDX headers on every file ([REUSE](https://reuse.software) layout). |
| **Gladius data** (`data-gladius`, fixture) | **CC BY 4.0**, credited "Measured in-game by AdobeWan". |
| **Third-party data** | **None in the open repo.** The fixture still has two spviewer-sourced values (boosted back 5.9 G and down 6.6 G). Measure them with `sc-flighttest/tests_round4.yaml` and replace them before the repo goes public. The permission from Olakeen covers use in the app, not relicensing under CC BY. |
| **Dependencies** | Allow-list only: MIT, BSD-2/3, ISC, Apache-2.0, Unlicense, 0BSD, CC0. Checked in CI. Runtime deps: `ogl` (Unlicense) only. |
| **Contributions** | DCO sign-off (`Signed-off-by`) on every commit, so provenance stays clean for a later hand-off to spviewer. |
| **CIG** | No CIG art, models, fonts, logos or HUD graphics; dust and TVI visuals are original. Footer on every page: *"This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies."* plus the trademark line (RESEARCH.md "Fan-site notices"). No brand names in the domain, repo or package names. No ads, paywalls or tip links in this project. |
| **Credits** | Olakeen / spviewer.eu for the original directional-G work and permission. Author's in-game measurements for speed caps, walls and partial-input data. |

---

## 11. Phases (stop for review after each)

- **P0 — Repo and compliance.**
  - Monorepo scaffold, MIT LICENSE, data LICENSE (CC BY 4.0), REUSE/SPDX, CONTRIBUTING (DCO), NOTICE, CODE_OF_CONDUCT.
  - CI: typecheck, lint, test, `size-limit`, license allow-list, REUSE lint.
  - Import the fixture and validate it with Zod.
  - Write failing physics tests from the fixture.
  - ADR-001 (OGL) and ADR-002 (custom element).
  - **Exit:** CI green except physics tests.
- **P1 — Core physics** (§4).
  - **Exit:** all acceptance tests pass; fitted constants reported.
- **P2 — Slice view + readouts + keyboard/touch.**
  - The first shippable, no-WebGL experience.
  - Responsive at 375 / 768 / 1440 px.
- **P3 — Egg view** (§5): disc, settle ghost, labels, TVI symbol.
  - **Exit:** budgets met.
- **P4 — Pilot view** (§6): dust, crosshair, TVI, FOV helper, cockpit and chase cameras.
  - **Exit:** the dust focus of expansion is within 1° of the TVI in automated tests (pure translation); 60 fps on mobile.
- **P5 — Scenes, gamepad, presets, accessibility, release.**
  - Static site (Cloudflare Pages or GitHub Pages).
  - npm packages; `/embed` route; EMBEDDING.md and DATA.md.
- **P6 (V1.1) — Rotation.** Attitude quaternion with measured, linear stick-to-rate response:

  | | Pitch | Yaw | Roll |
  |---|---|---|---|
  | SCM | 68 °/s | 52 °/s | 200 °/s |
  | Boost | 81.6 °/s | 62.7 °/s | 240 °/s |

  Adds dust swirl, the TVI orbiting while rolling, and the TVI anchoring gauge.
- **P7 — spviewer hand-off kit.** Demo link, the three integration levels, the data adapter, and answers to §8's questions.

**Tests:**
- Vitest: physics against the fixture; property tests for the dust wrap (continuity, no precision loss after 10⁶ m) and for the TVI projection.
- Playwright: screenshots of key states at three widths, and a no-WebGL fallback test.
- Lighthouse CI.

---

## 12. Working agreements for Claude Code
- Build from this file. Stop after each phase and summarize what's verified vs assumed.
- Never invent a stat. Anything missing from the fixture is out of scope or marked `assumed`.
- Write physics tests before physics code. Keep the physics model swappable.
- No CIG assets. No third-party data in the repo. No new runtime dependencies without an ADR and a license check.
- Respect the budgets. A PR that breaks `size-limit` or Lighthouse CI doesn't merge.
