// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT
//
// Controls: bindings for keyboard, mouse, joysticks/HOTAS, pedals and gamepads; a setup wizard; and
// import of a Star Citizen bindings file. Device matching and the "move it to bind it" capture are adapted
// from Stay On Target (https://github.com/Adobe-Wan/stay-on-target, MIT).
//
// Model: six logical axes (f strafe fwd/back, l strafe left/right, u strafe up/down, roll, pitch, yaw), each
// driven by a device axis and/or a pair of buttons (pos / neg), plus two buttons (boost, brake).

const STORE = 'speedwall.controls.v2';
export const AXES = ['f', 'l', 'u', 'roll', 'pitch', 'yaw'];
export const BUTTONS = ['boost', 'brake'];

/** What the player flies with; the wizard's checkboxes. They shape the prompts. */
export const KINDS = ['keyboard', 'mouse', 'stick', 'pedals', 'gamepad'];

// The essential bindings, in Star Citizen's words, in the order the wizard asks for them.
// target: [logical axis, sign] or ['button', name]. pair: the step an axis capture also covers.
// short: the name used in conflict warnings. kb: the Star Citizen keyboard default. tip: advice per device kind.
// note: always shown. hint: the old one-line hint, kept for callers that read it.
export const STEPS = [
  { id: 'strafeUp', label: 'Strafe up', short: 'Strafe up', target: ['u', +1], pair: 'strafeDown', kb: 'Space', hint: 'Default: Space.' },
  { id: 'strafeDown', label: 'Strafe down', short: 'Strafe down', target: ['u', -1], pair: 'strafeUp', kb: 'Left Ctrl', hint: 'Default: Left Ctrl.' },
  { id: 'strafeLeft', label: 'Strafe left', short: 'Strafe left', target: ['l', -1], pair: 'strafeRight', kb: 'A', tip: { stick: 'A thumb stick on the throttle works too.', gamepad: 'Push the left stick left.' }, hint: 'Default: A. A thumb stick on the throttle works too.' },
  { id: 'strafeRight', label: 'Strafe right', short: 'Strafe right', target: ['l', +1], pair: 'strafeLeft', kb: 'D', hint: 'Default: D.' },
  { id: 'throttleFwd', label: 'Throttle forward', short: 'Throttle forward', target: ['f', +1], pair: 'throttleBack', kb: 'W', tip: { stick: 'Push a throttle lever fully forward.', gamepad: 'Push the left stick forward.' }, hint: 'Default: W. Push a throttle lever fully forward.' },
  { id: 'throttleBack', label: 'Throttle back', short: 'Throttle back', target: ['f', -1], pair: 'throttleFwd', kb: 'S', hint: 'Default: S.' },
  { id: 'pitchUp', label: 'Pitch (nose up)', short: 'Pitch up', target: ['pitch', +1], pair: 'pitchDown', mouse: 'y', mouseDefault: true, tip: { stick: 'Pull the stick back.', gamepad: 'Pull the right stick back.' }, hint: 'Pull the stick back. Default: the mouse.' },
  { id: 'pitchDown', label: 'Pitch (nose down)', short: 'Pitch down', target: ['pitch', -1], pair: 'pitchUp', mouse: 'y', note: 'Only asked if pitch is on keys or buttons.', hint: 'Only asked if pitch is on keys or buttons.' },
  { id: 'yawRight', label: 'Yaw (nose right)', short: 'Yaw right', target: ['yaw', +1], pair: 'yawLeft', mouse: 'x', mouseDefault: true, tip: { stick: 'Twist the stick right.', pedals: 'Push the right pedal.', gamepad: 'Push the right stick right.' }, hint: 'Twist the stick or press the right pedal. Default: the mouse.' },
  { id: 'yawLeft', label: 'Yaw (nose left)', short: 'Yaw left', target: ['yaw', -1], pair: 'yawRight', mouse: 'x', note: 'Only asked if yaw is on keys or buttons.', hint: 'Only asked if yaw is on keys or buttons.' },
  { id: 'boost', label: 'Boost (afterburner)', short: 'Boost', target: ['button', 'boost'], kb: 'Left Shift', note: 'Hold to boost.', hint: 'Default: Left Shift. Hold to boost.' },
  { id: 'rollLeft', label: 'Roll left', short: 'Roll left', target: ['roll', -1], pair: 'rollRight', kb: 'Q', hint: 'Default: Q.' },
  { id: 'rollRight', label: 'Roll right', short: 'Roll right', target: ['roll', +1], pair: 'rollLeft', kb: 'E', hint: 'Default: E.' },
  { id: 'brake', label: 'Spacebrake (optional)', short: 'Spacebrake', target: ['button', 'brake'], kb: 'X', hint: 'Default: X.' },
];
/** The rows of the summary: the six logical axes, then the two buttons. */
export const ROWS = ['f', 'l', 'u', 'roll', 'pitch', 'yaw', 'boost', 'brake'];
export const ROW_NAMES = { f: 'Throttle (strafe forward / back)', l: 'Strafe left / right', u: 'Strafe up / down', roll: 'Roll', pitch: 'Pitch', yaw: 'Yaw', boost: 'Boost', brake: 'Spacebrake' };
const ROW_SHORT = { f: 'Throttle', l: 'Strafe left / right', u: 'Strafe up / down', roll: 'Roll', pitch: 'Pitch', yaw: 'Yaw', boost: 'Boost', brake: 'Spacebrake' };
const rowOf = (st) => (st.target[0] === 'button' ? st.target[1] : st.target[0]);
/** Indices into STEPS of the steps that set one summary row, in wizard order. */
export const rowSteps = (row) => STEPS.map((s, i) => [s, i]).filter(([s]) => rowOf(s) === row).map(([, i]) => i);

const key = (code) => ({ t: 'key', code });
const emptyMap = () => ({
  axes: Object.fromEntries(AXES.map((a) => [a, { axis: null, pos: [], neg: [] }])),
  buttons: { boost: [], brake: [] },
  deadzone: 0.05,
  mouse: { enabled: false, sens: 1 },
  devices: [],
  kinds: [], // what the wizard was last told the player flies with (empty: not asked yet)
  source: 'none',
});
/** Star Citizen keyboard defaults (decoupled flight); pitch and yaw on the mouse. */
export function scDefaults() {
  const m = emptyMap();
  m.axes.f.pos = [key('KeyW')]; m.axes.f.neg = [key('KeyS')];
  m.axes.l.pos = [key('KeyD')]; m.axes.l.neg = [key('KeyA')];
  m.axes.u.pos = [key('Space')]; m.axes.u.neg = [key('ControlLeft')];
  m.axes.roll.pos = [key('KeyE')]; m.axes.roll.neg = [key('KeyQ')];
  m.axes.pitch.axis = { t: 'mouse', axis: 'y', inv: false };
  m.axes.yaw.axis = { t: 'mouse', axis: 'x', inv: false };
  m.buttons.boost = [key('ShiftLeft')]; m.buttons.brake = [key('KeyX')];
  m.source = 'defaults';
  return m;
}

