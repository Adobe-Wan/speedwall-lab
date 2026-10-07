// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
import { describe, it, expect } from "vitest";
import {
  parseActionmaps,
  vidPidFromGuid,
  browserAxisIndex,
  SC_KEY_TO_CODE,
  SC_DEFAULT_KEYBOARD,
  DEFAULT_ACTIONMAPS_PATH,
} from "../../site/js/sc-bindings.mjs";

// actionmaps.xml as the game writes it under Profiles\default (keyboard + HOTAS + pad).
const ACTIONMAPS = `<?xml version="1.0" encoding="utf-8"?>
<ActionMaps version="1" optionsVersion="2" rebindVersion="2" profileName="Gladius HOTAS">
 <ActionProfiles version="1" optionsVersion="2" rebindVersion="2" profileName="default">
  <deviceoptions name=" VKBsim Gladiator EVO R   {0200231D-0000-0000-0000-504944564944}">
   <option input="x" saturation="1" deadzone="0.02"/>
  </deviceoptions>
  <options type="keyboard" instance="1" Product="Keyboard  {6F1D2B61-D5A0-11CF-BFC7-444553540000}"/>
  <options type="joystick" instance="1" Product=" VKBsim Gladiator EVO R   {0200231D-0000-0000-0000-504944564944}">
   <flight_move_pitch invert="1"/>
   <flight_move_yaw invert="0"/>
  </options>
  <options type="joystick" instance="2" Product=" VKBsim Gladiator EVO L   {0201231D-0000-0000-0000-504944564944}">
   <strafe_vertical invert="1"/>
  </options>
  <options type="xboxpad" instance="1" Product="Controller (Xbox One For Windows) {02FF045E-0000-0000-0000-504944564944}"/>
  <modifiers />
  <actionmap name="spaceship_movement">
   <action name="v_strafe_up"><rebind input="kb1_space"/><rebind input="js2_button5"/></action>
   <action name="v_strafe_down"><rebind input="kb1_lctrl"/><rebind input="js1_ "/></action>
   <action name="v_strafe_left"><rebind input="kb1_a"/></action>
   <action name="v_strafe_right"><rebind input="kb1_d"/></action>
   <action name="v_strafe_forward"><rebind input="kb1_w"/></action>
   <action name="v_strafe_back"><rebind input="kb1_s"/></action>
   <action name="v_strafe_lateral"><rebind input="js2_x"/><rebind input="gp1_thumblx"/></action>
   <action name="v_strafe_vertical"><rebind input="js2_y"/></action>
   <action name="v_strafe_longitudinal"><rebind input="js2_slider1"/><rebind input="gp1_ "/></action>
   <action name="v_pitch"><rebind input="js1_y"/><rebind input="gp1_thumbry"/></action>
   <action name="v_yaw"><rebind input="js1_rotz"/></action>
   <action name="v_roll"><rebind input="js1_x"/></action>
   <action name="v_pitch_mouse"><rebind input="mo1_maxis_y"/></action>
   <action name="v_yaw_mouse"><rebind input="mo1_maxis_x"/></action>
   <action name="v_roll_left"><rebind input="kb1_q"/></action>
   <action name="v_roll_right"><rebind input="kb1_e" activationMode="press"/></action>
   <action name="v_afterburner"><rebind input="kb1_lshift"/><rebind input="js1_button2" multiTap="1"/><rebind input="gp1_shoulderl"/></action>
   <action name="v_space_brake"><rebind input="kb1_x"/><rebind input="js1_hat1_down"/><rebind input="mo1_mouse3"/></action>
   <action name="v_ifcs_toggle_vector_decoupling"><rebind input="kb1_c"/></action>
   <action name="v_toggle_cruise_control"><rebind input="kb1_ "/></action>
  </actionmap>
  <actionmap name="spaceship_targeting">
   <action name="v_target_cycle_all_fwd"><rebind input="kb1_t"/></action>
  </actionmap>
  <actionmap name="vehicle_driver">
   <action name="v_brake"><rebind input="kb1_space"/></action>
  </actionmap>
 </ActionProfiles>
</ActionMaps>`;

