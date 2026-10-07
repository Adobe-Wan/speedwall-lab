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
// update(state) fields (all optional):
//   speed (signed: < 0 when flying backwards), speedCap, throttle (−1..1), g, gPeak,
//   tank, redZone, boostActive, boostLocked, unlimited, mode ('SCM' | 'BOOST'),
//   roll, pitch, yaw (°/s),
//   hfovDeg (default 90), keepOutDeg (default 22): the side groups are laid out outside
//     the cone keepOutDeg around the nose, where the corkscrew lessons park the TVI,
//   anchorRollDps (number | null), guideDeg: "HOLD TVI @13°: 27 °/s" under the G readout,
//   maneuver (string): small caps label at the top centre, hidden when empty.
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

// Layout constants (px). Text widths are estimated from a monospace advance so layout
// never has to measure the DOM.
const CW = 0.62;         // monospace glyph advance in em, with a little slack
const HALO = 2;          // reach of the text halo stroke
const EDGE = 8;          // keep everything this far inside the view
const GAP = 4;           // minimum gap between HUD blocks
const TVI_PAD = 20;      // clearance beyond the keep-out radius (the TVI glyph's wings reach ±22 px)
const TVI_LBL = [14, 66, 10, 26]; // the page's "TVI 13°" label box relative to the TVI centre (x0, x1, y0, y1)

let hudSeq = 0;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const q = v => Math.round(v * 10) / 10; // 0.1 px quantisation keeps the change-cache effective
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const RAD = Math.PI / 180;

function el(parent, tag, attrs) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}

// Cached attribute / text setters: DOM is touched only when the value changed.
// A null value removes the attribute.
function set(e, name, v) {
  const c = e.__hc || (e.__hc = Object.create(null));
  if (c[name] !== v) {
    c[name] = v;
    if (v == null) e.removeAttribute(name); else e.setAttribute(name, v);
  }
}
function text(e, v) {
  if (e.__ht !== v) { e.__ht = v; e.firstChild.data = v; }
}
function show(e, on) {
  if (e.__hv !== on) { e.__hv = on; e.setAttribute('display', on ? 'inline' : 'none'); }
}
function move(e, x, y) {
  const v = `translate(${q(x)} ${q(y)})`;
  if (e.__hm !== v) { e.__hm = v; e.setAttribute('transform', v); }
}
function label(parent, attrs, initial) {
  const t = el(parent, 'text', attrs);
  t.appendChild(document.createTextNode(initial || ''));
  return t;
}

// Distance from (cx, cy) to the rectangle [x0, x1] × [y0, y1] (0 when inside).
function rectDist(x0, y0, x1, y1, cx, cy) {
  const dx = cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0;
  const dy = cy < y0 ? y0 - cy : cy > y1 ? cy - y1 : 0;
  return Math.hypot(dx, dy);
}

// Does a block (list of local rects [x0, y0, x1, y1]) translated by (tx, ty) fit?
// Inside the view, outside the keep-out disc (r1), clear of the TVI label (r2 > 0) and of
// the blocks placed so far.
function fits(rects, tx, ty, E) {
  for (const r of rects) {
    const x0 = r[0] + tx, y0 = r[1] + ty, x1 = r[2] + tx, y1 = r[3] + ty;
    if (x0 < EDGE || y0 < EDGE || x1 > E.w - EDGE || y1 > E.h - EDGE) return false;
    if (rectDist(x0, y0, x1, y1, E.cx, E.cy) < E.r1) return false;
    if (E.r2 > 0 && rectDist(x0 - TVI_LBL[1], y0 - TVI_LBL[3], x1 - TVI_LBL[0], y1 - TVI_LBL[2], E.cx, E.cy) < E.r2) return false;
    for (const o of E.obs) if (x0 < o[2] + GAP && x1 > o[0] - GAP && y0 < o[3] + GAP && y1 > o[1] - GAP) return false;
  }
  return true;
}

function bounds(rects) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
  return [x0, y0, x1, y1];
}

