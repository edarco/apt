(function () {
  const { el, row } = FP.uiForm, K = FP.OVERLAP;
  K.host.add('base_oven');                          // варочная панель сверху на модуле с духовкой — не конфликт
  const SIDES = ['n', 's', 'w', 'e'], OPP = { n: 's', s: 'n', w: 'e', e: 'w' }, SN = { n: 'север', s: 'юг', w: 'запад', e: 'восток' };
  const PN = { mid: 'по центру', start: 'у начала стены', end: 'у конца стены' }, OPF = { start: 'end', end: 'start', mid: 'mid' };
  const DIR = { n: [0, 1, 0], s: [0, -1, 180], w: [1, 0, 270], e: [-1, 0, 90] };   // внутрь комнаты (nx, ny) и поворот спиной к стене
  const ROT = { 0: 'n', 180: 's', 270: 'w', 90: 'e' };
  const WH = '#edece6', LT = '#f4f2ee';
  const I = (kind, name, w, d, h, color, role, elev) => ({ kind, name, w, d, h, color, role, elev });   // role: s мягкое, w дерево, k шкафы/кухня, x не перекрашивать

  // Г-образные угловые шкафы: нижний (глубина веток 0,6 м) и навесной (0,35 м). Вторая ветка слева (в модели x < 0), для другого угла модель отзеркаливается
  {
    const B = (w, h, d, x, y, z, c) => ({ b: [w, h, d], at: [x, y, z], c: c || 'm' }), TOP = '#e8e4da';
    FP.LIB.models.corner_cab = {
      name: 'Угловой шкаф (Г-образный)', w: .9, d: .9, h: .9,
      foot: [[-.45, -.45, .45, .15], [-.45, .15, .15, .45]], outline: [[-.45, -.45], [.45, -.45], [.45, .15], [.15, .15], [.15, .45], [-.45, .45]],
      parts: [B(.82, .1, .52, 0, 0, -.18, 'bk'), B(.52, .1, .26, -.17, 0, .3, 'bk'), B(.9, .76, .6, 0, .1, -.15), B(.6, .76, .3, -.15, .1, .3),
        B(.92, .04, .62, 0, .86, -.14, TOP), B(.62, .04, .28, -.14, .86, .31, TOP),
        B(.28, .72, .018, .3, .12, .159, 'l'), B(.014, .14, .014, .19, .55, .172, 'ch'), B(.018, .72, .28, .159, .12, .31, 'l'), B(.014, .014, .14, .172, .55, .4, 'ch')]
    };
    FP.LIB.models.corner_wall = {
      name: 'Угловой навесной шкаф (Г-образный)', w: .9, d: .9, h: .7, wall: true, elev: 1.4,
      foot: [[-.45, -.45, .45, -.1], [-.45, -.1, -.1, .45]], outline: [[-.45, -.45], [.45, -.45], [.45, -.1], [-.1, -.1], [-.1, .45], [-.45, .45]],
      parts: [B(.9, .7, .35, 0, 0, -.275), B(.35, .7, .55, -.275, 0, .175), B(.54, .68, .014, .175, .01, -.093, 'l'), B(.014, .68, .53, -.093, .01, .175, 'l')]
    };
  }

  const TYPES = [['kitchen', 'Кухня'], ['bedroom', 'Спальня'], ['living', 'Гостиная / зал'], ['bath', 'Ванная / санузел'], ['office', 'Рабочая комната'], ['hall', 'Коридор / прихожая'], ['cosmo', 'Косметологическая']];
  FP.RTYPES = TYPES;                                // нужен панели свойств комнаты
  const OPTS = {
    kitchen: [['dining', 'Обеденный стол со стульями', true], ['hob', 'Встроенная газовая панель + духовка', true], ['dish', 'Посудомоечная машина', true], ['washer', 'Стиральная машина в шкафу', true], ['tall', 'Высокий шкаф-пенал до потолка', true]],
    bedroom: [['dresser', 'Комод', true], ['ward2', 'Второй шкаф', true], ['mirror', 'Зеркало в рост', true], ['armchair', 'Кресло', false], ['desk', 'Рабочее место', false], ['rug', 'Ковёр', false]],
    living: [['tv', 'ТВ-тумба и телевизор', true], ['lsofa', 'Угловой диван', true], ['dining', 'Обеденный стол со стульями', false], ['oval', 'Овальный стол со стульями', true], ['armchair', 'Два кресла', true], ['shelf', 'Стеллаж', true], ['board', 'Сервант / комод с полкой', true], ['plant', 'Растение', false], ['rug', 'Ковёр', false]],
    bath: [['shower', 'Душ вместо ванны', true], ['washer', 'Стиральная машина', false]],
    office: [['wardrobe', 'Шкаф', false]],
    hall: [['mirror', 'Зеркало в рост', true]],
    cosmo: [['sink', 'Умывальник с тумбой', true], ['shelf', 'Стеллаж', true], ['cab', 'Шкафчик навесной', true], ['mirror', 'Зеркало', true], ['lamp', 'Торшер', false]]
  };
  const STYLES = {
    light: { name: 'Светлый (скандинавский)', floor: 'lam_oak_light', wet: 'tile_sq60_lgrey', wall: '#f2efe9', s: '#d9d4c7', w: '#d8c3a0', k: '#ece8de' },
    warm: { name: 'Тёплый (дерево)', floor: 'lam_oak_nat', wet: 'tile_sq60_beige', wall: '#e6dcc7', s: '#bf8c6c', w: '#a8794f', k: '#c9b08a' },
    dark: { name: 'Тёмный современный', floor: 'lam_oak_dark', wet: 'tile_sq60_graph', wall: '#a7a8a8', s: '#5c5f64', w: '#6b4429', k: '#3a3d42' },
    keep: { name: 'Не менять цвета' }
  };
  const guess = n => { n = (n || '').toLowerCase(); return /косметол/.test(n) ? 'cosmo' : /кухн/.test(n) ? 'kitchen' : /спальн|детск/.test(n) ? 'bedroom' : /ванн|туалет|санузел|wc/.test(n) ? 'bath' : /кабинет|рабоч/.test(n) ? 'office' : /коридор|прихож|холл/.test(n) ? 'hall' : 'living'; };

  // ---------- геометрия ----------
  const horiz = s => s === 'n' || s === 's';
  const span = (ctx, s) => horiz(s) ? [ctx.r.x, ctx.r.x + ctx.r.width] : [ctx.r.y, ctx.r.y + ctx.r.depth];
  const len = (ctx, s) => { const a = span(ctx, s); return a[1] - a[0]; };
  const perp = (ctx, s) => horiz(s) ? ctx.r.depth : ctx.r.width;
  const al = (m, s) => horiz(s) ? m.x : m.y;
  const cnt = (ctx, s, kind) => ctx.sp[s].filter(a => !kind || a.o.kind === kind).length;
  const byLen = ctx => SIDES.slice().sort((a, b) => len(ctx, b) - len(ctx, a));
  const mains = ctx => ctx.o.anchor !== 'auto' ? [ctx.o.anchor] : SIDES;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const FRC = new WeakMap();
  const fr = m => {
    const key = [m.x, m.y, m.rotation, m.width, m.depth, m.flipX].join('|'); let q = FRC.get(m);
    if (!q || q.key !== key) FRC.set(m, q = { key, v: FP.footRects(m) });
    return q.v;
  };
  const zr = (ctx, m) => { const M = FP.model(m), e = M && M.ceil ? ctx.f.height - m.height : (m.elev != null ? m.elev : ((M && M.elev) || 0)); return [e, e + m.height]; };
  const skipK = m => { const M = FP.model(m); return !!(M && (M.sym || M.ceil)) || K.skip.has(m.kind); };
  const hit = (a, b, e) => {                        // пересечение двух повёрнутых прямоугольников (SAT)
    const ax = [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]], dx = b.cx - a.cx, dy = b.cy - a.cy;
    for (const q of ax) {
      const ra = a.hl * Math.abs(a.ux * q[0] + a.uy * q[1]) + a.ht * Math.abs(-a.uy * q[0] + a.ux * q[1]) - e;
      const rb = b.hl * Math.abs(b.ux * q[0] + b.uy * q[1]) + b.ht * Math.abs(-b.uy * q[0] + b.ux * q[1]) - e;
      if (Math.abs(dx * q[0] + dy * q[1]) >= ra + rb) return false;
    }
    return true;
  };
  const inR = (q, x, y, e) => { const dx = x - q.cx, dy = y - q.cy; return Math.abs(dx * q.ux + dy * q.uy) <= q.hl - e && Math.abs(-dx * q.uy + dy * q.ux) <= q.ht - e; };
  const pairOK = (a, b) => {                        // разрешённые наложения: стул у стола, варочная на духовке
    const sa = K.soft.has(a.kind), sb = K.soft.has(b.kind);
    if ((sa && (sb || K.table.has(b.kind))) || (sb && K.table.has(a.kind))) return true;
    return [a.kind, b.kind].sort().join() === 'base_oven,hob_gas';
  };

  // ---------- контекст: всё, что нужно для проверок, считается один раз ----------
  function mkCtx(f, r, o) {
    const st = STYLES[o.style] || STYLES.keep, walls = FP.getWalls(f), cx = r.x + r.width / 2, cy = r.y + r.depth / 2, R0 = Math.hypot(r.width, r.depth) / 2 + 1;
    const WR = FP.wallRects(f, walls).filter(q => Math.hypot(q.cx - cx, q.cy - cy) < R0 + q.hl + q.ht), zones = [], sp = {};
    SIDES.forEach(s => { const w = walls.find(q => q.room === r && q.side === s), WL = w ? FP.wlen(w) : 0; sp[s] = w ? FP.spans(f, walls, w).filter(q => q.e > .02 && q.s < WL - .02) : []; });
    f.openings.forEach(op => {                      // зоны открывания дверей (как в FP.conflicts)
      if (op.kind !== 'door' && op.kind !== 'gap') return;       // у проёма без двери тоже нужен свободный проход
      const w = walls.find(q => q.id === op.wallId); if (!w) return;
      const p = FP.openPos(w, op), wd = op.width, ly = ((p.nx * -p.uy + p.ny * p.ux) >= 0 ? 1 : -1) * (op.swing === -1 ? -1 : 1);
      const vx = -p.uy * ly, vy = p.ux * ly, hx = op.flip ? p.ex : p.sx, hy = op.flip ? p.ey : p.sy, sg = op.flip ? -1 : 1;
      if (op.kind === 'door') [.3, .6, .95].forEach(rr => { for (let g = 0; g <= 6; g++) { const an = g * Math.PI / 12, c = Math.cos(an) * wd * rr, s = Math.sin(an) * wd * rr; zones.push([hx + p.ux * sg * c + vx * s, hy + p.uy * sg * c + vy * s]); } });
      for (let k = 0; k < 5; k++) (op.kind === 'gap' ? [.2, .45, .7, .95] : [.2, .45]).forEach(d => {
        zones.push([p.sx + p.ux * wd * (k + .5) / 5 - vx * d, p.sy + p.uy * wd * (k + .5) / 5 - vy * d]);
        if (op.kind === 'gap') zones.push([p.sx + p.ux * wd * (k + .5) / 5 + vx * d, p.sy + p.uy * wd * (k + .5) / 5 + vy * d]);   // проём без двери: с обеих сторон
      });
    });
    const near = m => m.x > r.x - 3 && m.x < r.x + r.width + 3 && m.y > r.y - 3 && m.y < r.y + r.depth + 3, base = f.furniture.filter(near);
    const ctx = { f, r, o, st, walls, WR, sp, base, all: base.slice(), added: [], log: [], seen: {}, parts: [], skipped: [] };
    ctx.zones = zones.filter(pt => pt[0] > r.x - .3 && pt[0] < r.x + r.width + .3 && pt[1] > r.y - .3 && pt[1] < r.y + r.depth + .3);
    ctx.col = it => (it.role !== 'x' && st[it.role]) || it.color;
    return ctx;
  }

  // ---------- создание и проверка предметов ----------
  function mk(ctx, it, x, y, rot, w) {
    const m = { id: FP.uid(), kind: it.kind, name: it.name, width: w || it.w, depth: it.d, height: it.h, color: ctx.col(it), x: +x.toFixed(3), y: +y.toFixed(3), rotation: rot };
    if (it.elev != null) m.elev = it.elev;
    if (it.flip) m.flipX = true;
    return m;
  }
  function make(ctx, it, side, a, w) {              // предмет спиной к стене side, центр вдоль стены = a
    const r = ctx.r, dp = it.d, ins = FP.inner() ? 0 : FP.wt(r, side, ctx.f) / 2; let x, y;
    if (side === 'n') { x = a; y = r.y + ins + dp / 2; } else if (side === 's') { x = a; y = r.y + r.depth - ins - dp / 2; }
    else if (side === 'w') { x = r.x + ins + dp / 2; y = a; } else { x = r.x + r.width - ins - dp / 2; y = a; }
    return mk(ctx, it, x, y, DIR[side][2], w);
  }
  function inside(ctx, m) {
    const r = ctx.r;
    for (const q of fr(m)) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = q.cx + q.ux * q.hl * sx - q.uy * q.ht * sy, y = q.cy + q.uy * q.hl * sx + q.ux * q.ht * sy;
      if (x < r.x - .004 || x > r.x + r.width + .004 || y < r.y - .004 || y > r.y + r.depth + .004) return false;
    }
    return true;
  }
  // сколько метров должно остаться свободным перед предметом (открыть дверцу, встать, пройти)
  const FRONT = { wardrobe: .75, wardrobe_mir: .75, dresser: .6, shelf: .45, fridge: .8, tall_cab: .7, counter: .6, drawer_base: .6, sink: .75, base_oven: .75, stove: .75, dishwasher: .65, cab_washer: .7, washer: .65, vanity: .6, toilet: .45, toilet_wall: .45, shower_open: .5, shoe_rack: .5 };
  const SIDEC = { toilet: .15, toilet_wall: .15 };      // свободно по бокам

  const KB0 = ['counter', 'sink', 'base_oven', 'stove', 'dishwasher', 'cab_washer', 'corner_cab', 'tall_cab', 'fridge'];
  const perpEx = (a, b) => ['counter', 'sink'].includes(a.kind) && KB0.includes(b.kind) && Math.abs(Math.sin(((a.rotation || 0) - (b.rotation || 0)) * Math.PI / 180)) > .9;   // два модуля под прямым углом в углу: дверцы достают «за угол»

  function strips(m) {                              // прямоугольники, которые должны остаться пустыми
    const a = (m.rotation || 0) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), out = [], g = .03;
    const f = /^Угловой/.test(m.name) ? 0 : FRONT[m.kind], sd = SIDEC[m.kind];
    if (f) { const c = m.depth / 2 + g + (f - g) / 2; out.push({ cx: m.x - uy * c, cy: m.y + ux * c, ux, uy, hl: Math.max(.05, m.width / 2 - .02), ht: (f - g) / 2 }); }
    if (sd) [-1, 1].forEach(s => { const c = m.width / 2 + g + (sd - g) / 2; out.push({ cx: m.x + ux * c * s, cy: m.y + uy * c * s, ux, uy, hl: (sd - g) / 2, ht: m.depth / 2 - .02 }); });
    return out;
  }
  function blockedStrip(ctx, m, z) {                // '' или причина: мешает месту перед предметом / сам закрывает место перед чужим
    const mine = strips(m), ma = fr(m), rad = Math.hypot(m.width, m.depth) / 2 + 1.7;
    for (const o of ctx.all) {
      if (o === m || skipK(o)) continue;
      const zo = zr(ctx, o); if (zo[0] >= 1.3 || zo[1] <= .25) continue;       // навесное и совсем низкое не мешает
      if (Math.hypot(o.x - m.x, o.y - m.y) > rad + Math.hypot(o.width, o.depth) / 2) continue;
      if (mine.length && !perpEx(m, o) && fr(o).some(q => mine.some(s => hit(s, q, .005)))) return 'нет места перед ним: мешает «' + o.name + '»';
      if (z[0] < 1.3 && z[1] > .25 && !perpEx(o, m)) { const so = strips(o); if (so.length && so.some(s => ma.some(p => hit(s, p, .005)))) return 'закрывает место перед «' + o.name + '»'; }
    }
    return '';
  }
  function why(ctx, m, side, lax) {                 // '' = можно ставить, иначе причина отказа
    if (!lax && !inside(ctx, m)) return 'выходит за пределы комнаты';
    const a = fr(m), z = zr(ctx, m);
    if (side) {
      const [lo, hi] = span(ctx, side), c = al(m, side), hw = m.width / 2;
      if (c - hw < lo - 1e-6 || c + hw > hi + 1e-6) return 'не помещается по длине стены';
      for (const q of ctx.sp[side]) {
        const mg = q.o.kind === 'gap' ? .35 : .05;
        if (c + hw <= lo + q.s - mg || c - hw >= lo + q.e + mg) continue;
        if (q.o.kind === 'window') { const sill = q.o.sill != null ? q.o.sill : .9; if (z[1] > sill + .05 && z[0] < sill + (q.o.h || 1.3)) return 'мешает окно'; }
        else if (z[0] < 2.05) return q.o.kind === 'door' ? 'мешает дверь' : 'мешает проём';
      }
    }
    if (!lax && ctx.WR.some(q => a.some(p => hit(p, q, .01)))) return 'заходит в стену';
    const rad = Math.hypot(m.width, m.depth) / 2;
    for (const o of ctx.all) {
      if (o === m || skipK(o)) continue;
      if (Math.hypot(o.x - m.x, o.y - m.y) > rad + Math.hypot(o.width, o.depth) / 2 + .05) continue;
      const zo = zr(ctx, o); if (Math.min(z[1], zo[1]) - Math.max(z[0], zo[0]) < .03) continue;
      if (!a.some(p => fr(o).some(q => hit(p, q, .005)))) continue;
      if (pairOK(m, o)) continue;
      return 'пересекается с «' + o.name + '»';
    }
    if (z[0] <= 2.05 && z[1] >= .05 && ctx.zones.some(pt => a.some(q => inR(q, pt[0], pt[1], .02)))) return 'мешает двери / проходу (зона открывания)';
    if (!lax) { const bl = blockedStrip(ctx, m, z); if (bl) return bl; }
    return '';
  }
  const add = (ctx, m) => { ctx.added.push(m); ctx.all.push(m); return m; };
  const rollback = (ctx, mark) => { while (ctx.added.length > mark) { const m = ctx.added.pop(); ctx.all.splice(ctx.all.lastIndexOf(m), 1); } };
  const tryAdd = (ctx, m, side) => (why(ctx, m, side || null) ? null : add(ctx, m));
  const miss = (ctx, name, w) => { ctx.skipped.push(name); ctx.parts.push(['нет: ' + name, -w]); if (w >= 20) ctx.fatal = true; };
  const bonus = (ctx, name, v) => ctx.parts.push([name, v]);

  function cands(lo, hi, w, from) {
    const a0 = lo + w / 2, a1 = hi - w / 2, out = []; if (a1 < a0 - 1e-6) return out;
    if (typeof from === 'number') return [from];
    if (from === 'start') for (let a = a0; a <= a1 + 1e-6; a += .05) out.push(a);
    else if (from === 'end') for (let a = a1; a >= a0 - 1e-6; a -= .05) out.push(a);
    else { const mid = (a0 + a1) / 2; out.push(mid); for (let k = 1; mid + k * .05 <= a1 + 1e-6; k++) out.push(mid + k * .05, mid - k * .05); }
    return out;
  }
  // from = 'start' | 'end' | 'mid' | число (центр вдоль стены); o.w — ширина, o.min / o.max — границы вдоль стены
  function put(ctx, it, side, from, o) {
    o = o || {}; const w = o.w || it.w, [lo, hi] = span(ctx, side), bad0 = {};
    for (const a of cands(lo, hi, w, from)) {
      if (o.min != null && a - w / 2 < o.min - 1e-6) continue;
      if (o.max != null && a + w / 2 > o.max + 1e-6) continue;
      const m = make(ctx, it, side, a, w), bad = why(ctx, m, side);
      if (!bad) return add(ctx, m);
      bad0[bad] = (bad0[bad] || 0) + 1;
    }
    const fx = typeof from === 'number' ? from.toFixed(2) : from, key = it.name + '|' + side + '|' + fx;
    if (!ctx.seen[key]) {
      ctx.seen[key] = 1;
      const top = Object.keys(bad0).sort((p, q) => bad0[q] - bad0[p]).slice(0, 3).map(t => t + ' ×' + bad0[t]).join('; ');
      ctx.log.push('  ✗ ' + it.name + ' [' + SN[side] + ', ' + fx + ']: ' + (top || 'нет позиций (стена ' + (hi - lo).toFixed(2) + ' м, ширина ' + w + ' м, заданы границы)'));
    }
    return null;
  }
  function fitAny(ctx, it, widths, sides, froms) {
    for (const w of widths) for (const s of sides) for (const f0 of froms) { const m = put(ctx, it, s, f0, { w }); if (m) return m; }
    return null;
  }
  // растянуть уже поставленный предмет вдоль стены (в обе стороны), пока не упрётся (до ширины wmax)
  function grow(ctx, m, side, wmax) {
    for (const sg of [1, -1]) {
      for (let ext = +Math.min(wmax - m.width, 3).toFixed(2); ext >= .05; ext = +(ext - .05).toFixed(2)) {
        const w0 = m.width, x0 = m.x, y0 = m.y;
        m.width = +(w0 + ext).toFixed(3);
        if (horiz(side)) m.x = +(x0 + sg * ext / 2).toFixed(3); else m.y = +(y0 + sg * ext / 2).toFixed(3);
        if (!why(ctx, m, side)) break;
        m.width = w0; m.x = x0; m.y = y0;
      }
    }
  }
  function putFlex(ctx, it, side, from, wmin, wmax) {   // поставить минимальной ширины и растянуть до препятствия
    const m = put(ctx, it, side, from, { w: wmin }); if (!m) return null;
    grow(ctx, m, side, wmax); return m;
  }
  function flexAny(ctx, it, sides, froms, wmin, wmax) {
    for (const s of sides) for (const f0 of froms) { const m = putFlex(ctx, it, s, f0, wmin, Math.min(wmax, len(ctx, s))); if (m) return m; }
    return null;
  }
  function addRug(ctx, ref, side, w, d, shift) {
    const n = DIR[side], m = mk(ctx, I('rug', 'Ковёр', w, d, .025, '#e2d6c1', 'x'), ref.x + n[0] * shift, ref.y + n[1] * shift, n[2]);
    if (inside(ctx, m)) add(ctx, m);
  }
  function center(ctx, fw, fd, mg) {                // место посреди комнаты с проходом mg вокруг
    const r = ctx.r, W = fw + 2 * mg, D = fd + 2 * mg, cx = r.x + r.width / 2, cy = r.y + r.depth / 2, pts = [];
    for (let x = r.x + W / 2; x <= r.x + r.width - W / 2 + 1e-6; x += .15) for (let y = r.y + D / 2; y <= r.y + r.depth - D / 2 + 1e-6; y += .15) pts.push([x, y]);
    pts.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    for (const p of pts) { const pr = { id: 'probe', kind: 'box', name: 'зона стола', width: W, depth: D, height: .75, color: '#000', x: p[0], y: p[1], rotation: 0 }; if (!why(ctx, pr, null)) return p; }
    return null;
  }
  // стоит ли предмет m под окном на стене s
  const underWin = (ctx, m, s) => { const lo = span(ctx, s)[0], a = al(m, s), hw = m.width / 2; return ctx.sp[s].some(q => q.o.kind === 'window' && a + hw > lo + q.s + .05 && a - hw < lo + q.e - .05); };
  // место для стола. iw×id — сам стол (оси экрана), ow×od — стол со стульями
  // mode 'center': посреди комнаты, проход mg со всех сторон; 'corner': у стены/в углу, проход mg только со свободных сторон
  function tableSpot(ctx, iw, id, ow, od, mode, mg) {
    const r = ctx.r, pts = [], pr = (w, d, x, y) => ({ id: 'probe', kind: 'box', name: 'зона стола', width: w, depth: d, height: .75, color: '#000', x, y, rotation: 0 });
    if (mode === 'center') {
      const W = ow + 2 * mg, D = od + 2 * mg, cx = r.x + r.width / 2, cy = r.y + r.depth / 2;
      for (let x = r.x + W / 2; x <= r.x + r.width - W / 2 + 1e-6; x += .15) for (let y = r.y + D / 2; y <= r.y + r.depth - D / 2 + 1e-6; y += .15) pts.push([x, y]);
      pts.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
      return pts.find(p => !why(ctx, pr(W, D, p[0], p[1]), null)) || null;
    }
    const x0 = r.x + iw / 2, x1 = r.x + r.width - iw / 2, y0 = r.y + id / 2, y1 = r.y + r.depth - id / 2;
    if (x1 < x0 - 1e-6 || y1 < y0 - 1e-6) return null;
    for (let x = x0; x <= x1 + 1e-6; x += .15) { pts.push([x, y0]); pts.push([x, y1]); }
    for (let y = y0; y <= y1 + 1e-6; y += .15) { pts.push([x0, y]); pts.push([x1, y]); }
    const cr = p => Math.min(...[[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.depth], [r.x + r.width, r.y + r.depth]].map(c => Math.hypot(p[0] - c[0], p[1] - c[1])));
    pts.sort((a, b) => cr(a) - cr(b));                                          // сначала ближайшие к углам
    return pts.find(p => !why(ctx, pr(iw, id, p[0], p[1]), null) && !why(ctx, pr(ow + 2 * mg, od + 2 * mg, p[0], p[1]), null, true)) || null;
  }
  // дотянуть линию кухонных модулей до края стены (нет пустых мест по краям)
  function closeGap(ctx, side, dir, CT, CAB) {
    const KS = ['counter', 'sink', 'base_oven', 'stove', 'dishwasher', 'cab_washer', 'tall_cab', 'fridge'];
    const L = ctx.added.filter(m => ROT[m.rotation] === side && KS.includes(m.kind)); if (!L.length) return;
    const [lo, hi] = span(ctx, side), sg = dir === 'start' ? 1 : -1;
    const last = L.reduce((a, b) => (sg * al(b, side) > sg * al(a, side) ? b : a));
    const edge = al(last, side) + sg * last.width / 2, g = sg > 0 ? hi - edge : edge - lo;
    if (g < .02 || g > .6) return;
    if (g >= .3) {                                                              // хватает места на узкий модуль
      const c = edge + sg * g / 2, m = put(ctx, CT, side, c, { w: g });
      if (m) { put(ctx, CAB, side, c, { w: g }); ctx.log.push('  дотянул стенку до края: модуль ' + g.toFixed(2) + ' м'); }
      return;
    }
    if (last.kind !== 'counter') return;                                        // меньше 30 см: расширяем последний модуль
    const old = al(last, side), cabs = ctx.added.filter(m => m.kind === 'wall_cab' && ROT[m.rotation] === side && Math.abs(al(m, side) - old) < .02);
    const tgt = [last].concat(cabs), bak = tgt.map(m => [m.x, m.y, m.width]);
    tgt.forEach(m => { m.width = +(m.width + g).toFixed(3); if (horiz(side)) m.x = +(m.x + sg * g / 2).toFixed(3); else m.y = +(m.y + sg * g / 2).toFixed(3); });
    if (why(ctx, last, side)) tgt.forEach((m, i) => { m.x = bak[i][0]; m.y = bak[i][1]; m.width = bak[i][2]; });
    else ctx.log.push('  дотянул стенку до края: модуль расширен на ' + g.toFixed(2) + ' м');
  }

  const BASEK = ['counter', 'sink', 'base_oven', 'stove', 'dishwasher', 'cab_washer', 'corner_cab'];       // нижние модули стенки (под столешницу, фартук, навесные)
  const KBASE = BASEK.concat(['tall_cab', 'fridge']);
  function exWallOf(m) {                            // у углового шкафа: стена, вдоль которой идёт его вторая ветка
    const a = (m.rotation || 0) * Math.PI / 180, sg = m.flipX ? 1 : -1, dx = Math.cos(a) * sg, dy = Math.sin(a) * sg;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'w' : 'e') : (dy < 0 ? 'n' : 's');
  }
  function runs(ctx, side) {                        // отрезки вдоль стены side, занятые кухонной мебелью (включая торцы перпендикулярных линий и ветки углов)
    const r = ctx.r, L = [];
    ctx.added.forEach(m => {
      if (!KBASE.includes(m.kind)) return;
      let a0 = 1e9, a1 = -1e9;
      fr(m).forEach(q => {
        const ex = Math.abs(q.ux) * q.hl + Math.abs(q.uy) * q.ht, ey = Math.abs(q.uy) * q.hl + Math.abs(q.ux) * q.ht;
        const t = side === 'n' ? q.cy - ey <= r.y + .03 : side === 's' ? q.cy + ey >= r.y + r.depth - .03 : side === 'w' ? q.cx - ex <= r.x + .03 : q.cx + ex >= r.x + r.width - .03;
        if (!t) return;
        a0 = Math.min(a0, horiz(side) ? q.cx - ex : q.cy - ey); a1 = Math.max(a1, horiz(side) ? q.cx + ex : q.cy + ey);
      });
      if (a1 > a0) L.push({ a0, a1, m });
    });
    return L.sort((p, q) => p.a0 - q.a0);
  }
  function closeGaps(ctx, side, CT) {               // нет пустых мест: узкий модуль (0,3–0,6 м) или расширение соседа (< 0,3 м)
    const [lo, hi] = span(ctx, side), L = runs(ctx, side); if (!L.length) return;
    const segs = [[lo, L[0].a0, null, L[0]]];
    for (let i = 0; i < L.length - 1; i++) segs.push([L[i].a1, L[i + 1].a0, L[i], L[i + 1]]);
    segs.push([L[L.length - 1].a1, hi, L[L.length - 1], null]);
    segs.forEach(([a, b, u, w]) => {
      const g = b - a; if (g < .02 || g > .6) return;
      if (g >= .3) { const m = put(ctx, CT, side, (a + b) / 2, { w: +g.toFixed(3) }); if (m) ctx.log.push('  закрыл зазор ' + g.toFixed(2) + ' м на стене «' + SN[side] + '» узким модулем'); return; }
      for (const x of [u, w]) {
        if (!x || ROT[x.m.rotation] !== side || !['counter', 'sink', 'cab_washer'].includes(x.m.kind)) continue;
        const m = x.m, w0 = m.width, p0 = horiz(side) ? m.x : m.y, sg = x === u ? 1 : -1;
        m.width = +(w0 + g).toFixed(3); if (horiz(side)) m.x = +(p0 + sg * g / 2).toFixed(3); else m.y = +(p0 + sg * g / 2).toFixed(3);
        if (!why(ctx, m, side)) { ctx.log.push('  закрыл зазор ' + g.toFixed(2) + ' м на стене «' + SN[side] + '»: расширил «' + m.name + '»'); return; }
        m.width = w0; if (horiz(side)) m.x = p0; else m.y = p0;
      }
    });
  }

  function dining(ctx, tw, td, vert, p, oval) {
    const T = oval ? I('oval', 'Стол овальный', tw, td, .75, '#bd9a73', 'w') : I('dining', 'Обеденный стол', tw, td, .75, '#bd9a73', 'w'), C = I('chair', 'Стул', .45, .5, .85, '#b18c68', 'w'), n = tw > 1.5 ? 3 : tw > 1 ? 2 : 1, e = td / 2 - .1;
    if (!tryAdd(ctx, mk(ctx, T, p[0], p[1], vert ? 90 : 0))) return false;
    for (let i = 0; i < n; i++) [-1, 1].forEach(s => {
      const off = (i - (n - 1) / 2) * (tw / n);
      tryAdd(ctx, vert ? mk(ctx, C, p[0] + s * e, p[1] + off, s < 0 ? 270 : 90) : mk(ctx, C, p[0] + off, p[1] + s * e, s < 0 ? 0 : 180));
    });
    return true;
  }
  // поставить стол (с одним из размеров SZ) с лучшим вариантом: центр, потом у стены/в углу; проход от большого к малому
  function placeTable(ctx, SZ, oval, name) {
    const vt = ctx.r.depth > ctx.r.width;
    for (const mode of ['center', 'corner']) for (const mg of [.75, .6, .45, .3]) for (const [tw, td] of SZ) for (const vert of [vt, !vt]) {
      const p = tableSpot(ctx, vert ? td : tw, vert ? tw : td, vert ? td + .3 : tw, vert ? tw : td + .3, mode, mg);   // +.3 — стулья по бокам
      if (p && dining(ctx, tw, td, vert, p, oval)) { ctx.log.push('  ' + name + ' ' + tw + '×' + td + ', режим «' + (mode === 'center' ? 'в центре' : 'у стены/в углу') + '», проход ' + mg + ' м'); return true; }
    }
    return false;
  }
  function deskSet(ctx, side, pos, office) {
    const desk = I('desk', 'Рабочий стол', 1.2, .6, .75, '#b99570', 'w'), ch = office ? I('office_chair', 'Кресло офисное', .6, .6, 1.1, '#444a50', 'x') : I('chair', 'Стул', .45, .5, .85, '#b18c68', 'w'), mark = ctx.added.length;
    const dm = putFlex(ctx, desk, side, pos, 1.2, 1.8); if (!dm) return null;
    const n = DIR[side], e = desk.d / 2 + ch.d / 2 - .1;
    if (!tryAdd(ctx, mk(ctx, ch, dm.x + n[0] * e, dm.y + n[1] * e, (n[2] + 180) % 360))) { rollback(ctx, mark); return null; }
    return dm;
  }

  // ---------- сценарии: vars(ctx) — список вариантов, run(ctx, v) — расстановка одного варианта ----------
  const RECIPES = {

    kitchen: {
      vars(ctx) {
        const out = [], FZ = { line: 'в линии', corner: 'в углу отдельно', free: 'отдельно у двери' };
        mains(ctx).forEach(m => {
          if (len(ctx, m) < 1.6) return;
          for (const d of ['start', 'end']) for (const ord of [0, 1, 2]) for (const ex of [false, 'near', 'far']) for (const cr of (ex ? ['cab', 'blind'] : ['cab'])) for (const fz of ['line', 'corner', 'free'])
            out.push({
              main: m, dir: d, ord, ex, cr, fz, tb: 'corner',
              label: 'линия вдоль «' + SN[m] + '»' + (ex ? ' + Г-образное продолжение (' + (ex === 'near' ? 'у начала линии' : 'у конца линии') + ', ' + (cr === 'cab' ? 'угловой шкаф' : 'без углового шкафа, слитная столешница') + ')' : '') + ', от ' + (d === 'start' ? (horiz(m) ? 'запада' : 'севера') : (horiz(m) ? 'востока' : 'юга')) + ', порядок ' + (ord + 1) + ', холодильник ' + FZ[fz] + (ctx.o.on.dining ? ', стол у стены/в углу' : '')
            });
        });
        return out;
      },
      run(ctx, v) {
        const f = ctx.f, r = ctx.r, on = ctx.o.on, A = r.width * r.depth, H = f.height, KC = '#899a87', KD = .6;      // KD: единая глубина всей нижней мебели
        const CT = I('counter', 'Кухонный модуль', .6, KD, .9, KC, 'k'),
          CAB = I('wall_cab', 'Навесной шкаф (до потолка)', .6, .35, Math.max(.5, H - 1.4), KC, 'k', 1.4),
          CABT = I('wall_cab', 'Шкаф над вытяжкой (до потолка)', .6, .35, Math.max(.3, H - 2.3), KC, 'k', 2.3),
          HOOD = I('hood', 'Вытяжка', .6, .5, .8, '#cfcfcf', 'x', 1.5),
          HOB = I('hob_gas', 'Газовая варочная панель', .6, .52, .065, '#222222', 'x', .877),
          FR = I('fridge', 'Холодильник', .6, KD, 1.8, '#e2e2dc', 'x'),
          SK = I('sink', 'Мойка', .8, KD, .91, KC, 'k'),
          ST = on.hob ? I('base_oven', 'Нижний модуль со встроенной духовкой', .6, KD, .9, KC, 'k') : I('stove', 'Плита', .6, KD, .9, '#cfcfcf', 'x'),
          WM = on.washer ? I('cab_washer', 'Шкаф со встроенной стиральной машиной', .6, KD, .9, KC, 'k') : null,
          DW = on.dish ? I('dishwasher', 'Посудомоечная машина', .6, KD, .85, '#e8e8e8', 'x') : null,
          TALL = on.tall ? I('tall_cab', 'Шкаф-пенал (до потолка)', .6, KD, H - .05, KC, 'k') : null,
          CORN = I('corner_cab', 'Угловой шкаф', .9, .9, .9, KC, 'k'),
          CORNW = I('corner_wall', 'Угловой навесной шкаф', .9, .9, Math.max(.5, H - 1.4), KC, 'k', 1.4),
          WT = I('worktop', 'Столешница', .6, .62, .045, '#e8e4da', 'x', .86),
          BS = I('backsplash', 'Фартук', .6, .02, .5, '#c9d2cf', 'x', .9);
        const has = k => ctx.added.some(m => m.kind === k), g = k => ctx.added.find(m => m.kind === k);
        const lay = (s, seq, dir, cap, reach) => {                              // только нижние модули; шкафы/фартук/столешница добавляются в конце
          const [lo, hi] = span(ctx, s); let cur = dir === 'start' ? lo : hi, n = 0;
          for (const it of seq) {
            if (cap && n >= cap) break;
            const q = dir === 'start' ? { min: cur } : { max: cur };
            if (reach != null && n === 0) { if (dir === 'start') q.max = cur + it.w + reach; else q.min = cur - it.w - reach; }
            const m = put(ctx, it, s, dir, q); if (!m) continue;
            n++; cur = dir === 'start' ? al(m, s) + m.width / 2 : al(m, s) - m.width / 2;
            if (m.kind === 'base_oven') add(ctx, mk(ctx, HOB, m.x, m.y, m.rotation));
          }
        };
        // 1) угол (Г-образная кухня): либо Г-образный угловой шкаф, либо вторая линия примыкает торцом
        let exw = null, xd = null;
        if (v.ex) {
          const nd = v.ex === 'far' ? OPF[v.dir] : v.dir, dec = v.main === 's' || v.main === 'w';
          exw = nd === 'start' ? (horiz(v.main) ? 'w' : 'n') : (horiz(v.main) ? 'e' : 's'); xd = (v.main === 's' || v.main === 'e') ? 'end' : 'start';
          if (v.cr === 'cab') {
            const cm = put(ctx, Object.assign({}, CORN, { flip: (nd === 'start') === dec }), v.main, nd, { w: .9 });
            if (cm) bonus(ctx, 'угловой шкаф', 2); else ctx.log.push('  угловой шкаф не встал');
          } else ctx.log.push('  без углового шкафа: вторая линия примыкает торцом, столешница слитная');
        }
        // 2) главная линия
        const fill = [CT, CT, CT, CT, CT, CT];
        const ORD = [[SK, DW, CT, ST, WM], [ST, CT, SK, DW, WM], [ST, WM, SK, DW, CT]], tallIn = TALL && v.fz !== 'line' && v.ord >= 2;   // пенал открывает линию, холодильник отдельно
        lay(v.main, [].concat(v.fz === 'line' ? [FR, TALL, CT] : (tallIn ? [TALL, CT] : []), ORD[v.ord], fill).filter(Boolean), v.dir);
        // 3) продолжение по смежной стене
        if (exw) {
          const need = [!has('sink') && SK, !has(ST.kind) && ST, DW && !has('dishwasher') && DW, WM && !has('cab_washer') && WM].filter(Boolean);
          lay(exw, need.concat([CT, CT, CT, CT]), xd, 6, 1.0);
        }
        SIDES.forEach(s => closeGaps(ctx, s, CT));                              // 4) никаких зазоров: между модулями и до краёв стены
        // 5) холодильник и остальное
        const corner = (it, qual, froms, sides) => {                            // лучшее место: пробуем все, берём с максимальной оценкой
          let bq = -1e9, bs = null;
          (sides || SIDES).forEach(s => (froms || ['start', 'end']).forEach(d => { const m0 = ctx.added.length, m = put(ctx, it, s, d); if (m) { const q = qual(m, s); if (q > bq) { bq = q; bs = [s, d]; } } rollback(ctx, m0); }));
          return bs ? put(ctx, it, bs[0], bs[1]) : null;
        };
        const stv = () => g('base_oven') || g('stove');
        if (!has('fridge')) {
          const sk0 = g('sink'), st0 = stv();
          const dD = m => Math.min(9, ...f.openings.filter(o => o.kind === 'door' && o.wallId.startsWith(r.id + ':')).map(o => { const p = FP.openPos(ctx.walls.find(q => q.id === o.wallId), o); return Math.hypot(p.cx - m.x, p.cy - m.y); }));
          const qual = (m, s) => { let q = -cnt(ctx, s, 'door'); if (st0 && dist(m, st0) < .9) q -= 6; if (sk0) { const d = dist(m, sk0); q += d >= 1.2 && d <= 3.5 ? 3 : 0; } return v.fz === 'free' ? q + 3 - Math.min(3, dD(m)) : q; };
          if (v.fz === 'free') corner(FR, qual, ['mid', 'start', 'end'], SIDES.filter(s => s !== v.main));
          else corner(FR, qual);
        }
        // плиту и мойку отдельно в другом углу не ставим: не влезли в линию, значит вариант получит «нет: …»
        if (WM && !has('cab_washer')) fitAny(ctx, WM, [.6], byLen(ctx), ['end', 'start', 'mid']);
        if (DW && !has('dishwasher')) fitAny(ctx, DW, [.6], byLen(ctx), ['end', 'start', 'mid']);
        if (TALL && !has('tall_cab')) {                                         // пенал рядом с холодильником
          const fm = g('fridge'), s = fm && ROT[fm.rotation]; let t = null;
          if (s) for (const sg of [1, -1]) t = t || put(ctx, TALL, s, al(fm, s) + sg * .6);
          if (!t) t = fitAny(ctx, TALL, [.6], SIDES, ['end', 'start']);
        }
        // 6) столешница одним куском, фартук, навесные шкафы, вытяжка
        const TOPK = ['counter', 'dishwasher', 'cab_washer', 'base_oven'], BU = ctx.added.filter(m => BASEK.includes(m.kind));
        SIDES.forEach(s => {
          const on1 = BU.filter(m => m.kind !== 'corner_cab' && ROT[m.rotation] === s).sort((a, b) => al(a, s) - al(b, s)); let grp = [];
          const flush = () => {
            if (grp.length) { const a0 = al(grp[0], s) - grp[0].width / 2, e = grp[grp.length - 1], a1 = al(e, s) + e.width / 2; if (a1 - a0 > .1) add(ctx, make(ctx, WT, s, (a0 + a1) / 2, a1 - a0)); }
            grp = [];
          };
          on1.forEach(m => {
            if (TOPK.includes(m.kind)) { const l = grp[grp.length - 1]; if (l && (al(m, s) - m.width / 2) - (al(l, s) + l.width / 2) > .03) flush(); grp.push(m); } else flush();   // мойка и плита имеют свою столешницу: кусок прерывается
            const b = make(ctx, BS, s, al(m, s), m.width); if (!why(ctx, b, s, true)) add(ctx, b);                    // фартук (под окном не ставится)
            if (m.kind === 'base_oven' || m.kind === 'stove') { if (put(ctx, HOOD, s, al(m, s), { w: .6 })) put(ctx, CABT, s, al(m, s), { w: .6 }); }   // вытяжка, над ней шкаф до потолка
            else put(ctx, CAB, s, al(m, s), { w: m.width });                    // навесной шкаф над каждым модулем
          });
          flush();
        });
        BU.filter(m => m.kind === 'corner_cab').forEach(m => {                  // угол: фартук на обе стены и Г-образный навесной шкаф
          const sM = ROT[m.rotation], sX = exWallOf(m);
          [sM, sX].forEach(s => { const b = make(ctx, BS, s, al(m, s), .9); if (!why(ctx, b, s, true)) add(ctx, b); });
          const cw = mk(ctx, CORNW, m.x, m.y, m.rotation); if (m.flipX) cw.flipX = true;
          if (!why(ctx, cw, sM)) add(ctx, cw); else ctx.log.push('  угловой навесной шкаф не встал (окно или дверь)');
        });
        // 7) обеденный стол
        if (on.dining && A >= 6) {                                              // только 0,9×0,65; режим варианта (у стены/в углу), потом другой
          const SZ = [[.9, .65]], vt = r.depth > r.width, modes = v.tb === 'corner' ? ['corner', 'center'] : ['center', 'corner']; let done = false;
          for (const mode of modes) {
            for (const mg of [.75, .6, .45, .3, .2]) {
              for (const [tw, td] of SZ) for (const vert of [vt, !vt]) {
                if (done) break;
                const p = tableSpot(ctx, vert ? td : tw, vert ? tw : td, vert ? td + .3 : tw, vert ? tw : td + .3, mode, mg);
                if (p && dining(ctx, tw, td, vert, p)) { done = true; ctx.log.push('  стол ' + tw + '×' + td + ', режим «' + (mode === 'center' ? 'в центре' : 'у стены/в углу') + '», проход ' + mg + ' м, ' + (vert ? 'вертикально' : 'горизонтально')); }
              }
              if (done) break;
            }
            if (done) break;
          }
          if (!done) miss(ctx, 'обеденный стол', 6);
        }
        // 8) оценка
        const sk = g('sink'), st = stv(), fz = g('fridge');
        if (!sk) miss(ctx, 'мойка', 40); if (!st) miss(ctx, 'плита', 25); if (!fz) miss(ctx, 'холодильник', 20);
        if (DW && !has('dishwasher')) miss(ctx, 'посудомойка', 3); if (WM && !has('cab_washer')) miss(ctx, 'стиральная машина', 3); if (TALL && !has('tall_cab')) miss(ctx, 'высокий шкаф', 3);
        if (sk && st && fz) {
          const tri = dist(sk, st) + dist(st, fz) + dist(fz, sk);
          bonus(ctx, 'рабочий треугольник', tri >= 3.4 && tri <= 7 ? 10 : tri < 3.4 ? 5 : Math.max(0, 10 - (tri - 7) * 3));
          ctx.log.push('  треугольник мойка–плита–холодильник: ' + tri.toFixed(2) + ' м');
        }
        if (sk && st) bonus(ctx, 'расстояние мойка–плита', dist(sk, st) >= 1.0 ? 3 : -3);
        if (sk) {
          const sd = ROT[sk.rotation], nn = DIR[sd] || [0, 1, 0];
          const lo0 = sd ? span(ctx, sd)[0] : 0, hi0 = sd ? span(ctx, sd)[1] : 0, a0 = sd ? al(sk, sd) : 0, gapE = sd ? Math.min(a0 - sk.width / 2 - lo0, hi0 - a0 - sk.width / 2) : 1;
          if (gapE < .25) bonus(ctx, 'мойка вплотную к углу (негде стоять)', -15); else if (gapE < .5) bonus(ctx, 'мойка близко к углу', -3);
          const pz = { id: 'probe', kind: 'box', name: 'место у мойки', width: .9, depth: .6, height: .75, color: '#000', x: sk.x + nn[0] * .6, y: sk.y + nn[1] * .6, rotation: nn[2] };
          if ((why(ctx, pz, null) || '').indexOf('пересекается') >= 0) bonus(ctx, 'место перед мойкой занято', -10);
          if (sd && underWin(ctx, sk, sd)) bonus(ctx, 'мойка у окна', 4);
        }
        if (st && fz && dist(st, fz) < .8) bonus(ctx, 'плита вплотную к холодильнику', -4);
        const TK = ['tall_cab', 'fridge', 'tall_oven'], KB2 = ['counter', 'sink', 'base_oven', 'stove', 'dishwasher', 'cab_washer', 'tall_cab', 'fridge', 'corner_cab'];
        const nb = m => ctx.added.filter(o => o !== m && KB2.includes(o.kind) && fr(m).some(p => fr(o).some(q => hit(p, q, -.06))));   // соседи вплотную (до 12 см)
        [[sk, 'мойка'], [st, 'плита']].forEach(a => {
          if (!a[0]) return; const ns = nb(a[0]), bad = ns.filter(o => TK.includes(o.kind)).length;
          if (bad) bonus(ctx, a[1] + ': рядом пенал или холодильник', -12 * bad);
          bonus(ctx, a[1] + ': столешница рядом', Math.min(2, ns.length - bad) * 2.5);
        });
        const tl = g('tall_cab'); if (tl && nb(tl).length >= 2) bonus(ctx, 'пенал в середине стенки', -8);
        const wl = ctx.added.filter(m => ['counter', 'sink', 'base_oven', 'stove', 'dishwasher', 'cab_washer', 'corner_cab'].includes(m.kind)).reduce((s, m) => s + m.width, 0);
        bonus(ctx, 'длина рабочей зоны', Math.min(wl, 3.6) * 1.5);
        const KB = ['counter', 'sink', 'base_oven', 'stove', 'dishwasher', 'cab_washer', 'tall_cab', 'corner_cab'], bu = ctx.added.filter(m => KB.includes(m.kind));
        if (bu.length > 1) {                                                    // чем больше модулей стоят сплошной линией (в т.ч. через угол), тем лучше
          const used = new Set(), totW = bu.reduce((s, m) => s + m.width, 0); let bestW = 0;
          bu.forEach(s0 => {
            if (used.has(s0)) return; let w = 0; const stack = [s0]; used.add(s0);
            while (stack.length) { const c = stack.pop(); w += c.width; bu.forEach(o2 => { if (!used.has(o2) && fr(c).some(p => fr(o2).some(q => hit(p, q, -.06)))) { used.add(o2); stack.push(o2); } }); }
            bestW = Math.max(bestW, w);
          });
          bonus(ctx, 'сплошная стенка без разрывов', 14 * bestW / totW);
          ctx.log.push('  сплошная часть стенки: ' + bestW.toFixed(1) + ' из ' + totW.toFixed(1) + ' м');
        }
      }
    },

    bedroom: {
      vars(ctx) {
        const out = []; mains(ctx).forEach(m => ['mid', 'start', 'end'].forEach(p => ['long', 'opp'].forEach(w => out.push({ main: m, pos: p, ws: w, label: 'кровать у стены «' + SN[m] + '» (' + PN[p] + '), шкаф ' + (w === 'long' ? 'у длинной стены' : 'напротив кровати') }))));
        return out;
      },
      run(ctx, v) {
        const r = ctx.r, on = ctx.o.on, A = r.width * r.depth, bw = A >= 16 ? 1.85 : A >= 11 ? 1.65 : A >= 8 ? 1.45 : .95;
        const bed = I('bed', 'Кровать ' + ({ 1.85: 180, 1.65: 160, 1.45: 140, .95: 90 })[bw], bw, bw < 1 ? 2.05 : 2.15, .65, '#e5dfd1', 's'), ns = I('nightstand', 'Тумба', .45, .45, .5, '#ba9b7c', 'w');
        const bm = perp(ctx, v.main) >= bed.d + .5 ? put(ctx, bed, v.main, v.pos) : null;
        if (!bm) miss(ctx, 'кровать', 40);
        else {
          const a = al(bm, v.main); let n = 0;
          if (put(ctx, ns, v.main, a - bw / 2 - .245)) n++;
          if (put(ctx, ns, v.main, a + bw / 2 + .245)) n++;
          bonus(ctx, 'прикроватные тумбы', n * 3); bonus(ctx, 'окна/двери на стене изголовья', -cnt(ctx, v.main, 'window') * 3 - cnt(ctx, v.main, 'door') * 2);
          if (on.rug) addRug(ctx, bm, v.main, Math.min(bw + .8, len(ctx, v.main) - .2), 2.0, .35);
        }
        const sides = v.ws === 'long' ? byLen(ctx).filter(s => s !== v.main).concat(v.main) : [OPP[v.main]].concat(SIDES.filter(s => s !== OPP[v.main] && s !== v.main), [v.main]);

        if (!flexAny(ctx, I('wardrobe', 'Шкаф', 1.8, .6, 2.2, '#d6cdbb', 'k'), sides, ['start', 'end'], .8, 2.6)) miss(ctx, 'шкаф', 12);
        else if (on.ward2 && A >= 12 && !flexAny(ctx, I('wardrobe', 'Шкаф 2', 1.2, .6, 2.2, '#d6cdbb', 'k'), sides, ['end', 'start'], .8, 2.0)) miss(ctx, 'второй шкаф', 2);
        if (on.dresser && A >= 10 && !flexAny(ctx, I('dresser', 'Комод', 1.2, .5, .85, '#c9b08a', 'w'), sides, ['mid', 'start', 'end'], .8, 1.6)) miss(ctx, 'комод', 3);
        if (on.mirror && !fitAny(ctx, I('mirror_full', 'Зеркало в рост', .5, .04, 1.7, '#6f5a44', 'x', .1), [.5], sides, ['end', 'start', 'mid'])) miss(ctx, 'зеркало', 1);
        if (on.armchair && !fitAny(ctx, I('armchair', 'Кресло', .85, .85, .8, '#bf8c6c', 's'), [.85], sides, ['start', 'end'])) miss(ctx, 'кресло', 2);

        if (on.desk) { let d = null; for (const s of byLen(ctx)) for (const p of ['start', 'end', 'mid']) d = d || deskSet(ctx, s, p, false); if (d) bonus(ctx, 'рабочее место у окна', cnt(ctx, ROT[d.rotation], 'window') * 3); else miss(ctx, 'рабочее место', 4); }
      }
    },

    living: {
      vars(ctx) {
        const out = [], kinds = ctx.o.on.lsofa ? ['straight', 'L'] : ['straight'], KN = { straight: 'прямой диван', L: 'угловой диван (лежанка к краю)' };
        kinds.forEach(k => mains(ctx).forEach(m => (k === 'L' ? ['start', 'end'] : ['mid', 'start', 'end']).forEach(p => out.push({ main: m, pos: p, sk: k, label: KN[k] + ' у стены «' + SN[m] + '» (' + PN[p] + '), ТВ напротив' }))));
        return out;
      },
      run(ctx, v) {
        const r = ctx.r, on = ctx.o.on, A = r.width * r.depth, sw = A >= 14 ? 2.3 : 1.6, L = byLen(ctx);
        const isL = v.sk === 'L', flip = isL && ((v.pos === 'end') !== (v.main === 'n' || v.main === 'e'));   // лежанка смотрит в сторону края
        const sofa = isL ? Object.assign(I('sofa_l', 'Диван угловой', 2.8, 1.9, .78, '#c4c2b2', 's'), { flip }) : I('sofa', 'Диван', 1.6, .95, .78, '#c4c2b2', 's');
        const sm = perp(ctx, v.main) >= (isL ? 3.4 : 2.6) ? (isL ? put(ctx, sofa, v.main, v.pos) : putFlex(ctx, sofa, v.main, v.pos, 1.6, A >= 14 ? 2.6 : 2.1)) : null;
        if (!sm) miss(ctx, 'диван', 30);
        if (on.tv) {
          const un = put(ctx, I('tvstand', 'ТВ-тумба', 1.6, .4, .5, '#b99570', 'w'), OPP[v.main], 'mid');
          if (!un) miss(ctx, 'ТВ-тумба', 8);
          else {
            put(ctx, I('tv', 'Телевизор', 1.23, .06, .72, '#1a1a1a', 'x', 1.0), OPP[v.main], al(un, OPP[v.main]));
            if (sm) { const d = dist(sm, un); bonus(ctx, 'расстояние диван–ТВ', d >= 2.2 && d <= 4.8 ? 6 : d < 2 ? -5 : 0); }
          }
        }
        if (sm) {
          const n = DIR[v.main], P = perp(ctx, v.main);
          if (!isL && P >= 3.2) tryAdd(ctx, mk(ctx, I('table', 'Журнальный стол', 1.1, .65, .4, '#b99570', 'w'), sm.x + n[0] * 1.2, sm.y + n[1] * 1.2, n[2]));
          if (on.rug && P >= 4.4) addRug(ctx, sm, v.main, Math.min(2.4, len(ctx, v.main) - .8), 1.6, 1.25);
        }
        if (on.dining && !placeTable(ctx, A >= 16 ? [[1.7, .9], [1.4, .8], [1.2, .8]] : [[1.2, .8], [.9, .65]], false, 'обеденный стол')) miss(ctx, 'обеденный стол', 6);
        if (on.oval && !placeTable(ctx, A >= 16 ? [[1.8, 1], [1.4, .9]] : [[1.4, .9]], true, 'овальный стол')) miss(ctx, 'овальный стол', 6);

        if (on.armchair) for (let i = 0; i < 2; i++) if (!fitAny(ctx, I('armchair', 'Кресло', .85, .85, .8, '#bf8c6c', 's'), [.85], L, ['start', 'end'])) { if (!i) miss(ctx, 'кресло', 3); break; }   // два кресла
        if (on.shelf && !flexAny(ctx, I('shelf', 'Стеллаж', 1, .35, 1.9, '#b99570', 'w'), L, ['start', 'end', 'mid'], .8, 1.6)) miss(ctx, 'стеллаж', 3);
        if (on.board) {                                                         // сервант с полкой над ним
          const sb = flexAny(ctx, I('dresser', 'Сервант / комод', 1.2, .5, .85, '#c9b08a', 'w'), L, ['mid', 'start', 'end'], 1.0, 1.8);
          if (!sb) miss(ctx, 'сервант', 3); else { const s0 = ROT[sb.rotation]; if (s0) put(ctx, I('wall_shelf', 'Полка настенная', 1, .22, .04, '#b99570', 'w', 1.5), s0, al(sb, s0), { w: Math.min(sb.width, 1.2) }); }
        }

        if (on.plant) fitAny(ctx, I('plant', 'Растение', .65, .65, 1.25, '#688366', 'x'), [.65], L, ['end', 'start']);
        if (sm) bonus(ctx, 'двери на стене дивана', -cnt(ctx, v.main, 'door'));
        if (sm && isL) bonus(ctx, 'угловой диван', 2);
      }
    },

    bath: {
      vars(ctx) {
        const out = []; SIDES.forEach(s => ['start', 'end'].forEach(d => ['start', 'end', 'mid'].forEach(t => out.push({ bs: s, bd: d, tp: t, label: 'ванна/душ у «' + SN[s] + '» (' + PN[d] + '), унитаз ' + PN[t] }))));
        return out;
      },
      run(ctx, v) {
        const r = ctx.r, on = ctx.o.on, A = r.width * r.depth, wc = A < 2.6, sides = [OPP[v.bs]].concat(byLen(ctx).filter(s => s !== OPP[v.bs]));
        if (!wc) {
          const SH = I('shower_open', 'Душ: поддон + стекло + дверь', .9, .9, 2.05, '#bfe0ee', 'x');
          const inC = m => { const s0 = ROT[m.rotation], [lo, hi] = span(ctx, s0), c = al(m, s0); return Math.min(c - m.width / 2 - lo, hi - c - m.width / 2) < .06; };   // душ стоит в углу
          let tub = null;
          if (!on.shower) for (const w of [1.7, 1.5, 1.3]) tub = tub || put(ctx, I('bath', 'Ванна', w, .8, .58, WH, 'x'), v.bs, v.bd, { w });
          if (!tub) {                                                           // сначала на стене варианта, потом на других; только в углу, ширина 0,9–1,5 м
            for (const s of [v.bs].concat(SIDES.filter(q => q !== v.bs))) for (const d of [v.bd, OPF[v.bd]]) {
              if (tub) break; const m0 = ctx.added.length, q = putFlex(ctx, SH, s, d, .9, 1.5);
              if (q && !inC(q)) rollback(ctx, m0); else if (q) tub = q;
            }
          }
          if (!tub) miss(ctx, 'ванна / душ', 25);
        }
        const to = fitAny(ctx, I('toilet', 'Унитаз', .42, .7, .45, WH, 'x'), [.42], sides, [v.tp, 'mid', 'start', 'end']);
        if (!to) miss(ctx, 'унитаз', 25);
        const vn = fitAny(ctx, I('vanity', 'Тумба с умывальником', .8, .5, .85, WH, 'x'), wc ? [.6] : [.8, .6], sides, [OPF[v.tp], 'mid', 'start', 'end']);
        if (!vn) miss(ctx, 'умывальник', 20);
        else { const s = ROT[vn.rotation]; if (s && put(ctx, I('mirror', 'Зеркало', .6, .03, .8, '#8b6b4a', 'x', 1.1), s, al(vn, s))) bonus(ctx, 'зеркало над умывальником', 2); }
        if (to && vn) bonus(ctx, 'унитаз и умывальник не вплотную', dist(to, vn) >= .8 ? 2 : -2);
        if (on.washer && !wc && !fitAny(ctx, I('washer', 'Стиральная машина', .6, .6, .85, '#f0f0f0', 'x'), [.6], sides, ['start', 'end'])) miss(ctx, 'стиральная машина', 3);
      }
    },

    office: {
      vars(ctx) {
        const out = []; mains(ctx).forEach(m => ['start', 'end', 'mid'].forEach(p => ['long', 'opp'].forEach(w => out.push({ main: m, pos: p, ws: w, label: 'стол у стены «' + SN[m] + '» (' + PN[p] + '), стеллажи ' + (w === 'long' ? 'у длинных стен' : 'напротив стола') }))));
        return out;
      },
      run(ctx, v) {
        const dm = deskSet(ctx, v.main, v.pos, true);
        if (!dm) miss(ctx, 'рабочий стол', 40); else bonus(ctx, 'стол у окна', cnt(ctx, v.main, 'window') * 4);
        const sides = v.ws === 'long' ? byLen(ctx) : [OPP[v.main]].concat(byLen(ctx).filter(s => s !== OPP[v.main]));
        if (!flexAny(ctx, I('shelf', 'Стеллаж', 1, .35, 1.9, '#b99570', 'w'), sides, ['start', 'end', 'mid'], .8, 1.8)) miss(ctx, 'стеллаж', 5);
        if (ctx.o.on.wardrobe && !flexAny(ctx, I('wardrobe', 'Шкаф', .8, .6, 2.2, '#d6cdbb', 'k'), sides, ['start', 'end'], .8, 1.6)) miss(ctx, 'шкаф', 3);
      }
    },

    hall: {
      vars(ctx) { const out = []; mains(ctx).forEach(m => ['start', 'end'].forEach(d => out.push({ main: m, dir: d, label: 'шкаф у стены «' + SN[m] + '» (' + PN[d] + ')' }))); return out; },
      run(ctx, v) {
        const L = [v.main].concat(byLen(ctx).filter(s => s !== v.main));
        if (!flexAny(ctx, I('wardrobe', 'Шкаф', 1.2, .45, 2.2, '#d6cdbb', 'k'), [v.main], [v.dir, OPF[v.dir]], .8, 2.4)) miss(ctx, 'шкаф', 12);
        const sr = fitAny(ctx, I('shoe_rack', 'Обувница', .8, .3, .5, '#d6cdbb', 'k'), [.8], L, ['mid', 'start', 'end']);
        if (!sr) miss(ctx, 'обувница', 6);
        else { const s = ROT[sr.rotation]; if (s) put(ctx, I('hanger', 'Вешалка настенная', .8, .1, .2, '#6f5a44', 'x', 1.6), s, al(sr, s)); }
        if (ctx.o.on.mirror && !fitAny(ctx, I('mirror_full', 'Зеркало в рост', .5, .04, 1.7, '#6f5a44', 'x', .1), [.5], L, ['mid', 'end', 'start'])) miss(ctx, 'зеркало', 2);
      }
    },

    cosmo: {
      vars(ctx) {
        const out = [{ bt: 'center', main: 'n', pos: 'mid', label: 'кушетка посреди комнаты' }];
        mains(ctx).forEach(m => ['mid', 'start', 'end'].forEach(p => out.push({ bt: 'wall', main: m, pos: p, label: 'кушетка изголовьем к стене «' + SN[m] + '» (' + PN[p] + ')' })));
        return out;
      },
      run(ctx, v) {
        const r = ctx.r, on = ctx.o.on, L = byLen(ctx);
        const BED = I('beauty_bed', 'Косметологическая кушетка', .7, 1.9, .85, '#f1ece3', 'x'), STL = I('beauty_stool', 'Стул косметолога', .5, .5, .8, '#444a50', 'x'), CART = I('beauty_cart', 'Каталка-стеллаж косметолога', .45, .35, .9, '#f4f2ee', 'x');
        let bm = null;
        if (v.bt === 'wall') { if (perp(ctx, v.main) >= 2.6) bm = put(ctx, BED, v.main, v.pos); }
        else { const vert = r.depth >= r.width; for (const mg of [.7, .55, .4]) { const p = center(ctx, vert ? .7 : 1.9, vert ? 1.9 : .7, mg); if (p) { bm = tryAdd(ctx, mk(ctx, BED, p[0], p[1], vert ? 0 : 90)); if (bm) break; } } }
        if (!bm) miss(ctx, 'кушетка', 40);
        else {                                                                  // стул мастера сбоку у головы кушетки, лицом к ней
          const a = bm.rotation * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a); let st = null;
          for (const s of [1, -1]) { if (st) break; const lx = .7 * s, lz = -.4; st = tryAdd(ctx, mk(ctx, STL, bm.x + ux * lx - uy * lz, bm.y + uy * lx + ux * lz, ((bm.rotation + 90 * s) % 360 + 360) % 360)); }
          if (!st) miss(ctx, 'стул мастера', 3);
        }
        if (!fitAny(ctx, CART, [.45], L, ['start', 'end', 'mid'])) miss(ctx, 'каталка', 3);
        if (on.sink) {
          const vn = flexAny(ctx, I('vanity', 'Умывальник с тумбой', .8, .5, .85, WH, 'x'), L, ['start', 'end', 'mid'], .6, 1.2);
          if (!vn) miss(ctx, 'умывальник', 4); else if (on.mirror) { const s = ROT[vn.rotation]; if (s) put(ctx, I('mirror', 'Зеркало', .6, .03, .8, '#8b6b4a', 'x', 1.1), s, al(vn, s)); }
        }
        if (on.shelf && !flexAny(ctx, I('shelf', 'Стеллаж', 1, .35, 1.9, '#b99570', 'w'), L, ['start', 'end', 'mid'], .8, 1.6)) miss(ctx, 'стеллаж', 3);
        if (on.cab) fitAny(ctx, I('wall_cab', 'Шкафчик навесной', .6, .35, .7, '#e8e4da', 'x', 1.4), [.6], L, ['mid', 'start', 'end']);
        if (on.lamp) fitAny(ctx, I('lamp_floor', 'Торшер', .35, .35, 1.6, '#f7efdc', 'x'), [.35], L, ['end', 'start']);
      }
    }
  };

  // ---------- оценка: проход по комнате и связность дверей ----------
  function walkInfo(ctx) {
    const r = ctx.r, S = .2, nx = Math.max(2, Math.round(r.width / S)), ny = Math.max(2, Math.round(r.depth / S)), blk = new Uint8Array(nx * ny);
    const rects = ctx.all.filter(m => { if (skipK(m)) return false; const z = zr(ctx, m); return z[0] < 1.2 && z[1] > .15; })
      .flatMap(m => fr(m).map(q => Object.assign({}, q, { hl: q.hl + .15, ht: q.ht + .15 })));
    let free = 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = r.x + (i + .5) * r.width / nx, y = r.y + (j + .5) * r.depth / ny;
      if (rects.some(q => inR(q, x, y, 0))) blk[i * ny + j] = 1; else free++;
    }
    const idx = (x, y) => Math.min(nx - 1, Math.max(0, Math.floor((x - r.x) / r.width * nx))) * ny + Math.min(ny - 1, Math.max(0, Math.floor((y - r.y) / r.depth * ny)));
    const cells = ctx.f.openings.filter(o => (o.kind === 'door' || o.kind === 'gap') && o.wallId.startsWith(r.id + ':')).map(o => {
      const w = ctx.walls.find(q => q.id === o.wallId), p = FP.openPos(w, o); return idx(p.cx + p.nx * .4, p.cy + p.ny * .4);
    });
    let conn = true;
    if (cells.length === 1) conn = !blk[cells[0]];
    else if (cells.length > 1) {
      const vis = new Uint8Array(nx * ny), q = []; if (!blk[cells[0]]) { vis[cells[0]] = 1; q.push(cells[0]); }
      while (q.length) {
        const c = q.pop(), i = Math.floor(c / ny), j = c % ny;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => { const a = i + d[0], b = j + d[1]; if (a < 0 || b < 0 || a >= nx || b >= ny) return; const k = a * ny + b; if (!blk[k] && !vis[k]) { vis[k] = 1; q.push(k); } });
      }
      conn = cells.every(c => vis[c]);
    }
    return { open: free / (nx * ny), conn };
  }
  function finish(ctx) {
    ctx.parts.push(['предметов в комнате', ctx.added.filter(m => !['backsplash', 'worktop', 'hob_gas', 'wall_cab', 'corner_wall'].includes(m.kind)).length * .8]);
    const w = walkInfo(ctx);
    ctx.parts.push(['свободное место для прохода', w.open * 12]);
    if (w.open < .3) ctx.parts.push(['теснота', -(.3 - w.open) * 50]);
    if (!w.conn) ctx.parts.push(['двери отрезаны мебелью', -40]);
    ctx.log.push('  свободно для прохода: ' + Math.round(w.open * 100) + '%, двери связаны: ' + (w.conn ? 'да' : 'НЕТ'));
    return ctx.parts.reduce((s, p) => s + p[1], 0);
  }
  const sigOf = items => items.filter(m => m.width * m.depth > .5 || m.height > 1.5 || ['sink', 'base_oven', 'stove', 'toilet', 'vanity', 'bath'].includes(m.kind))
    .map(m => m.kind + '@' + Math.round(m.x * 2) + ',' + Math.round(m.y * 2)).sort().join('|');

  // ---------- цвета и материалы ----------
  function applyStyle(f, r, o) {
    const st = STYLES[o.style] || STYLES.keep, t = o.type; if (!st.floor) return;
    r.floor = { m: (t === 'bath' || t === 'kitchen' || t === 'cosmo') ? st.wet : st.floor, c: null }; r.color = FP.MAT.eff(r.floor);
    r.fin = { all: { up: { m: 'paint', c: st.wall }, low: t === 'bath' ? { m: 'tile_sq30_white', c: null } : null, h: t === 'bath' ? f.height : 0 } };
  }

  // ---------- свет ----------
  const occ = (ctx, x, y, z) => ctx.all.some(m => { if (skipK(m)) return false; const e = zr(ctx, m); if (z < e[0] || z > e[1]) return false; return fr(m).some(q => inR(q, x, y, -.02)); });
  function addLights(ctx, items, out) {
    const r = ctx.r, f = ctx.f, t = ctx.o.type, A = r.width * r.depth, nx = Math.max(1, Math.round(r.width / 3.5)), ny = Math.max(1, Math.round(r.depth / 3.5));
    const ring = nx * ny === 1 && A >= 8 && (t === 'bedroom' || t === 'living');
    const LG = ring ? I('ch_ring', 'Люстра-кольцо LED', .8, .8, .7, LT, 'x') : I('ceil_light', 'Светильник потолочный', .4, .4, .08, LT, 'x');
    const push = m => { out.push(m); ctx.all.push(m); };
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) push(mk(ctx, LG, r.x + (i + .5) * r.width / nx, r.y + (j + .5) * r.depth / ny, 0));
    const SW = I('switch1', 'Выключатель', .08, .03, .08, LT, 'x', .9);
    SIDES.forEach(s => {                            // выключатели у дверей (справа или слева, где свободно)
      const [lo, hi] = span(ctx, s);
      f.openings.filter(o => o.wallId === r.id + ':' + s && o.kind === 'door').forEach(o => {
        for (const a of [lo + o.offset + o.width + .25, lo + o.offset - .25]) {
          if (a < lo + .1 || a > hi - .1) continue;
          const m = make(ctx, SW, s, a, SW.w);
          if (occ(ctx, m.x, m.y, .9) || out.some(q => q.kind === 'switch1' && Math.hypot(q.x - m.x, q.y - m.y) < .6)) continue;
          push(m); break;
        }
      });
    });
    const OUT = { nightstand: [.65, 9], desk: [1.05, 9], tvstand: [.75, 9], counter: [1.1, 2] }, used = {};
    items.forEach(m => {                            // розетки у тумб/столов/кухни, лампы на тумбах, торшер у дивана
      const s = ROT[m.rotation], q = OUT[m.kind]; if (!s) return;
      if (q && (used[m.kind] || 0) < q[1]) { used[m.kind] = (used[m.kind] || 0) + 1; push(make(ctx, I('outlet', 'Розетка', .08, .03, .08, LT, 'x', q[0]), s, al(m, s), .08)); }
      if (m.kind === 'nightstand') push(mk(ctx, I('lamp_table', 'Настольная лампа', .25, .25, .5, '#f7efdc', 'x', .5), m.x, m.y, 0));
      if (m.kind === 'sofa') {
        const lm = make(ctx, I('lamp_floor', 'Торшер', .35, .35, 1.6, '#f7efdc', 'x'), s, al(m, s) + m.width / 2 + .3, .35);
        if (!why(ctx, lm, s)) push(lm);
      }
    });
  }

  // ---------- главная функция: перебор вариантов, оценка, применение лучшего ----------
  FP.autofill = function (r, o) {
    const f = FP.floor(); FP.snap();
    if (o.clear) { const old = new Set(FP.furnInRoom(f, r)); f.furniture = f.furniture.filter(m => !old.has(m)); }
    applyStyle(f, r, o);
    const ctx = mkCtx(f, r, o), R = RECIPES[o.type] || RECIPES.living, t0 = performance.now(), res = [], head = [];
    head.push('Комната «' + r.name + '»: ' + r.width.toFixed(2) + '×' + r.depth.toFixed(2) + ' м, потолок ' + f.height + ' м, тип ' + o.type + ', стиль ' + o.style + ', главная стена ' + o.anchor + ', x=' + r.x + ', y=' + r.y);
    SIDES.forEach(s => head.push('  стена ' + SN[s] + ': длина ' + len(ctx, s).toFixed(2) + ' м; ' + (ctx.sp[s].map(q => q.o.kind + ' ' + q.s.toFixed(2) + '–' + q.e.toFixed(2) + (q.o.kind === 'window' ? ' (подоконник ' + (q.o.sill != null ? q.o.sill : .9) + ')' : '')).join(', ') || 'без проёмов')));
    head.push('  зон открывания дверей (точек): ' + ctx.zones.length + ', стен-препятствий: ' + ctx.WR.length + ', чужой мебели рядом: ' + ctx.base.length);
    const vars = R.vars(ctx); head.push('Вариантов к проверке: ' + vars.length);
    for (const v of vars) {
      if (performance.now() - t0 > 20000) { head.push('Остановлено по времени (20 с) после ' + res.length + ' вариантов'); break; }
      rollback(ctx, 0); ctx.log = []; ctx.seen = {}; ctx.parts = []; ctx.skipped = []; ctx.fatal = false;
      try {
        R.run(ctx, v);
        (o.extra || []).forEach(it => { if (!fitAny(ctx, I(it[0], it[1], it[2], it[3], it[4], it[5], 'x', it[6]), [it[2]], byLen(ctx), ['mid', 'start', 'end'])) miss(ctx, it[1], 2); });
      } catch (e) { console.error('[autofill] ошибка в варианте', v.label, e); head.push('ОШИБКА в варианте «' + v.label + '»: ' + e.message); continue; }
      const score = finish(ctx);
      res.push({ label: v.label, score, fatal: ctx.fatal, parts: ctx.parts.slice(), log: ctx.log.slice(), skipped: ctx.skipped.slice(), items: ctx.added.map(m => Object.assign({}, m)), sig: sigOf(ctx.added) });
    }
    rollback(ctx, 0);
    res.sort((a, b) => (a.fatal - b.fatal) || (b.score - a.score));
    const top = [], seen = {}; res.forEach(q => { if (top.length < 3 && !seen[q.sig]) { seen[q.sig] = 1; top.push(q); } });
    head.push('Проверено вариантов: ' + res.length + ' за ' + Math.round(performance.now() - t0) + ' мс');
    FP.afState = { roomId: r.id, o, results: top, all: res, head, applied: [], cur: 0, lights: 0 };
    if (top.length) applyResult(0, true);
    return FP.afState;
  };

  function applyResult(k, noSnap) {                 // убрать предыдущий вариант и поставить выбранный
    const S = FP.afState, f = FP.floor(), r = f.rooms.find(q => q.id === S.roomId); if (!r) return;
    if (!noSnap) FP.snap();
    const old = new Set(S.applied); f.furniture = f.furniture.filter(m => !old.has(m.id));
    const res = S.results[k], ctx = mkCtx(f, r, S.o), items = res.items.map(m => Object.assign({}, m)), lights = [];
    items.forEach(m => ctx.all.push(m));
    if (S.o.lights) addLights(ctx, items, lights);
    items.concat(lights).forEach(m => f.furniture.push(m));
    S.applied = items.concat(lights).map(m => m.id); S.cur = k; S.lights = lights.length;
    S.snap = items.concat(lights).map(m => JSON.parse(JSON.stringify(m)));        // как программа расставила (для сравнения с ручными правками)
    FP.changed(); panel();
  }
  function manual(S) {                              // что изменили вручную после показа варианта
    const f = FP.floor(), r = f.rooms.find(q => q.id === S.roomId), L = ['', 'ПРАВКИ ВРУЧНУЮ (сравнение с вариантом ' + (S.cur + 1) + ', как его поставила программа):'];
    if (!r) return L.concat('  комната удалена').join('\n');
    const ctx = mkCtx(f, r, S.o), cur = new Map(f.furniture.map(m => [m.id, m])), ids = new Set((S.snap || []).map(m => m.id));
    const nv = v => v == null ? '' : typeof v === 'number' ? +v.toFixed(3) : v;
    const ver = m => { const b = why(ctx, m, null); return b ? 'программа НЕ разрешила бы так: ' + b : 'программа разрешила бы (наложений и помех нет)'; };
    let n = 0;
    (S.snap || []).forEach(a => {
      const b = cur.get(a.id);
      if (!b) { n++; L.push('  УДАЛЕНО: ' + a.name + ' (' + a.kind + '), было x=' + a.x + ' y=' + a.y); return; }
      const ch = ['kind', 'name', 'x', 'y', 'rotation', 'width', 'depth', 'height', 'elev', 'flipX', 'color'].filter(k => nv(a[k]) !== nv(b[k]) && !((k === 'elev' || k === 'flipX') && !a[k] && !b[k])).map(k => k + ' ' + nv(a[k]) + ' → ' + nv(b[k]));
      if (ch.length) { n++; L.push('  ИЗМЕНЕНО: ' + b.name + ' (' + b.kind + '): ' + ch.join(', ')); L.push('      ' + ver(b)); }
    });
    FP.furnInRoom(f, r).filter(m => !ids.has(m.id)).forEach(m => { n++; L.push('  ДОБАВЛЕНО ВРУЧНУЮ: ' + m.name + ' (' + m.kind + ') x=' + m.x + ' y=' + m.y + ' поворот=' + m.rotation + ' ' + m.width + '×' + m.depth); L.push('      ' + ver(m)); });
    if (!n) L.push('  правок нет');
    const mine = sigOf(FP.furnInRoom(f, r)).split('|'), setM = new Set(mine); let nq = null, nj = -1;
    S.all.forEach(q => { const t = q.sig.split('|'), c = t.filter(x => setM.has(x)).length, j = c / ((t.length + mine.length - c) || 1); if (j > nj) { nj = j; nq = q; } });
    if (nq) {
      const tq = new Set(nq.sig.split('|'));
      L.push('  Ближайший вариант программы (совпадение ' + Math.round(nj * 100) + '%): ' + nq.label + ' (' + nq.score.toFixed(1) + ' б.)');
      L.push('    у вас есть, у программы нет: ' + (mine.filter(x => !tq.has(x)).join(', ') || '—'));
      L.push('    у программы есть, у вас нет: ' + (nq.sig.split('|').filter(x => !setM.has(x)).join(', ') || '—'));
    }
    const w = walkInfo(ctx); L.push('  сейчас: свободно для прохода ' + Math.round(w.open * 100) + '%, двери связаны: ' + (w.conn ? 'да' : 'НЕТ'));
    L.push('ТЕКУЩАЯ РАССТАНОВКА В КОМНАТЕ:');
    FP.furnInRoom(f, r).forEach(m => L.push('  ' + m.kind + ' «' + m.name + '» x=' + m.x + ' y=' + m.y + ' поворот=' + m.rotation + ' ' + m.width + '×' + m.depth + '×' + (+m.height.toFixed(2)) + (m.elev ? ' над полом ' + m.elev : '')));
    return L.join('\n');
  }
  function report(k) {
    const S = FP.afState, res = S.results[k], best = S.results[0], L = S.head.slice();
    L.push('', 'РЕЙТИНГ (лучшие 12 из ' + S.all.length + '):');
    S.all.slice(0, 12).forEach((q, i) => { const j = S.results.indexOf(q); L.push((i + 1) + '. ' + q.score.toFixed(1) + '  ' + q.label + (q.fatal ? '  [нет обязательного предмета]' : '') + (j >= 0 ? '   ← вариант ' + (j + 1) + ' в панели' : '')); });
    L.push('', 'ПОКАЗАН ВАРИАНТ ' + (k + 1) + ': ' + res.label + ' (' + res.score.toFixed(1) + ' баллов)', 'Баллы по статьям:');
    res.parts.forEach(p => L.push('  ' + p[0] + ': ' + (p[1] > 0 ? '+' : '') + (+p[1].toFixed(1))));
    if (k > 0) {
      const mp = a => { const o = {}; a.forEach(p => { o[p[0]] = (o[p[0]] || 0) + p[1]; }); return o; }, a = mp(res.parts), b = mp(best.parts);
      L.push('Сравнение с вариантом 1 (лучшим по мнению программы), разница ' + (res.score - best.score).toFixed(1) + ':');
      Object.keys(Object.assign({}, a, b)).forEach(n => { const d = (a[n] || 0) - (b[n] || 0); if (Math.abs(d) >= .5) L.push('  ' + n + ': здесь ' + (+(a[n] || 0).toFixed(1)) + ', у варианта 1 ' + (+(b[n] || 0).toFixed(1)) + ' (' + (d > 0 ? '+' : '') + d.toFixed(1) + ')'); });
    }
    L.push('Журнал размещения (✗ = причина отказа):'); res.log.forEach(s => L.push(s));
    L.push('Предметы (' + res.items.length + ') + свет/розетки/выключатели: ' + S.lights);
    res.items.forEach(m => L.push('  ' + m.kind + ' «' + m.name + '» x=' + m.x + ' y=' + m.y + ' поворот=' + m.rotation + ' ' + m.width + '×' + m.depth + '×' + (+m.height.toFixed(2)) + (m.elev ? ' над полом ' + m.elev : '')));
    L.push(manual(S));
    return L.join('\n');
  }

  // ---------- панель выбора вариантов и окно лога ----------
  function panel() {
    const old = document.getElementById('afPanel'); if (old) old.remove();
    const S = FP.afState; if (!S || !S.results.length) return;
    const p = el('div'), row1 = el('div'), cur = S.results[S.cur];
    p.id = 'afPanel'; p.style.cssText = 'position:fixed;left:50%;bottom:44px;transform:translateX(-50%);z-index:50;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px 10px;box-shadow:0 6px 18px rgba(0,0,0,.3);max-width:94vw;display:flex;flex-direction:column;gap:6px';
    row1.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap'; row1.appendChild(el('b', '', '✨ Варианты:'));
    S.results.forEach((q, i) => { const b = el('button', i === S.cur ? 'on' : '', (i + 1) + ' · ' + q.score.toFixed(0) + ' б.'); b.title = q.label; b.onclick = () => applyResult(i); row1.appendChild(b); });
    const lg = el('button', '', 'Лог'); lg.onclick = () => FP.ui.autofillReport(report(S.cur));
    const cl = el('button', '', '✕'); cl.onclick = () => p.remove();
    row1.appendChild(lg); row1.appendChild(cl); p.appendChild(row1);
    p.appendChild(el('div', 'hint', cur.label + (cur.skipped.length ? ' · не поместилось: ' + cur.skipped.join(', ') : '')));
    document.body.appendChild(p);
  }
  FP.ui.autofillReport = function (text) {
    console.log('[autofill]\n' + text);
    const dlg = document.createElement('dialog'), ta = el('textarea'), b = el('div', 'dlgBtns'), cp = el('button', '', 'Копировать'), cl = el('button', '', 'Закрыть');
    const close = () => { dlg.close(); dlg.remove(); };
    ta.value = text; ta.readOnly = true; ta.rows = 22; ta.style.cssText = 'width:640px;max-width:86vw;font:12px monospace';
    dlg.appendChild(el('h3', '', 'Лог автозаполнения')); dlg.appendChild(ta);
    cp.onclick = () => { ta.select(); try { document.execCommand('copy'); } catch (e) {} if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); };
    cl.onclick = close; b.appendChild(cp); b.appendChild(cl); dlg.appendChild(b); document.body.appendChild(dlg); dlg.showModal();
  };

  // ---------- диалог вопросов ----------
  const mkSel = (opts, v) => { const s = el('select'); opts.forEach(a => { const p = el('option'); p.value = a[0]; p.textContent = a[1]; s.appendChild(p); }); s.value = v; return s; };
  const mkChk = v => { const i = el('input'); i.type = 'checkbox'; i.checked = v; return i; };
  FP.ui.autofill = function (r) {
    if (r.poly) { alert('Автозаполнение пока работает только для прямоугольных комнат'); return; }
    const dlg = document.createElement('dialog'), box = el('div'), F = {}, ob = el('div');
    box.style.minWidth = '340px'; dlg.appendChild(el('h3', '', 'Автозаполнение: ' + r.name));
    F.type = mkSel(TYPES, r.rtype || guess(r.name));        // тип из свойств комнаты, иначе по названию
    F.anchor = mkSel([['auto', 'Авто (перебрать все стены)'], ['n', 'Север (сверху)'], ['s', 'Юг (снизу)'], ['w', 'Запад (слева)'], ['e', 'Восток (справа)']], 'auto');
    F.style = mkSel(Object.keys(STYLES).map(k => [k, STYLES[k].name]), 'dark');
    F.lights = mkChk(true); F.clear = mkChk(true);
    const fillOpts = () => { ob.innerHTML = ''; (OPTS[F.type.value] || []).forEach(a => { const c = mkChk(a[2]); c.dataset.k = a[0]; ob.appendChild(row(a[1], c)); }); };
    F.type.onchange = fillOpts; fillOpts();
    [['Тип комнаты', F.type], ['Главная стена (изголовье / диван / кухня)', F.anchor], ['Цвета и материалы', F.style], ['Свет, выключатели, розетки', F.lights], ['Убрать мебель из комнаты', F.clear]].forEach(a => box.appendChild(row(a[0], a[1])));
    box.appendChild(el('h4', '', 'Что добавить')); box.appendChild(ob);
    const ex = [], flat = [], exSel = el('select'), exList = el('div', 'hint'), exAdd = el('button', '', '+ Добавить');
    FP.CATALOG.forEach(g => { const og = el('optgroup'); og.label = g.cat; g.items.forEach(it => { const o = el('option'); o.value = flat.length; o.textContent = it[1] + ' (' + it[2] + '×' + it[3] + ')'; flat.push(it); og.appendChild(o); }); exSel.appendChild(og); });
    const showEx = () => { exList.innerHTML = ''; ex.forEach((it, i) => { const b = el('button', '', it[1] + ' ✕'); b.onclick = () => { ex.splice(i, 1); showEx(); }; exList.appendChild(b); }); };
    exAdd.onclick = () => { ex.push(flat[+exSel.value]); showEx(); };
    box.appendChild(el('h4', '', 'Свои предметы из каталога (добавить дополнительно)')); box.appendChild(row('Предмет', exSel)); box.appendChild(exAdd); box.appendChild(exList);
    dlg.appendChild(box);
    const b = el('div', 'dlgBtns'), ok = el('button', '', 'Заполнить'), no = el('button', '', 'Отмена'), close = () => { dlg.close(); dlg.remove(); };
    ok.onclick = () => {
      const on = {}; ob.querySelectorAll('input').forEach(i => { on[i.dataset.k] = i.checked; });
      close(); r.rtype = F.type.value;                       // запоминаем тип комнаты
      const S = FP.autofill(r, { type: F.type.value, anchor: F.anchor.value, style: F.style.value, lights: F.lights.checked, clear: F.clear.checked, on, extra: ex.slice() });
      if (!S.results.length) { FP.ui.autofillReport(S.head.join('\n') + '\n\nНи один вариант не построен'); return; }
      console.log('[autofill]\n' + report(0));
    };
    no.onclick = close; b.appendChild(ok); b.appendChild(no); dlg.appendChild(b);
    document.body.appendChild(dlg); dlg.showModal();
  };
})();
