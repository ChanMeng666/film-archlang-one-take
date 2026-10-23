/* archlang-promo — one composition, every value a pure function of time: window.__seek(t).
   three.js draws everything (the editor, the plan, the Blender-built house, the HUD); the grid is 120 BPM. */
(function () {
'use strict';
const Q = new URLSearchParams(location.search);
const RW = +Q.get('w') || 1920, RH = +Q.get('h') || 1080, RENDER = Q.has('render');
const BPM = 120, BEAT = 60 / BPM, DUR = 32, FPS = 30;
const B = b => b * BEAT;

// ───────────────────────── maths ─────────────────────────
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const E = {
  lin: u => u, smooth: u => u * u * (3 - 2 * u),
  cubicInOut: u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  cubicOut: u => 1 - Math.pow(1 - u, 3), quartOut: u => 1 - Math.pow(1 - u, 4),
  expoOut: u => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  expoInOut: u => (u <= 0 ? 0 : u >= 1 ? 1 : u < .5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2),
  sineInOut: u => -(Math.cos(Math.PI * u) - 1) / 2, quadIn: u => u * u, cubicIn: u => u * u * u,
};
function spring(tau, zeta = .55, om = 22) {          // damped spring step response 0→1
  if (tau <= 0) return 0;
  const wd = om * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * om * tau) * (Math.cos(wd * tau) + (zeta * om / wd) * Math.sin(wd * tau));
}
const ring = (tau, decay = 9, om = 26) => (tau <= 0 ? 0 : Math.exp(-decay * tau) * Math.sin(om * tau));
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

// ───────────────────────── the time table (beats @120 BPM; B(b) = seconds) ─────────────────────────
const K = {
  walls: { w_lane: 8, w_east: 9, w_garden: 10, w_west: 11, w_hall: 12, w_bath: 13 },
  rooms: { r_live: 14, r_bath: 14.5, r_bed: 15 },
  doors: { d_front: 16, d_garden: 16.5, d_bed: 17, d_bath: 17.5 },
  wins: { win_west: 18, win_garden1: 18.5, win_garden2: 19, win_east: 19.5 },
  furn: [['fridge', 20], ['stove', 20.25], ['sink', 20.5], ['counter', 20.75], ['rug', 21], ['table', 21.5], ['sofa', 22],
         ['bed', 22.25], ['robe', 22.5], ['shower', 23], ['wc', 23.25], ['basin', 23.5]],
  grid: 4, north: 4.8, dimsLine: 5.5,
  title: 24, cmdStart: 24.1, result: 25, dims: [25, 26.5],
  lift: 28,                      // walls rise 28 … 30.5
  liftOrder: ['w_lane', 'w_east', 'w_garden', 'w_west', 'w_hall', 'w_bath'], liftBeat: [28, 28.5, 29, 29.5, 30, 30.5],
  furn3d: [['fridge', 30], ['stove', 30.25], ['sink', 30.5], ['counter', 30.75], ['rug', 31], ['table', 31.5], ['sofa', 32],
           ['bed', 32.25], ['robe', 32.5], ['shower', 33], ['wc', 33.25], ['basin', 33.5]],
  doorFront: 32.5, slide: 34, doorBed: 38,
  roofStart: 43, roofLand: 46, roofOff: 48, collapse: [48.5, 49.5, 50.5, 51.5, 52.25, 52.75], 
  logo: 56, letters: 56.5, slogan: [58, 58.5, 59], sub: 60, chips: 61,
};
const WALLS = ['w_lane', 'w_east', 'w_garden', 'w_west', 'w_hall', 'w_bath'];
const WALL_NODE = { w_lane: 'wall_lane', w_east: 'wall_east', w_garden: 'wall_garden', w_west: 'wall_west', w_hall: 'wall_hall', w_bath: 'wall_bath' };
const HOST = { win_west: 'w_west', win_garden1: 'w_garden', win_garden2: 'w_garden', win_east: 'w_east', slide_fixed: 'w_garden', slide_moving: 'w_garden', door_front: 'w_lane', door_bed: 'w_hall', door_bath: 'w_hall' };
const FURN_NODE = { fridge: 'furn_fridge', stove: 'furn_stove', sink: 'furn_sink', counter: 'furn_counter', rug: 'furn_rug', table: 'furn_table', sofa: 'furn_sofa', bed: 'furn_bed', robe: 'furn_robe', shower: 'furn_shower', wc: 'furn_wc', basin: 'furn_basin' };
const FP = { fridge: [100, 100, 700, 700], stove: [100, 900, 700, 1500], sink: [100, 1600, 700, 2400], counter: [100, 2500, 700, 3100], rug: [400, 2700, 3200, 6100],
  table: [1450, 2800, 2750, 3700], sofa: [350, 4000, 1250, 6100], bed: [5530, 4000, 7100, 6100], robe: [4350, 2650, 6250, 3250], shower: [6400, 100, 7400, 1000],
  wc: [4200, 1700, 4650, 2450], basin: [6700, 1950, 7400, 2450] };

// real source lines of examples/laneway-house.arch (comments and blank lines left out): [text, lands (beat), typing time (beats)]
const SRC = [
  ['plan "Laneway House" {', 2.4, 1.0], ['  units mm', 3.1, .5], ['  grid 50', 4.0, .5], ['  north up', 4.8, .5], ['  dims auto all', 5.5, .5], ['  site { street north }', 6.2, .6],
  ['  wall id=w_lane   exterior  thickness 200 { (0,0) (7500,0) }', 8, .85],
  ['  wall id=w_east   exterior  thickness 200 { (7500,0) (7500,6500) }', 9, .85],
  ['  wall id=w_garden exterior  thickness 200 { (0,6500) (7500,6500) }', 10, .85],
  ['  wall id=w_west   exterior  thickness 200 { (0,0) (0,6500) }', 11, .85],
  ['  wall id=w_hall   partition thickness 100 { (4200,0) (4200,6500) }', 12, .85],
  ['  wall id=w_bath   partition thickness 100 { (4200,2500) (7500,2500) }', 13, .85],
  ['  room id=r_live at (0,0) size 4200x6500 label "Living / Kitchen" uses living kitchen', 14, .7],
  ['  strip down at (4200,0) gap 0 width 3300 {', 14.25, .25],
  ['    room id=r_bath size 2500 label "Bath"    uses bath', 14.5, .25],
  ['    room id=r_bed  size 4000 label "Bedroom" uses bedroom', 15, .5],
  ['  }', 15.25, .2],
  ['  door id=d_front  on w_lane at 2100 width 900 hinge near start swing into r_live', 16, .8],
  ['  door id=d_garden sliding on w_garden at 2700 width 1800 slide left', 16.5, .45],
  ['  door id=d_bed    on w_hall at 5600 width 800 hinge left swing into r_bed', 17, .45],
  ['  door id=d_bath   pocket on w_hall at 900 width 800 slide right', 17.5, .45],
  ['  window on w_west   at 2400 width 1200', 18, .7], ['  window on w_garden at 700  width 1000', 18.5, .45],
  ['  window on w_garden at 5850 width 1600', 19, .45], ['  window on w_east   at 1500 width 600', 19.5, .45],
  ['  furniture fridge       against wall w_west offset 400  in r_live', 20, .75],
  ['  furniture stove        against wall w_west offset 1200 in r_live', 20.25, .3],
  ['  furniture kitchen_sink against wall w_west offset 2000 in r_live', 20.5, .3],
  ['  furniture counter      against wall w_west offset 2800 in r_live', 20.75, .3],
  ['  furniture rug   in r_live anchor bottom-left inset 400 size 2800x3400', 21, .45],
  ['  furniture table  in r_live centered size 1300x900 label "Table"', 21.5, .45],
  ['  furniture sofa   in r_live anchor bottom-left flush inset 250 size 900x2000  label "Sofa"', 22, .45],
  ['  furniture bed    in r_bed  anchor bottom-right flush inset 250 size 1500x2000 label "Bed"', 22.25, .3],
  ['  furniture robe   in r_bed  anchor top-left     flush inset 200 size 1800x600  label "Wardrobe"', 22.5, .3],
  ['  furniture shower in r_bath anchor top-right    flush size 900x900', 23, .45],
  ['  furniture wc     in r_bath anchor bottom-left  flush size 400x700', 23.25, .3],
  ['  furniture basin  in r_bath anchor bottom-right flush size 600x450', 23.5, .3],
  ['  title { project "Laneway House" drawn_by "ArchLang" date "2026-08-16" }', 24, .45],
  ['}', 24.25, .2],
];
const CMD = '$ archlang compile laneway-house.arch -o plan.svg --json';
const RESULT = [['ok', 'true'], ['diagnostics', '[]'], ['rooms', '3'], ['area', '48.75 m²']];   // from the real compile + describe of this file

// ───────────────────────── events for the score (name, time, extras) ─────────────────────────
const EVENTS = [];
const ev = (name, b, o) => EVENTS.push(Object.assign({ name, t: B(b) }, o || {}));
ev('intro', 0); SRC.forEach(l => ev('type', l[1], { len: l[2], chars: l[0].length })); ev('type', K.result, { len: K.result - K.cmdStart, chars: CMD.length, cmd: 1 }); ev('grid', K.grid); ev('north', K.north);
WALLS.forEach(w => ev('wall', K.walls[w], { id: w }));
Object.entries(K.rooms).forEach(([r, b]) => ev('room', b, { id: r }));
Object.entries(K.doors).forEach(([r, b]) => ev('door', b, { id: r }));
Object.entries(K.wins).forEach(([r, b]) => ev('window', b, { id: r }));
K.furn.forEach(([r, b]) => ev('furn2d', b, { id: r }));
ev('title', K.title); ev('result', K.result); ev('dims', K.dims[0]); ev('still', 26.5);
K.liftBeat.forEach((b, i) => ev('rise', b, { id: K.liftOrder[i] }));
ev('lift', K.lift);
K.furn3d.forEach(([r, b]) => ev('furn3d', b, { id: r }));
ev('door_open', K.doorFront, { id: 'd_front' }); ev('slide', K.slide); ev('door_open', K.doorBed, { id: 'd_bed' });
ev('whoosh_up', 41, { dur: 2 }); ev('roof_start', K.roofStart); ev('roof_land', K.roofLand); ev('roof_off', K.roofOff);
K.collapse.forEach((b, i) => ev('collapse', b, { id: i }));
ev('logo', K.logo); ev('letters', K.letters); K.slogan.forEach((b, i) => ev('slogan', b, { id: i })); ev('sub', K.sub); ev('chips', K.chips);

// ───────────────────────── globals ─────────────────────────
const THREE = window.THREE, X = window.THREEX;
const D = window.__DATA;   // { svg, logo, glb, fonts }
const WALLCOL = '#f4f1ea';
let renderer, scene, cam, composer, bokeh, hudScene, hudCam, hudMesh, hudCtx, hudTex, acc, accCtx;
let editorCv, editorCtx, editorTex, planCv, planCtx, planTex, planMesh, edMesh, ground, sun;
let SIG = [], nodes = {}, houseGroup, roofNode, planItems = [], logoImgs = {}, T_LAST = -1;
const PLAN_S = 2560 / 10718.4;          // canvas px per mm
const VB = [-1609.2, -1609.2, 10718.4, 11166];
const ED = { w: 8.0, h: 7.1, cx: -5.0, cz: 3.3, pw: 2304, ph: 2045 };

// ───────────────────────── editor card (canvas → texture) ─────────────────────────
const KW = new Set('plan units grid north dims site street wall room strip door window furniture title project drawn_by date at size on width hinge swing into slide label uses in anchor inset flush centered against offset gap down up left right near start exterior partition thickness sliding pocket id mm auto all'.split(' '));
function tokenize(s) {
  const out = []; const re = /("[^"]*")|(\d+x\d+|\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|(\s+)|(.)/g; let m;
  while ((m = re.exec(s))) {
    if (m[1]) out.push([m[0], '#1f7a4d']); else if (m[2]) out.push([m[0], '#0e5484']);
    else if (m[3]) out.push([m[0], KW.has(m[0]) ? '#6b3ae0' : (/^[wrd]_/.test(m[0]) ? '#b3541e' : '#1c2430')]);
    else if (m[4]) out.push([m[0], null]); else out.push([m[0], '#8a93a1']);
  }
  return out;
}
const LINE_H = 52, FS = 38, CH = FS * 0.6, GUT = 168, TOP = 108;
function lineProgress(i, t) { const [, land, d] = SRC[i]; return E.cubicOut(seg(t, B(land - d), B(land))); }
function drawEditor(t) {
  const c = editorCtx, W = ED.pw, H = ED.ph;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#fbfbfc'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#eceef2'; c.fillRect(0, 0, W, 84);
  ['#d4d7de', '#d4d7de', '#d4d7de'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(54 + i * 40, 42, 11, 0, 6.3); c.fill(); });
  c.font = '500 30px "IBM Plex Mono"'; c.fillStyle = '#5b6472'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText('laneway-house.arch', 200, 43);
  const TERM_H = 330, codeH = H - 84 - TERM_H;
  // typing state
  let last = -1, lastStart = -1;
  SRC.forEach((s, i) => { const st = B(s[1] - s[2]); if (t >= st && st >= lastStart) { last = i; lastStart = st; } });
  const lastAll = SRC.reduce((a, s, i) => (t >= B(s[1] - s[2]) ? i : a), -1);
  const scrollRows = Math.max(0, lastAll - 28);
  const scroll = scrollRows * LINE_H;
  c.save(); c.beginPath(); c.rect(0, 84, W, codeH); c.clip();
  c.font = `500 ${FS}px "IBM Plex Mono"`; c.textBaseline = 'alphabetic';
  // highlight band for `dims auto all` while the dimensions are placed
  if (t >= B(K.dims[0]) && t < B(K.dims[1] + 1.2)) {
    const k = E.smooth(seg(t, B(K.dims[0]), B(K.dims[0] + .25))) * (1 - E.smooth(seg(t, B(K.dims[1]), B(K.dims[1] + 1.2))));
    c.fillStyle = `rgba(128,82,255,${.14 * k})`; c.fillRect(0, TOP - 36 + 4 * LINE_H - scroll + 12, W, LINE_H);
  }
  for (let i = 0; i <= lastAll; i++) {
    const y = TOP + i * LINE_H - scroll; if (y < 84 || y > 84 + codeH + 40) continue;
    const p = lineProgress(i, t), n = Math.round(SRC[i][0].length * p);
    c.fillStyle = '#a3a9b5'; c.textAlign = 'right'; c.fillText(String(i + 1), GUT - 40, y); c.textAlign = 'left';
    let x = GUT, used = 0;
    for (const [tx, col] of tokenize(SRC[i][0])) {
      if (used >= n) break; const part = tx.slice(0, n - used); used += tx.length;
      if (col) { c.fillStyle = col; c.fillText(part, x, y); } x += part.length * CH;
    }
    if (i === last && p < 1 || (i === lastAll && t < B(SRC[i][1]) + .6)) {  // caret
      const on = (p < 1) || (Math.floor(t / (BEAT / 2)) % 2 === 0);
      if (on) { c.fillStyle = '#8052ff'; c.fillRect(x + 2, y - 31, 5, 40); }
    }
  }
  if (lastAll < 0 && t > .35 && Math.floor(t / (BEAT / 2)) % 2 === 0) { c.fillStyle = '#8052ff'; c.fillRect(GUT + 2, TOP - 31, 5, 40); }
  if (lastAll < 0) { c.fillStyle = '#a3a9b5'; c.textAlign = 'right'; c.fillText('1', GUT - 40, TOP); }
  c.restore();
  c.fillStyle = '#d9dce3'; c.fillRect(GUT - 14, 84, 2, codeH);
  // terminal
  const ty = H - TERM_H; c.fillStyle = '#eceef2'; c.fillRect(0, ty, W, TERM_H); c.fillStyle = '#c9ced8'; c.fillRect(0, ty, W, 3);
  c.font = '500 34px "IBM Plex Mono"'; c.textBaseline = 'alphabetic';
  const cp = seg(t, B(K.cmdStart), B(K.result)), nn = Math.round(CMD.length * E.cubicOut(cp));
  if (t >= B(K.cmdStart)) {
    c.fillStyle = '#6b3ae0'; c.fillText(CMD.slice(0, Math.min(nn, 1)), 60, ty + 70);
    c.fillStyle = '#1c2430'; c.fillText(CMD.slice(1, nn), 60 + CH * 34 / 36 * 1, ty + 70);
    if (t < B(K.result) && Math.floor(t / (BEAT / 4)) % 2 === 0) { c.fillStyle = '#8052ff'; c.fillRect(60 + nn * 34 * .6 + 2, ty + 38, 5, 40); }
  } else if (t > B(23.2)) { c.fillStyle = '#8052ff'; c.fillText('$', 60, ty + 70); }
  if (t >= B(K.result)) {
    const k = spring(t - B(K.result), .6, 26);
    c.globalAlpha = clamp(k * 1.6); c.save(); c.translate(0, (1 - k) * 14);
    c.fillStyle = '#1f7a4d'; c.font = '600 40px "IBM Plex Mono"'; c.fillText('✓', 60, ty + 150);
    let x = 120; c.font = '500 40px "IBM Plex Mono"';
    RESULT.forEach(([a, b2], i) => { const a0 = clamp((t - B(K.result) - i * .07) * 10); c.globalAlpha = a0; c.fillStyle = '#5b6472'; c.fillText(a + ' ', x, ty + 150); x += (a.length + 1) * 24; c.fillStyle = '#1c2430'; c.fillText(b2, x, ty + 150); x += (b2.length + 3) * 24; });
    c.globalAlpha = clamp((t - B(K.result) - .3) * 5); c.font = '400 32px "IBM Plex Mono"'; c.fillStyle = '#5b6472';
    c.fillText('“Laneway House” — a 3-room floor plan, 4 doors, 4 windows', 120, ty + 230);
    c.restore(); c.globalAlpha = 1;
  }
  SIG.push(lastAll, nn0(t), cp, t >= B(K.result) ? spring(t - B(K.result), .6, 26) : 0, Math.floor(t / (BEAT / 2)), scrollRows);
  editorTex.needsUpdate = true;
}
const nn0 = t => SRC.reduce((a, s, i) => a + (t >= B(s[1] - s[2]) ? lineProgress(i, t) : 0), 0);

