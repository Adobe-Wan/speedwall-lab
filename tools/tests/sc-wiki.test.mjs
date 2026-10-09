// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { FLIGHT_RE, flatten, grep } from "../sc-wiki.mjs";

describe("sc-wiki helpers", () => {
  const doc = { name: "Gladius", speed: { scm: 226, max: 1230 }, flight: { boost: { forward: 1.55 } }, tags: ["a", "b"], parts: [{ id: 1 }, { id: 2 }], deep: { a: { b: { c: 1 } } } };
  it("flattens nested objects, scalar arrays and object arrays to path = value lines", () => {
    const lines = Object.fromEntries(flatten(doc));
    expect(lines["speed.scm"]).toBe(226);
    expect(lines["flight.boost.forward"]).toBe(1.55);
    expect(lines.tags).toBe("[a, b]");
    expect(lines["parts[1].id"]).toBe(2);
  });
  it("stops at the depth limit with a summary", () => {
    expect(Object.fromEntries(flatten(doc, 2))["deep.a"]).toBe("{1 keys}");
  });
  it("greps paths and string values, case-insensitively", () => {
    expect(grep(flatten(doc), /boost/i).map(([k]) => k)).toEqual(["flight.boost.forward"]);
    expect(grep(flatten(doc), /glad/i).map(([k]) => k)).toEqual(["name"]);
  });
  it("the flight pattern keeps speed and boost fields and drops the rest", () => {
    const kept = grep(flatten(doc), FLIGHT_RE).map(([k]) => k);
    expect(kept).toContain("speed.scm");
    expect(kept).toContain("flight.boost.forward");
    expect(kept).not.toContain("name");
  });
});
