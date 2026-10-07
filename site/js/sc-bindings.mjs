// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Import a Star Citizen key-bindings export (actionmaps.xml or an exported layout .xml) and
// translate it into the trainer's action ids. Dependency-free; runs in browsers (DOMParser) and
// in Node (small regex XML parser, which is also the tested path).
//
// The actionmaps format is not documented by CIG. Everything here is written from community
// knowledge of the files and handles several variants where the format is uncertain:
//  - root <ActionMaps> with <ActionProfiles> (actionmaps.xml) or with <options>/<actionmap>
//    directly under the root (exported layouts, which also carry a <CustomisationUIHeader>);
//  - gamepad <options> type "xboxpad" (what SC writes, as far as we know) or "gamepad";
//  - per-axis inverts as <pitch invert="1"/>, <flight_move_pitch invert="1"/> or
//    <option input="pitch" invert="1"/> inside <options>, and invert="1" on a <rebind>;
//  - prefixed inputs ("kb1_w", "js2_x") and old style <rebind device="keyboard" input="w"/>.

/** Where the live game keeps the active bindings (Windows, default install). */
export const DEFAULT_ACTIONMAPS_PATH =
  'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\user\\client\\0\\Profiles\\default\\actionmaps.xml';
/** Layouts exported from the in-game Keybindings screen ("Save control settings") land here. */
export const CUSTOM_LAYOUTS_DIR =
  'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\user\\client\\0\\controls\\mappings\\';

/** SC keyboard token (after "kb1_") → KeyboardEvent.code. */
export const SC_KEY_TO_CODE = (() => {
  const t = {};
  for (const c of 'abcdefghijklmnopqrstuvwxyz') t[c] = 'Key' + c.toUpperCase();
  for (let d = 0; d <= 9; d++) { t[String(d)] = 'Digit' + d; t['np_' + d] = 'Numpad' + d; }
  for (let f = 1; f <= 12; f++) t['f' + f] = 'F' + f;
  Object.assign(t, {
    space: 'Space', lshift: 'ShiftLeft', rshift: 'ShiftRight', lctrl: 'ControlLeft', rctrl: 'ControlRight',
    lalt: 'AltLeft', ralt: 'AltRight', tab: 'Tab', enter: 'Enter', backspace: 'Backspace', escape: 'Escape',
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    np_add: 'NumpadAdd', np_subtract: 'NumpadSubtract', np_multiply: 'NumpadMultiply',
    np_divide: 'NumpadDivide', np_period: 'NumpadDecimal', np_enter: 'NumpadEnter',
    insert: 'Insert', delete: 'Delete', home: 'Home', end: 'End', pgup: 'PageUp', pgdn: 'PageDown',
    minus: 'Minus', equals: 'Equal', lbracket: 'BracketLeft', rbracket: 'BracketRight',
    semicolon: 'Semicolon', apostrophe: 'Quote', comma: 'Comma', period: 'Period', slash: 'Slash',
    backslash: 'Backslash', grave: 'Backquote', capslock: 'CapsLock',
    // Plausible alternative spellings (unverified).
    esc: 'Escape', return: 'Enter', pageup: 'PageUp', pagedown: 'PageDown', np_decimal: 'NumpadDecimal',
  });
  return Object.freeze(t);
})();

/** Star Citizen keyboard defaults for decoupled flight. Pitch/yaw default to the mouse in game. */
export const SC_DEFAULT_KEYBOARD = Object.freeze({
  strafeUp: 'Space', strafeDown: 'ControlLeft', strafeLeft: 'KeyA', strafeRight: 'KeyD',
  throttleFwd: 'KeyW', throttleBack: 'KeyS', rollLeft: 'KeyQ', rollRight: 'KeyE',
  boost: 'ShiftLeft', spacebrake: 'KeyX',
});