// ───────────────────────── the plan: the compiled SVG drawn by us, element by element ─────────────────────────
function parsePlan() {
  const doc = new DOMParser().parseFromString(D.svg, 'image/svg+xml'); const root = doc.documentElement;
  const num = s => s.split(/[\s,]+/).filter(Boolean).map(Number);
  const nearest = (cx, cy, list) => { let best = null, bd = 1e18; for (const [k, [x, y]] of Object.entries(list)) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = k; } } return best; };
  const DOORC = { d_front: [2100, 0], d_garden: [2700, 6500], d_bed: [4200, 5600], d_bath: [4200, 900] };
  const WINC = { win_west: [0, 2400], win_garden1: [700, 6500], win_garden2: [5850, 6500], win_east: [7500, 1500] };
  const fpOrder = Object.entries(FP).sort((a, b) => (a[1][2] - a[1][0]) * (a[1][3] - a[1][1]) - (b[1][2] - b[1][0]) * (b[1][3] - b[1][1]));
  const furnOf = (cx, cy) => { for (const [k, r] of fpOrder) if (cx >= r[0] - 60 && cx <= r[2] + 60 && cy >= r[1] - 60 && cy <= r[3] + 60) return k;
    let best = null, bd = 1e18; for (const [k, r] of Object.entries(FP)) { const dx = Math.max(r[0] - cx, 0, cx - r[2]), dy = Math.max(r[1] - cy, 0, cy - r[3]); const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } } return best; };
  let idx = 0;
  for (const g of root.children) {
    if (g.tagName !== 'g') continue; const layer = g.getAttribute('id');
    for (const el of g.children) {
      const tag = el.tagName; const a = n => el.getAttribute(n); let cx = 0, cy = 0, cls = layer, d = null, p2 = null;
      const it = { layer, tag, i: idx++, fill: a('fill'), stroke: a('stroke'), sw: +a('stroke-width') || 0, dash: a('stroke-dasharray') };
      if (tag === 'polygon') { const v = num(a('points')); let sx = 0, sy = 0, n = v.length / 2; for (let k = 0; k < v.length; k += 2) { sx += v[k]; sy += v[k + 1]; } cx = sx / n; cy = sy / n; p2 = new Path2D('M' + v.map((x, k) => (k % 2 ? ' ' : ' L') + x).join('').slice(2) + 'Z'); }
      else if (tag === 'path') { d = a('d'); const v = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number); cx = (v[0] + v[v.length - 2]) / 2; cy = (v[1] + v[v.length - 1]) / 2; p2 = new Path2D(d); it.arc = /A/.test(d); }
      else if (tag === 'line') { it.x1 = +a('x1'); it.y1 = +a('y1'); it.x2 = +a('x2'); it.y2 = +a('y2'); cx = (it.x1 + it.x2) / 2; cy = (it.y1 + it.y2) / 2; it.len = Math.hypot(it.x2 - it.x1, it.y2 - it.y1); }
      else if (tag === 'circle') { it.cx = +a('cx'); it.cy = +a('cy'); it.r = +a('r'); cx = it.cx; cy = it.cy; }
      else if (tag === 'rect') { it.x = +a('x'); it.y = +a('y'); it.w = +a('width'); it.h = +a('height'); cx = it.x + it.w / 2; cy = it.y + it.h / 2; }
      else if (tag === 'text') { it.x = +a('x'); it.y = +a('y'); it.fs = +a('font-size'); it.anchor = a('text-anchor'); it.fw = a('font-weight'); it.tf = a('transform'); it.txt = el.textContent; cx = it.x; cy = it.y; }
      else continue;
      it.cx0 = cx; it.cy0 = cy; it.p2 = p2;
      if (layer === 'A-FLOR') it.grp = ['flor', cx < 4200 ? 'r_live' : cy < 2500 ? 'r_bath' : 'r_bed'];
      else if (layer === 'A-WALL') it.grp = ['wall'];
      else if (layer === 'A-DOOR') it.grp = ['door', nearest(cx, cy, DOORC)];
      else if (layer === 'A-GLAZ') it.grp = ['win', nearest(cx, cy, WINC)];
      else if (layer === 'A-FURN') it.grp = ['furn', furnOf(cx, cy)];
      else if (layer === 'A-ANNO-TEXT') it.grp = ['label', cx < 4200 ? 'r_live' : cy < 2500 ? 'r_bath' : 'r_bed'];
      else {
        const txt = it.txt || '';
        if (tag === 'polygon' || txt === 'N') it.grp = ['north'];
        else if (cy > 7700 && cx > 5000) it.grp = ['title'];
        else if (cy > 7700) it.grp = ['scale'];
        else it.grp = ['dim'];
      }
      planItems.push(it);
    }
  }
  const dims = planItems.filter(i => i.grp[0] === 'dim'); dims.forEach((it, k) => { it.dk = k / dims.length; });
}
let pochePat = null;
function makePoche() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#e9e4db'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#b9b1a4'; x.lineWidth = 8.62 * 64 / 100.1; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 64); x.stroke();
  pochePat = planCtx.createPattern(c, 'repeat'); pochePat.setTransform(new DOMMatrix().rotate(45).scale(100.1 / 64));
}
const WALLBAND = { w_lane: [-100, -100, 7700, 200, 'x'], w_east: [7400, -100, 200, 6700, 'y'], w_garden: [-100, 6400, 7700, 200, 'x'], w_west: [-100, -100, 200, 6700, 'y'], w_hall: [4150, 100, 100, 6300, 'y'], w_bath: [4250, 2450, 3250, 100, 'x'] };
function wallClip(t) {
  const p = new Path2D(); let any = false;
  for (const w of WALLS) {
    const [x, y, w0, h0, ax] = WALLBAND[w]; const k = E.expoOut(seg(t, B(K.walls[w]) - .2, B(K.walls[w]) + .3));
    if (k <= 0) continue; any = true;
    if (ax === 'x') p.rect(x - 2, y - 2, w0 * k + 4, h0 + 4); else p.rect(x - 2, y - 2, w0 + 4, h0 * k + 4);
  }
  return any ? p : null;
}
function drawGrid(c, t) {
  const k = E.smooth(seg(t, B(K.grid) - .3, B(K.grid) + .5)); if (k <= 0) return;
  c.save(); c.globalAlpha = .55 * k; c.fillStyle = '#c7c1b3';
  const x0 = Math.floor(-1600 / 500) * 500, x1 = 9100, y0 = -1600, y1 = 9500;
  for (let y = y0; y <= y1; y += 500) for (let x = x0; x <= x1; x += 500) { const d = Math.hypot(x - 3750, y - 3250) / 6500; if (seg(t, B(K.grid) - .2, B(K.grid) + .9) < d * .9) continue; c.beginPath(); c.arc(x, y, (x % 1000 === 0 && y % 1000 === 0) ? 11 : 6.5, 0, 6.3); c.fill(); }
  c.restore();
}
function drawPlan(t) {
  const c = planCtx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, planCv.width, planCv.height);
  c.setTransform(PLAN_S, 0, 0, PLAN_S, -VB[0] * PLAN_S, -VB[1] * PLAN_S); c.lineJoin = 'miter'; c.miterLimit = 2;
  drawGrid(c, t);
  const wc = wallClip(t);
  const dimK = E.smooth(seg(t, B(K.dims[0]), B(K.dims[1])));
  for (const it of planItems) {
    const [g, key] = it.grp; let al = 1, sc = 1, draw = 1, pv = null;
    if (g === 'flor') { const tt = B(K.rooms[key]); al = E.smooth(seg(t, tt, tt + .35)); sc = lerp(.97, 1, al); }
    else if (g === 'wall') { if (!wc) continue; }
    else if (g === 'door') { const tt = B(K.doors[key]); const k = spring(t - tt, .55, 24); al = clamp((t - tt) * 14); sc = lerp(.7, 1, k); draw = it.arc ? E.expoOut(seg(t, tt, tt + .45)) : 1; }
    else if (g === 'win') { const tt = B(K.wins[key]); const k = spring(t - tt, .55, 24); al = clamp((t - tt) * 14); sc = lerp(.8, 1, k); }
    else if (g === 'furn') { const tt = B(K.furn.find(f => f[0] === key)[1]); const k = spring(t - tt, .5, 26); al = clamp((t - tt) * 12); sc = lerp(.82, 1, k); }
    else if (g === 'label') { const tt = B(K.rooms[key]) + .2; al = E.smooth(seg(t, tt, tt + .3)); }
    else if (g === 'north') { al = E.smooth(seg(t, B(K.north), B(K.north) + .35)); }
    else if (g === 'title') { al = E.smooth(seg(t, B(K.title), B(K.title) + .4)); }
    else if (g === 'scale') { al = E.smooth(seg(t, B(K.dims[0]) + .3, B(K.dims[1]))); }
    else if (g === 'dim') { const s0 = it.dk * .62; draw = E.cubicOut(clamp((dimK - s0) / .38)); al = draw > 0 ? 1 : 0; }
    if (al <= 0.001 || draw <= 0) continue;
    SIG.push(al, sc, draw);
    // plan fades into the volume at the lift
    const fade = clamp(1 - E.smooth(seg(t, B(K.lift), B(K.lift + 3))) + E.smooth(seg(t, B(K.collapse[0]), B(K.collapse[5] + 1))));
    if (fade <= 0.001) continue;
    c.save(); c.globalAlpha = al * fade;
    if (sc !== 1) { c.translate(it.cx0, it.cy0); c.scale(sc, sc); c.translate(-it.cx0, -it.cy0); }
    if (g === 'wall') { c.beginPath(); c.clip(wc); }
    if (it.tag === 'text') {
      c.font = `${it.fw === '600' ? 600 : 600} ${it.fs}px Archivo`; c.textAlign = it.anchor === 'middle' ? 'center' : (it.anchor === 'end' ? 'right' : 'left'); c.textBaseline = 'middle'; c.fillStyle = it.fill || '#000';
      const m = it.tf && it.tf.match(/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);
      if (m && +m[1] !== 0) { c.translate(+m[2], +m[3]); c.rotate(+m[1] * Math.PI / 180); c.fillText(it.txt, 0, 0); } else c.fillText(it.txt, it.x, it.y);
    } else {
      const fill = it.fill && it.fill !== 'none' ? (it.fill.startsWith('url') ? pochePat : it.fill) : null;
      const stroke = it.stroke && it.stroke !== 'none' ? it.stroke : null;
      if (it.dash) c.setLineDash(it.dash.split(/[\s,]+/).map(Number)); else c.setLineDash([]);
      if (it.tag === 'line') {
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = it.sw; c.beginPath(); c.moveTo(it.x1, it.y1); c.lineTo(it.x1 + (it.x2 - it.x1) * draw, it.y1 + (it.y2 - it.y1) * draw); c.stroke(); }
      } else if (it.tag === 'circle') {
        c.beginPath(); c.arc(it.cx, it.cy, it.r, 0, 6.3); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = it.sw; c.stroke(); }
      } else if (it.tag === 'rect') {
        if (fill) { c.fillStyle = fill; c.fillRect(it.x, it.y, it.w, it.h); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = it.sw; c.strokeRect(it.x, it.y, it.w, it.h); }
      } else {
        if (fill) { c.fillStyle = fill; c.fill(it.p2, it.layer === 'A-WALL' ? 'evenodd' : 'nonzero'); }
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = it.sw; if (draw < 1) c.setLineDash([2400 * draw, 5000]); c.stroke(it.p2); }
      }
    }
    c.restore();
  }
  SIG.push(wc ? 1 : 0, dimK);
  planTex.needsUpdate = true;
}