// ---------- devices (from Stay On Target) ----------
// Browsers name the same device differently: Chrome/Edge say "T-Rudder (Vendor: 231d Product: 011f)",
// Firefox says "231d-11f-T-Rudder". Match on USB vendor + product, falling back to the cleaned-up name.
export const prettyName = (id) => (id || '').replace(/\s*\((STANDARD GAMEPAD\s*)?Vendor:.*\)\s*$/i, '').replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '').trim() || id;
export function devKey(id) {
  const m = /Vendor:\s*([0-9a-f]{1,4})\s*Product:\s*([0-9a-f]{1,4})/i.exec(id || '') || /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i.exec(id || '');
  return m ? m[1].toLowerCase().padStart(4, '0') + ':' + m[2].toLowerCase().padStart(4, '0') : prettyName(id).toLowerCase();
}
export function connectedPads() {
  const list = [], pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected !== false) list.push(p);
  list.sort((a, b) => a.index - b.index);
  const count = {}; // identical twins (two of the same stick) are told apart by order
  return list.map((p) => { const k = devKey(p.id); return { pad: p, id: p.id, key: k, nth: (count[k] = (count[k] ?? -1) + 1) }; });
}
const padFor = (b, pads) => {
  if (b.key === '*standard*') return (pads.find((d) => d.pad.mapping === 'standard') || {}).pad || null;
  return (pads.find((d) => d.key === b.key && d.nth === (b.nth || 0)) || {}).pad || null;
};
function snapshotAll() {
  const s = {};
  for (const d of connectedPads()) s[d.pad.index + '|' + d.id] = { axes: d.pad.axes.slice(), buttons: d.pad.buttons.map((b) => b.pressed) };
  return s;
}

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const KEY_NAMES = { ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', AltLeft: 'L Alt', AltRight: 'R Alt', Space: 'Space' };
export const keyName = (code) => KEY_NAMES[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ').replace(/^Arrow/, '');
export function describe(b) {
  if (!b) return '–';
  if (b.t === 'key') return keyName(b.code);
  if (b.t === 'mouse') return `Mouse ${b.axis === 'x' ? 'left/right' : 'up/down'}${b.inv ? ' (inverted)' : ''}`;
  const dev = b.key === '*standard*' ? 'Gamepad' : `${prettyName(b.id || b.key)}${b.nth ? ' #' + (b.nth + 1) : ''}`;
  return b.t === 'btn' ? `${dev} · button ${b.button + 1}` : `${dev} · axis ${b.axis + 1}${b.inv ? ' (inverted)' : ''}`;
}

// Rebuild a saved map from known fields only, dropping anything malformed.
const okBinding = (b) => !!b && typeof b === 'object' && (
  (b.t === 'key' && typeof b.code === 'string') || (b.t === 'mouse' && (b.axis === 'x' || b.axis === 'y')) ||
  ((b.t === 'btn' || b.t === 'axis') && typeof b.key === 'string' && Number.isInteger(b.t === 'btn' ? b.button : b.axis)));
const okList = (l) => (Array.isArray(l) ? l.filter(okBinding) : []);
function sanitize(j) {
  const m = emptyMap();
  for (const a of AXES) {
    const x = Object.hasOwn(j.axes, a) && j.axes[a] && typeof j.axes[a] === 'object' ? j.axes[a] : {};
    m.axes[a] = { axis: okBinding(x.axis) && x.axis.t !== 'key' && x.axis.t !== 'btn' ? x.axis : null, pos: okList(x.pos), neg: okList(x.neg) };
  }
  for (const n of BUTTONS) m.buttons[n] = okList(j.buttons && Object.hasOwn(j.buttons, n) ? j.buttons[n] : []);
  if (Number.isFinite(j.deadzone)) m.deadzone = Math.min(0.5, Math.max(0, j.deadzone));
  if (j.mouse && typeof j.mouse === 'object') m.mouse = { enabled: !!j.mouse.enabled, sens: Number.isFinite(j.mouse.sens) ? j.mouse.sens : 1 };
  if (typeof j.source === 'string') m.source = j.source;
  if (Array.isArray(j.kinds)) m.kinds = KINDS.filter((k) => j.kinds.includes(k));
  return m;
}
// Some browsers report a joystick hat as an axis that rests outside -1..1 (e.g. 1.2857): never treat it as an axis.
const isHat = (v) => Math.abs(v) > 1.05;

// ---------- pure helpers (tested in tools/tests/controls.test.mjs) ----------
/** "A", "A and B", "A, B and C". */
export const andList = (l) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`);
/** One physical input: the same key, the same button or axis of the same device (vendor:product + twin number), or a mouse axis. */
export function bindingId(b) {
  if (!b) return null;
  if (b.t === 'key') return 'k:' + b.code;
  if (b.t === 'btn') return `b:${b.key}#${b.nth || 0}:${b.button}`;
  if (b.t === 'axis') return `a:${b.key}#${b.nth || 0}:${b.axis}`;
  if (b.t === 'mouse') return 'm:' + b.axis;
  return null;
}
const stepFor = (row, sign) => STEPS.find((s) => s.target[0] === row && s.target[1] === sign);
/** Every place a map uses each input: Map id → [{ row, slot: 'axis'|'pos'|'neg'|'btn', name, binding }]. */
function usage(m) {
  const u = new Map();
  const add = (b, row, slot, name) => {
    const id = bindingId(b); if (!id) return;
    const l = u.get(id) || []; u.set(id, l);
    if (!l.some((s) => s.row === row && s.slot === slot)) l.push({ row, slot, name, binding: b });
  };
  for (const a of AXES) {
    const x = m.axes[a];
    if (x.axis) add(x.axis, a, 'axis', ROW_SHORT[a]);
    for (const b of x.pos) add(b, a, 'pos', stepFor(a, 1).short);
    for (const b of x.neg) add(b, a, 'neg', stepFor(a, -1).short);
  }
  for (const n of BUTTONS) for (const b of m.buttons[n]) add(b, n, 'btn', ROW_SHORT[n]);
  return u;
}
/**
 * Inputs bound to two different rows, or to both directions of one row.
 * @returns {{ binding: object, rows: string[], names: string[], text: string }[]}
 */
export function findConflicts(m) {
  const out = [];
  for (const slots of usage(m).values()) {
    if (slots.length < 2) continue;
    const names = slots.map((s) => s.name);
    out.push({ binding: slots[0].binding, rows: [...new Set(slots.map((s) => s.row))], names, text: `${describe(slots[0].binding)} is bound to ${andList(names)}` });
  }
  return out;
}
/** Where else a draft already uses the input `b`, other than the given row/slot. */
export function otherUses(m, b, row, slot) {
  return (usage(m).get(bindingId(b)) || []).filter((s) => !(s.row === row && s.slot === slot));
}
/** True when any pad (joystick, pedals, gamepad) input is bound: then the automatic gamepad layout is off. */
export function anyPadBinding(m) {
  return AXES.some((a) => m.axes[a].axis?.t === 'axis' || [...m.axes[a].pos, ...m.axes[a].neg].some((b) => b.t === 'btn'))
    || BUTTONS.some((n) => m.buttons[n].some((b) => b.t === 'btn'));
}
const rowEmpty = (m, r) => (BUTTONS.includes(r) ? !m.buttons[r].length : !m.axes[r].axis && !m.axes[r].pos.length && !m.axes[r].neg.length);
function clearRow(m, r) { if (BUTTONS.includes(r)) m.buttons[r] = []; else m.axes[r] = { axis: null, pos: [], neg: [] }; }
function copyRow(from, to, r) { if (BUTTONS.includes(r)) to.buttons[r] = from.buttons[r]; else to.axes[r] = from.axes[r]; }
/** Plain-text description of one row's bindings. */
export function rowText(m, r) {
  if (BUTTONS.includes(r)) return m.buttons[r].map(describe).join(' / ') || 'not bound';
  const x = m.axes[r], parts = [];
  if (x.axis) parts.push(describe(x.axis));
  if (x.pos.length || x.neg.length) parts.push(`${x.neg.map(describe).join(' / ') || '–'} ↔ ${x.pos.map(describe).join(' / ') || '–'}`);
  return parts.join(' · ') || 'not bound';
}
/**
 * The instruction for one wizard step, shaped by the kinds of device the player picked.
 * @param {object} st a STEPS entry
 * @param {Set<string>} kinds
 * @param {boolean} [buttonsOnly] only keys and buttons are taken (binding reverse thrust next to a throttle axis)
 * @returns {{ text: string, tip: string, mouse: boolean }}
 */
export function stepPrompt(st, kinds, buttonsOnly = false) {
  const kb = kinds.has('keyboard'), js = kinds.has('stick'), gp = kinds.has('gamepad'), ped = kinds.has('pedals');
  const isBtn = buttonsOnly || st.target[0] === 'button';
  const yawPedal = ped && st.target[0] === 'yaw' && !isBtn;
  const mouse = !isBtn && !!st.mouse && kinds.has('mouse');
  const ways = [];
  if (yawPedal) ways.push('press a pedal (or twist the stick)');
  const press = [];
  if (kb || (!js && !gp && !ped && !mouse)) press.push('key');
  if (js || gp || ped) press.push('button');
  if (gp) press.push('trigger');
  if (press.length) ways.push('press a ' + (press.length === 3 ? `${press[0]}, ${press[1]} or ${press[2]}` : press.join(' or ')));
  if (!isBtn) {
    const mv = [];
    if ((js || ped) && !yawPedal) mv.push('an axis');
    if (gp) mv.push('a stick');
    if (mv.length) ways.push('move ' + mv.join(' or '));
  }
  if (mouse) ways.push('use the mouse');
  const text = ways.join(', or ');
  const tips = [];
  if (!isBtn && st.tip) for (const k of ['stick', 'pedals', 'gamepad']) if (kinds.has(k) && st.tip[k] && !(k === 'stick' && yawPedal)) tips.push(st.tip[k]);
  if (kb && st.kb) tips.push(`Default: ${st.kb}.`);
  else if (mouse && st.mouseDefault) tips.push('Default: the mouse.');
  if (st.note && !(buttonsOnly && st.note.startsWith('Only asked'))) tips.push(st.note);
  return { text: text[0].toUpperCase() + text.slice(1) + '.', tip: tips.join(' '), mouse };
}

// New styles for the controls dialog. The rest (.binds, .brow, .ask, .meter, .kinds...) live in index.html.
const CSS = `
dialog .c-conf { display: flex; gap: 10px; align-items: center; justify-content: space-between; border: 1px solid var(--line); border-left: 3px solid var(--tvi); border-radius: 6px; padding: 6px 8px 6px 10px; margin: 0 0 10px; font-size: .82rem; }
dialog .c-conf p { margin: 0; min-width: 0; overflow-wrap: anywhere; }
dialog .c-conf.warn { border-left-color: var(--warn); }
dialog .c-warnline { display: block; color: var(--warn); margin-top: 2px; }
dialog button.c-act { padding: 4px 10px; font-size: .75rem; flex: none; }
dialog .c-box { border: 1px solid var(--line); border-left: 3px solid var(--warn); border-radius: 6px; padding: 6px 10px; margin: 0 0 10px; font-size: .8rem; }
dialog .c-box p { margin: 2px 0; }
dialog .c-box.c-auto { border-left-color: var(--line-strong); color: var(--muted); }
dialog .c-box.c-auto b { color: var(--fg); }
dialog .binds .brow.conflict .what { color: var(--warn); }
dialog .binds .opts { align-items: center; margin-bottom: 6px; }
dialog .c-flag { margin-right: 4px; }
dialog .c-note { flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; color: var(--fg); font-size: .78rem; }
dialog button:disabled { opacity: .45; cursor: default; }
dialog .c-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
dialog h2:focus, dialog .ask:focus { outline: none; }
`;
function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('controls-css')) return;
  const s = document.createElement('style');
  s.id = 'controls-css'; s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * @param {{ dialog: HTMLDialogElement, body: HTMLElement, status: HTMLElement, onFly?: () => void }} ui
 */
