// SPDX-FileCopyrightText: 2026 Alex Bruecken Blaum
// SPDX-License-Identifier: MIT
//
// License allow-list check (PLAN.md §10).
//   - Runtime (production) dependencies: only the plan's allow-list.
//   - Dev tooling is never shipped, so it may also use the licenses in DEV_EXTRA.
// Reads `pnpm licenses list --json`, which covers the whole pnpm tree, not just top-level deps.
import { execFileSync } from "node:child_process";

const ALLOW = ["MIT", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Apache-2.0", "Unlicense", "0BSD", "CC0-1.0"];
const DEV_EXTRA = ["BlueOak-1.0.0", "Python-2.0"]; // minimatch, argparse: permissive, dev-only

/** True if an SPDX expression like "(MIT OR Apache-2.0)" is satisfied by `allowed`. */
function ok(expr, allowed) {
  const e = expr.replace(/[()]/g, " ").trim();
  return e.split(/\s+OR\s+/).some((alt) => alt.split(/\s+AND\s+/).every((id) => allowed.includes(id.trim())));
}

function list(args) {
  const out = execFileSync("pnpm", ["licenses", "list", "--json", ...args], { encoding: "utf8" });
  if (/^No licenses/.test(out.trim())) return [];
  return Object.entries(JSON.parse(out)).flatMap(([license, pkgs]) =>
    pkgs.map((p) => ({ license, name: p.name, versions: p.versions })),
  );
}

let bad = 0;
for (const [label, args, allowed] of [
  ["runtime", ["--prod"], ALLOW],
  ["all (incl. dev tooling)", [], [...ALLOW, ...DEV_EXTRA]],
]) {
  const pkgs = list(args);
  const offenders = pkgs.filter((p) => !ok(p.license, allowed));
  console.log(`${label}: ${pkgs.length} packages, ${offenders.length} outside the allow-list`);
  for (const p of offenders) console.log(`  ✗ ${p.name}@${p.versions.join(",")}  ${p.license}`);
  bad += offenders.length;
}
process.exit(bad ? 1 : 0);