// ───────────────────────── the camera ─────────────────────────
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TD_FOV = 30, TD_K = 1 / (2 * Math.tan(TD_FOV * Math.PI / 360) * (RW / RH));   // eye height per metre of visible width
const top = (cx, cz, w) => ({ eye: [cx, w * TD_K, cz], tgt: [cx, 0, cz], up: [0, 0, -1], fov: TD_FOV });
const UP = [0, 1, 0];
function KEY(t, o, ease) { return Object.assign({ t, ease: ease || E.cubicInOut, up: UP, fov: 34 }, o); }
const CAMKEYS = [
  KEY(0, top(-5.0, 3.3, 11.6)),
  KEY(1.9, top(-5.0, 3.35, 10.6), E.cubicOut),
  KEY(3.9, top(0.05, 3.3, 17.9), E.cubicInOut),
  KEY(8.0, top(0.15, 3.25, 17.4), E.sineInOut),
  KEY(12.9, top(0.3, 3.3, 16.9), E.sineInOut),
  KEY(14.0, top(0.3, 3.3, 16.9), E.lin),
  KEY(16.0, { eye: [-2.4, 12.2, 17.2], tgt: [1.4, 0.4, 3.3], fov: 34 }, E.cubicInOut),
  KEY(17.0, { eye: [2.7, 1.75, 11.0], tgt: [2.7, 1.2, 6.2], fov: 52 }, E.expoInOut),
  KEY(18.0, { eye: [2.5, 1.55, 6.1], tgt: [1.0, 0.85, 4.3], fov: 56 }, E.sineInOut),
  KEY(19.0, { eye: [3.5, 1.5, 5.6], tgt: [5.0, 1.0, 5.55], fov: 56 }, E.sineInOut),
  KEY(20.0, { eye: [5.3, 1.45, 4.3], tgt: [6.4, 0.5, 5.2], fov: 56 }, E.sineInOut),
  KEY(20.6, { eye: [5.4, 1.45, 4.2], tgt: [6.5, 0.5, 5.3], fov: 56 }, E.lin),
  KEY(21.8, { eye: [-3.4, 9.2, 15.6], tgt: [2.9, 0.3, 3.3], fov: 38 }, E.expoInOut),
  KEY(23.9, { eye: [-3.0, 9.0, 15.2], tgt: [2.9, 0.3, 3.3], fov: 38 }, E.sineInOut),
  KEY(26.2, top(3.75, 3.3, 14.4), E.cubicInOut),
  KEY(DUR, top(3.75, 3.3, 14.4), E.lin),
];
const FOCKEYS = [   // [time, point] — the DOF rack: a spring to the next subject on the beat
  [0, null], [1.0, 'tgt'],
  [16.0, [1.4, 0.4, 3.3]], [17.0, [2.7, 1.0, 6.5]], [18.0, [0.8, 0.45, 5.0]], [18.5, [2.1, 0.75, 3.25]], [19.0, [4.2, 1.2, 5.6]],
  [19.5, [6.35, 0.45, 5.1]], [20.0, [5.35, 1.0, 3.0]], [21.0, [3.75, 1.0, 3.3]], [26.0, 'tgt'],
];
const A3 = a => V(a[0], a[1], a[2]);
function camAt(t) {
  let i = 0; while (i < CAMKEYS.length - 2 && t >= CAMKEYS[i + 1].t) i++;
  const a = CAMKEYS[i], b = CAMKEYS[i + 1]; const u = b.ease(seg(t, a.t, b.t));
  const L = (p, q) => [lerp(p[0], q[0], u), lerp(p[1], q[1], u), lerp(p[2], q[2], u)];
  const eye = A3(L(a.eye, b.eye)), tgt = A3(L(a.tgt, b.tgt)), up = A3(L(a.up, b.up)).normalize(), fov = lerp(a.fov, b.fov, u);
  // hand: slow float, fades out in the holds; kick pulse on the grid
  const mv = 1 - seg(t, 13, 14) * (1 - seg(t, 14, 14.01)) - (t > 22 && t < 24 ? .8 : 0) - (t > 26.2 ? 1 : 0);
  const hand = clamp(mv, 0, 1) * (t > 3.9 ? 1 : .3);
  const dx = (Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.3 + 1) * 0.3) * 0.045 * hand * (eye.y > 5 ? 3 : 1), dz = Math.sin(t * 0.55 + 2) * 0.04 * hand * (eye.y > 5 ? 3 : 1);
  eye.x += dx; eye.z += dz; tgt.x += dx * .5; tgt.z += dz * .5;
  // punch: the camera leans in on each landing (width × (1 − k))
  let punch = 0; for (const e of PUNCH) { const tau = t - e.t; if (tau > 0 && tau < .6) punch += e.a * Math.max(0, spring(tau, .45, 30) - 1 + .0) + e.a * .5 * ring(tau, 11, 30) * -1; }
  const toward = tgt.clone().sub(eye).multiplyScalar(punch * 1.0); eye.add(toward);
  return { eye, tgt, up, fov };
}
const PUNCH = [];
WALLS.forEach(w => PUNCH.push({ t: B(K.walls[w]), a: .028 }));
PUNCH.push({ t: B(K.rooms.r_live), a: .02 }, { t: B(K.doors.d_front), a: .02 }, { t: B(K.wins.win_west), a: .02 }, { t: B(K.furn[0][1]), a: .02 }, { t: B(K.furn[4][1]), a: .02 }, { t: B(K.furn[9][1]), a: .02 }, { t: B(K.result), a: .03 });
K.liftBeat.forEach(b => PUNCH.push({ t: B(b), a: .03 })); PUNCH.push({ t: B(K.lift), a: .05 }, { t: B(K.roofLand), a: .025 });
function focusDist(t, eye, tgt) {
  const pts = FOCKEYS.map(k => k[1] === 'tgt' ? tgt.clone() : (k[1] ? A3(k[1]) : null));
  let cur = pts[0] || tgt.clone(); let mul = 1;
  for (let i = 1; i < FOCKEYS.length; i++) { const kt = FOCKEYS[i][0]; if (t < kt) break; const to = pts[i] || tgt.clone(); const k = spring(t - kt, .8, 22); const prev = (i > 1 ? (pts[i - 1] || tgt.clone()) : cur); cur = prev.clone().lerp(to, clamp(k, -.1, 1.1)); }
  let d = eye.distanceTo(cur);
  const intro = 1 - E.expoOut(seg(t, .15, 1.15)); d *= 1 - intro * .62;     // opening: the card racks into focus
  return d;
}