const parsed = parseActionmaps(ACTIONMAPS);
const only = (action) => parsed.bindings[action] ?? [];

describe("parseActionmaps: actionmaps.xml", () => {
  it("parses cleanly and reads the profile name", () => {
    expect(parsed.warnings).toEqual([]);
    expect(parsed.profileName).toBe("Gladius HOTAS");
  });

  it("maps keyboard keys to KeyboardEvent.code", () => {
    const kb = (a) => only(a).filter((b) => b.device === "kb").map((b) => b.code);
    expect(kb("strafeUp")).toEqual(["Space"]);
    expect(kb("strafeDown")).toEqual(["ControlLeft"]);
    expect(kb("strafeLeft")).toEqual(["KeyA"]);
    expect(kb("strafeRight")).toEqual(["KeyD"]);
    expect(kb("throttleFwd")).toEqual(["KeyW"]);
    expect(kb("throttleBack")).toEqual(["KeyS"]);
    expect(kb("rollLeft")).toEqual(["KeyQ"]);
    expect(kb("rollRight")).toEqual(["KeyE"]);
    expect(kb("boost")).toEqual(["ShiftLeft"]);
    expect(kb("spacebrake")).toEqual(["KeyX"]);
    expect(only("strafeUp")[0]).toMatchObject({ device: "kb", instance: 1, kind: "key", scInput: "kb1_space" });
  });

  it("reads joystick axes and applies per-device inverts", () => {
    expect(only("pitch").find((b) => b.device === "js")).toMatchObject({
      device: "js", instance: 1, kind: "axis", axis: "y", invert: true, scInput: "js1_y",
    });
    expect(only("yaw")[0]).toMatchObject({ axis: "rotz", invert: false });
    expect(only("roll")[0]).toMatchObject({ axis: "x", invert: false });
    // Invert on stick 2 only affects stick 2's vertical axis.
    expect(only("strafeVert")[0]).toMatchObject({ instance: 2, axis: "y", invert: true });
    expect(only("strafeLat").find((b) => b.device === "js")).toMatchObject({ instance: 2, axis: "x", invert: false });
    expect(only("strafeLong")).toEqual([expect.objectContaining({ instance: 2, axis: "slider1" })]);
  });

  it("reads joystick buttons (0-based) and hats", () => {
    expect(only("boost").find((b) => b.device === "js")).toMatchObject({ kind: "button", button: 1, instance: 1 });
    expect(only("strafeUp").find((b) => b.device === "js")).toMatchObject({ kind: "button", button: 4, instance: 2 });
    expect(only("spacebrake").find((b) => b.kind === "hat")).toMatchObject({ device: "js", hat: 1, direction: "down" });
  });

  it("reads gamepad axes and buttons", () => {
    expect(only("strafeLat").find((b) => b.device === "gp")).toMatchObject({ kind: "axis", axis: "thumblx", instance: 1 });
    expect(only("pitch").find((b) => b.device === "gp")).toMatchObject({ kind: "axis", axis: "thumbry" });
    expect(only("boost").find((b) => b.device === "gp")).toMatchObject({ kind: "button", button: 4 });
  });

  it("reads mouse axes and buttons", () => {
    expect(only("pitch").find((b) => b.device === "mouse")).toMatchObject({ kind: "axis", axis: "y", scInput: "mo1_maxis_y" });
    expect(only("yaw").find((b) => b.device === "mouse")).toMatchObject({ kind: "axis", axis: "x" });
    expect(only("spacebrake").find((b) => b.device === "mouse")).toMatchObject({ kind: "button", button: 1 });
  });

  it("ignores unbound entries", () => {
    expect(only("strafeDown").map((b) => b.scInput)).toEqual(["kb1_lctrl"]);
    expect(only("strafeLong").some((b) => b.device === "gp")).toBe(false);
    expect(JSON.stringify(parsed.bindings)).not.toContain("kb1_ ");
  });

  it("keeps several rebinds per action, one per device", () => {
    expect(only("boost").map((b) => b.scInput)).toEqual(["kb1_lshift", "js1_button2", "gp1_shoulderl"]);
    expect(only("spacebrake")).toHaveLength(3);
  });

  it("reports unknown flight actions and skips non-flight maps", () => {
    expect(parsed.unknownActions).toEqual(["v_ifcs_toggle_vector_decoupling", "v_toggle_cruise_control"]);
    // v_brake in the ground-vehicle map must not become the space brake.
    expect(only("spacebrake").some((b) => b.scInput === "kb1_space")).toBe(false);
  });

  it("lists devices with product, GUID and vid:pid", () => {
    expect(parsed.devices).toEqual([
      { type: "keyboard", instance: 1, product: "Keyboard", guid: "{6F1D2B61-D5A0-11CF-BFC7-444553540000}", vidPid: null },
      { type: "joystick", instance: 1, product: "VKBsim Gladiator EVO R", guid: "{0200231D-0000-0000-0000-504944564944}", vidPid: "231d:0200" },
      { type: "joystick", instance: 2, product: "VKBsim Gladiator EVO L", guid: "{0201231D-0000-0000-0000-504944564944}", vidPid: "231d:0201" },
      { type: "gamepad", instance: 1, product: "Controller (Xbox One For Windows)", guid: "{02FF045E-0000-0000-0000-504944564944}", vidPid: "045e:02ff" },
    ]);
  });
});