/** SC action → [app action, sign]. Sign is -1 for the negative half of a split axis. */
const ACTION_MAP = {
  v_strafe_up: ['strafeUp'], v_strafe_down: ['strafeDown'],
  v_strafe_left: ['strafeLeft'], v_strafe_right: ['strafeRight'],
  // Recent builds put W/S on v_strafe_forward/back; v_throttle_* and v_ifcs_throttle_* are
  // older/alternative names. All feed the trainer's throttle.
  v_strafe_forward: ['throttleFwd'], v_strafe_back: ['throttleBack'], v_strafe_backward: ['throttleBack'],
  v_throttle_up: ['throttleFwd'], v_throttle_down: ['throttleBack'],
  v_ifcs_throttle_up: ['throttleFwd'], v_ifcs_throttle_down: ['throttleBack'],
  v_strafe_lateral: ['strafeLat'], v_strafe_vertical: ['strafeVert'], v_strafe_longitudinal: ['strafeLong'],
  v_pitch: ['pitch'], v_pitch_mouse: ['pitch'], v_pitch_up: ['pitch', 1], v_pitch_down: ['pitch', -1],
  v_yaw: ['yaw'], v_yaw_mouse: ['yaw'], v_yaw_left: ['yaw', -1], v_yaw_right: ['yaw', 1],
  v_roll: ['roll'], v_roll_mouse: ['roll'], v_roll_left: ['rollLeft'], v_roll_right: ['rollRight'],
  v_afterburner: ['boost'], v_boost: ['boost'],
  v_space_brake: ['spacebrake'], v_brake: ['spacebrake'], v_ifcs_space_brake: ['spacebrake'],
};
// Only flight maps are read, so a v_brake in a ground-vehicle map is not taken as the space brake.
// Unmapped actions are only reported from the movement maps, not from targeting, weapons etc.
const FLIGHT_MAP = /^spaceship|^ifcs|flight|movement/i;
const MOVEMENT_MAP = /movement|ifcs|flight/i;

// Names used for per-axis invert options, normalised (prefixes flight_move_/flight_/v_ stripped).
const INVERT_NAMES = {
  pitch: 'pitch', yaw: 'yaw', roll: 'roll',
  strafe_lateral: 'strafeLat', strafe_vertical: 'strafeVert', strafe_longitudinal: 'strafeLong',
  strafe_forward_back: 'strafeLong', strafe_left_right: 'strafeLat', strafe_up_down: 'strafeVert',
};

const PREFIX = { kb: ['kb', 'keyboard'], mo: ['mouse', 'mouse'], js: ['js', 'joystick'], gp: ['gp', 'gamepad'] };
const OPTION_TYPE = { keyboard: 'keyboard', mouse: 'mouse', joystick: 'joystick', gamepad: 'gamepad', xboxpad: 'gamepad' };
const LEGACY_DEVICE = { keyboard: 'kb', mouse: 'mo', joystick: 'js', gamepad: 'gp', xboxpad: 'gp' };
const JS_AXES = new Set(['x', 'y', 'z', 'rotx', 'roty', 'rotz', 'slider1', 'slider2']);
// Gamepad buttons in W3C "standard" Gamepad API order.
const GP_BUTTONS = {
  a: 0, b: 1, x: 2, y: 3, shoulderl: 4, shoulderr: 5, triggerl_btn: 6, triggerr_btn: 7,
  back: 8, start: 9, thumbl: 10, thumbr: 11, dpad_up: 12, dpad_down: 13, dpad_left: 14, dpad_right: 15,
};
const GP_AXES = { thumblx: 'thumblx', thumbly: 'thumbly', thumbrx: 'thumbrx', thumbry: 'thumbry',
  triggerl_axis: 'triggerl', triggerr_axis: 'triggerr', triggerl: 'triggerl', triggerr: 'triggerr' };
// SC mouse1/2/3 = left/right/middle → MouseEvent.button.
const MOUSE_BUTTONS = { mouse1: 0, mouse2: 2, mouse3: 1, mouse4: 3, mouse5: 4 };

/**
 * DirectInput product GUIDs ("PIDVID" GUIDs, last group 504944564944) encode the USB ids in the
 * first group as PPPPVVVV. Returns 'vvvv:pppp' (lowercase hex) or null.
 */
export function vidPidFromGuid(guid) {
  const m = /^\{?([0-9a-f]{4})([0-9a-f]{4})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-([0-9a-f]{12})\}?$/i
    .exec(String(guid ?? '').trim());
  if (!m || m[3].toUpperCase() !== '504944564944') return null; // e.g. GUID_SysKeyboard
  const pid = m[1].toLowerCase(), vid = m[2].toLowerCase();
  return vid === '0000' && pid === '0000' ? null : `${vid}:${pid}`;
}

/**
 * Best guess at the Gamepad API axes[] index for an SC axis on Windows/Chrome. Generic HID
 * devices usually list axes in HID usage order; standard-mapped pads use the W3C layout. It is
 * only a starting point: the app confirms each axis with a live wiggle test. Returns null if unknown.
 */
export function browserAxisIndex(axisName, type = 'joystick') {
  const n = String(axisName ?? '').toLowerCase();
  const table = type === 'gamepad' || type === 'gp'
    ? { thumblx: 0, thumbly: 1, thumbrx: 2, thumbry: 3 }
    : { x: 0, y: 1, z: 2, rotx: 3, roty: 4, rotz: 5, slider1: 6, slider2: 7 };
  return n in table ? table[n] : null;
}