// ───────────────────────── the scene ─────────────────────────
function build() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(RW, RH, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  const cv = renderer.domElement; cv.id = 'gl'; cv.style.cssText = `width:${RW}px;height:${RH}px;display:block`; document.getElementById('stage').appendChild(cv);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#f1ede3');
  cam = new THREE.PerspectiveCamera(34, RW / RH, 0.3, 90);
  // ground = paper
  ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  // lights
  scene.add(new THREE.HemisphereLight('#ffffff', '#e5dccb', 1.35));
  sun = new THREE.DirectionalLight('#fff8ee', 2.7); sun.position.set(-5.5, 13, 9); sun.target.position.set(3.2, 0, 3.4); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 40; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3.5;
  // plan sheet
  planCv = document.createElement('canvas'); planCv.width = 2560; planCv.height = Math.round(2560 * VB[3] / VB[2]); planCtx = planCv.getContext('2d');
  planTex = new THREE.CanvasTexture(planCv); planTex.colorSpace = THREE.SRGBColorSpace; planTex.anisotropy = 8;
  planMesh = new THREE.Mesh(new THREE.PlaneGeometry(VB[2] / 1000, VB[3] / 1000), new THREE.MeshStandardMaterial({ map: planTex, transparent: true, roughness: 1, depthWrite: false }));
  planMesh.rotation.x = -Math.PI / 2; planMesh.position.set((VB[0] + VB[2] / 2) / 1000, 0.004, (VB[1] + VB[3] / 2) / 1000); planMesh.receiveShadow = true; planMesh.renderOrder = 1; scene.add(planMesh);
  // editor card
  editorCv = document.createElement('canvas'); editorCv.width = ED.pw; editorCv.height = ED.ph; editorCtx = editorCv.getContext('2d');
  editorTex = new THREE.CanvasTexture(editorCv); editorTex.colorSpace = THREE.SRGBColorSpace; editorTex.anisotropy = 8;
  edMesh = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(ED.w, 0.05, ED.h), [0, 1, 2, 3, 4, 5].map(i => i === 2 ? new THREE.MeshStandardMaterial({ map: editorTex, roughness: .9 }) : new THREE.MeshStandardMaterial({ color: '#dfe2e8', roughness: .8 })));
  card.castShadow = true; card.receiveShadow = true; edMesh.add(card); edMesh.position.set(ED.cx, 0.025, ED.cz); scene.add(edMesh);
  // house
  const gl = new X.GLTFLoader(); houseGroup = new THREE.Group(); scene.add(houseGroup);
  const M = {
    m_wall: new THREE.MeshStandardMaterial({ color: '#f6f3ec', roughness: .9 }), m_slab: new THREE.MeshStandardMaterial({ color: '#dcd7cb', roughness: .95 }),
    m_floor_live: new THREE.MeshStandardMaterial({ color: '#d2bd98', roughness: .6 }), m_floor_bath: new THREE.MeshStandardMaterial({ color: '#cdd2d7', roughness: .4 }), m_floor_bed: new THREE.MeshStandardMaterial({ color: '#dccbb0', roughness: .65 }),
    m_glass: new THREE.MeshStandardMaterial({ color: '#a9cdee', roughness: .08, transparent: true, opacity: .3, depthWrite: false }), m_frame: new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: .45 }),
    m_wood: new THREE.MeshStandardMaterial({ color: '#c39662', roughness: .55 }), m_white: new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: .5 }), m_steel: new THREE.MeshStandardMaterial({ color: '#c4c8cf', roughness: .35, metalness: .6 }),
    m_plum: new THREE.MeshStandardMaterial({ color: '#8052ff', roughness: .6 }), m_rug: new THREE.MeshStandardMaterial({ color: '#aeb9c7', roughness: .95 }), m_linen: new THREE.MeshStandardMaterial({ color: '#f1eee8', roughness: .9 }),
    m_dark: new THREE.MeshStandardMaterial({ color: '#3d4049', roughness: .5 }), m_roof: new THREE.MeshStandardMaterial({ color: '#e7e0d3', roughness: .85 }), m_fascia: new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: .6 }), m_porcelain: new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: .25 }),
  };
  return new Promise((res, rej) => {
    const bin = Uint8Array.from(atob(D.glb), c => c.charCodeAt(0));
    gl.parse(bin.buffer, '', gltf => {
      gltf.scene.traverse(o => {
        if (o.isMesh) { const nm = (n) => (n || '').replace(/\.\d+$/, '');
          const mats = Array.isArray(o.material) ? o.material : [o.material]; const mm = mats.map(m => M[nm(m.name)] || m); o.material = Array.isArray(o.material) ? mm : mm[0];
          o.castShadow = !/glass|floor_/.test(o.name) ; o.receiveShadow = true; if (/win_|slide_/.test(o.parent && o.parent.name || '')) o.castShadow = false; }
        if (o.name) nodes[o.name] = o.isMesh && o.parent && o.parent.name && o.parent.type === 'Group' && !nodes[o.parent.name] ? o : (nodes[o.name] || o);
      });
      // glTF names the node and (when it has >1 material) its mesh with the same name; take the outermost with that name
      gltf.scene.children.forEach(ch => { nodes[ch.name] = ch; });
      houseGroup.add(gltf.scene);
      roofNode = nodes.roof;
      // remember rest poses
      Object.values(nodes).forEach(n => { n.userData.p0 = n.position.clone(); n.userData.r0 = n.rotation.clone(); n.userData.s0 = n.scale.clone(); });
      res();
    }, rej);
  });
}