export function createControls(ui) {
  injectCss();
  let map = null;
  try {
    const j = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (j && typeof j === 'object' && j.axes && typeof j.axes === 'object') map = sanitize(j); // a partial or damaged save can't break the page
  } catch { /* private mode or bad JSON: start fresh */ }
  const firstRun = !map;
  if (!map) map = scDefaults();
  let saved = !firstRun;
  // Every save tells the page (window 'controls-changed'), so it can refresh key hints on its buttons.
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(map)); } catch { /* ignore */ }
    saved = true;
    try { window.dispatchEvent(new window.CustomEvent('controls-changed', { detail: { source: map.source } })); } catch { /* ignore */ }
  };

  // ---------- mouse as a virtual stick (pitch / yaw) ----------
  // With pointer lock, mouse movement moves a virtual stick; it stays where you leave it, like the game's
  // mouse flight. Click the pilot view to lock the pointer, Esc to release; middle click or C re-centres.
  const mouse = { x: 0, y: 0, locked: false };
  const MOUSE_RANGE = 240; // px of movement for full deflection, divided by sensitivity
  function mouseMove(dx, dy) {
    if (!map.mouse.enabled || !mouse.locked) return;
    const r = MOUSE_RANGE / (map.mouse.sens || 1);
    mouse.x = Math.max(-1, Math.min(1, mouse.x + dx / r));
    mouse.y = Math.max(-1, Math.min(1, mouse.y - dy / r));
  }
  const mouseCenter = () => { mouse.x = 0; mouse.y = 0; };

  // ---------- reading ----------
  const out = { f: undefined, l: undefined, u: undefined, roll: undefined, pitch: undefined, yaw: undefined, boost: false, brake: false, rollIsButton: false };
  function pressed(b, keys, pads) {
    if (b.t === 'key') return keys.has(b.code);
    if (b.t === 'btn') { const p = padFor(b, pads); return !!(p && p.buttons[b.button] && p.buttons[b.button].pressed); }
    return false;
  }
  function axisValue(b, pads) {
    const dz = map.deadzone;
    let v;
    if (b.t === 'mouse') { if (!map.mouse.enabled || !mouse.locked) return undefined; v = b.axis === 'x' ? mouse.x : mouse.y; if (b.inv) v = -v; return Math.abs(v) < 0.02 ? 0 : v; }
    const p = padFor(b, pads); if (!p) return undefined;
    v = p.axes[b.axis]; if (v == null || isHat(v)) return undefined;
    v = Math.max(-1, Math.min(1, b.inv ? -v : v));
    if (b.mode === 'throttle') { // a throttle lever is always in charge: at the back it means 0 %, not "not in use"
      v = (v + 1) / 2;
      return v < dz ? 0 : (v - dz) / (1 - dz);
    }
    if (Math.abs(v) < dz) return undefined;
    return Math.sign(v) * (Math.abs(v) - dz) / (1 - dz);
  }
  /** Current input from bound devices. Axes are undefined when nothing bound is active, so on-screen controls still work. */
  function read(keys) {
    const pads = connectedPads();
    const padBound = anyPadBinding(map);
    for (const a of AXES) {
      const m = map.axes[a];
      const bv = m.pos.reduce((s, b) => s + (pressed(b, keys, pads) ? 1 : 0), 0) - m.neg.reduce((s, b) => s + (pressed(b, keys, pads) ? 1 : 0), 0);
      out[a] = bv ? Math.max(-1, Math.min(1, bv)) : m.axis ? axisValue(m.axis, pads) : undefined;
      if (a === 'roll') out.rollIsButton = !!bv; // keys/buttons roll at the chosen rate; an axis is analog
    }
    for (const n of BUTTONS) out[n] = map.buttons[n].some((b) => pressed(b, keys, pads));
    // No controller bound yet: a standard-layout gamepad works out of the box. Left stick strafes,
    // right stick pitches/yaws, bumpers strafe down/up, triggers roll, A boosts, B spacebrakes.
    if (!padBound) {
      const gp = pads.find((d) => d.pad.mapping === 'standard');
      if (gp) {
        const p = gp.pad, btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed), dz = map.deadzone;
        const sh = (v) => (Math.abs(v) < dz ? undefined : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz));
        out.f ??= sh(-(p.axes[1] || 0)); out.l ??= sh(p.axes[0] || 0);
        out.yaw ??= sh(p.axes[2] || 0); out.pitch ??= sh(-(p.axes[3] || 0));
        const ud = (btn(5) ? 1 : 0) - (btn(4) ? 1 : 0); if (ud) out.u = ud;
        const rl = (p.buttons[7]?.value || 0) - (p.buttons[6]?.value || 0); if (Math.abs(rl) > dz && out.roll == null) out.roll = rl;
        out.boost ||= btn(0); out.brake ||= btn(1);
      }
    }
    return out;
  }
  /** Keyboard codes bound to anything: the page claims these keys. */
  function flightKeys() {
    const s = new Set();
    const add = (b) => { if (b.t === 'key') s.add(b.code); };
    for (const a of AXES) { map.axes[a].pos.forEach(add); map.axes[a].neg.forEach(add); }
    for (const n of BUTTONS) map.buttons[n].forEach(add);
    return s;
  }

  // ---------- wizard ----------
  const dlg = ui.dialog, body = ui.body;
  // wiz: { stage: 'devices' | 'steps', kinds: Set, mode: 'full' | 'rebind' | 'reverse', row, seq: STEPS indices to ask,
  //        pos: index into seq, draft, done: Set of step ids, history: [], held: Set, settle, base,
  //        last: what the previous step captured (shown with Undo), buttonsOnly }
  let wiz = null;
  let keyCapture = null;
  // Keys held in the dialog (for the summary's live values) and keys still held from the last capture.
  const dlgKeys = new Set();
  let notice = '', noticeUndo = null, pendingFocus = null;
  // A change to one row turns the keyboard defaults into the player's own setup.
  const custom = () => { if (map.source === 'defaults' || map.source === 'none') map.source = 'wizard'; };

  function status() {
    const pads = connectedPads(), n = pads.length;
    const src = { defaults: 'Star Citizen keyboard defaults', wizard: 'your setup', import: 'your Star Citizen bindings' }[map.source] || 'not set up';
    ui.status.textContent = `Controls: ${src}${map.mouse.enabled ? ' · mouse flies the nose' : ''}${n ? ` · ${n} controller${n > 1 ? 's' : ''} connected` : ''}.`;
  }

  // After every re-render, focus moves somewhere sensible: the question in the wizard, the control that was
  // just used in the summary, or else the dialog's heading.
  const heading = () => { const h = dlg.querySelector('h2'); if (h && !h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); return h; };
  function placeFocus() {
    if (!dlg.open) return;
    let el = null;
    if (wiz?.stage === 'steps') el = body.querySelector('.ask');
    else if (pendingFocus) el = body.querySelector(pendingFocus);
    pendingFocus = null;
    if (el && !el.disabled) el.focus({ preventScroll: el.classList.contains('ask') });
    else heading()?.focus({ preventScroll: true });
  }
  function render() {
    if (!wiz) renderSummary();
    else if (wiz.stage === 'devices') renderDevices();
    else renderStep();
    placeFocus();
  }
  // What the player flies with: what they told the wizard last time, plus whatever is plugged in now.
  function guessKinds() {
    const k = new Set(map.kinds?.length ? map.kinds : ['keyboard']);
    if (map.mouse.enabled) k.add('mouse');
    for (const d of connectedPads()) k.add(d.pad.mapping === 'standard' ? 'gamepad' : 'stick');
    return k;
  }

  function renderDevices() {
    const kinds = wiz.kinds;
    const box = (k, label, hint) => `<label class="kind"><input type="checkbox" data-kind="${k}" ${kinds.has(k) ? 'checked' : ''}><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
    body.innerHTML = `<p class="lead">What will you fly with? Pick everything you use. Next, you press each control once, the way Star Citizen asks for bindings.</p>
      <div class="kinds">
        ${box('keyboard', 'Keyboard', 'e.g. W A S D, Space, Ctrl, Q E, Shift')}
        ${box('mouse', 'Mouse', 'e.g. moves the nose (pitch and yaw)')}
        ${box('stick', 'Joystick / HOTAS', 'e.g. sticks and throttles')}
        ${box('pedals', 'Pedals', '')}
        ${box('gamepad', 'Gamepad', 'e.g. an Xbox-style controller')}
      </div>
      <p class="keys" id="wiz-kinds-msg" role="status"></p>
      <p class="keys" id="wiz-pads">${padLine()}</p>
      <div class="row">
        <button id="wiz-next" class="primary">Set my controls</button>
        <button id="wiz-defaults">Use Star Citizen keyboard defaults</button>
      </div>
      <details class="import"><summary>Import my Star Citizen bindings file</summary>
        <p class="keys">In Star Citizen: <em>Options → Keybindings → Control Profiles → Save/export</em>. The game keeps your live bindings in:</p>
        <p class="path"><code id="wiz-path"></code> <button id="wiz-copy" type="button">Copy path</button></p>
        <p class="keys">Browsers can't open a folder for you: paste the path into the file picker's address bar, or drag the file onto this box.</p>
        <label class="file"><input type="file" id="wiz-file" accept=".xml,text/xml"> Choose actionmaps.xml…</label>
        <p class="keys" id="wiz-import-msg"></p>
      </details>`;
    const next = body.querySelector('#wiz-next'), kmsg = body.querySelector('#wiz-kinds-msg');
    // Nothing to press with: nothing to set up.
    const sync = () => { next.disabled = !kinds.size; kmsg.textContent = kinds.size ? '' : 'Pick the keyboard or at least one device to set your controls.'; };
    body.querySelectorAll('[data-kind]').forEach((c) => (c.onchange = () => { if (c.checked) kinds.add(c.dataset.kind); else kinds.delete(c.dataset.kind); sync(); }));
    sync();
    next.onclick = () => startSteps();
    body.querySelector('#wiz-defaults').onclick = () => {
      map = scDefaults(); map.mouse.enabled = kinds.has('mouse'); map.kinds = KINDS.filter((k) => kinds.has(k));
      save(); wiz = null; status(); notice = 'Using the Star Citizen keyboard defaults.'; render();
    };
    setupImport();
  }
  const padLine = () => { const pads = connectedPads(); return pads.length ? `Connected: ${pads.map((d) => esc(prettyName(d.id))).join(', ')}.` : 'No controller seen yet. Press any button on it: browsers only show controllers after you use them.'; };

  function startSteps() {
    const d = emptyMap();
    d.mouse = { ...map.mouse, enabled: wiz.kinds.has('mouse') };
    d.deadzone = map.deadzone;
    d.kinds = KINDS.filter((k) => wiz.kinds.has(k));
    begin({ mode: 'full', seq: STEPS.map((_, i) => i), draft: d });
  }
  function begin(o) {
    wiz = { kinds: wiz?.kinds || guessKinds(), row: null, buttonsOnly: false, ...o, stage: 'steps', pos: 0, done: new Set(), base: snapshotAll(), history: [], held: new Set(), settle: null, last: null };
    render();
  }
  /**
   * Rebind one summary row: a small wizard for just that row's steps, with the same capture rules. With
   * `reverse`, only "Throttle back" is asked (keys and buttons only) and added next to the throttle axis.
   * The draft is the whole map, so a capture that duplicates another row's binding is flagged.
   */
  function startRebind(row, reverse = false) {
    const d = structuredClone(map);
    if (!reverse) clearRow(d, row);
    begin({ mode: reverse ? 'reverse' : 'rebind', row, seq: reverse ? [STEPS.findIndex((s) => s.id === 'throttleBack')] : rowSteps(row), draft: d, buttonsOnly: reverse });
  }
  const curStep = () => STEPS[wiz.seq[wiz.pos]];
  const lastLine = (l) => (l.skipped ? `Skipped ${l.label}.` : `✓ ${l.label} → ${l.text}${l.both ? ' (covers both directions)' : ''}`);
  function renderStep() {
    const st = curStep(), n = wiz.seq.length, last = wiz.last;
    const pr = stepPrompt(st, wiz.kinds, wiz.buttonsOnly);
    const where = wiz.mode === 'full' ? `Step ${wiz.pos + 1} of ${n}` : wiz.mode === 'reverse' ? 'Reverse thrust'
      : `Rebind ${ROW_SHORT[wiz.row]}${n > 1 ? `, step ${wiz.pos + 1} of ${n}` : ''}`;
    // What the previous step captured, with Undo (the same as Back), at the top of the next step.
    const conf = last ? `<div class="c-conf${last.warn ? ' warn' : ''}"><p>${esc(lastLine(last))}${last.warn ? `<span class="c-warnline">⚠ ${esc(last.warn)}</span>` : ''}</p><button type="button" id="wiz-undo" class="c-act">Undo</button></div>` : '';
    body.innerHTML = `${conf}<p class="keys" role="status">${last ? `<span class="c-sr">${esc(lastLine(last))}${last.warn ? ' ' + esc(last.warn) : ''} </span>` : ''}${esc(where)}: ${esc(st.label)}</p>
      <p class="ask" tabindex="-1">${esc(st.label)}</p>
      <p class="keys" id="wiz-how">${esc(pr.text)}${pr.tip ? ' ' + esc(pr.tip) : ''}</p>
      <p class="c-box" id="wiz-wait" role="status" ${wiz.settle?.release ? '' : 'hidden'}>Let go of ${esc(wiz.settle?.release?.name || 'the control')}: return it to where it started, then move the next control. <button type="button" id="wiz-go" class="c-act">It rests here</button></p>
      <div class="meter" aria-hidden="true"><i id="wiz-live"></i></div>
      <p class="keys" id="wiz-pads">${padLine()}</p>
      <div class="row">
        ${pr.mouse ? `<button id="wiz-mouse" class="primary">Use the mouse</button>` : ''}
        <button id="wiz-skip">Skip</button><button id="wiz-back" ${wiz.history.length ? '' : 'disabled'}>Back</button><button id="wiz-stop">Cancel</button>
      </div>`;
    body.querySelector('#wiz-skip').onclick = () => { remember(); wiz.last = { skipped: true, label: st.label }; advance(); };
    body.querySelector('#wiz-back').onclick = goBack;
    // a lever that really rests somewhere else (e.g. a throttle left at 100 %): listen from here
    body.querySelector('#wiz-go').onclick = () => { if (wiz.settle) wiz.settle.release = null; body.querySelector('#wiz-wait').hidden = true; };
    if (last) body.querySelector('#wiz-undo').onclick = goBack;
    body.querySelector('#wiz-stop').onclick = () => {
      if (wiz.mode !== 'full') pendingFocus = `[data-rebind="${wiz.row}"]`;
      wiz = null; render();
    };
    if (pr.mouse) body.querySelector('#wiz-mouse').onclick = () => bindCaptured({ t: 'mouse', axis: st.mouse, inv: false }, true);
    keyCapture = (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') return;
      // Enter/Space on a focused wizard button press the button (keyboard users need Skip, Back, Undo, Cancel)
      if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && e.target.closest?.('button, summary, input, select')) return;
      e.preventDefault(); e.stopPropagation();
      if (e.repeat || wiz.held.has(e.code)) return; // auto-repeat, or still holding the key bound a step ago
      wiz.held.add(e.code);
      bindCaptured(key(e.code), false);
    };
  }
  const remember = () => wiz.history.push({ pos: wiz.pos, draft: structuredClone(wiz.draft), done: new Set(wiz.done), last: wiz.last });
  // Back (and Undo) undoes the previous step completely: its binding, and any step its axis covered.
  function goBack() {
    const h = wiz.history.pop(); if (!h) return;
    Object.assign(wiz, { pos: h.pos, draft: h.draft, done: h.done, last: h.last, settle: { frames: 0, last: null, release: null }, base: null });
    render();
  }
  const addOnce = (l, b) => { if (!l.some((x) => bindingId(x) === bindingId(b))) l.push(b); };
  // Store a captured control for the current step. An axis covers both directions of the step's logical
  // axis, so the paired step is skipped. A control the draft already uses elsewhere is still bound, with a warning.
  function bindCaptured(b, isAxis) {
    const st = curStep(), d = wiz.draft, [a, sign] = st.target;
    const slot = a === 'button' ? 'btn' : isAxis ? 'axis' : sign > 0 ? 'pos' : 'neg';
    const others = otherUses(d, b, rowOf(st), slot);
    remember();
    if (a === 'button') addOnce(d.buttons[sign], b);
    else if (isAxis) { d.axes[a].axis = b; if (st.pair) wiz.done.add(st.pair); if (b.t === 'mouse') d.mouse.enabled = true; }
    else addOnce(sign > 0 ? d.axes[a].pos : d.axes[a].neg, b);
    wiz.done.add(st.id);
    wiz.last = { label: st.label, text: describe(b), both: isAxis && !!st.pair, warn: others.length ? `${describe(b)} is also bound to ${andList(others.map((s) => s.name))}.` : '' };
    advance();
  }
  function advance() {
    do wiz.pos++; while (wiz.pos < wiz.seq.length && wiz.done.has(curStep().id));
    // Don't listen again until every control is back at rest: releasing the axis just bound must not bind it
    // to the next step.
    wiz.base = null; wiz.settle = { frames: 0, last: null, release: wiz.release || null }; wiz.release = null;
    if (wiz.pos >= wiz.seq.length) finishWizard();
    render();
  }
  function finishWizard() {
    const d = wiz.draft, row = wiz.row;
    keyCapture = null;
    if (wiz.mode === 'full') {
      const def = scDefaults();
      // anything skipped keeps its Star Citizen keyboard default
      for (const a of AXES) if (!d.axes[a].axis && !d.axes[a].pos.length && !d.axes[a].neg.length) d.axes[a] = def.axes[a];
      for (const n of BUTTONS) if (!d.buttons[n].length) d.buttons[n] = def.buttons[n];
      map = { ...d, source: 'wizard' }; save();
      notice = 'Saved. Anything you skipped keeps its Star Citizen keyboard default.';
    } else {
      // Only this row changes; the rest of the draft was there to spot conflicts.
      const before = structuredClone(map);
      let changed = false;
      if (wiz.mode === 'reverse') {
        if (d.axes.f.neg.length) { map.axes.f.neg = d.axes.f.neg; changed = true; notice = `Throttle back: ${d.axes.f.neg.map(describe).join(' / ')}.`; }
      } else if (!rowEmpty(d, row)) {
        copyRow(d, map, row); changed = true;
        if (map.axes[row]?.axis?.t === 'mouse') map.mouse.enabled = true;
        notice = `${ROW_NAMES[row]}: ${rowText(map, row)}.`;
      }
      if (changed) { custom(); save(); noticeUndo = before; } else notice = `Nothing captured: ${ROW_NAMES[row]} is unchanged.`;
      pendingFocus = `[data-rebind="${row}"]`;
    }
    wiz = null; status();
  }
  // Wait until the axis just bound is back where it started (a held stick must not bind the next step when
  // it is released), then until no axis has moved for ~15 frames, before taking the new step's baseline.
  function settled() {
    const snap = snapshotAll(), st = wiz.settle, r = st.release;
    const wait = body.querySelector('#wiz-wait');
    if (r && snap[r.k] && Math.abs((snap[r.k].axes[r.i] ?? r.start) - r.start) > 0.25) {
      st.frames = 0; st.last = snap;
      if (wait) wait.hidden = false;
      return false;
    }
    if (r) { st.release = null; if (wait) wait.hidden = true; }
    const moved = !st.last || Object.keys(snap).some((k) => !st.last[k] || snap[k].axes.some((v, i) => Math.abs(v - (st.last[k].axes[i] ?? v)) > 0.02));
    st.last = snap; st.frames = moved ? 0 : st.frames + 1;
    if (st.frames < 15) return false;
    wiz.base = snap; wiz.settle = null; return true;
  }
  function tickStep() {
    const st = curStep(), pads = connectedPads();
    const np = body.querySelector('#wiz-pads'); if (np) np.innerHTML = padLine();
    if (wiz.settle && !settled()) return;
    for (const d of pads) { // a controller that appeared during this step: take its baseline now
      const k = d.pad.index + '|' + d.id;
      if (!wiz.base[k]) wiz.base[k] = { axes: d.pad.axes.slice(), buttons: d.pad.buttons.map((b) => b.pressed) };
    }
    for (const d of pads) { // a new button press
      const b0 = (wiz.base[d.pad.index + '|' + d.id] || {}).buttons || [];
      const i = d.pad.buttons.findIndex((b, k) => b.pressed && !b0[k]);
      if (i >= 0) return bindCaptured({ t: 'btn', id: d.id, key: d.key, nth: d.nth, button: i }, false);
    }
    if (st.target[0] === 'button' || wiz.buttonsOnly) return;
    let best = null; // the axis that moved furthest since the step began
    for (const d of pads) {
      const a0 = (wiz.base[d.pad.index + '|' + d.id] || {}).axes || [];
      d.pad.axes.forEach((v, i) => {
        if (isHat(v) || isHat(a0[i] ?? 0)) return; // a hat reported as an axis
        const delta = v - (a0[i] ?? v);
        if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { d, i, delta, start: a0[i] ?? v };
      });
    }
    const live = body.querySelector('#wiz-live'); if (live) live.style.width = (best ? Math.min(1, Math.abs(best.delta) / 0.8) * 100 : 0) + '%';
    if (best && Math.abs(best.delta) > 0.6) {
      const inv = Math.sign(best.delta) !== st.target[1];
      const b = { t: 'axis', id: best.d.id, key: best.d.key, nth: best.d.nth, axis: best.i, inv };
      // a throttle rests at one end of its travel: treat it as 0 → 100 % forward
      if (st.target[0] === 'f') b.mode = Math.abs(best.start) > 0.9 ? 'throttle' : 'centered';
      wiz.release = { k: best.d.pad.index + '|' + best.d.id, i: best.i, start: best.start, name: describe(b) };
      bindCaptured(b, true);
    }
  }

  // ---------- summary ----------
  // A standard-layout gamepad flies with no setup while nothing is bound to any pad (see read()).
  const autoPad = () => !anyPadBinding(map) && connectedPads().some((d) => d.pad.mapping === 'standard');
  function renderSummary() {
    keyCapture = null;
    const conflicts = findConflicts(map), bad = new Set(conflicts.flatMap((c) => c.rows));
    const rows = ROWS.map((r) => {
      const m = AXES.includes(r) ? map.axes[r] : null, flag = bad.has(r);
      let opts = `<button type="button" class="c-act" data-rebind="${r}" aria-label="Rebind ${esc(ROW_NAMES[r])}">Rebind</button>`
        + `<button type="button" class="c-act" data-clear="${r}" aria-label="Clear ${esc(ROW_NAMES[r])}"${rowEmpty(map, r) ? ' disabled' : ''}>Clear</button>`;
      if (m?.axis && m.axis.t !== 'key') opts += `<label class="tog"><input type="checkbox" data-inv="${r}" ${m.axis.inv ? 'checked' : ''}> Invert</label>`;
      if (r === 'f' && m.axis?.t === 'axis') {
        opts += `<label class="tog">Range <select data-mode="f"><option value="centered" ${m.axis.mode !== 'throttle' ? 'selected' : ''}>centred (back ↔ forward)</option><option value="throttle" ${m.axis.mode === 'throttle' ? 'selected' : ''}>throttle (0 → 100 %)</option></select></label>`;
        // a throttle lever only goes 0 → 100 %: reverse thrust needs a button
        if (m.axis.mode === 'throttle' && !m.neg.length) opts += `<span class="c-note">No reverse: bind Throttle back to a button for reverse thrust. <button type="button" class="c-act" data-reverse>Bind reverse</button></span>`;
      }
      const what = `${flag ? '<span class="c-flag" aria-hidden="true">⚠</span>' : ''}${esc(ROW_NAMES[r])}${flag ? '<span class="c-sr"> (conflict)</span>' : ''}`;
      return `<div class="brow${flag ? ' conflict' : ''}" data-row="${r}"><span class="what">${what}</span><span class="src">${esc(rowText(map, r))}</span><span class="live" id="c-v-${r}">–</span><span class="opts">${opts}</span></div>`;
    }).join('');
    const undo = noticeUndo; noticeUndo = null;
    body.innerHTML = `${notice ? `<p class="notice" role="status">${esc(notice)}${undo ? ' <button type="button" id="c-undo" class="c-act">Undo</button>' : ''}</p>` : ''}
      ${conflicts.length ? `<div class="c-box c-conflicts" id="c-conflicts">${conflicts.map((c) => `<p>⚠ ${esc(c.text)}.</p>`).join('')}<p class="keys">Rebind or clear one of them.</p></div>` : ''}
      <div class="c-box c-auto" id="c-auto" ${autoPad() ? '' : 'hidden'}><p><b>Gamepad (automatic):</b> left stick strafes forward/back and left/right, right stick pitches and yaws, bumpers strafe down/up, triggers roll, A boosts, B spacebrakes. Binding any control to a controller turns this off.</p></div>
      <p class="keys">${firstRun && map.source === 'defaults' ? 'Using the Star Citizen keyboard defaults. ' : ''}Move each control to check it. Saved in this browser.</p>
      <div class="binds">${rows}</div>
      <div class="set">
        <span>Deadzone</span><input type="range" id="c-dz" min="0" max="25" value="${Math.round(map.deadzone * 100)}" aria-label="Axis deadzone"><output id="c-dz-v">${Math.round(map.deadzone * 100)}%</output>
        <span>Mouse</span><label class="tog"><input type="checkbox" id="c-mouse" ${map.mouse.enabled ? 'checked' : ''}> Mouse flies the nose</label><span></span>
        <span>Mouse speed</span><input type="range" id="c-sens" min="25" max="300" value="${Math.round((map.mouse.sens || 1) * 100)}" aria-label="Mouse sensitivity"><output id="c-sens-v">${Math.round((map.mouse.sens || 1) * 100)}%</output>
      </div>
      <p class="keys">Mouse flight: click the cockpit view to capture the mouse, Esc to release it, middle-click or <kbd>C</kbd> to centre the nose.</p>
      <div class="row">
        <button id="c-wizard" class="primary">Set up controls again</button>
        <button id="c-defaults">Star Citizen keyboard defaults</button>
        <button id="c-fly">Fly full screen</button>
        <button id="c-close">Done</button>
      </div>`;
    notice = '';
    if (undo) body.querySelector('#c-undo').onclick = () => { map = undo; save(); status(); notice = 'Undone.'; render(); };
    body.querySelectorAll('[data-rebind]').forEach((b) => (b.onclick = () => startRebind(b.dataset.rebind)));
    body.querySelectorAll('[data-clear]').forEach((b) => (b.onclick = () => {
      const r = b.dataset.clear, before = structuredClone(map);
      clearRow(map, r); custom(); save(); status();
      notice = `Cleared ${ROW_NAMES[r]}.`; noticeUndo = before; pendingFocus = `[data-rebind="${r}"]`; render();
    }));
    body.querySelector('[data-reverse]')?.addEventListener('click', () => startRebind('f', true));
    body.querySelector('#c-wizard').onclick = () => open(true);
    body.querySelector('#c-defaults').onclick = () => {
      const before = structuredClone(map), mouseOn = map.mouse.enabled, kinds = map.kinds;
      map = scDefaults(); map.mouse.enabled = mouseOn; map.kinds = kinds; save(); status();
      notice = 'Star Citizen keyboard defaults restored.'; noticeUndo = before; pendingFocus = '#c-defaults'; render();
    };
    body.querySelector('#c-close').onclick = () => dlg.close();
    body.querySelector('#c-fly').onclick = () => { dlg.close(); ui.onFly?.(); };
    body.querySelector('#c-dz').oninput = (e) => { map.deadzone = +e.target.value / 100; body.querySelector('#c-dz-v').textContent = `${e.target.value}%`; save(); };
    body.querySelector('#c-sens').oninput = (e) => { map.mouse.sens = +e.target.value / 100; body.querySelector('#c-sens-v').textContent = `${e.target.value}%`; save(); };
    body.querySelector('#c-mouse').onchange = (e) => {
      map.mouse.enabled = e.target.checked;
      if (map.mouse.enabled) { map.axes.pitch.axis ??= { t: 'mouse', axis: 'y', inv: false }; map.axes.yaw.axis ??= { t: 'mouse', axis: 'x', inv: false }; }
      save(); status(); pendingFocus = '#c-mouse'; render();
    };
    body.querySelectorAll('[data-inv]').forEach((c) => (c.onchange = () => { map.axes[c.dataset.inv].axis.inv = c.checked; save(); pendingFocus = `[data-inv="${c.dataset.inv}"]`; render(); }));
    body.querySelectorAll('[data-mode]').forEach((c) => (c.onchange = () => { map.axes.f.axis.mode = c.value; save(); pendingFocus = '[data-mode="f"]'; render(); }));
  }
  function tickSummary(keys) {
    const v = read(new Set([...keys, ...dlgKeys]));
    for (const a of AXES) { const e = body.querySelector('#c-v-' + a); if (e) e.textContent = v[a] == null ? '0' : `${v[a] > 0 ? '+' : ''}${Math.round(v[a] * 100)}`; }
    for (const n of BUTTONS) { const e = body.querySelector('#c-v-' + n); if (e) e.textContent = v[n] ? 'ON' : 'off'; }
    const auto = body.querySelector('#c-auto'); if (auto) { const on = autoPad(); if (auto.hidden === on) auto.hidden = !on; }
  }

  // ---------- Star Citizen bindings import ----------
  function setupImport() {
    const pathEl = body.querySelector('#wiz-path'), msg = body.querySelector('#wiz-import-msg');
    import('./sc-bindings.mjs').then((sc) => {
      pathEl.textContent = sc.DEFAULT_ACTIONMAPS_PATH;
      body.querySelector('#wiz-copy').onclick = () => navigator.clipboard?.writeText(sc.DEFAULT_ACTIONMAPS_PATH).then(() => { msg.textContent = 'Path copied.'; });
      const load = (file) => file.text().then((text) => {
        const res = fromActionmaps(sc, text);
        msg.textContent = res.message;
        if (res.ok) { notice = res.message; wiz = null; render(); }
      });
      body.querySelector('#wiz-file').onchange = (e) => { const f = e.target.files?.[0]; if (f) load(f); };
      const box = body.querySelector('details.import');
      box.ondragover = (e) => { e.preventDefault(); };
      box.ondrop = (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) load(f); };
    }).catch(() => { msg.textContent = 'Import is not available.'; });
  }
  // Convert a parsed Star Citizen bindings file into this app's map.
  function fromActionmaps(sc, text) {
    const r = sc.parseActionmaps(text);
    // Start from the keyboard defaults: the game's file may list only what you changed. Each action the file
    // binds replaces that action's defaults.
    const d = scDefaults(); d.deadzone = map.deadzone; d.mouse = { ...map.mouse }; d.kinds = map.kinds;
    const pads = connectedPads(), skipped = [];
    const keyOf = (dv, inst) => dv?.vidPid || (dv?.product ? prettyName(dv.product).toLowerCase() : `js${inst}`);
    const devFor = (e) => {
      const isJs = (x) => (e.device === 'js' ? x.type === 'joystick' : x.type === 'gamepad' || x.type === 'xboxpad');
      const dv = r.devices.find((x) => x.instance === e.instance && isJs(x));
      if (e.device === 'gp') return { key: '*standard*', nth: 0, id: dv?.product || 'Gamepad' };
      const k = keyOf(dv, e.instance);
      // identical sticks: the game numbers them; the 2nd one in the file is the 2nd one the browser sees
      const nth = r.devices.filter((x) => isJs(x) && x.instance < e.instance && keyOf(x, x.instance) === k).length;
      const live = pads.find((p) => p.key === k && p.nth === nth);
      return { key: k, nth, id: live?.id || dv?.product || `Joystick ${e.instance}` };
    };
    const conv = (e) => {
      if (e.modifiers?.length) { skipped.push(e.scInput); return null; } // combos like Alt+W aren't supported yet
      if (e.kind === 'hat' || e.kind === 'wheel') { skipped.push(e.scInput); return null; }
      if (e.device === 'kb' && e.code) return key(e.code);
      if (e.device === 'mouse' && e.kind === 'axis' && /^(x|y)$/.test(e.axis || '')) { d.mouse.enabled = true; return { t: 'mouse', axis: e.axis, inv: !!e.invert }; }
      if ((e.device === 'js' || e.device === 'gp') && e.kind === 'button' && e.button != null) return { t: 'btn', ...devFor(e), button: e.button };
      if ((e.device === 'js' || e.device === 'gp') && e.kind === 'axis') {
        const idx = sc.browserAxisIndex(e.axis, e.device === 'gp' ? 'gamepad' : 'joystick');
        if (idx == null || idx < 0) return null;
        return { t: 'axis', ...devFor(e), axis: idx, inv: !!e.invert };
      }
      return null;
    };
    const replaced = new Set(); let count = 0;
    const list = (target, sign) => (target[0] === 'button' ? d.buttons[target[1]] : sign > 0 ? d.axes[target[0]].pos : d.axes[target[0]].neg);
    const put = (action, target) => {
      const entries = Object.hasOwn(r.bindings, action) ? r.bindings[action] : [];
      for (const e of entries) {
        const b = conv(e); if (!b) continue;
        count++;
        if (b.t === 'axis' || b.t === 'mouse') { if (target[0] !== 'button') d.axes[target[0]].axis = b; continue; }
        const sign = target[1] * (e.sign || 1), l = list(target, sign), id = `${target[0]}${target[0] === 'button' ? target[1] : sign}`;
        if (!replaced.has(id)) { l.length = 0; replaced.add(id); }
        l.push(b);
      }
    };
    put('strafeUp', ['u', 1]); put('strafeDown', ['u', -1]); put('strafeLeft', ['l', -1]); put('strafeRight', ['l', 1]);
    put('throttleFwd', ['f', 1]); put('throttleBack', ['f', -1]); put('rollLeft', ['roll', -1]); put('rollRight', ['roll', 1]);
    put('strafeVert', ['u', 1]); put('strafeLat', ['l', 1]); put('strafeLong', ['f', 1]);
    put('pitch', ['pitch', 1]); put('yaw', ['yaw', 1]); put('roll', ['roll', 1]);
    put('boost', ['button', 'boost']); put('spacebrake', ['button', 'brake']);
    if (!count) return { ok: false, message: `No flight bindings found in that file.${r.warnings?.length ? ' ' + r.warnings[0] : ''}` };
    d.source = 'import';
    map = d; save(); status();
    const skip = skipped.length ? ` Not imported (combos and hats aren't supported yet): ${[...new Set(skipped)].slice(0, 6).join(', ')}.` : '';
    return { ok: true, message: `Imported ${count} bindings from "${r.profileName || 'your profile'}"; everything else keeps the keyboard defaults. Move each control to check it: joystick axes are matched by guess, so fix any that are inverted or swapped.${skip}` };
  }

  // ---------- dialog plumbing ----------
  let keysRef = new Set(), ticking = false;
  function tick() {
    if (!dlg.open) { ticking = false; return; }
    requestAnimationFrame(tick);
    if (wiz && wiz.stage === 'steps') tickStep();
    else if (!wiz) tickSummary(keysRef);
    else if (wiz.stage === 'devices') { const np = body.querySelector('#wiz-pads'); if (np) np.innerHTML = padLine(); }
  }
  /** Open the controls panel; `wizard` starts the setup wizard. */
  function open(wizard = false, keys) {
    if (keys) keysRef = keys;
    wiz = wizard ? { stage: 'devices', kinds: guessKinds() } : null;
    render();
    if (!dlg.open) dlg.showModal();
    placeFocus();
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }
  addEventListener('keydown', (e) => { if (!dlg.open) return; if (keyCapture) keyCapture(e); else dlgKeys.add(e.code); }, true);
  addEventListener('keyup', (e) => { dlgKeys.delete(e.code); wiz?.held?.delete(e.code); }, true);
  addEventListener('blur', () => { dlgKeys.clear(); wiz?.held?.clear(); });
  dlg.addEventListener('close', () => {
    wiz = null; keyCapture = null; dlgKeys.clear(); notice = ''; noticeUndo = null;
    // closing the first-run wizard keeps the defaults, so it doesn't reopen on every visit
    if (!saved) { save(); status(); }
  });
  /** Short label of the first keyboard key bound to a wizard step (e.g. 'boost', 'rollLeft', 'throttleBack'), or ''. */
  function hint(action) {
    const st = STEPS.find((s) => s.id === action); if (!st) return '';
    const [a, s] = st.target;
    const k = (a === 'button' ? map.buttons[s] : s > 0 ? map.axes[a].pos : map.axes[a].neg).find((b) => b.t === 'key');
    return k ? keyName(k.code) : '';
  }
  addEventListener('gamepadconnected', status); addEventListener('gamepaddisconnected', status);
  status();

  return {
    read, flightKeys, open, status, hint,
    dialogOpen: () => dlg.open,
    firstRun,
    mouse: { move: mouseMove, center: mouseCenter, setLocked: (on) => { mouse.locked = on; if (!on) mouseCenter(); }, get enabled() { return map.mouse.enabled; }, get state() { return mouse; } },
  };
}
