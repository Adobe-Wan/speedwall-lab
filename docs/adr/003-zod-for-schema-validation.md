# ADR-003: Zod for FlightProfile and fixture validation (dev-only)

- **Status:** proposed, for review
- **Date:** 2026-10-07

## Context
PLAN.md §3 and §11 (P0) require the `FlightProfile` schema and the fixture to be validated with Zod. PLAN.md §10 also allows only `ogl` as a runtime dependency, and `@speedwall-lab/core` must have zero runtime dependencies.

## Decision
Zod (MIT) is a **devDependency**. The schemas are separate entry points (`@speedwall-lab/core/schema`, `@speedwall-lab/data-gladius/fixture-schema`) that nothing in the runtime path imports. They run in tests, in CI, and in tooling. The TypeScript types in `core/src/types.ts` are written by hand.

## Consequences
- The runtime bundle and `size-limit` budgets are unaffected; the license check (`pnpm check:licenses`) reports 0 runtime packages.
- A host that wants to validate its own profile at runtime installs Zod itself and imports the `/schema` entry. If we later want built-in validation, that needs a new ADR, a size check and a decision on whether `core` keeps its zero-dependency rule.
- Hand-written types and the schema can drift. A test asserts that the profile built from the fixture passes the schema; add a type-level equality check if drift appears.