function setupPost() {
  composer = new X.EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(RW, RH);
  composer.addPass(new X.RenderPass(scene, cam));
  bokeh = new X.BokehPass(scene, cam, { focus: 15, aperture: 0.0, maxblur: 0.012 });
  composer.addPass(bokeh);
  composer.addPass(new X.OutputPass());
}

// ───────────────────────── HUD (screen-space captions and the end card) ─────────────────────────
function setupHud() {
  hudCv = document.createElement('canvas'); hudCv.width = RW; hudCv.height = RH; hudCtx = hudCv.getContext('2d');
  hudTex = new THREE.CanvasTexture(hudCv); hudTex.colorSpace = THREE.SRGBColorSpace;
  hudScene = new THREE.Scene(); hudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false })); hudScene.add(hudMesh);
}
let hudCv;
const INK = '#1c2430', PLUM = '#8052ff', PLUMD = '#6b3ae0', PAPER = '#f5f2ea';
function pill(c, x, y, txt, font, pad, h, fill, col, stroke) {
  c.font = font; const w = c.measureText(txt).width + pad * 2; const r = h / 2;
  c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  c.fillStyle = col; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, x + pad, y + h / 2 + 2); return w;
}
function drawHud(t, camState) {
  const c = hudCtx, s = RW / 1920; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, RW, RH); c.setTransform(s, 0, 0, s, 0, 0);
  let on = false;
  // caption in the aerial hold
  const capIn = B(43.6), capOut = B(47.6);
  if (t > capIn - .1 && t < capOut + .5) {
    on = true; const a = clamp((t - capIn) * 4) * (1 - clamp((t - capOut) * 3)); const k = E.cubicOut(clamp((t - capIn) * 2.2));
    c.globalAlpha = a; c.save(); c.translate(120, 930 + (1 - k) * 24);
    c.font = '600 30px "IBM Plex Mono"'; c.fillStyle = PLUMD; c.textBaseline = 'alphabetic'; c.fillText('archlang', 0, -62);
    c.font = '800 58px Archivo'; c.fillStyle = INK; c.fillText('The same source gives the same drawing,', 0, 0); c.fillText('byte for byte.', 0, 66);
    c.restore(); c.globalAlpha = 1;
  }
  // end card — an iris opens from the house on the sheet
  if (t >= B(K.logo) - .05) {
    on = true;
    const p = camState.pp; const k = E.expoOut(seg(t, B(K.logo), B(K.logo) + .7)); const R = k * Math.hypot(RW, RH) / s * 1.05;
    c.save(); c.beginPath(); c.arc(p[0] / s, p[1] / s, R, 0, 6.3); c.clip();
    c.fillStyle = PAPER; c.fillRect(0, 0, 1920, 1080);
    // drafting grid (faint)
    c.fillStyle = 'rgba(160,152,135,.28)'; for (let y = 0; y <= 1080; y += 60) for (let x = 0; x <= 1920; x += 60) { c.beginPath(); c.arc(x, y, 1.8, 0, 6.3); c.fill(); }
    // lockup: mark lands, then the name unrolls
    const lk = spring(t - B(K.logo) - .08, .5, 20);
    const VW = logoImgs.maxX, LW = 1250 / VW * 1420, u = LW / 1420, LH = 198 * u, lx = 960 - 1250 / 2, ly = 150;
    if (logoImgs.mark) { c.save(); c.translate(lx + 115 * u, ly + 99 * u); c.scale(lerp(.5, 1, lk), lerp(.5, 1, lk)); c.globalAlpha = clamp(lk * 2); c.drawImage(logoImgs.mark, -115 * u, -99 * u, LW, LH); c.restore(); }
    c.globalAlpha = 1;
    if (logoImgs.word) { const wk = E.expoOut(seg(t, B(K.letters), B(K.letters) + .5)); c.save(); c.beginPath(); c.rect(lx, ly - 10, 1250 * wk + 8, LH + 20); c.clip(); c.drawImage(logoImgs.word, lx, ly, LW, LH); c.restore(); }
    // slogan, word by word on the grid
    const words = [['Floor ', 0], ['plans ', 1], ['as code.', 2]]; c.font = '800 132px Archivo'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    let tw = 0; words.forEach(w => { tw += c.measureText(w[0]).width; }); let x = 960 - tw / 2;
    words.forEach(([w, i]) => { const tt = B(K.slogan[i]); const kk = spring(t - tt, .55, 24); const a = clamp((t - tt) * 14); c.save(); c.globalAlpha = a; c.translate(x, 690 + (1 - kk) * 46); c.fillStyle = i === 2 ? PLUMD : INK; c.fillText(w, 0, 0); c.restore(); x += c.measureText(w).width; });
    // sub line
    const sk = E.cubicOut(seg(t, B(K.sub), B(K.sub) + .45)); c.globalAlpha = sk; c.font = '500 40px Archivo'; c.fillStyle = '#4b5565'; c.textAlign = 'center';
    c.fillText('Write a floor plan as text. Get a precise, dimensioned drawing back.', 960, 775 + (1 - sk) * 16); c.globalAlpha = 1;
    // chips
    const ck = seg(t, B(K.chips), B(K.chips) + .5); if (ck > 0) {
      const items = [['SVG · DXF · PDF · PNG', '#eceef2', INK, null], ['npx -y @chanmeng666/archlang', '#eceef2', INK, null], ['github.com/ChanMeng666/archlang', PLUM, '#ffffff', null], ['MIT', null, INK, '#b9b1a4']];
      c.font = '500 30px "IBM Plex Mono"'; const gap = 22, pad = 28, h = 64; let W = 0; const ws = items.map(it => c.measureText(it[0]).width + pad * 2); W = ws.reduce((a, b) => a + b, 0) + gap * 3; let px = 960 - W / 2;
      items.forEach((it, i) => { const kk = E.cubicOut(clamp(ck * 2 - i * .25)); c.save(); c.globalAlpha = kk; c.translate(0, (1 - kk) * 18); pill(c, px, 862, it[0], '500 30px "IBM Plex Mono"', pad, h, it[1], it[2], it[3]); c.restore(); px += ws[i] + gap; });
    }
    c.restore();
    // plum seam on the iris edge
    if (k < 0.995) { c.beginPath(); c.arc(p[0] / s, p[1] / s, R, 0, 6.3); c.strokeStyle = PLUM; c.lineWidth = 5; c.stroke(); }
  }
  hudMesh.visible = on; hudTex.needsUpdate = on;
}

