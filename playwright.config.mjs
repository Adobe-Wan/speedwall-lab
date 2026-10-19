// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Browser smoke tests for the live alpha (site/index.html): `pnpm test:e2e`. Chromium only; WebGL runs on
// SwiftShader, so these check behaviour, never frame times.
import process from "node:process";
import { defineConfig } from "@playwright/test";

const port = 4173;
export default defineConfig({
  testDir: "tools/e2e",
  testMatch: "**/*.e2e.mjs",
  timeout: 120_000,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: { command: `node tools/serve-site.mjs ${port}`, url: `http://127.0.0.1:${port}/index.html`, reuseExistingServer: !process.env.CI },
});