// ---------- XML → light tree { name, attrs, children } ----------

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(\w+));/gi, (all, hex, dec, name) =>
  hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : ENT[name] ?? all);

function regexTree(text, warnings) {
  const doc = { name: '#doc', attrs: {}, children: [] };
  const stack = [doc];
  const tok = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/gi;
  let last = 0, m, strays = 0;
  while ((m = tok.exec(text))) {
    if (text.slice(last, m.index).includes('<')) strays++;
    last = tok.lastIndex;
    if (m[1]) { // closing tag
      const i = stack.map((e) => e.name).lastIndexOf(m[1]);
      if (i <= 0) { warnings.push(`Unexpected closing tag </${m[1]}> ignored.`); continue; }
      if (i !== stack.length - 1) warnings.push(`<${stack[stack.length - 1].name}> not closed before </${m[1]}>.`);
      stack.length = i;
    } else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3]);
      const el = { name: m[2], attrs, children: [] };
      stack[stack.length - 1].children.push(el);
      if (!m[4]) stack.push(el);
    }
  }
  if (text.slice(last).includes('<')) strays++;
  if (strays) warnings.push(`${strays} piece(s) of unparseable markup skipped; the file may be truncated or malformed.`);
  if (stack.length > 1) warnings.push(`Unclosed element(s) at end of file: ${stack.slice(1).map((e) => e.name).join(', ')}.`);
  return doc;
}

function domTree(text, warnings) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) {
    warnings.push('XML parser reported an error; read the file leniently instead.');
    return null;
  }
  const conv = (el) => ({
    name: el.nodeName,
    attrs: Object.fromEntries(Array.from(el.attributes, (a) => [a.name, a.value])),
    children: Array.from(el.children, conv),
  });
  return { name: '#doc', attrs: {}, children: [conv(xml.documentElement)] };
}

const lc = (s) => s.toLowerCase();
function findAll(node, name, out = []) {
  for (const c of node.children) { if (lc(c.name) === name) out.push(c); findAll(c, name, out); }
  return out;
}

// ---------- inputs ----------

/** Parse one SC input string into a binding (without action-specific fields), or null if unbound. */
function parseInput(raw, deviceAttr, warnings) {
  const s = String(raw ?? '').trim();
  let m = /^(kb|mo|js|gp)(\d+)_(.*)$/i.exec(s);
  if (!m && s && LEGACY_DEVICE[lc(deviceAttr ?? '')]) m = [s, LEGACY_DEVICE[lc(deviceAttr)], '1', s];
  if (!m) { if (s) warnings.push(`Unrecognised input "${s}" ignored.`); return null; }
  const [device, type] = PREFIX[lc(m[1])];
  // Modifier combos look like "kb1_lalt+f" or "kb1_lalt+kb1_f"; the last part is the input.
  const parts = m[3].split('+').map((p) => lc(p.replace(/^(kb|mo|js|gp)\d+_/i, '').trim()));
  const token = parts.pop();
  if (!token) return null; // "kb1_ " / "js1_" = explicitly unbound
  const b = { device, type, instance: Number(m[2]), kind: null, code: null, button: null, axis: null,
    hat: null, direction: null, modifiers: parts.map((p) => SC_KEY_TO_CODE[p] ?? p), invert: false, sign: 1, scInput: s };
  let k;
  if (device === 'kb') {
    b.kind = 'key'; b.code = SC_KEY_TO_CODE[token] ?? null;
    if (!b.code) warnings.push(`Unknown keyboard key "${token}" in "${s}".`);
  } else if (device === 'mouse') {
    if ((k = /^maxis_(\w+)$/.exec(token))) { b.kind = 'axis'; b.axis = k[1]; }
    else if ((k = /^mwheel_(up|down)$/.exec(token))) { b.kind = 'wheel'; b.direction = k[1]; }
    else if (token in MOUSE_BUTTONS) { b.kind = 'button'; b.button = MOUSE_BUTTONS[token]; }
  } else if (device === 'js') {
    if ((k = /^button(\d+)$/.exec(token))) { b.kind = 'button'; b.button = Number(k[1]) - 1; }
    else if ((k = /^hat(\d+)_(up|down|left|right)$/.exec(token))) { b.kind = 'hat'; b.hat = Number(k[1]); b.direction = k[2]; }
    else if (JS_AXES.has(token)) { b.kind = 'axis'; b.axis = token; }
  } else if (token in GP_BUTTONS) { b.kind = 'button'; b.button = GP_BUTTONS[token]; }
  else if (token in GP_AXES) { b.kind = 'axis'; b.axis = GP_AXES[token]; }
  if (!b.kind) { warnings.push(`Unsupported input "${s}" ignored.`); return null; }
  return b;
}