// ───────────────────────── house animation (pure function of t) ─────────────────────────
function poseHouse(t) {
  const set = (n, f) => { const o = nodes[n]; if (o) { f(o); SIG.push(o.scale.y, o.rotation.y, o.position.x, o.position.y, o.position.z, o.visible ? 1 : 0); } };
  // floors
  const fl = spring(t - B(K.lift), .8, 26);
  ['floor_slab', 'floor_live', 'floor_bath', 'floor_bed'].forEach(n => set(n, o => { const k = clamp(fl, 0, 1.05); const cf = 1 - E.cubicIn(seg(t, B(K.collapse[4]), B(K.collapse[5] + .8))); o.visible = t >= B(K.lift) - .001 && cf > .003; o.scale.y = Math.max(k * cf, 1e-3); }));
  // walls (rise) — openings share their host's factor
  const rise = {}; WALLS.forEach((w, i) => { const b = K.liftBeat[K.liftOrder.indexOf(w)]; const tt = B(b); rise[w] = t < tt ? 0 : spring(t - tt, .5, 17); });
  const collapse = {}; WALLS.forEach((w, i) => { const tt = B(K.collapse[i]); collapse[w] = 1 - E.cubicIn(seg(t, tt, tt + .5)); });
  const wallY = w => { const r = Math.max(rise[w] * collapse[w], 0); return r; };
  WALLS.forEach(w => set(WALL_NODE[w], o => { const y = wallY(w); o.visible = y > 0.001; o.scale.y = Math.max(y, 1e-3); }));
  Object.keys(HOST).forEach(n => set(n, o => { const y = wallY(HOST[n]); o.visible = y > 0.001; o.scale.y = Math.max(y, 1e-3); }));
  // doors
  set('door_front', o => { const k = spring(t - B(K.doorFront), .6, 16); o.rotation.y = -Math.PI / 2 * clamp(k, 0, 1.08); });
  set('door_bed', o => { const k = spring(t - B(K.doorBed), .6, 16); o.rotation.y = Math.PI / 2 * clamp(k, 0, 1.08); });
  set('door_bath', o => { o.position.z = o.userData.p0.z - 0.35; });
  set('slide_moving', o => { const k = E.cubicInOut(seg(t, B(K.slide), B(K.slide) + 1.0)); o.position.x = o.userData.p0.x - 0.9 * k; });
  // furniture rises out of its plan glyph
  K.furn3d.forEach(([n, b], i) => set(FURN_NODE[n], o => { const tt = B(b); const k = t < tt ? 0 : spring(t - tt, .45, 20); const c2 = 1 - E.cubicIn(seg(t, B(K.collapse[0]) - .3, B(K.collapse[0]) + .3 + i * .02)); const y = Math.max(k * c2, 1e-3);
    o.visible = y > 0.002; o.scale.y = y; const w = 1 + (1 - clamp(k, 0, 1)) * .0; o.scale.x = w; }));
  // roof: lowers onto the walls, lifts off again
  if (roofNode) { const a = E.cubicInOut(seg(t, B(K.roofStart), B(K.roofLand))); const settle = t > B(K.roofLand) ? ring(t - B(K.roofLand), 12, 36) * .06 : 0;
    const off = E.cubicIn(seg(t, B(K.roofOff), B(K.roofOff) + 1.1));
    roofNode.position.y = (1 - a) * 5.5 + off * 9 + settle; roofNode.visible = t >= B(K.roofStart) - .001 && off < 1; }
}