describe("parseActionmaps: variants", () => {
  it("reads an exported layout (no ActionProfiles, split pitch/yaw buttons, <pitch invert>)", () => {
    const r = parseActionmaps(`<ActionMaps version="1" optionsVersion="2" rebindVersion="2" profileName="layout_gladius_exported">
 <CustomisationUIHeader label="layout_gladius" description="" image="">
  <devices><keyboard instance="1"/><joystick instance="1"/></devices>
 </CustomisationUIHeader>
 <options type="joystick" instance="1" Product="T.16000M {B10A044F-0000-0000-0000-504944564944}"><pitch invert="1"/></options>
 <actionmap name="spaceship_movement">
  <action name="v_pitch_up"><rebind input="kb1_np_8"/></action>
  <action name="v_pitch_down"><rebind input="kb1_np_2"/></action>
  <action name="v_yaw_left"><rebind input="kb1_np_4"/></action>
  <action name="v_pitch"><rebind input="js1_y"/></action>
  <action name="v_brake"><rebind input="kb1_lalt+x"/></action>
  <action name="v_afterburner"><rebind input="kb1_f1"/></action>
 </actionmap>
</ActionMaps>`);
    expect(r.warnings).toEqual([]);
    expect(r.profileName).toBe("layout_gladius_exported");
    expect(r.bindings.pitch.map((b) => [b.scInput, b.sign, b.code ?? b.axis, b.invert])).toEqual([
      ["kb1_np_8", 1, "Numpad8", false],
      ["kb1_np_2", -1, "Numpad2", false],
      ["js1_y", 1, "y", true],
    ]);
    expect(r.bindings.yaw[0]).toMatchObject({ code: "Numpad4", sign: -1 });
    expect(r.bindings.spacebrake[0]).toMatchObject({ code: "KeyX", modifiers: ["AltLeft"] });
    expect(r.bindings.boost[0].code).toBe("F1");
    expect(r.devices[0].vidPid).toBe("044f:b10a");
  });

  it("accepts old-style rebinds with a device attribute and unprefixed input", () => {
    const r = parseActionmaps(`<ActionMaps><actionmap name="spaceship_movement">
  <action name="v_strafe_up"><rebind device="keyboard" input="space"/></action>
  <action name="v_roll"><rebind device="joystick" input="js1_z" invert="1"/></action>
 </actionmap></ActionMaps>`);
    expect(r.bindings.strafeUp[0]).toMatchObject({ device: "kb", instance: 1, code: "Space" });
    expect(r.bindings.roll[0]).toMatchObject({ axis: "z", invert: true });
  });
});