function parseProduct(product) {
  const m = /^(.*?)\s*(\{[0-9a-f-]+\})?\s*$/i.exec(String(product ?? '').trim());
  return { product: m[1].trim() || null, guid: m[2] ?? null };
}

// ---------- main ----------

/**
 * Parse an actionmaps.xml / exported layout. Never throws: problems end up in `warnings`.
 * @returns {{profileName: string|null, devices: object[], bindings: Object<string, object[]>,
 *   unknownActions: string[], warnings: string[]}}
 */
export function parseActionmaps(xmlText) {
  const out = { profileName: null, devices: [], bindings: {}, unknownActions: [], warnings: [] };
  const w = out.warnings;
  try {
    if (typeof xmlText !== 'string' || !xmlText.trim()) { w.push('No XML text given.'); return out; }
    const text = xmlText.replace(/^\uFEFF/, '');
    const tree = (typeof DOMParser === 'function' && domTree(text, w)) || regexTree(text, w);

    const root = findAll(tree, 'actionmaps')[0];
    if (!root) w.push('No <ActionMaps> root element found; is this a Star Citizen actionmaps file?');
    let scope = root ?? tree;
    const profiles = findAll(scope, 'actionprofiles');
    if (profiles.length) {
      scope = profiles.find((p) => p.attrs.profileName === 'default') ?? profiles[0];
      if (profiles.length > 1) w.push(`${profiles.length} <ActionProfiles> found; using "${scope.attrs.profileName ?? 'first'}".`);
    }
    const header = findAll(root ?? tree, 'customisationuiheader')[0];
    out.profileName = root?.attrs.profileName || scope.attrs?.profileName || header?.attrs.label || null;

    // Devices and per-axis inverts from <options>.
    const inverts = new Map();
    for (const o of findAll(scope, 'options')) {
      const type = OPTION_TYPE[lc(o.attrs.type ?? '')];
      if (!type) continue;
      const instance = Number(o.attrs.instance ?? 1);
      const { product, guid } = parseProduct(o.attrs.Product ?? o.attrs.product);
      if (!out.devices.some((d) => d.type === type && d.instance === instance)) {
        out.devices.push({ type, instance, product, guid, vidPid: guid ? vidPidFromGuid(guid) : null });
      }
      for (const opt of allDesc(o)) {
        if (!('invert' in opt.attrs)) continue;
        const name = lc(opt.attrs.input ?? opt.attrs.name ?? opt.name).replace(/^(flight_move_|flight_|v_)/, '');
        const app = INVERT_NAMES[name];
        if (app) inverts.set(`${type}:${instance}:${app}`, opt.attrs.invert === '1' || lc(opt.attrs.invert) === 'true');
      }
    }

    const maps = findAll(scope, 'actionmap');
    if (!maps.length) w.push('No <actionmap> elements found; nothing to import.');
    const unknown = new Set();
    for (const map of maps) {
      if (map.attrs.name && !FLIGHT_MAP.test(map.attrs.name)) continue;
      for (const action of findAll(map, 'action')) {
        const scName = action.attrs.name ?? '';
        const target = ACTION_MAP[lc(scName)];
        if (!target) { if (scName && (!map.attrs.name || MOVEMENT_MAP.test(map.attrs.name))) unknown.add(scName); continue; }
        const [app, sign = 1] = target;
        for (const r of findAll(action, 'rebind')) {
          const b = parseInput(r.attrs.input, r.attrs.device, w);
          if (!b) continue;
          b.sign = sign;
          if (b.kind === 'axis') {
            const types = b.type === 'mouse' ? ['mouse', 'keyboard'] : [b.type];
            const opt = types.map((t) => inverts.get(`${t}:${b.instance}:${app}`)).find((v) => v !== undefined);
            b.invert = r.attrs.invert === '1' || opt === true;
          }
          const list = (out.bindings[app] ??= []);
          if (!list.some((x) => x.scInput === b.scInput && x.sign === b.sign)) { delete b.type; list.push(b); }
        }
      }
    }
    out.unknownActions = [...unknown];
  } catch (e) {
    w.push(`Could not read bindings: ${e?.message ?? e}`);
  }
  return out;
}

function allDesc(node, out = []) {
  for (const c of node.children) { out.push(c); allDesc(c, out); }
  return out;
}