// ───────────────────────── seek ─────────────────────────
const projP = new THREE.Vector3();
function seekScene(t) {
  const cs = camAt(t);
  cam.position.copy(cs.eye); cam.up.copy(cs.up); cam.lookAt(cs.tgt); cam.fov = cs.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  SIG = []; drawEditor(t); drawPlan(t); poseHouse(t);
  // the sheet fades under the volume; the editor card slides off toward the left after the lift
  const sl = E.cubicInOut(seg(t, B(K.lift + 3), B(K.lift + 8)));
  edMesh.position.x = ED.cx - sl * 3; edMesh.visible = t < B(K.lift + 8.5);
  planMesh.material.opacity = 1;
  // card pop-in
  const k = spring(t - 0.1, .7, 14); edMesh.scale.set(lerp(.9, 1, clamp(k, 0, 1.02)), 1, lerp(.9, 1, clamp(k, 0, 1.02)));
  const fd = focusDist(t, cs.eye, cs.tgt);
  const ap = t < 2 ? .0034 : (t < 16 ? .0006 : (t < 21 ? .0042 : (t < 24 ? .0022 : .0006)));
  bokeh.uniforms['focus'].value = fd; bokeh.uniforms['aperture'].value = ap; bokeh.uniforms['maxblur'].value = .014;
  // where the house sits on screen (for the iris)
  projP.set(3.75, 0, 3.25).project(cam); const pp = [(projP.x * .5 + .5) * RW, (1 - (projP.y * .5 + .5)) * RH];
  drawHud(t, { pp });
}
function drawFrame() {
  composer.render();
  renderer.autoClear = false; renderer.clearDepth();
  if (hudMesh.visible) renderer.render(hudScene, hudCam);
  renderer.autoClear = true;
}
function nonCamSig(t) { seekScene(t); return SIG.slice().concat([hudMesh.visible ? 1 : 0]); }
const PROBE = [[3.75, 0, 3.25], [0, 0, 0], [7.5, 1.5, 6.5], [-5, 0, 3], [3.75, 2.7, 3.25], [-8, 0, 0], [8, 0, 7]];
function camPx(t) { const cs = camAt(t); const c = new THREE.PerspectiveCamera(cs.fov, RW / RH, .3, 90); c.position.copy(cs.eye); c.up.copy(cs.up); c.lookAt(cs.tgt); c.updateMatrixWorld(); c.updateProjectionMatrix();
  return PROBE.map(p => { const v = new THREE.Vector3(...p).project(c); return [(v.x * .5 + .5) * RW, (1 - (v.y * .5 + .5)) * RH]; }); }
