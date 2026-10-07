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

// The essential bindings, in Star Citizen's words, in the order the wizard asks for them.
// target: [logical axis, sign] or ['button', name]. pair: the step an axis capture also covers.
export const STEPS = [
  { id: 'strafeUp', label: 'Strafe up', target: ['u', +1], pair: 'strafeDown', hint: 'Default: Space.' },
  { id: 'strafeDown', label: 'Strafe down', target: ['u', -1], pair: 'strafeUp', hint: 'Default: Left Ctrl.' },
  { id: 'strafeLeft', label: 'Strafe left', target: ['l', -1], pair: 'strafeRight', hint: 'Default: A. A thumb stick on the throttle works too.' },
  { id: 'strafeRight', label: 'Strafe right', target: ['l', +1], pair: 'strafeLeft', hint: 'Default: D.' },
  { id: 'throttleFwd', label: 'Throttle forward', target: ['f', +1], pair: 'throttleBack', hint: 'Default: W. Push a throttle lever fully forward.' },
  { id: 'throttleBack', label: 'Throttle back', target: ['f', -1], pair: 'throttleFwd', hint: 'Default: S.' },
  { id: 'pitchUp', label: 'Pitch (nose up)', target: ['pitch', +1], pair: 'pitchDown', mouse: 'y', hint: 'Pull the stick back. Default: the mouse.' },
  { id: 'pitchDown', label: 'Pitch (nose down)', target: ['pitch', -1], pair: 'pitchUp', mouse: 'y', hint: 'Only asked if pitch is on keys or buttons.' },
  { id: 'yawRight', label: 'Yaw (nose right)', target: ['yaw', +1], pair: 'yawLeft', mouse: 'x', hint: 'Twist the stick or press the right pedal. Default: the mouse.' },
  { id: 'yawLeft', label: 'Yaw (nose left)', target: ['yaw', -1], pair: 'yawRight', mouse: 'x', hint: 'Only asked if yaw is on keys or buttons.' },
  { id: 'boost', label: 'Boost (afterburner)', target: ['button', 'boost'], hint: 'Default: Left Shift. Hold to boost.' },
  { id: 'rollLeft', label: 'Roll left', target: ['roll', -1], pair: 'rollRight', hint: 'Default: Q.' },
  { id: 'rollRight', label: 'Roll right', target: ['roll', +1], pair: 'rollLeft', hint: 'Default: E.' },
  { id: 'brake', label: 'Spacebrake (optional)', target: ['button', 'brake'], hint: 'Default: X.' },
];

