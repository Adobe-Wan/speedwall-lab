// SPDX-FileCopyrightText: 2026 AdobeWan
// SPDX-License-Identifier: MIT

// Pilot-view cockpit HUD drawn as plain SVG.
//
// Original drawing: the layout (what sits where around the crosshair) follows the
// in-game Advanced HUD, but every shape, font and colour here is our own. No game assets.
//
//   const hud = createHud(svgElement);
//   hud.resize(w, h);            // on layout change; sets viewBox "0 0 w h"
//   hud.update(state);           // every frame; only touches attributes that changed
//   hud.setVisible(true|false);
//
// The HUD lives in its own <g class="sw-hud"> and never touches other children of `svg`.

export const HUD_NOTE = 'Original HUD drawing; layout follows the in-game Advanced HUD. No game assets.';

const NS = 'http://www.w3.org/2000/svg';
const MINT = '#7ef0c8';
const WHITE = '#e7edf5';
const RED = '#ff6a55';
const AMBER = '#f2a33a';
const SHADOW = '#03060a';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

let hudSeq = 0;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const q = v => Math.round(v * 10) / 10; // 0.1 px quantisation keeps the change-cache effective
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function el(parent, tag, attrs) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}

// Cached attribute / text setters: DOM is touched only when the value changed.
function set(e, name, v) {
  const c = e.__hc || (e.__hc = Object.create(null));
  if (c[name] !== v) { c[name] = v; e.setAttribute(name, v); }
}
function text(e, v) {
  if (e.__ht !== v) { e.__ht = v; e.firstChild.data = v; }
}
function show(e, on) {
  if (e.__hv !== on) { e.__hv = on; e.setAttribute('display', on ? 'inline' : 'none'); }
}
function label(parent, attrs, initial) {
  const t = el(parent, 'text', attrs);
  t.appendChild(document.createTextNode(initial || ''));
  return t;
}

