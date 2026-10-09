// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Quick, cached, compact access to the Star Citizen Wiki API (https://api.star-citizen.wiki) for Q&A and cross-checks.
// The data is extracted from the game files; the API's code is MIT but it states no licence for the data, so (CLAUDE.md: no new
// third-party data) use it to CHECK and to form hypotheses, cite it, and never paste its values into the fixture without an ADR.
//
//   node tools/sc-wiki.mjs vehicle gladius                 top-level keys and the flight-looking fields of a ship
//   node tools/sc-wiki.mjs flight gladius                  only the fields that look like flight data (speed, accel, boost, rotation, ifcs...)
//   node tools/sc-wiki.mjs get /vehicles/gladius --grep boost    any path under the base, keys/values matching a regex
//   node tools/sc-wiki.mjs get <full-url> --keys           the top-level keys of any URL
//   node tools/sc-wiki.mjs search vehicles gladius         list matches (tries ?filter[name]= and ?search=)
//   node tools/sc-wiki.mjs cache clear                     empty the 24 h cache (.cache/sc-wiki)
// Options: --base URL (default https://api.star-citizen.wiki/api/v2)  --grep REGEX  --keys  --depth N (default 6)  --max N lines (default 120)
//          --refresh  --raw (print the JSON)  --ttl HOURS (default 24)
// The request goes through curl so the environment's proxy settings apply. If the host is blocked (EGRESS_BLOCKED / 403 CONNECT) the
// environment's network policy must allow api.star-citizen.wiki.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE = "https://api.star-citizen.wiki/api/v2";
const CACHE = new URL("../.cache/sc-wiki/", import.meta.url);
export const FLIGHT_RE = /speed|accel|boost|thrust|ifcs|rotat|angular|pitch|yaw|roll|scm|cruise|nav|afterburn|retro|strafe|fuel_?burn|mass|flight|controller|max_?(vel|spd|rate)|decay|ramp/i;

/** Flatten any JSON value to ["a.b[0].c", scalar] lines, down to `depth`. */
export function flatten(value, depth = 6, prefix = "", out = []) {
  if (value === null || typeof value !== "object") { out.push([prefix || "(value)", value]); return out; }
  if (depth <= 0) { out.push([prefix, Array.isArray(value) ? `[${value.length} items]` : `{${Object.keys(value).length} keys}`]); return out; }
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((x) => x === null || typeof x !== "object")) { out.push([prefix, value.length > 12 ? `[${value.slice(0, 12).join(", ")}, ... ${value.length} items]` : `[${value.join(", ")}]`]); return out; }
    value.slice(0, 40).forEach((x, i) => flatten(x, depth - 1, `${prefix}[${i}]`, out));
    if (value.length > 40) out.push([prefix, `... ${value.length - 40} more items`]);
    return out;
  }
  for (const k of Object.keys(value)) flatten(value[k], depth - 1, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** Keep the lines whose path or value matches `re`. */
export const grep = (lines, re) => lines.filter(([k, v]) => re.test(k) || (typeof v === "string" && re.test(v)));

const fmt = ([k, v]) => `${k} = ${typeof v === "string" ? JSON.stringify(v.length > 160 ? v.slice(0, 157) + "..." : v) : v}`;

function curlJson(url) {
  let text;
  try { text = execFileSync("curl", ["-sS", "-L", "--max-time", "40", "-H", "Accept: application/json", "-H", "User-Agent: speedwall-lab-coach/1.0", url], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) {
    const msg = `${e.stderr || e.message}`;
    if (/403|CONNECT|blocked|denied|proxy/i.test(msg)) throw new Error(`blocked: the environment's network policy denied ${new URL(url).host} (allow it under Network access > Allowed domains). curl said: ${msg.trim().split("\n")[0]}`);
    throw new Error(`curl failed: ${msg.trim().split("\n")[0]}`);
  }
  try { return JSON.parse(text); } catch { throw new Error(`not JSON (first 120 chars): ${text.slice(0, 120).replace(/\s+/g, " ")}`); }
}

export function fetchCached(url, { ttlH = 24, refresh = false } = {}) {
  const dir = fileURLToPath(CACHE); mkdirSync(dir, { recursive: true });
  const file = `${dir}${createHash("sha1").update(url).digest("hex").slice(0, 16)}.json`;
  if (!refresh && existsSync(file) && Date.now() - statSync(file).mtimeMs < ttlH * 3600e3) return JSON.parse(readFileSync(file, "utf8")).data;
  const data = curlJson(url);
  writeFileSync(file, JSON.stringify({ url, fetched: new Date().toISOString(), data }));
  return data;
}

function main(argv) {
  const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const flag = (k) => argv.includes(`--${k}`);
  const pos = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && !["keys", "raw", "refresh"].includes(argv[i - 1].slice(2))));
  const base = opt("base", DEFAULT_BASE).replace(/\/$/, ""), depth = +opt("depth", 6), max = +opt("max", 120), ttlH = +opt("ttl", 24), refresh = flag("refresh");
  const [cmd, a1, a2] = pos;
  const url = (p) => (/^https?:/.test(p) ? p : `${base}/${p.replace(/^\//, "")}`);
  const show = (data, re) => {
    if (flag("raw")) return console.log(JSON.stringify(data, null, 1).split("\n").slice(0, max).join("\n"));
    if (flag("keys")) return console.log(Array.isArray(data) ? `[array of ${data.length}] first item keys: ${Object.keys(data[0] ?? {}).join(", ")}` : Object.keys(data.data ?? data).join(", "));
    let lines = flatten(data.data ?? data, depth); const total = lines.length;
    if (re) lines = grep(lines, re);
    console.log(`${lines.length}/${total} fields${re ? ` matching ${re}` : ""}`); console.log(lines.slice(0, max).map(fmt).join("\n")); if (lines.length > max) console.log(`... ${lines.length - max} more (raise --max or narrow --grep)`);
  };
  try {
    if (cmd === "cache" && a1 === "clear") { rmSync(fileURLToPath(CACHE), { recursive: true, force: true }); return console.log("cache cleared"); }
    if (cmd === "cache") { const d = fileURLToPath(CACHE); return console.log(existsSync(d) ? `${readdirSync(d).length} cached responses in ${d}` : "empty"); }
    if (cmd === "get" && a1) return show(fetchCached(url(a1), { ttlH, refresh }), opt("grep") ? new RegExp(opt("grep"), "i") : null);
    if ((cmd === "vehicle" || cmd === "flight") && a1) {
      const slug = a1.toLowerCase().replace(/\s+/g, "-");
      return show(fetchCached(url(`vehicles/${slug}`), { ttlH, refresh }), cmd === "flight" ? FLIGHT_RE : opt("grep") ? new RegExp(opt("grep"), "i") : FLIGHT_RE);
    }
    if (cmd === "search" && a1 && a2) {
      for (const q of [`${a1}?filter[name]=${encodeURIComponent(a2)}`, `${a1}?search=${encodeURIComponent(a2)}`]) {
        try { const d = fetchCached(url(q), { ttlH, refresh }), rows = d.data ?? d; if (Array.isArray(rows) && rows.length) return console.log(rows.slice(0, 25).map((r) => [r.name, r.slug, r.uuid, r.class_name].filter(Boolean).join(" | ")).join("\n")); } catch (e) { if (/blocked/.test(e.message)) throw e; }
      }
      return console.log("no matches (try a shorter term, or `get` a list endpoint with --keys)");
    }
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).slice(5, 22).map((l) => l.slice(3)).join("\n"));
  } catch (e) { console.error(`sc-wiki: ${e.message}`); process.exitCode = 1; }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