describe("parseActionmaps: bad input never throws", () => {
  it.each([
    ["truncated file", ACTIONMAPS.slice(0, 1400)],
    ["mismatched tags", `<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_up"><rebind input="kb1_space"/></actionmap></ActionMaps>`],
    ["not XML", "this is not xml at all"],
    ["broken tag", `<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_up"<rebind input="kb1_space"/></action></actionmap></ActionMaps>`],
    ["empty", ""],
    ["not a string", undefined],
  ])("%s → warnings", (_label, xml) => {
    let r;
    expect(() => { r = parseActionmaps(xml); }).not.toThrow();
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r).toHaveProperty("bindings");
  });

  it("still salvages bindings from a mismatched file", () => {
    const r = parseActionmaps(`<ActionMaps><actionmap name="spaceship_movement"><action name="v_strafe_up"><rebind input="kb1_space"/></actionmap></ActionMaps>`);
    expect(r.bindings.strafeUp[0].code).toBe("Space");
    expect(r.warnings.join(" ")).toMatch(/not closed/);
  });

  it("warns about unknown inputs instead of failing", () => {
    const r = parseActionmaps(`<ActionMaps><actionmap name="spaceship_movement">
  <action name="v_strafe_up"><rebind input="kb1_weirdkey"/><rebind input="js1_dial9"/></action></actionmap></ActionMaps>`);
    expect(r.bindings.strafeUp).toEqual([expect.objectContaining({ code: null, scInput: "kb1_weirdkey" })]);
    expect(r.warnings).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("vidPidFromGuid decodes DirectInput PIDVID GUIDs", () => {
    expect(vidPidFromGuid("{0200231D-0000-0000-0000-504944564944}")).toBe("231d:0200");
    expect(vidPidFromGuid("02FF045E-0000-0000-0000-504944564944")).toBe("045e:02ff");
    expect(vidPidFromGuid("{6F1D2B61-D5A0-11CF-BFC7-444553540000}")).toBeNull(); // GUID_SysKeyboard
    expect(vidPidFromGuid("{00000000-0000-0000-0000-504944564944}")).toBeNull();
    expect(vidPidFromGuid("nonsense")).toBeNull();
    expect(vidPidFromGuid(null)).toBeNull();
  });

  it("browserAxisIndex guesses Gamepad API indices", () => {
    expect(["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"].map((a) => browserAxisIndex(a, "joystick")))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(["thumblx", "thumbly", "thumbrx", "thumbry"].map((a) => browserAxisIndex(a, "gamepad"))).toEqual([0, 1, 2, 3]);
    expect(browserAxisIndex("thumblx", "joystick")).toBeNull();
  });

  it("key table and defaults are consistent", () => {
    expect(SC_KEY_TO_CODE).toMatchObject({
      w: "KeyW", 1: "Digit1", f12: "F12", np_0: "Numpad0", np_add: "NumpadAdd", lshift: "ShiftLeft",
      rctrl: "ControlRight", ralt: "AltRight", pgdn: "PageDown", grave: "Backquote", apostrophe: "Quote", capslock: "CapsLock",
    });
    const codes = new Set(Object.values(SC_KEY_TO_CODE));
    for (const code of Object.values(SC_DEFAULT_KEYBOARD)) expect(codes.has(code)).toBe(true);
    expect(DEFAULT_ACTIONMAPS_PATH).toMatch(/\\LIVE\\user\\client\\0\\Profiles\\default\\actionmaps\.xml$/);
  });
});