const key = (code) => ({ t: 'key', code });
const emptyMap = () => ({
  axes: Object.fromEntries(AXES.map((a) => [a, { axis: null, pos: [], neg: [] }])),
  buttons: { boost: [], brake: [] },
  deadzone: 0.05,
  mouse: { enabled: false, sens: 1 },
  devices: [],
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

/**
 * @param {{ dialog: HTMLDialogElement, body: HTMLElement, status: HTMLElement, onFly?: () => void }} ui
 */
export function createControls(ui) {
  let map = null;
  try {
    const j = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (j && j.axes) { // merge over a complete map, so a partial or older save can't break reading
      const e = emptyMap();
      map = { ...e, ...j, axes: { ...e.axes }, buttons: { ...e.buttons, ...(j.buttons || {}) }, mouse: { ...e.mouse, ...(j.mouse || {}) } };
      for (const a of AXES) map.axes[a] = { ...e.axes[a], ...(j.axes[a] || {}) };
    }
  } catch { /* private mode or bad JSON: start fresh */ }
  const firstRun = !map;
  if (!map) map = scDefaults();
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(map)); } catch { /* ignore */ } };

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
  const out = { f: undefined, l: undefined, u: undefined, roll: undefined, pitch: undefined, yaw: undefined, boost: false, brake: false };
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
    v = p.axes[b.axis]; if (v == null) return undefined;
    v = Math.max(-1, Math.min(1, b.inv ? -v : v));
    if (b.mode === 'throttle') v = (v + 1) / 2; // a throttle resting at the back = 0 %, full forward = 100 %
    if (Math.abs(v) < dz) return undefined;
    return Math.sign(v) * (Math.abs(v) - dz) / (1 - dz);
  }
  /** Current input from bound devices. Axes are undefined when nothing bound is active, so on-screen controls still work. */
  function read(keys) {
    const pads = connectedPads();
    const anyPadBinding = AXES.some((a) => map.axes[a].axis?.t === 'axis' || [...map.axes[a].pos, ...map.axes[a].neg].some((b) => b.t === 'btn'))
      || BUTTONS.some((n) => map.buttons[n].some((b) => b.t === 'btn'));
    for (const a of AXES) {
      const m = map.axes[a];
      const bv = m.pos.reduce((s, b) => s + (pressed(b, keys, pads) ? 1 : 0), 0) - m.neg.reduce((s, b) => s + (pressed(b, keys, pads) ? 1 : 0), 0);
      out[a] = bv ? Math.max(-1, Math.min(1, bv)) : m.axis ? axisValue(m.axis, pads) : undefined;
    }
    for (const n of BUTTONS) out[n] = map.buttons[n].some((b) => pressed(b, keys, pads));
    // No controller bound yet: a standard-layout gamepad works out of the box. Left stick strafes,
    // right stick pitches/yaws, bumpers strafe down/up, triggers roll, A boosts, B spacebrakes.
    if (!anyPadBinding) {
      const gp = pads.find((d) => d.pad.mapping === 'standard');
      if (gp) {
        const p = gp.pad, btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed), dz = map.deadzone;
        const sh = (v) => (Math.abs(v) < dz ? undefined : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz));
        out.f ??= sh(-(p.axes[1] || 0)); out.l ??= sh(p.axes[0] || 0);
        out.yaw ??= sh(p.axes[2] || 0); out.pitch ??= sh(-(p.axes[3] || 0));
        const ud = (btn(5) ? 1 : 0) - (btn(4) ? 1 : 0); if (ud) out.u = ud;
        const rl = (p.buttons[7]?.value || 0) - (p.buttons[6]?.value || 0); if (Math.abs(rl) > dz) out.roll = rl;
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
  let wiz = null; // { stage, kinds, step, base, draft, done:Set }
  let keyCapture = null;

  function status() {
    const pads = connectedPads(), n = pads.length;
    const src = { defaults: 'Star Citizen keyboard defaults', wizard: 'your setup', import: 'your Star Citizen bindings' }[map.source] || 'not set up';
    ui.status.textContent = `Controls: ${src}${map.mouse.enabled ? ' · mouse flies the nose' : ''}${n ? ` · ${n} controller${n > 1 ? 's' : ''} connected` : ''}.`;
  }

  function render() {
    if (!wiz) return renderSummary();
    if (wiz.stage === 'devices') return renderDevices();
    if (wiz.stage === 'steps') return renderStep();
  }

  function renderDevices() {
    const kinds = wiz.kinds;
    const box = (k, label, hint) => `<label class="kind"><input type="checkbox" data-kind="${k}" ${kinds.has(k) ? 'checked' : ''}><span><b>${label}</b><small>${hint}</small></span></label>`;
    body.innerHTML = `<p class="lead">What will you fly with? Pick everything you use. Next, you press each control once, the way Star Citizen asks for bindings.</p>
      <div class="kinds">
        ${box('keyboard', 'Keyboard', 'W A S D, Space, Ctrl, Q E, Shift')}
        ${box('mouse', 'Mouse', 'Moves the nose (pitch and yaw)')}
        ${box('stick', 'Joystick / HOTAS', 'Sticks and throttles')}
        ${box('pedals', 'Pedals', 'Usually yaw or strafe')}
        ${box('gamepad', 'Gamepad', 'Xbox-style controller')}
      </div>
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
    body.querySelectorAll('[data-kind]').forEach((c) => (c.onchange = () => { if (c.checked) kinds.add(c.dataset.kind); else kinds.delete(c.dataset.kind); }));
    body.querySelector('#wiz-next').onclick = () => startSteps();
    body.querySelector('#wiz-defaults').onclick = () => { map = scDefaults(); map.mouse.enabled = kinds.has('mouse'); save(); wiz = null; status(); render(); };
    setupImport();
  }
  const padLine = () => { const pads = connectedPads(); return pads.length ? `Connected: ${pads.map((d) => esc(prettyName(d.id))).join(', ')}.` : 'No controller seen yet. Press any button on it: browsers only show controllers after you use them.'; };

  function startSteps() {
    const d = emptyMap();
    d.mouse = { ...map.mouse, enabled: wiz.kinds.has('mouse') };
    d.deadzone = map.deadzone;
    wiz.draft = d; wiz.stage = 'steps'; wiz.step = 0; wiz.done = new Set(); wiz.base = snapshotAll();
    render();
  }
  const curStep = () => STEPS[wiz.step];
  function renderStep() {
    const st = curStep(), n = STEPS.length;
    const useMouse = st.mouse && wiz.kinds.has('mouse');
    body.innerHTML = `<p class="keys">Step ${wiz.step + 1} of ${n}</p>
      <p class="ask">${esc(st.label)}</p>
      <p class="keys">Press a key or button, or move an axis${useMouse ? ', or use the mouse' : ''}. ${esc(st.hint)}</p>
      <div class="meter" aria-hidden="true"><i id="wiz-live"></i></div>
      <p class="keys" id="wiz-pads">${padLine()}</p>
      <div class="row">
        ${useMouse ? `<button id="wiz-mouse" class="primary">Use the mouse</button>` : ''}
        <button id="wiz-skip">Skip</button><button id="wiz-back" ${wiz.step ? '' : 'disabled'}>Back</button><button id="wiz-stop">Cancel</button>
      </div>`;
    body.querySelector('#wiz-skip').onclick = () => advance();
    body.querySelector('#wiz-back').onclick = () => { do wiz.step--; while (wiz.step > 0 && wiz.done.has(STEPS[wiz.step].id) && wiz.autoskipped?.has(STEPS[wiz.step].id)); wiz.base = snapshotAll(); render(); };
    body.querySelector('#wiz-stop').onclick = () => { wiz = null; render(); };
    if (useMouse) body.querySelector('#wiz-mouse').onclick = () => bindCaptured({ t: 'mouse', axis: st.mouse, inv: false }, true);
    keyCapture = (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') return;
      e.preventDefault(); e.stopPropagation();
      bindCaptured(key(e.code), false);
    };
  }
  // Store a captured control for the current step. An axis covers both directions of the step's logical
  // axis, so the paired step is skipped.
  function bindCaptured(b, isAxis) {
    const st = curStep(), d = wiz.draft, [a, sign] = st.target;
    if (a === 'button') d.buttons[sign].push(b);
    else if (isAxis) { d.axes[a].axis = b; if (st.pair) { wiz.done.add(st.pair); (wiz.autoskipped ||= new Set()).add(st.pair); } if (b.t === 'mouse') d.mouse.enabled = true; }
    else (sign > 0 ? d.axes[a].pos : d.axes[a].neg).push(b);
    wiz.done.add(st.id);
    advance();
  }
  function advance() {
    do wiz.step++; while (wiz.step < STEPS.length && wiz.done.has(STEPS[wiz.step].id));
    wiz.base = snapshotAll();
    if (wiz.step >= STEPS.length) { map = { ...wiz.draft, source: 'wizard' }; save(); wiz = null; keyCapture = null; status(); }
    render();
  }
  function tickStep() {
    const st = curStep(), pads = connectedPads();
    const np = body.querySelector('#wiz-pads'); if (np) np.innerHTML = padLine();
    for (const d of pads) { // a new button press
      const b0 = (wiz.base[d.pad.index + '|' + d.id] || {}).buttons || [];
      const i = d.pad.buttons.findIndex((b, k) => b.pressed && !b0[k]);
      if (i >= 0) return bindCaptured({ t: 'btn', id: d.id, key: d.key, nth: d.nth, button: i }, false);
    }
    if (st.target[0] === 'button') return;
    let best = null; // the axis that moved furthest since the step began
    for (const d of pads) {
      const a0 = (wiz.base[d.pad.index + '|' + d.id] || {}).axes || [];
      d.pad.axes.forEach((v, i) => {
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
      bindCaptured(b, true);
    }
  }

  function renderSummary() {
    keyCapture = null;
    const row = (label, html, liveId, opts = '') => `<span class="what">${label}</span><span class="src">${html}</span><span class="live" id="${liveId}">–</span>${opts ? `<span class="opts">${opts}</span>` : ''}`;
    const names = { f: 'Throttle (strafe forward / back)', l: 'Strafe left / right', u: 'Strafe up / down', roll: 'Roll', pitch: 'Pitch', yaw: 'Yaw' };
    const rows = AXES.map((a) => {
      const m = map.axes[a], parts = [];
      if (m.axis) parts.push(esc(describe(m.axis)));
      if (m.pos.length || m.neg.length) parts.push(`${m.neg.map(describe).map(esc).join(' / ') || '–'} ↔ ${m.pos.map(describe).map(esc).join(' / ') || '–'}`);
      let opts = '';
      if (m.axis && m.axis.t !== 'key') opts += `<label class="tog"><input type="checkbox" data-inv="${a}" ${m.axis.inv ? 'checked' : ''}> Invert</label>`;
      if (a === 'f' && m.axis?.t === 'axis') opts += `<label class="tog">Range <select data-mode="f"><option value="centered" ${m.axis.mode !== 'throttle' ? 'selected' : ''}>centred (back ↔ forward)</option><option value="throttle" ${m.axis.mode === 'throttle' ? 'selected' : ''}>throttle (0 → 100 %)</option></select></label>`;
      return row(names[a], parts.join(' · ') || 'not bound', `c-v-${a}`, opts);
    }).join('') + BUTTONS.map((n) => row(n === 'boost' ? 'Boost' : 'Spacebrake', map.buttons[n].map(describe).map(esc).join(' / ') || 'not bound', `c-v-${n}`)).join('');
    body.innerHTML = `<p class="keys">${firstRun && map.source === 'defaults' ? 'Using the Star Citizen keyboard defaults. ' : ''}Move each control to check it. Saved in this browser.</p>
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
    body.querySelector('#c-wizard').onclick = () => open(true);
    body.querySelector('#c-defaults').onclick = () => { const mouseOn = map.mouse.enabled; map = scDefaults(); map.mouse.enabled = mouseOn; save(); status(); render(); };
    body.querySelector('#c-close').onclick = () => dlg.close();
    body.querySelector('#c-fly').onclick = () => { dlg.close(); ui.onFly?.(); };
    body.querySelector('#c-dz').oninput = (e) => { map.deadzone = +e.target.value / 100; body.querySelector('#c-dz-v').textContent = `${e.target.value}%`; save(); };
    body.querySelector('#c-sens').oninput = (e) => { map.mouse.sens = +e.target.value / 100; body.querySelector('#c-sens-v').textContent = `${e.target.value}%`; save(); };
    body.querySelector('#c-mouse').onchange = (e) => {
      map.mouse.enabled = e.target.checked;
      if (map.mouse.enabled) { map.axes.pitch.axis ??= { t: 'mouse', axis: 'y', inv: false }; map.axes.yaw.axis ??= { t: 'mouse', axis: 'x', inv: false }; }
      save(); status(); render();
    };
    body.querySelectorAll('[data-inv]').forEach((c) => (c.onchange = () => { map.axes[c.dataset.inv].axis.inv = c.checked; save(); render(); }));
    body.querySelectorAll('[data-mode]').forEach((c) => (c.onchange = () => { map.axes.f.axis.mode = c.value; save(); }));
  }
  function tickSummary(keys) {
    const v = read(keys);
    for (const a of AXES) { const e = body.querySelector('#c-v-' + a); if (e) e.textContent = v[a] == null ? '0' : `${v[a] > 0 ? '+' : ''}${Math.round(v[a] * 100)}`; }
    for (const n of BUTTONS) { const e = body.querySelector('#c-v-' + n); if (e) e.textContent = v[n] ? 'ON' : 'off'; }
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
        if (res.ok) { wiz = null; render(); }
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
    const d = emptyMap(); d.deadzone = map.deadzone; d.mouse = { ...map.mouse };
    const pads = connectedPads();
    const devFor = (e) => {
      const dv = r.devices.find((x) => x.instance === e.instance && (e.device === 'js' ? x.type === 'joystick' : x.type === 'gamepad'));
      if (e.device === 'gp') return { key: '*standard*', nth: 0, id: dv?.product || 'Gamepad' };
      const k = dv?.vidPid || (dv?.product ? prettyName(dv.product).toLowerCase() : `js${e.instance}`);
      const live = pads.find((p) => p.key === k);
      return { key: k, nth: live ? live.nth : 0, id: live?.id || dv?.product || `Joystick ${e.instance}` };
    };
    const conv = (e) => {
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
    const put = (action, target) => {
      for (const e of r.bindings[action] || []) {
        const b = conv(e); if (!b) continue;
        if (target[0] === 'button') d.buttons[target[1]].push(b);
        else if (b.t === 'axis' || b.t === 'mouse') { if (!d.axes[target[0]].axis) d.axes[target[0]].axis = b; }
        else if (b.t === 'key' || b.t === 'btn') (target[1] * (e.sign || 1) > 0 ? d.axes[target[0]].pos : d.axes[target[0]].neg).push(b);
      }
    };
    put('strafeUp', ['u', 1]); put('strafeDown', ['u', -1]); put('strafeLeft', ['l', -1]); put('strafeRight', ['l', 1]);
    put('throttleFwd', ['f', 1]); put('throttleBack', ['f', -1]); put('rollLeft', ['roll', -1]); put('rollRight', ['roll', 1]);
    put('strafeVert', ['u', 1]); put('strafeLat', ['l', 1]); put('strafeLong', ['f', 1]);
    put('pitch', ['pitch', 1]); put('yaw', ['yaw', 1]); put('roll', ['roll', 1]);
    put('boost', ['button', 'boost']); put('spacebrake', ['button', 'brake']);
    const count = AXES.reduce((s, a) => s + (d.axes[a].axis ? 1 : 0) + d.axes[a].pos.length + d.axes[a].neg.length, 0) + d.buttons.boost.length + d.buttons.brake.length;
    if (!count) return { ok: false, message: `No flight bindings found in that file.${r.warnings?.length ? ' ' + r.warnings[0] : ''}` };
    // anything the file leaves unbound falls back to the keyboard defaults
    const def = scDefaults();
    for (const a of AXES) if (!d.axes[a].axis && !d.axes[a].pos.length && !d.axes[a].neg.length) d.axes[a] = def.axes[a];
    for (const n of BUTTONS) if (!d.buttons[n].length) d.buttons[n] = def.buttons[n];
    d.source = 'import';
    map = d; save(); status();
    return { ok: true, message: `Imported ${count} bindings from "${r.profileName || 'your profile'}". Move each control to check it; joystick axes are matched by guess, so fix any that are inverted or swapped.` };
  }

  // ---------- dialog plumbing ----------
  let keysRef = new Set();
  function tick() {
    if (!dlg.open) return;
    requestAnimationFrame(tick);
    if (wiz && wiz.stage === 'steps') tickStep();
    else if (!wiz) tickSummary(keysRef);
    else if (wiz.stage === 'devices') { const np = body.querySelector('#wiz-pads'); if (np) np.innerHTML = padLine(); }
  }
  /** Open the controls panel; `wizard` starts the setup wizard. */
  function open(wizard = false, keys) {
    if (keys) keysRef = keys;
    const kinds = new Set(['keyboard']); if (map.mouse.enabled) kinds.add('mouse');
    if (connectedPads().length) kinds.add('stick');
    wiz = wizard ? { stage: 'devices', kinds } : null;
    render();
    if (!dlg.open) dlg.showModal();
    requestAnimationFrame(tick);
  }
  addEventListener('keydown', (e) => { if (dlg.open && keyCapture) keyCapture(e); }, true);
  dlg.addEventListener('close', () => { wiz = null; keyCapture = null; });
  addEventListener('gamepadconnected', status); addEventListener('gamepaddisconnected', status);
  status();

  return {
    read, flightKeys, open, status,
    dialogOpen: () => dlg.open,
    firstRun,
    mouse: { move: mouseMove, center: mouseCenter, setLocked: (on) => { mouse.locked = on; }, get enabled() { return map.mouse.enabled; }, get state() { return mouse; } },
  };
}
