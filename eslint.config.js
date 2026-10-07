// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "site/vendor/**", "tools/**", "research/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
  {
    files: ["site/js/**/*.mjs"],
    languageOptions: {
      globals: Object.fromEntries(["window", "document", "navigator", "localStorage", "requestAnimationFrame", "addEventListener",
        "removeEventListener", "structuredClone", "DOMParser", "matchMedia", "innerHeight", "innerWidth", "devicePixelRatio", "performance", "HTMLElement"].map((g) => [g, "readonly"])),
    },
  },
);