window.__nSamples = (t, open, nmax) => {
  const t0 = Math.max(0, t - open / 2), t1 = Math.min(DUR - 1e-6, t + open / 2);
  const a = camPx(t0), b = camPx(t1); let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  const s0 = nonCamSig(t0), s1 = nonCamSig(t1); let ch = s0.length !== s1.length; if (!ch) for (let i = 0; i < s0.length; i++) if (Math.abs(s0[i] - s1[i]) > 1e-6) { ch = true; break; }
  let n = m < .6 ? 1 : Math.min(nmax, Math.ceil(m / 5)); if (ch) n = Math.max(n, Math.min(nmax, 4));
  return { n, m, ch };
};
window.__events = () => EVENTS.slice();
window.__meta = { dur: DUR, fps: FPS, bpm: BPM };
window.__K = K;
window.__seek = async function (t) { T_LAST = t; seekScene(t); drawFrame(); return t; };
// motion-blurred frame: n sub-captures across the open shutter, averaged in the page
window.__shutter = async function (t, n, open) {
  if (!acc) { acc = document.createElement('canvas'); acc.width = RW; acc.height = RH; accCtx = acc.getContext('2d'); }
  const gl = renderer.domElement;
  for (let k = 0; k < n; k++) {
    const tk = clamp(t + open * ((k + .5) / n - .5), 0, DUR - 1e-6); seekScene(tk); drawFrame();
    accCtx.globalAlpha = 1 / (k + 1); accCtx.drawImage(gl, 0, 0);
  }
  return acc.toDataURL('image/png');
};
window.__grab = async function (t) { seekScene(t); drawFrame(); return renderer.domElement.toDataURL('image/png'); };
window.__hash = async function (t) { seekScene(t); drawFrame(); const c = document.createElement('canvas'); c.width = 48; c.height = 27; const x = c.getContext('2d'); x.drawImage(renderer.domElement, 0, 0, 48, 27); const d = x.getImageData(0, 0, 48, 27).data; let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0; return h; };

// ───────────────────────── boot ─────────────────────────
async function loadFonts() {
  const F = D.fonts, mk = (fam, w, b64) => new FontFace(fam, `url(data:font/woff2;base64,${b64})`, { weight: String(w) });
  const fs = [mk('IBM Plex Mono', 400, F.plex400), mk('IBM Plex Mono', 500, F.plex500), mk('IBM Plex Mono', 600, F.plex500), mk('Archivo', 500, F.archivo600), mk('Archivo', 600, F.archivo600), mk('Archivo', 800, F.archivo800)];
  for (const f of fs) { await f.load(); document.fonts.add(f); }
}
function loadImg(svg) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); }); }
window.__ready = (async () => {
  await loadFonts();
  logoImgs.mark = await loadImg(D.logo.mark); logoImgs.word = await loadImg(D.logo.word);
  { const c = document.createElement('canvas'); c.width = 1420; c.height = 198; const x = c.getContext('2d'); x.drawImage(logoImgs.word, 0, 0); const d = x.getImageData(0, 0, 1420, 198).data; let mx = 0; for (let i = 0; i < 1420; i++) for (let j = 0; j < 198; j++) if (d[(j * 1420 + i) * 4 + 3] > 20) mx = Math.max(mx, i); logoImgs.maxX = mx + 4; }
  await build(); setupPost(); setupHud(); parsePlan(); makePoche();
  seekScene(0); drawFrame();
  if (!RENDER) initPlayer();
  return true;
})();

// ───────────────────────── player (browser playback with the mixed soundtrack) ─────────────────────────
function initPlayer() {
  const ui = document.getElementById('ui'); ui.style.display = 'flex';
  const btn = document.getElementById('pp'), bar = document.getElementById('bar'), tm = document.getElementById('tm');
  let ac = null, buf = null, src = null, t0 = 0, off = 0, playing = false, raf = 0;
  const fit = () => { const s = Math.min(innerWidth / RW, (innerHeight - 52) / RH); const st = document.getElementById('stage'); st.style.transform = `scale(${s})`; st.style.left = (innerWidth - RW * s) / 2 + 'px'; st.style.top = '0px'; };
  fit(); addEventListener('resize', fit);
  async function loadAudio() { if (buf || !D.audio) return; ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const b = Uint8Array.from(atob(D.audio), c => c.charCodeAt(0)); buf = await ac.decodeAudioData(b.buffer); }
  const now = () => (playing ? (ac ? ac.currentTime - t0 : (performance.now() / 1000 - t0)) : off);
  async function play() { await loadAudio(); if (off >= DUR - .05) off = 0;
    if (ac) { if (ac.state === 'suspended') await ac.resume(); if (buf) { src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start(0, off); } t0 = ac.currentTime - off; } else t0 = performance.now() / 1000 - off;
    playing = true; btn.textContent = '❚❚'; loop(); }
  function pause() { off = now(); playing = false; if (src) { try { src.stop(); } catch (e) {} src = null; } btn.textContent = '▶'; cancelAnimationFrame(raf); }
  function loop() { const t = now(); if (t >= DUR) { off = DUR; pause(); seekScene(DUR - 1e-3); drawFrame(); return; } seekScene(t); drawFrame(); bar.value = t / DUR * 1000; tm.textContent = t.toFixed(1) + ' / ' + DUR.toFixed(0) + ' s'; raf = requestAnimationFrame(loop); }
  btn.onclick = () => (playing ? pause() : play());
  bar.oninput = () => { const t = bar.value / 1000 * DUR; const was = playing; if (playing) pause(); off = t; seekScene(t); drawFrame(); tm.textContent = t.toFixed(1) + ' / ' + DUR.toFixed(0) + ' s'; if (was) play(); };
  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); btn.click(); } });
  if (Q.has('t')) { off = +Q.get('t'); seekScene(off); drawFrame(); }
  if (Q.has('play')) play().catch(() => {});
}
})();