// Find a translation for block b. First slide outward along the preferred row (keeps the
// classic "bars beside the crosshair" look), then scan the view for the cheapest spot:
// moving outward or down is cheap, inward or up is expensive. In relaxed mode (nothing
// clears the keep-out band) take the spot farthest from the crosshair, low and at the edges.
// b.txMin / b.txMax keep a block on its own side of the crosshair; b.maxSlide > 0 means
// "beside only" (no scan), used to keep the G readout attached to the AB bar.
function place(b, E) {
  const [px, py] = b.pref, side = b.side || 0;
  const [bx0, by0, bx1, by1] = bounds(b.rects);
  const lo = Math.max(EDGE - bx0, b.txMin ?? -Infinity), hi = Math.min(E.w - EDGE - bx1, b.txMax ?? Infinity);
  if (side && !E.relaxed) {
    const kMax = b.maxSlide || E.w;
    for (let k = 0; k <= kMax; k += 2) {
      const tx = px + side * k;
      if (tx < lo || tx > hi) break;
      if (fits(b.rects, tx, py, E)) return [tx, py];
    }
    if (b.maxSlide) return null;
  }
  const st = E.step;
  const tx0 = lo, tx1 = hi, ty0 = EDGE - by0, ty1 = E.h - EDGE - by1;
  let best = null, bestCost = Infinity;
  for (let ty = ty0; ty <= ty1; ty += st) {
    const dy = ty - py;
    const cy = dy >= 0 ? dy * 1.5 : -dy * 4;
    for (let tx = tx0; tx <= tx1; tx += st) {
      const dx = side ? (tx - px) * side : Math.abs(tx - px);
      let cost = cy + (dx >= 0 ? dx : -dx * 3);
      if (!E.relaxed && cost >= bestCost) continue;
      if (!fits(b.rects, tx, ty, E)) continue;
      if (E.relaxed) {
        let clear = Infinity;
        for (const r of b.rects) clear = Math.min(clear, rectDist(r[0] + tx, r[1] + ty, r[2] + tx, r[3] + ty, E.cx, E.cy));
        cost = cost * 0.05 - clear * 10;
      }
      if (cost < bestCost) { bestCost = cost; best = [tx, ty]; }
    }
  }
  return best;
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

  // Every text gets a dark halo (stroke painted under the fill) so it stays legible over bright scenery.
  const txtAttrs = (fill, anchor) => ({
    fill, 'text-anchor': anchor || 'middle', stroke: SHADOW, 'stroke-opacity': '0.75',
    'stroke-width': '3', 'paint-order': 'stroke', 'font-variant-numeric': 'tabular-nums',
  });

  // ---------- crosshair ----------
  const xh = el(root, 'g', { stroke: WHITE, 'stroke-width': '1.25', fill: 'none', opacity: '0.9' });
  const xhRing = el(xh, 'circle');
  const xhDot = el(xh, 'circle', { fill: WHITE, stroke: 'none' });
  const xhTicks = el(xh, 'path');

  // ---------- left block: throttle / speed / mode badge / rotation rates ----------
  // Every block is drawn in local coordinates (x = bar centre, y = bar middle) and moved as a whole.
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
  const rev = el(L, 'g', { display: 'none' });
  const revBox = el(rev, 'rect', { fill: '#1a1206', 'fill-opacity': '0.8', stroke: AMBER, 'stroke-width': '1' });
  const revTxt = label(rev, Object.assign(txtAttrs(AMBER), { 'letter-spacing': '0.06em', 'font-weight': '600' }), 'REV');
  const badge = el(L, 'g');
  const badgeBox = el(badge, 'rect', { 'stroke-width': '1' });
  const badgeTxt = label(badge, Object.assign(txtAttrs(MINT), { 'letter-spacing': '0.08em', 'font-weight': '600' }), 'SCM');
  const RT = el(L, 'g', { display: 'none' });
  const rtHead = label(RT, txtAttrs(MINT, 'end'), '°/s');
  const rtRows = ['R', 'P', 'Y'].map(k => ({
    k: label(RT, txtAttrs(MINT, 'start'), k),
    v: label(RT, txtAttrs(WHITE, 'end'), '0'),
  }));

  // ---------- right block: boost (AB) ----------
  const R = el(root, 'g');
  const abGlow = el(R, 'rect', { fill: 'none', stroke: MINT, 'stroke-width': '4', 'stroke-opacity': '0.7', filter: `url(#${id}-glow)`, display: 'none' });
  const abTrack = el(R, 'rect', { fill: '#0b1a1a', 'fill-opacity': '0.35', 'stroke-width': '1' });
  const abZone = el(R, 'rect', { fill: RED, 'fill-opacity': '0.16' });
  const abRed = el(R, 'rect', { fill: RED, 'fill-opacity': '0.9' });
  const abFill = el(R, 'rect', { fill: MINT, 'fill-opacity': '0.8' });
  const abZoneTick = el(R, 'line', { stroke: RED, 'stroke-width': '1.25' });
  const abPct = label(R, txtAttrs(WHITE), '100%');
  const abLbl = label(R, txtAttrs(MINT), 'AB');
  const abLock = label(R, Object.assign(txtAttrs(RED, 'start'), { 'letter-spacing': '0.06em', 'font-weight': '600' }), 'AB LOCKED');

  // ---------- G block: G readout + anchoring roll rate (local x = left edge, y = G baseline) ----------
  const G = el(root, 'g');
  const gNum = label(G, txtAttrs(WHITE, 'end'), '0.0');
  const gUnit = label(G, txtAttrs(MINT, 'start'), 'G');
  const gRule = el(G, 'line', { stroke: MINT, 'stroke-opacity': '0.5', 'stroke-width': '1' });
  const gPeak = label(G, Object.assign(txtAttrs(WHITE, 'end'), { 'fill-opacity': '0.8' }), '0.0');
  const gPeakLbl = label(G, txtAttrs(MINT, 'start'), 'pk');
  const anc = label(G, Object.assign(txtAttrs(MINT, 'start'), { display: 'none' }), 'HOLD TVI: ');
  const ancV = el(anc, 'tspan', { fill: WHITE });
  ancV.appendChild(document.createTextNode('0 °/s'));

  // ---------- maneuver label (top centre) ----------
  const M = label(root, Object.assign(txtAttrs(WHITE), { 'letter-spacing': '0.12em', 'font-weight': '600', 'fill-opacity': '0.92', display: 'none' }), '');

  // Layout, recomputed in resize() and when hfovDeg / keepOutDeg change.
  const Lo = { ready: false, w: 0, h: 0, hfov: 90, keep: 22 };
  let last = null;
  let visible = true;
  let badgeMode = '';
  let manText = '';

  function resize(w, h) {
    Lo.w = Math.max(1, num(w)); Lo.h = Math.max(1, num(h));
    svg.setAttribute('viewBox', `0 0 ${Lo.w} ${Lo.h}`);
    layout();
    if (last) update(last);
  }

  // Local geometry of the three side blocks for bar height H and an anchor line on 1 or 2 lines.
  function geom(H, lines) {
    const { u, fsS, fsM, fsN, fsL, bw } = Lo;
    const top = -H / 2, bot = H / 2;
    const tl = Math.max(3, 0.7 * u), midExt = 0.9 * u + 3, tri = Math.max(4, 1.0 * u), zt = Math.max(3, 0.8 * u);
    const spdY = bot + 1.2 * u + fsM, unitY = spdY + fsS * 1.15;
    // left
    const numHalf = 2 * CW * fsM;                      // "−520"
    const revH = fsS * 1.35, revW = 3 * (CW + 0.06) * fsS + fsS * 0.8;
    const revX1 = -numHalf - 4, revY = spdY - 0.36 * fsM - revH / 2;
    const badgeH = fsS * 1.5, badgeX1 = bw / 2 + midExt, badgeY = top - 1.4 * u - badgeH;
    const badgeWmax = 5 * (CW + 0.08) * fsS + 1.1 * fsS;
    const lh = fsN * 1.25;
    const rv = Math.min(-Math.max(28, 6.5 * u) + 0.9 * fsS, -bw / 2 - 2 - tl - 6); // rate values end here
    const rk = rv - 3.4 * fsS - 0.9 * fsS - (fsN - fsS) * 2.5;                     // rate keys start here
    const ry0 = -lh * 1.5 + fsS * 0.35;
    const Lr = [
      [-bw / 2 - Math.max(midExt, 2 + tl) - 1, top - tri, bw / 2 + Math.max(midExt, 2 + tri) + 1, bot + tri],
      [Math.min(-numHalf, revX1 - revW) - HALO, spdY - 0.95 * fsM - 1, Math.max(numHalf, 1.6 * CW * fsS) + HALO, unitY + 0.3 * fsS + HALO],
      [badgeX1 - badgeWmax - 1, badgeY - 1, badgeX1 + 1, badgeY + badgeH + 1],
      [rk - HALO, ry0 - 0.15 * lh - 0.95 * fsS, rv + HALO, ry0 + 3 * lh + 0.3 * fsN + HALO],
    ];
    // right
    const pctHalf = 2 * CW * fsM, lockY = top - 1.4 * u - 2;
    const Rr = [
      [-bw / 2 - 2, top - 2, bw / 2 + zt + 2, bot + 2],
      [-pctHalf - HALO, spdY - 0.95 * fsM * 1.45, pctHalf + HALO, unitY + 0.3 * fsS + HALO],
      [-bw / 2 - HALO, lockY - 0.95 * fsS, -bw / 2 + 9 * (CW + 0.06) * fsS + HALO, lockY + 0.3 * fsS + HALO],
    ];
    // G
    const gx = 4 * CW * fsL;                          // "12.3"
    const ruleY = 0.5 * u + 3, peakY = ruleY + 1.2 * fsN, ancY = peakY + 1.45 * fsS;
    const ancW = lines === 1 ? 15 * CW * fsS + 8 * CW * fsN : Math.max(15 * CW * fsS, 8 * CW * fsN);
    const ancBot = (lines === 1 ? ancY : ancY + 1.2 * fsN) + 0.3 * fsN + HALO;
    const Gr = [
      [-HALO, -0.95 * fsL, gx + 0.25 * fsS + Math.max(CW * fsM, 2 * CW * fsS) + HALO, peakY + 0.3 * fsN + HALO],
      [-HALO, ancY - 0.95 * fsS, ancW + HALO, ancBot],
    ];
    return { H, lines, top, bot, tl, midExt, tri, zt, spdY, unitY, numHalf, revH, revW, revX1, revY, badgeH, badgeX1, badgeY,
      lh, rv, rk, ry0, lockY, gx, ruleY, peakY, ancY, Lr, Rr, Gr };
  }

  function layout() {
    const { w, h, hfov, keep } = Lo;
    if (!w || !h) return;
    const S = Math.min(w, h), u = S / 100;
    const cx = w / 2, cy = h / 2;
    const fsS = Math.max(11.5, 1.9 * u);   // small labels (≥ 11.5 px so they stay readable on phones)
    const fsM = Math.max(13, 2.7 * u);     // numbers under the bars
    const fsN = Math.max(13, fsS);         // small numbers (G peak, rates, anchor roll)
    const fsL = Math.max(17, 4.0 * u);     // G value
    const bw = Math.max(6, 1.5 * u);       // bar width
    const ins = Math.max(1.5, 0.28 * u);   // fill inset
    Object.assign(Lo, { ready: true, S, u, cx, cy, fsS, fsM, fsN, fsL, bw, ins });

    // crosshair
    const r = Math.max(5, 1.3 * u), gap = Math.max(3, 0.8 * u), len = Math.max(6, 1.8 * u);
    set(xhRing, 'cx', q(cx)); set(xhRing, 'cy', q(cy)); set(xhRing, 'r', q(r));
    set(xhDot, 'cx', q(cx)); set(xhDot, 'cy', q(cy)); set(xhDot, 'r', 1.2);
    const a = q(r + gap), b = q(r + gap + len), bs = q(r + gap + len * 0.6);
    set(xhTicks, 'd',
      `M${q(cx - b)} ${q(cy)}H${q(cx - a)}M${q(cx + a)} ${q(cy)}H${q(cx + b)}` +
      `M${q(cx)} ${q(cy + a)}V${q(cy + bs)}`);

    // keep-out band: pixel radius of keepOutDeg in a view with horizontal FOV hfov
    const f = (w / 2) / Math.tan((hfov / 2) * RAD);
    const rK = f * Math.tan(keep * RAD);
    Lo.rK = rK; Lo.xhR = r + gap + len;
    const side = Math.max(64, 20 * u);
    const step = Math.max(3, Math.round(S / 120));

    // Try progressively tighter layouts until all three blocks clear the band.
    const H0 = Math.max(84, 23 * u);
    // [bar height, anchor line on 1 or 2 lines, also clear the page's TVI label, G attached to the AB bar]
    const Hs = Math.max(44, 0.55 * H0);
    const tiers = [
      [H0, 1, true, true], [H0, 2, true, true], [H0, 1, false, true], [H0, 2, false, true],
      [H0, 2, true, false], [H0, 2, false, false],
      [0.75 * H0, 2, false, true], [0.75 * H0, 2, false, false], [Hs, 2, false, true], [Hs, 2, false, false],
    ];
    let res = null;
    for (const [H, lines, lbl, attached] of tiers) {
      res = tryLayout(geom(H, lines), { w, h, cx, cy, r1: rK + TVI_PAD, r2: lbl ? rK : 0, step, relaxed: false, side, attached });
      if (res) break;
    }
    if (!res) {
      // Too tight (narrow view, small FOV): low and at the edges, never over the crosshair.
      const g = geom(Hs, 2);
      res = tryLayout(g, { w, h, cx, cy, r1: Lo.xhR + 6, r2: 0, step, relaxed: true, side }) ||
        { g, l: [cx - side, cy], r: [cx + side, cy], gp: [cx + side + 20, cy], relaxed: true };
    }
    Lo.clear = !res.relaxed; // false: the view is too tight to keep the band clear
    apply(res);
    layoutManeuver();
  }

  function tryLayout(g, E) {
    const obs = [];
    E.obs = obs;
    const push = (rects, [tx, ty]) => { for (const r of rects) obs.push([r[0] + tx, r[1] + ty, r[2] + tx, r[3] + ty]); };
    const yPref = E.cy - 0.05 * g.H;
    const l = place({ rects: g.Lr, pref: [E.cx - E.side, yPref], side: -1, txMax: E.cx - Lo.bw }, E);
    if (!l) return null;
    push(g.Lr, l);
    const r = place({ rects: g.Rr, pref: [E.cx + E.side, yPref], side: 1, txMin: E.cx + Lo.bw }, E);
    if (!r) return null;
    push(g.Rr, r);
    const gp = place({ rects: g.Gr, pref: [r[0] + Lo.bw / 2 + g.zt + Math.max(10, 2 * Lo.u), r[1] + 0.05 * g.H + 0.35 * Lo.fsL],
      side: 1, maxSlide: E.attached && !E.relaxed ? 1 : 0 }, E);
    if (!gp) return null;
    push(g.Gr, gp);
    return { g, l, r, gp, relaxed: E.relaxed, obs: obs.slice() };
  }

  function apply({ g, l, r, gp, obs }) {
    const { fsS, fsM, fsN, fsL, bw, ins } = Lo;
    const { H, top, tl, midExt, tri, zt, spdY, unitY } = g;
    Object.assign(Lo, { H, top, bot: g.bot, g, obs: obs || [] });
    move(L, l[0], l[1]); move(R, r[0], r[1]); move(G, gp[0], gp[1]);

    // throttle bar (static parts)
    const x0 = q(-bw / 2);
    set(thrTrack, 'x', x0); set(thrTrack, 'y', q(top)); set(thrTrack, 'width', q(bw)); set(thrTrack, 'height', q(H));
    set(thrFill, 'x', q(x0 + ins)); set(thrFill, 'width', q(Math.max(1, bw - 2 * ins)));
    set(thrMid, 'x1', q(x0 - midExt)); set(thrMid, 'x2', q(x0 + bw + midExt));
    set(thrMid, 'y1', 0); set(thrMid, 'y2', 0);
    let d = '';
    const tx = x0 - 2;
    for (let i = 0; i <= 4; i++) {
      if (i === 2) continue;
      const y = q(top + (H * i) / 4);
      d += `M${q(tx - tl)} ${y}H${q(tx)}`;
    }
    set(thrTicks, 'd', d);
    // speed marker sits on the inner (crosshair-facing) side
    const mx = x0 + bw;
    set(spdLine, 'x1', q(x0 - 1)); set(spdLine, 'x2', q(mx + 2)); set(spdLine, 'y1', 0); set(spdLine, 'y2', 0);
    set(spdTri, 'd', `M${q(mx + 2)} 0L${q(mx + 2 + tri)} ${q(-tri * 0.6)}V${q(tri * 0.6)}Z`);
    set(spdNum, 'x', 0); set(spdNum, 'y', q(spdY)); set(spdNum, 'font-size', q(fsM));
    set(spdUnit, 'x', 0); set(spdUnit, 'y', q(unitY)); set(spdUnit, 'font-size', q(fsS));
    // REV badge: outer side of the speed number
    set(revBox, 'x', q(g.revX1 - g.revW)); set(revBox, 'y', q(g.revY)); set(revBox, 'width', q(g.revW));
    set(revBox, 'height', q(g.revH)); set(revBox, 'rx', q(g.revH * 0.22));
    set(revTxt, 'x', q(g.revX1 - g.revW / 2)); set(revTxt, 'y', q(g.revY + g.revH / 2 + fsS * 0.36)); set(revTxt, 'font-size', q(fsS));
    set(badgeTxt, 'font-size', q(fsS));
    badgeMode = ''; // force badge re-layout

    // rotation rates, left of the throttle bar
    set(rtHead, 'x', q(g.rv)); set(rtHead, 'y', q(g.ry0 - g.lh * 0.15)); set(rtHead, 'font-size', q(fsS));
    for (let i = 0; i < 3; i++) {
      const y = q(g.ry0 + g.lh * (i + 1));
      set(rtRows[i].k, 'x', q(g.rk)); set(rtRows[i].k, 'y', y); set(rtRows[i].k, 'font-size', q(fsS));
      set(rtRows[i].v, 'x', q(g.rv)); set(rtRows[i].v, 'y', y); set(rtRows[i].v, 'font-size', q(fsN));
    }

    // boost bar (static parts)
    const r0 = q(-bw / 2);
    set(abTrack, 'x', r0); set(abTrack, 'y', q(top)); set(abTrack, 'width', q(bw)); set(abTrack, 'height', q(H));
    set(abGlow, 'x', q(r0 - 1)); set(abGlow, 'y', q(top - 1)); set(abGlow, 'width', q(bw + 2)); set(abGlow, 'height', q(H + 2));
    for (const e of [abZone, abRed, abFill]) { set(e, 'x', q(r0 + ins)); set(e, 'width', q(Math.max(1, bw - 2 * ins))); }
    set(abZoneTick, 'x1', q(r0 + bw)); set(abZoneTick, 'x2', q(r0 + bw + zt));
    set(abPct, 'x', 0); set(abPct, 'y', q(spdY));
    set(abLbl, 'x', 0); set(abLbl, 'y', q(unitY)); set(abLbl, 'font-size', q(fsS));
    set(abLock, 'x', r0); set(abLock, 'y', q(g.lockY)); set(abLock, 'font-size', q(fsS));

    // G readout: value right-aligned on gx, unit just after it; anchor roll line underneath
    const gx = g.gx;
    set(gNum, 'x', q(gx)); set(gNum, 'y', 0); set(gNum, 'font-size', q(fsL));
    set(gUnit, 'x', q(gx + 0.25 * fsS)); set(gUnit, 'y', 0); set(gUnit, 'font-size', q(fsM));
    set(gRule, 'x1', 0); set(gRule, 'x2', q(gx + 0.25 * fsS + fsM * 0.9)); set(gRule, 'y1', q(g.ruleY)); set(gRule, 'y2', q(g.ruleY));
    set(gPeak, 'x', q(gx)); set(gPeak, 'y', q(g.peakY)); set(gPeak, 'font-size', q(fsN));
    set(gPeakLbl, 'x', q(gx + 0.25 * fsS)); set(gPeakLbl, 'y', q(g.peakY)); set(gPeakLbl, 'font-size', q(fsS));
    set(anc, 'x', 0); set(anc, 'y', q(g.ancY)); set(anc, 'font-size', q(fsS));
    set(ancV, 'font-size', q(fsN));
    if (g.lines === 1) { set(ancV, 'x', null); set(ancV, 'dy', null); }
    else { set(ancV, 'x', 0); set(ancV, 'dy', q(1.2 * fsN)); }
  }

  // Maneuver label: top centre when that clears the band and the blocks, else the nearest spot that does.
  function layoutManeuver() {
    if (!Lo.ready) return;
    const { w, h, cx, cy, fsS, rK } = Lo;
    show(M, !!manText);
    if (!manText) return;
    const ls = 0.12, fs = fsS;
    let tw = manText.length * (CW + ls) * fs;
    const maxW = w - 2 * EDGE - 2 * HALO;
    if (tw > maxW) { tw = maxW; set(M, 'textLength', q(tw)); set(M, 'lengthAdjust', 'spacingAndGlyphs'); }
    else { set(M, 'textLength', null); set(M, 'lengthAdjust', null); }
    const rects = [[-tw / 2 - HALO, -0.95 * fs, tw / 2 + HALO, 0.3 * fs + HALO]];
    const E = { w, h, cx, cy, r1: rK + TVI_PAD, r2: rK, step: 3, relaxed: false, obs: Lo.obs || [] };
    const pref = [cx, EDGE + 0.95 * fs];
    let p = place({ rects, pref }, E);
    if (!p) { E.r2 = 0; p = place({ rects, pref }, E); }
    if (!p) { E.r1 = Lo.xhR + 6; E.relaxed = true; p = place({ rects, pref }, E); }
    if (!p) p = pref;
    set(M, 'x', q(p[0])); set(M, 'y', q(p[1])); set(M, 'font-size', q(fs));
  }

  function layoutBadge(mode) {
    const { fsS } = Lo, g = Lo.g;
    const boost = mode === 'BOOST';
    const padX = fsS * 0.55, bh = g.badgeH;
    const bwid = mode.length * (CW + 0.08) * fsS + 2 * padX;
    const bx = g.badgeX1 - bwid, by = g.badgeY;
    set(badgeBox, 'x', q(bx)); set(badgeBox, 'y', q(by));
    set(badgeBox, 'width', q(bwid)); set(badgeBox, 'height', q(bh)); set(badgeBox, 'rx', q(bh * 0.22));
    set(badgeBox, 'fill', boost ? AMBER : '#0b1a1a');
    set(badgeBox, 'fill-opacity', boost ? '0.95' : '0.45');
    set(badgeBox, 'stroke', boost ? AMBER : MINT);
    set(badgeTxt, 'fill', boost ? '#14100a' : MINT);
    set(badgeTxt, 'stroke', boost ? AMBER : SHADOW); // the halo melts into the amber box
    set(badgeTxt, 'x', q(bx + bwid / 2)); set(badgeTxt, 'y', q(by + bh / 2 + fsS * 0.36));
    text(badgeTxt, mode);
  }

  function update(s) {
    last = s;
    if (!Lo.ready || !visible || !s) return;

    // --- view geometry: re-layout when the FOV or the keep-out cone changes
    const hf = clamp(fin(s.hfovDeg, 90), 10, 170), ko = clamp(fin(s.keepOutDeg, 22), 0, 85);
    if (hf !== Lo.hfov || ko !== Lo.keep) { Lo.hfov = hf; Lo.keep = ko; layout(); }

    const { top, bot, H } = Lo;
    const half = H / 2, mid = top + half;

    // --- mode badge
    const mode = s.mode === 'BOOST' ? 'BOOST' : 'SCM';
    if (mode !== badgeMode) { badgeMode = mode; layoutBadge(mode); }

    // --- maneuver label
    const man = typeof s.maneuver === 'string' ? s.maneuver.trim().toUpperCase() : '';
    if (man !== manText) { manText = man; if (man) text(M, man); layoutManeuver(); }

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

    // --- speed marker: |speed| / speedCap on the upper half; reversing plots below the mid mark
    const speed = num(s.speed), cap = num(s.speedCap);
    const reversing = speed < 0;
    const f = cap > 0 ? Math.abs(speed) / cap : 0;
    const over = f > 1.005;
    const off = clamp(f, 0, 1) * half;
    const my = q(reversing ? mid + Math.max(off, Math.min(3, half)) : mid - off);
    if (spdMark.__y !== my) { spdMark.__y = my; spdMark.setAttribute('transform', `translate(0 ${my})`); }
    const mc = over ? AMBER : WHITE;
    set(spdLine, 'stroke', mc); set(spdTri, 'fill', mc);
    const sr = Math.round(Math.abs(speed));
    text(spdNum, reversing && sr > 0 ? '−' + sr : String(sr));
    set(spdNum, 'fill', over ? AMBER : WHITE);
    show(rev, reversing);

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

    // --- anchoring roll rate: the roll that keeps the TVI parked on the guide ring
    const ar = s.anchorRollDps;
    const hasAnc = typeof ar === 'number' && Number.isFinite(ar);
    show(anc, hasAnc);
    if (hasAnc) {
      const gd = s.guideDeg;
      text(anc, typeof gd === 'number' && Number.isFinite(gd) ? `HOLD TVI @${Math.round(gd)}°: ` : 'HOLD TVI: ');
      const v = Math.round(ar);
      text(ancV, (v < 0 ? '−' + -v : String(v)) + ' °/s');
    }

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
