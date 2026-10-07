// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));
// Tests run against package sources, so no build step is needed first.
const alias = {
  "@speedwall-lab/core/schema": src("./packages/core/src/schema.ts"),
  "@speedwall-lab/core": src("./packages/core/src/index.ts"),
  "@speedwall-lab/data-gladius/fixture-schema": src("./packages/data-gladius/src/fixture-schema.ts"),
  "@speedwall-lab/data-gladius": src("./packages/data-gladius/src/index.ts"),
};

// Two projects so CI can gate on `unit` and report `physics` separately:
// the physics acceptance tests are written from the fixture before the
// physics exists (PLAN.md §12) and are expected to fail until P1.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["packages/*/test/**/*.test.ts"],
          exclude: ["packages/*/test/acceptance/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "physics",
          include: ["packages/*/test/acceptance/**/*.test.ts"],
        },
      },
    ],
  },
});
