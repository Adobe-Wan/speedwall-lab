// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, it, expect } from "vitest";
import {
  STEPS,
  ROWS,
  scDefaults,
  findConflicts,
  otherUses,
  anyPadBinding,
  bindingId,
  rowSteps,
  rowText,
  stepPrompt,
  andList,
} from "../../site/js/controls.mjs";

const step = (id) => STEPS.find((s) => s.id === id);
const kinds = (...k) => new Set(k);
const key = (code) => ({ t: "key", code });
const btn = (button, nth = 0) => ({ t: "btn", id: "VKB Gladiator EVO R (Vendor: 231d Product: 0200)", key: "231d:0200", nth, button });
const axis = (a, nth = 0) => ({ t: "axis", id: "VKB Gladiator EVO R (Vendor: 231d Product: 0200)", key: "231d:0200", nth, axis: a, inv: false });

describe("findConflicts", () => {
  it("finds none in the Star Citizen defaults", () => {
    expect(findConflicts(scDefaults())).toEqual([]);
  });

  it("flags a key bound to two rows", () => {
    const m = scDefaults();
    m.buttons.boost = [key("Space")];
    const c = findConflicts(m);
    expect(c).toHaveLength(1);
    expect(c[0].text).toBe("Space is bound to Strafe up and Boost");
    expect(c[0].rows.sort()).toEqual(["boost", "u"]);
  });

  it("flags a key bound to both directions of one row", () => {
    const m = scDefaults();
    m.axes.roll.neg = [key("KeyE")];
    const c = findConflicts(m);
    expect(c).toHaveLength(1);
    expect(c[0].rows).toEqual(["roll"]);
    expect(c[0].text).toBe("E is bound to Roll right and Roll left");
  });

  it("flags the same pad button and the same pad axis, but tells twin devices apart", () => {
    const m = scDefaults();
    m.buttons.boost = [btn(3)];
    m.buttons.brake = [btn(3)];
    m.axes.pitch.axis = axis(1);
    m.axes.yaw.axis = axis(1);
    m.axes.roll.axis = axis(1, 1); // the second, identical stick
    const c = findConflicts(m);
    expect(c.map((x) => x.rows.sort().join("+")).sort()).toEqual(["boost+brake", "pitch+yaw"]);
  });

  it("does not flag one key listed twice in the same slot", () => {
    const m = scDefaults();
    m.axes.u.pos = [key("Space"), key("Space")];
    expect(findConflicts(m)).toEqual([]);
  });

  it("lists three uses with commas", () => {
    const m = scDefaults();
    m.buttons.boost = [key("Space")];
    m.buttons.brake = [key("Space")];
    expect(findConflicts(m)[0].text).toBe("Space is bound to Strafe up, Boost and Spacebrake");
  });
});

describe("otherUses", () => {
  it("ignores the slot being bound", () => {
    const m = scDefaults();
    expect(otherUses(m, key("Space"), "u", "pos")).toEqual([]);
    expect(otherUses(m, key("Space"), "boost", "btn").map((s) => s.name)).toEqual(["Strafe up"]);
  });
});

describe("bindingId", () => {
  it("identifies inputs by device, twin number and index", () => {
    expect(bindingId(key("KeyW"))).toBe("k:KeyW");
    expect(bindingId(btn(2))).toBe("b:231d:0200#0:2");
    expect(bindingId(axis(2, 1))).toBe("a:231d:0200#1:2");
    expect(bindingId({ t: "mouse", axis: "x" })).toBe("m:x");
    expect(bindingId(btn(2))).not.toBe(bindingId(axis(2)));
  });
});

describe("anyPadBinding", () => {
  it("is false for keyboard and mouse only", () => {
    expect(anyPadBinding(scDefaults())).toBe(false);
  });
  it("is true once a pad button or axis is bound", () => {
    const a = scDefaults(); a.buttons.brake.push(btn(1));
    const b = scDefaults(); b.axes.f.axis = axis(2);
    expect(anyPadBinding(a)).toBe(true);
    expect(anyPadBinding(b)).toBe(true);
  });
});

describe("rowSteps and rowText", () => {
  it("maps rows to their wizard steps", () => {
    const ids = (r) => rowSteps(r).map((i) => STEPS[i].id);
    expect(ids("f")).toEqual(["throttleFwd", "throttleBack"]);
    expect(ids("roll")).toEqual(["rollLeft", "rollRight"]);
    expect(ids("boost")).toEqual(["boost"]);
    expect(ROWS.flatMap(rowSteps).sort((x, y) => x - y)).toEqual(STEPS.map((_, i) => i));
  });
  it("describes rows", () => {
    const m = scDefaults();
    expect(rowText(m, "u")).toBe("L Ctrl ↔ Space");
    expect(rowText(m, "boost")).toBe("L Shift");
    m.axes.roll = { axis: null, pos: [], neg: [] };
    expect(rowText(m, "roll")).toBe("not bound");
  });
});

describe("stepPrompt", () => {
  it("keyboard only: press a key", () => {
    expect(stepPrompt(step("strafeUp"), kinds("keyboard")).text).toBe("Press a key.");
    expect(stepPrompt(step("strafeUp"), kinds("keyboard")).tip).toBe("Default: Space.");
  });
  it("joystick / HOTAS: key or button, or an axis", () => {
    expect(stepPrompt(step("strafeUp"), kinds("keyboard", "stick")).text).toBe("Press a key or button, or move an axis.");
    expect(stepPrompt(step("boost"), kinds("keyboard", "stick")).text).toBe("Press a key or button.");
  });
  it("gamepad: buttons, triggers and sticks", () => {
    const p = stepPrompt(step("pitchUp"), kinds("gamepad"));
    expect(p.text).toBe("Press a button or trigger, or move a stick.");
    expect(p.tip).toContain("right stick");
  });
  it("pedals: the yaw steps ask for a pedal", () => {
    expect(stepPrompt(step("yawRight"), kinds("keyboard", "pedals")).text).toBe("Press a pedal (or twist the stick), or press a key or button.");
    expect(stepPrompt(step("strafeUp"), kinds("keyboard", "pedals")).text).not.toContain("pedal (or");
  });
  it("mouse: pitch and yaw offer the mouse", () => {
    const p = stepPrompt(step("pitchUp"), kinds("keyboard", "mouse"));
    expect(p.mouse).toBe(true);
    expect(p.text).toBe("Press a key, or use the mouse.");
    expect(stepPrompt(step("strafeUp"), kinds("keyboard", "mouse")).mouse).toBe(false);
  });
  it("buttons only (reverse thrust): no axes, no mouse", () => {
    const p = stepPrompt(step("throttleBack"), kinds("keyboard", "stick", "mouse"), true);
    expect(p.text).toBe("Press a key or button.");
    expect(p.mouse).toBe(false);
  });
});

describe("andList", () => {
  it("joins", () => {
    expect(andList(["A"])).toBe("A");
    expect(andList(["A", "B"])).toBe("A and B");
    expect(andList(["A", "B", "C"])).toBe("A, B and C");
  });
});