export function createHud(svg) {
  const id = 'sw-hud-' + (++hudSeq);
  const root = el(svg, 'g', {
    class: 'sw-hud', 'pointer-events': 'none', 'font-family': MONO,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  root.style.pointerEvents = 'none';

  // Soft glow used only while boost is firing (one small element, so the blur is cheap).
  const defs = el(root, 'defs');
  const glowF = el(defs, 'filter', { id: id + '-glow', x: '-200%', y: '-30%', width: '500%', height: '160%' });
  el(glowF, 'feGaussianBlur', { stdDeviation: '3' });

  // Text gets a thin dark halo so it stays legible over bright scenery.
  const txtAttrs = (fill, anchor) => ({
    fill, 'text-anchor': anchor || 'middle', stroke: SHADOW, 'stroke-opacity': '0.6',
    'stroke-width': '3', 'paint-order': 'stroke', 'font-variant-numeric': 'tabular-nums',
  });

  // ---------- crosshair ----------
  const xh = el(root, 'g', { stroke: WHITE, 'stroke-width': '1.25', fill: 'none', opacity: '0.9' });
  const xhRing = el(xh, 'circle');
  const xhDot = el(xh, 'circle', { fill: WHITE, stroke: 'none' });
  const xhTicks = el(xh, 'path');

  // ---------- left: throttle / speed ----------
  const L = el(root, 'g');
  const thrTicks = el(L, 'path', { stroke: MINT, 'stroke-opacity': '0.55', 'stroke-width': '1', fill: 'none' });
  const thrTrack = el(L, 'rect', { fill: '#0b1a1a', 'fill-opacity': '0.35', stroke: MINT, 'stroke-opacity': '0.6', 'stroke-width': '1' });
  const thrFill = el(L, 'rect', { fill: MINT, 'fill-opacity': '0.85' });
  const thrMid = el(L, 'line', { stroke: WHITE, 'stroke-opacity': '0.85', 'stroke-width': '1.25' });
  const spdMark = el(L, 'g');
  const spdLine = el(spdMark, 'line', { stroke: WHITE, 'stroke-width': '1.5' });
  const spdTri = el(spdMark, 'path', { fill: WHITE, stroke: 'none' });
  const spdNum = label(L, txtAttrs(WHITE), '0');
  const spdUnit = label(L, txtAttrs(MINT), 'm/s');
  const badge = el(L, 'g');
  const badgeBox = el(badge, 'rect', { 'stroke-width': '1' });
  const badgeTxt = label(badge, { 'text-anchor': 'middle', 'letter-spacing': '0.08em', 'font-weight': '600' }, 'SCM');

  // ---------- right: boost (AB) ----------
  const R = el(root, 'g');
  const abGlow = el(R, 'rect', { fill: 'none', stroke: MINT, 'stroke-width': '4', 'stroke-opacity': '0.7', filter: `url(#${id}-glow)`, display: 'none' });
  const abTrack = el(R, 'rect', { fill: '#0b1a1a', 'fill-opacity': '0.35', 'stroke-width': '1' });
  const abZone = el(R, 'rect', { fill: RED, 'fill-opacity': '0.16' });
  const abRed = el(R, 'rect', { fill: RED, 'fill-opacity': '0.9' });
  const abFill = el(R, 'rect', { fill: MINT, 'fill-opacity': '0.8' });
  const abZoneTick = el(R, 'line', { stroke: RED, 'stroke-width': '1.25' });
  const abPct = label(R, txtAttrs(WHITE), '100%');
  const abLbl = label(R, txtAttrs(MINT), 'AB');
  const abLock = label(R, Object.assign(txtAttrs(RED), { 'letter-spacing': '0.06em', 'font-weight': '600' }), 'AB LOCKED');

  // ---------- G readout ----------
  const G = el(root, 'g');
  const gNum = label(G, txtAttrs(WHITE, 'end'), '0.0');
  const gUnit = label(G, txtAttrs(MINT, 'start'), 'G');
  const gRule = el(G, 'line', { stroke: MINT, 'stroke-opacity': '0.5', 'stroke-width': '1' });
  const gPeak = label(G, Object.assign(txtAttrs(WHITE, 'end'), { 'fill-opacity': '0.75' }), '0.0');
  const gPeakLbl = label(G, txtAttrs(MINT, 'start'), 'pk');

  // ---------- rotation rates (left of the throttle bar) ----------
  const RT = el(root, 'g', { display: 'none' });
  const rtHead = label(RT, txtAttrs(MINT, 'end'), '°/s');
  const rtRows = ['R', 'P', 'Y'].map(k => ({
    k: label(RT, txtAttrs(MINT, 'start'), k),
    v: label(RT, txtAttrs(WHITE, 'end'), '0'),
  }));

  // Layout, recomputed in resize().
  const Lo = { ready: false };
  let last = null;
  let visible = true;
  let badgeMode = '';

  function resize(w, h) {
    w = Math.max(1, num(w)); h = Math.max(1, num(h));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const S = Math.min(w, h), u = S / 100;
    const cx = w / 2, cy = h / 2;
    const fsS = Math.max(10, 1.9 * u);     // small labels
    const fsM = Math.max(12, 2.7 * u);     // numbers under the bars
    const fsL = Math.max(17, 4.0 * u);     // G value
    const H = Math.max(84, 23 * u);        // bar height
    const top = cy - H * 0.55, bot = top + H;
    const bw = Math.max(6, 1.5 * u);       // bar width
    const ins = Math.max(1.5, 0.28 * u);   // fill inset
    const xL = cx - Math.max(64, 20 * u);  // throttle bar centre
    const xR = cx + Math.max(64, 20 * u);  // boost bar centre
    Object.assign(Lo, { ready: true, w, h, S, u, cx, cy, fsS, fsM, fsL, H, top, bot, bw, ins, xL, xR });

    // crosshair
    const r = Math.max(5, 1.3 * u), gap = Math.max(3, 0.8 * u), len = Math.max(6, 1.8 * u);
    set(xhRing, 'cx', q(cx)); set(xhRing, 'cy', q(cy)); set(xhRing, 'r', q(r));
    set(xhDot, 'cx', q(cx)); set(xhDot, 'cy', q(cy)); set(xhDot, 'r', 1.2);
    const a = q(r + gap), b = q(r + gap + len), bs = q(r + gap + len * 0.6);
    set(xhTicks, 'd',
      `M${q(cx - b)} ${q(cy)}H${q(cx - a)}M${q(cx + a)} ${q(cy)}H${q(cx + b)}` +
      `M${q(cx)} ${q(cy + a)}V${q(cy + bs)}`);

    // throttle bar (static parts)
    const x0 = q(xL - bw / 2);
    set(thrTrack, 'x', x0); set(thrTrack, 'y', q(top)); set(thrTrack, 'width', q(bw)); set(thrTrack, 'height', q(H));
    set(thrFill, 'x', q(x0 + ins)); set(thrFill, 'width', q(Math.max(1, bw - 2 * ins)));
    const mid = top + H / 2;
    set(thrMid, 'x1', q(x0 - 0.9 * u - 3)); set(thrMid, 'x2', q(x0 + bw + 0.9 * u + 3));
    set(thrMid, 'y1', q(mid)); set(thrMid, 'y2', q(mid));
    let d = '';
    const tx = x0 - 2, tl = Math.max(3, 0.7 * u);
    for (let i = 0; i <= 4; i++) {
      if (i === 2) continue;
      const y = q(top + (H * i) / 4);
      d += `M${q(tx - tl)} ${y}H${q(tx)}`;
    }
    set(thrTicks, 'd', d);
    // speed marker sits on the inner (crosshair-facing) side
    const mx = x0 + bw, tri = Math.max(4, 1.0 * u);
    set(spdLine, 'x1', q(x0 - 1)); set(spdLine, 'x2', q(mx + 2)); set(spdLine, 'y1', 0); set(spdLine, 'y2', 0);
    set(spdTri, 'd', `M${q(mx + 2)} 0L${q(mx + 2 + tri)} ${q(-tri * 0.6)}V${q(tri * 0.6)}Z`);
    set(spdNum, 'x', q(xL)); set(spdNum, 'y', q(bot + 1.2 * u + fsM)); set(spdNum, 'font-size', q(fsM));
    set(spdUnit, 'x', q(xL)); set(spdUnit, 'y', q(bot + 1.2 * u + fsM + fsS * 1.15)); set(spdUnit, 'font-size', q(fsS));
    set(badgeTxt, 'font-size', q(fsS));
    badgeMode = ''; // force badge re-layout

    // boost bar (static parts)
    const r0 = q(xR - bw / 2);
    set(abTrack, 'x', r0); set(abTrack, 'y', q(top)); set(abTrack, 'width', q(bw)); set(abTrack, 'height', q(H));
    set(abGlow, 'x', q(r0 - 1)); set(abGlow, 'y', q(top - 1)); set(abGlow, 'width', q(bw + 2)); set(abGlow, 'height', q(H + 2));
    for (const e of [abZone, abRed, abFill]) { set(e, 'x', q(r0 + ins)); set(e, 'width', q(Math.max(1, bw - 2 * ins))); }
    set(abZoneTick, 'x1', q(r0 + bw)); set(abZoneTick, 'x2', q(r0 + bw + Math.max(3, 0.8 * u)));
    set(abPct, 'x', q(xR)); set(abPct, 'y', q(bot + 1.2 * u + fsM)); set(abPct, 'font-size', q(fsM));
    set(abLbl, 'x', q(xR)); set(abLbl, 'y', q(bot + 1.2 * u + fsM + fsS * 1.15)); set(abLbl, 'font-size', q(fsS));
    set(abLock, 'x', q(xR)); set(abLock, 'y', q(top - 1.4 * u - 2)); set(abLock, 'font-size', q(fsS));

    // G readout: value right-aligned on gx, unit just after it
    const gx = xR + Math.max(48, 12.5 * u), gy = cy + fsL * 0.35;
    set(gNum, 'x', q(gx)); set(gNum, 'y', q(gy)); set(gNum, 'font-size', q(fsL));
    set(gUnit, 'x', q(gx + 0.25 * fsS)); set(gUnit, 'y', q(gy)); set(gUnit, 'font-size', q(fsM));
    const ry = gy + 0.5 * u + 3;
    set(gRule, 'x1', q(gx - fsL * 1.9)); set(gRule, 'x2', q(gx + fsM * 0.9)); set(gRule, 'y1', q(ry)); set(gRule, 'y2', q(ry));
    set(gPeak, 'x', q(gx)); set(gPeak, 'y', q(ry + fsS * 1.2)); set(gPeak, 'font-size', q(fsS));
    set(gPeakLbl, 'x', q(gx + 0.25 * fsS)); set(gPeakLbl, 'y', q(ry + fsS * 1.2)); set(gPeakLbl, 'font-size', q(fsS));

    // rotation rates: mirror of the G readout, left of the throttle bar
    const rx = xL - Math.max(28, 6.5 * u), lh = fsS * 1.25;
    const ry0 = cy - lh * 1.5 + fsS * 0.35;
    set(rtHead, 'x', q(rx + fsS * 0.9)); set(rtHead, 'y', q(ry0 - lh * 0.15)); set(rtHead, 'font-size', q(fsS * 0.9));
    for (let i = 0; i < 3; i++) {
      const y = q(ry0 + lh * (i + 1));
      set(rtRows[i].k, 'x', q(rx - fsS * 3.4)); set(rtRows[i].k, 'y', y); set(rtRows[i].k, 'font-size', q(fsS));
      set(rtRows[i].v, 'x', q(rx + fsS * 0.9)); set(rtRows[i].v, 'y', y); set(rtRows[i].v, 'font-size', q(fsS));
    }

    if (last) update(last);
  }

  function layoutBadge(mode) {
    const { xL, top, u, fsS } = Lo;
    const boost = mode === 'BOOST';
    const padX = fsS * 0.55, bh = fsS * 1.5;
    const bwid = mode.length * fsS * 0.62 + 2 * padX;
    const by = top - 1.4 * u - bh;
    set(badgeBox, 'x', q(xL - bwid / 2)); set(badgeBox, 'y', q(by));
    set(badgeBox, 'width', q(bwid)); set(badgeBox, 'height', q(bh)); set(badgeBox, 'rx', q(bh * 0.22));
    set(badgeBox, 'fill', boost ? AMBER : '#0b1a1a');
    set(badgeBox, 'fill-opacity', boost ? '0.95' : '0.45');
    set(badgeBox, 'stroke', boost ? AMBER : MINT);
    set(badgeTxt, 'fill', boost ? '#14100a' : MINT);
    set(badgeTxt, 'x', q(xL)); set(badgeTxt, 'y', q(by + bh / 2 + fsS * 0.36));
    text(badgeTxt, mode);
  }

  function update(s) {
    last = s;
    if (!Lo.ready || !visible || !s) return;
    const { top, bot, H } = Lo;
    const half = H / 2, mid = top + half;

    // --- mode badge
    const mode = s.mode === 'BOOST' ? 'BOOST' : 'SCM';
    if (mode !== badgeMode) { badgeMode = mode; layoutBadge(mode); }

    // --- throttle command: fills from the middle mark (up = forward, down = reverse)
    const t = clamp(num(s.throttle), -1, 1);
    const ti = Lo.ins;
    if (t >= 0) {
      const hh = Math.max(0, t * half - ti);
      set(thrFill, 'y', q(mid - t * half + ti)); set(thrFill, 'height', q(hh));
      set(thrFill, 'fill', MINT);
    } else {
      const hh = Math.max(0, -t * half - ti);
      set(thrFill, 'y', q(mid)); set(thrFill, 'height', q(hh));
      set(thrFill, 'fill', AMBER);
    }

    // --- speed marker: |speed| / speedCap on the upper half (negative speed plots below)
    const speed = num(s.speed), cap = num(s.speedCap);
    const f = cap > 0 ? speed / cap : 0;
    const over = f > 1.005;
    const my = q(mid - clamp(f, -1, 1) * half);
    if (spdMark.__y !== my) { spdMark.__y = my; spdMark.setAttribute('transform', `translate(0 ${my})`); }
    const mc = over ? AMBER : WHITE;
    set(spdLine, 'stroke', mc); set(spdTri, 'fill', mc);
    text(spdNum, String(Math.round(speed)));
    set(spdNum, 'fill', over ? AMBER : WHITE);

    // --- boost tank
    const tank = clamp(num(s.tank), 0, 100);
    const rz = clamp(s.redZone == null ? 0 : num(s.redZone), 0, 100);
    const locked = !!s.boostLocked, active = !!s.boostActive && !locked;
    const yOf = p => bot - (p / 100) * H;
    const ins = Lo.ins;
    const redTop = Math.min(tank, rz);
    set(abZone, 'y', q(yOf(rz) + (rz >= 100 ? ins : 0))); set(abZone, 'height', q(Math.max(0, (rz / 100) * H - ins - (rz >= 100 ? ins : 0))));
    set(abRed, 'y', q(yOf(redTop))); set(abRed, 'height', q(Math.max(0, (redTop / 100) * H - ins)));
    const mintH = tank > rz ? ((tank - rz) / 100) * H : 0;
    const mintTop = tank >= 100 ? yOf(100) + ins : yOf(tank);
    set(abFill, 'y', q(mintTop)); set(abFill, 'height', q(Math.max(0, yOf(rz) - mintTop - (tank > rz ? 0.5 : 0))));
    show(abFill, mintH > 0.5);
    const zy = q(yOf(rz));
    set(abZoneTick, 'y1', zy); set(abZoneTick, 'y2', zy);
    show(abZoneTick, rz > 0 && rz < 100);
    set(abFill, 'fill-opacity', active ? '1' : '0.8');

    set(abTrack, 'stroke', locked ? RED : MINT);
    set(abTrack, 'stroke-opacity', locked ? '1' : '0.6');
    set(abTrack, 'stroke-width', locked ? '1.5' : '1');
    show(abLock, locked);
    show(abGlow, active);

    const unl = !!s.unlimited;
    text(abPct, unl ? '∞' : Math.round(tank) + '%');
    set(abPct, 'font-size', q(unl ? Lo.fsM * 1.45 : Lo.fsM));
    set(abPct, 'fill', locked ? RED : WHITE);
    set(abLbl, 'fill', locked ? RED : MINT);

    // --- G
    const g = num(s.g);
    text(gNum, (Math.abs(g) < 0.05 ? 0 : g).toFixed(1));
    const hasPeak = s.gPeak != null && Number.isFinite(s.gPeak);
    show(gPeak, hasPeak); show(gPeakLbl, hasPeak); show(gRule, hasPeak);
    if (hasPeak) text(gPeak, s.gPeak.toFixed(1));

    // --- rotation rates (only when any is non-zero)
    const rr = num(s.roll), pp = num(s.pitch), yy = num(s.yaw);
    const anyRate = Math.abs(rr) >= 0.5 || Math.abs(pp) >= 0.5 || Math.abs(yy) >= 0.5;
    show(RT, anyRate);
    if (anyRate) {
      text(rtRows[0].v, fmtRate(rr));
      text(rtRows[1].v, fmtRate(pp));
      text(rtRows[2].v, fmtRate(yy));
    }
  }

  function setVisible(on) {
    visible = !!on;
    show(root, visible);
    if (visible && last) update(last);
  }

  return { resize, update, setVisible };
}

function fmtRate(v) {
  const r = Math.round(v);
  return r > 0 ? '+' + r : r < 0 ? '−' + -r : '0';
}
