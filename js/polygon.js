(function () {
  const clone = o => JSON.parse(JSON.stringify(o));
  // пересечение двух прямых: точка p + u*t
  const inter = (p1, u1, p2, u2) => {
    const cr = u1[0] * u2[1] - u1[1] * u2[0]; if (Math.abs(cr) < 1e-6) return null;
    const t = ((p2[0] - p1[0]) * u2[1] - (p2[1] - p1[1]) * u2[0]) / cr; return [p1[0] + u1[0] * t, p1[1] + u1[1] * t];
  };

  // ---------- базовая геометрия ----------
  FP.rpoly = r => r.poly || [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.depth], [r.x, r.y + r.depth]];
  FP.polyArea = P => { let A = 0; P.forEach((a, i) => { const b = P[(i + 1) % P.length]; A += a[0] * b[1] - b[0] * a[1]; }); return A / 2; };
  FP.polySign = P => FP.polyArea(P) >= 0 ? 1 : -1;
  FP.roomArea = r => r.poly ? Math.abs(FP.polyArea(r.poly)) : r.width * r.depth;
  FP.roomPerim = r => r.poly ? r.poly.reduce((s, a, i) => { const b = r.poly[(i + 1) % r.poly.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0) : 2 * (r.width + r.depth);
  FP.pointInRoom = (r, x, y) => {
    if (!r.poly) return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.depth;
    const P = r.poly; let ins = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) ins = !ins;
    return ins;
  };
  FP.syncBox = r => {                                   // охватывающий прямоугольник многоугольника
    const xs = r.poly.map(p => p[0]), ys = r.poly.map(p => p[1]);
    r.x = Math.min(...xs); r.y = Math.min(...ys); r.width = Math.max(.1, Math.max(...xs) - r.x); r.depth = Math.max(.1, Math.max(...ys) - r.y);
  };
  FP.fixPoly = r => {                                   // округление, склейка совпавших вершин
    const P = [];
    r.poly.forEach(p => { const q = [+(+p[0]).toFixed(4), +(+p[1]).toFixed(4)], l = P[P.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > .005) P.push(q); });
    if (P.length > 1 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= .005) P.pop();
    r.poly = P; FP.syncBox(r);
  };
  // сдвиг сторон: h[i] > 0 — внутрь, < 0 — наружу; вершины — пересечения сдвинутых прямых
  FP.offsetPoly = function (P, h) {
    const n = P.length, sg = FP.polySign(P);
    const L = P.map((a, i) => { const b = P[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len; return { p: [a[0] - uy * sg * h[i], a[1] + ux * sg * h[i]], u: [ux, uy] }; });
    return P.map((a, i) => { const A = L[(i + n - 1) % n], B = L[i]; return inter(A.p, A.u, B.p, B.u) || B.p; });
  };
  // точка для подписи внутри комнаты (середина самого длинного горизонтального отрезка на уровне центра масс)
  FP.labelPos = function (r) {
    const P = FP.rpoly(r); let cx = 0, cy = 0, A = 0;
    P.forEach((a, i) => { const b = P[(i + 1) % P.length], cr = a[0] * b[1] - b[0] * a[1]; A += cr; cx += (a[0] + b[0]) * cr; cy += (a[1] + b[1]) * cr; });
    if (Math.abs(A) < 1e-9) return { x: r.x + r.width / 2, y: r.y + r.depth / 2, w: r.width };
    cx /= 3 * A; cy /= 3 * A;
    const xs = [];
    P.forEach((a, i) => { const b = P[(i + 1) % P.length]; if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) xs.push(a[0] + (b[0] - a[0]) * (cy - a[1]) / (b[1] - a[1])); });
    xs.sort((p, q) => p - q); let best = null;
    for (let k = 0; k + 1 < xs.length; k += 2) if (!best || xs[k + 1] - xs[k] > best[1] - best[0]) best = [xs[k], xs[k + 1]];
    return best ? { x: (best[0] + best[1]) / 2, y: cy, w: best[1] - best[0] } : { x: cx, y: cy, w: r.width };
  };
  FP.roomCenter = r => { const q = FP.labelPos(r); return [q.x, q.y]; };

  // площадь объединения (многоугольники и прямоугольники): вертикальные полосы между всеми x вершин
  FP.unionArea = function (rooms) {
    const P = rooms.map(FP.rpoly), xs = [...new Set(P.flat().map(p => p[0]))].sort((a, b) => a - b); let tot = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1]; if (x1 - x0 < 1e-9) continue;
      const xm = (x0 + x1) / 2, iv = [];
      P.forEach(poly => {
        const ys = [];
        poly.forEach((a, k) => { const b = poly[(k + 1) % poly.length]; if ((a[0] <= xm && b[0] > xm) || (b[0] <= xm && a[0] > xm)) ys.push(a[1] + (b[1] - a[1]) * (xm - a[0]) / (b[0] - a[0])); });
        ys.sort((p, q) => p - q); for (let k = 0; k + 1 < ys.length; k += 2) iv.push([ys[k], ys[k + 1]]);
      });
      iv.sort((p, q) => p[0] - q[0]); let cur = null, len = 0;
      iv.forEach(q => { if (!cur || q[0] > cur[1]) { if (cur) len += cur[1] - cur[0]; cur = [q[0], q[1]]; } else cur[1] = Math.max(cur[1], q[1]); });
      if (cur) len += cur[1] - cur[0]; tot += len * (x1 - x0);
    }
    return tot;
  };
  FP.furnInRoom = (f, r) => f.furniture.filter(m => FP.pointInRoom(r, m.x, m.y));

  // ---------- обёртки над функциями model.js ----------
  const _norm = FP.normalize;
  FP.normalize = function (d) {
    d = _norm(d);
    d.floors.forEach(f => f.rooms.forEach(r => {
      if (Array.isArray(r.poly) && r.poly.filter(q => Array.isArray(q) && isFinite(+q[0]) && isFinite(+q[1])).length >= 3) { r.poly = r.poly.map(q => [+q[0], +q[1]]); FP.fixPoly(r); }
      else delete r.poly;
      if (r.poly && r.poly.length < 3) delete r.poly;
    }));
    return d;
  };

  // стены многоугольника: ось сдвинута наружу на t/2 (режим inner), концы удлинены так, чтобы закрыть угол
  function polyWalls(r, f, out) {
    const P = r.poly, n = P.length, sg = FP.polySign(P), inn = FP.inner(), D = [];
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      D.push({ a, b, ux, uy, nx: -uy * sg, ny: ux * sg, t: FP.wt(r, 'p' + i, f) });          // (nx, ny) — внутрь комнаты
    }
    const ext = (tn, d1, d2) => {
      const raw = d1.ux * d2.uy - d1.uy * d2.ux, tau = Math.abs(Math.atan2(raw, d1.ux * d2.ux + d1.uy * d2.uy)), tg = Math.min(4, Math.tan(tau / 2));
      return inn ? (raw * sg > 0 ? tn * tg : 0) : (tn / 2) * tg;
    };
    D.forEach((d, i) => {
      const pv = D[(i + n - 1) % n], nx = D[(i + 1) % n], h = inn ? d.t / 2 : 0;
      out.push({ id: r.id + ':p' + i, side: 'p' + i, room: r, x1: d.a[0] - d.nx * h, y1: d.a[1] - d.ny * h, x2: d.b[0] - d.nx * h, y2: d.b[1] - d.ny * h, t: d.t, e1: ext(pv.t, pv, d), e2: ext(nx.t, d, nx), nx: d.nx, ny: d.ny, inSign: sg, rail: !!(r.rail && r.rail['p' + i]) });
    });
  }
  const _gw = FP.getWalls;
  FP.getWalls = function (f) {
    if (!f.rooms.some(r => r.poly)) return _gw(f);
    const out = _gw(Object.assign({}, f, { rooms: f.rooms.filter(r => !r.poly) }));
    f.rooms.forEach(r => { if (r.poly) polyWalls(r, f, out); });
    const byId = new Map(out.map(q => [q.id, q]));
    f.openings.forEach(o => {                         // позиция проёма = доля длины стены (как в model.js)
      if (!/:p\d+$/.test(o.wallId)) return; const w = byId.get(o.wallId); if (!w) return;
      const L = FP.wlen(w); if (L < 1e-6) return;
      if (o.k == null) o.k = (o.offset + o.width / 2) / L; else o.offset = Math.max(0, Math.min(Math.max(0, L - o.width), o.k * L - o.width / 2));
    });
    return out;
  };
  const _op = FP.openPos;
  FP.openPos = function (w, o) {
    if (w.nx == null) return _op(w, o);
    const L = FP.wlen(w) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, sx = w.x1 + ux * o.offset, sy = w.y1 + uy * o.offset;
    return { sx, sy, ex: sx + ux * o.width, ey: sy + uy * o.width, cx: sx + ux * o.width / 2, cy: sy + uy * o.width / 2, ux, uy, nx: w.nx, ny: w.ny };
  };
  const _wl = FP.wallLabel;
  FP.wallLabel = function (id) {
    if (id.includes(':')) { const [rid, k] = id.split(':'); if (/^p\d+$/.test(k)) { const r = FP.floor().rooms.find(q => q.id === rid); return (r ? r.name : '?') + ' / сторона ' + (+k.slice(1) + 1); } }
    return _wl(id);
  };
  const _mv = FP.moveRoomBy;
  FP.moveRoomBy = function (r, dx, dy) { _mv(r, dx, dy); if (r.poly) { r.poly.forEach(q => { q[0] += dx; q[1] += dy; }); FP.syncBox(r); } };
  const _dup = FP.duplicate;
  FP.duplicate = function () {
    const was = FP.sel && FP.sel.type === 'room'; _dup();
    if (!was || !FP.sel) return; const c = FP.selObj(); if (!c) return;
    delete c.merge; if (c.poly) { c.poly = c.poly.map(q => [q[0] + .5, q[1] + .5]); FP.syncBox(c); FP.changed(); }
  };
  const _tc = FP.toClear;
  FP.toClear = function () { const f = FP.floor(), keep = f.rooms.filter(r => r.poly); f.rooms = f.rooms.filter(r => !r.poly); _tc(); FP.floor().rooms.push(...keep); FP.changed(); };

  // ---------- объединение комнат ----------
  const inw = w => w.nx != null ? [w.nx, w.ny] : { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[w.side];
  // общая стена двух комнат: параллельны, смотрят в разные стороны, оси почти совпадают, участки перекрываются
  function pairInfo(a, b) {
    const La = FP.wlen(a), Lb = FP.wlen(b); if (La < .05 || Lb < .05) return null;
    const ax = (a.x2 - a.x1) / La, ay = (a.y2 - a.y1) / La, bx = (b.x2 - b.x1) / Lb, by = (b.y2 - b.y1) / Lb;
    if (Math.abs(ax * by - ay * bx) > .02) return null;
    const na = inw(a), nb = inw(b); if (!na || !nb || na[0] * nb[0] + na[1] * nb[1] > -.9) return null;
    const dd = -((b.x1 - a.x1) * na[0] + (b.y1 - a.y1) * na[1]);
    if (dd < -.12 || dd > .5 * Math.max(a.t, b.t) + .08) return null;
    const pb1 = (b.x1 - a.x1) * ax + (b.y1 - a.y1) * ay, pb2 = (b.x2 - a.x1) * ax + (b.y2 - a.y1) * ay;
    const lo = Math.max(0, Math.min(pb1, pb2)), hi = Math.min(La, Math.max(pb1, pb2)); if (hi - lo < .05) return null;
    const pa1 = (a.x1 - b.x1) * bx + (a.y1 - b.y1) * by, pa2 = (a.x2 - b.x1) * bx + (a.y2 - b.y1) * by;
    return { lo, hi, lo2: Math.max(0, Math.min(pa1, pa2)), hi2: Math.min(Lb, Math.max(pa1, pa2)), dd, na, ax, ay };
  }
  let mcW = null, mcI = null;
  FP.mergeInfo = function (f, walls) {                  // { spans: Map(wallId → [[s,e]]), bridges: [{gid, room, pts}] }; кеш по массиву walls
    if (mcW === walls) return mcI;
    const info = { spans: new Map(), bridges: [] }, ws = walls.filter(w => w.room && w.room.merge);
    const put = (id, s, e) => { if (!info.spans.has(id)) info.spans.set(id, []); info.spans.get(id).push([s, e]); };
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) {
      const a = ws[i], b = ws[j]; if (a.room === b.room || a.room.merge !== b.room.merge) continue;
      const p = pairInfo(a, b); if (!p) continue;
      put(a.id, p.lo, p.hi); put(b.id, p.lo2, p.hi2);
      const inn = FP.inner(), bA = inn ? a.t / 2 : 0, bB = inn ? b.t / 2 : 0, na = p.na, th = bA + p.dd + bB;
      if (th > .002) {                                   // полоса пола на месте убранной стены
        const q = s => [a.x1 + p.ax * s, a.y1 + p.ay * s], A1 = q(p.lo), A2 = q(p.hi), k = p.dd + bB;
        info.bridges.push({ gid: a.room.merge, room: a.room, pts: [[A1[0] + na[0] * bA, A1[1] + na[1] * bA], [A2[0] + na[0] * bA, A2[1] + na[1] * bA], [A2[0] - na[0] * k, A2[1] - na[1] * k], [A1[0] - na[0] * k, A1[1] - na[1] * k]] });
      }
    }
    info.spans.forEach(l => l.sort((x, y) => x[0] - y[0]));
    mcW = walls; mcI = info; return info;
  };
  // убранные участки стен — это «сквозные проёмы» для FP.pieces (3D, коллизии)
  const MO = { kind: 'gap', h: 99, sill: 0, merged: true }, _spans = FP.spans;
  FP.spans = function (f, walls, w) {
    const out = _spans(f, walls, w), ms = FP.mergeInfo(f, walls).spans.get(w.id);
    if (ms) ms.forEach(a => out.push({ s: a[0], e: a[1], o: MO, own: false }));
    return out;
  };
  FP.mergeAreas = function (f, walls) {                 // id группы → площадь (комнаты + полосы на месте стен)
    const out = {}; if (!f.rooms.some(r => r.merge)) return out;
    const info = FP.mergeInfo(f, walls);
    [...new Set(f.rooms.filter(r => r.merge).map(r => r.merge))].forEach(id => {
      out[id] = FP.unionArea(f.rooms.filter(r => r.merge === id)) + info.bridges.filter(b => b.gid === id).reduce((s, b) => s + Math.abs(FP.polyArea(b.pts)), 0);
    });
    return out;
  };
  FP.adjacentRooms = function (f, r) {
    const walls = FP.getWalls(f), mine = walls.filter(w => w.room === r), res = new Set();
    walls.forEach(b => { if (b.room && b.room !== r && mine.some(a => pairInfo(a, b))) res.add(b.room); });
    return [...res];
  };
  FP.mergeRooms = function (a, b) {
    const f = FP.floor(), id = a.merge || b.merge || FP.uid(), ga = a.merge, gb = b.merge;
    f.rooms.forEach(q => { if (q === a || q === b || (ga && q.merge === ga) || (gb && q.merge === gb)) q.merge = id; });
  };
  FP.unmergeRoom = function (r) {
    const g = r.merge; delete r.merge; const rest = FP.floor().rooms.filter(q => q.merge === g); if (rest.length === 1) delete rest[0].merge;
  };

  // ---------- правка вершин (стороны нумеруются: сторона i = вершина i → вершина i+1) ----------
  function retag(r, f, map) {                           // перенумерация сторон: map(старый индекс) → новый индекс или null
    ['wt', 'fin'].forEach(key => {
      const o = r[key]; if (!o) return; const n = {};
      Object.keys(o).forEach(k => { const m = /^p(\d+)$/.exec(k); if (!m) { n[k] = o[k]; return; } const j = map(+m[1]); if (j != null) n['p' + j] = o[k]; });
      r[key] = n;
    });
    f.openings = f.openings.filter(o => {
      if (!o.wallId.startsWith(r.id + ':p')) return true;
      const j = map(+o.wallId.split(':p')[1]); if (j == null) return false; o.wallId = r.id + ':p' + j; return true;
    });
  }
  FP.polyInsert = function (r, i, pt) {                 // разрезать сторону i точкой pt
    const f = FP.floor(), n = r.poly.length, a = r.poly[i], b = r.poly[(i + 1) % n]; FP.getWalls(f);
    const Lo = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, sd = Math.hypot(pt[0] - a[0], pt[1] - a[1]), id = r.id + ':p';
    const ops = f.openings.filter(o => o.wallId === id + i);
    retag(r, f, e => e <= i ? e : e + 1);
    ['wt', 'fin'].forEach(k => { if (r[k] && r[k]['p' + i] != null) r[k]['p' + (i + 1)] = clone(r[k]['p' + i]); });
    ops.forEach(o => {
      const c = (o.k != null ? o.k : .5) * Lo;
      if (c > sd) { o.wallId = id + (i + 1); o.k = Math.min(1, (c - sd) / Math.max(1e-6, Lo - sd)); } else o.k = Math.min(1, c / Math.max(1e-6, sd));
    });
    r.poly.splice(i + 1, 0, pt); FP.syncBox(r);
  };
  FP.polyRemove = function (r, i) {                     // удалить вершину i (две стороны сливаются, проёмы на стороне i удаляются)
    if (r.poly.length <= 3) return; const f = FP.floor(); FP.getWalls(f);
    retag(r, f, e => e < i ? e : e === i ? null : e - 1);
    r.poly.splice(i, 1); FP.syncBox(r);
  };
  FP.polyReplace = function (r, v, pts) {               // заменить вершину v списком вершин
    const f = FP.floor(), k = pts.length; FP.getWalls(f);
    retag(r, f, e => e < v ? e : e + k - 1);
    r.poly.splice(v, 1, ...pts); FP.syncBox(r);
  };
  FP.toPoly = function (r) {                            // прямоугольник → многоугольник (n,e,s,w → стороны 0..3, проёмы сохраняются)
    if (r.poly) return; const f = FP.floor(), X = r.x + r.width, Y = r.y + r.depth, mp = { n: 'p0', e: 'p1', s: 'p2', w: 'p3' }; FP.getWalls(f);
    r.poly = [[r.x, r.y], [X, r.y], [X, Y], [r.x, Y]];
    ['wt', 'fin'].forEach(key => { const o = r[key]; if (!o) return; Object.keys(mp).forEach(k => { if (k in o) { o[mp[k]] = o[k]; delete o[k]; } }); });
    f.openings.forEach(o => {
      if (!o.wallId.startsWith(r.id + ':')) return; const k = o.wallId.split(':')[1]; if (!mp[k]) return;
      o.wallId = r.id + ':' + mp[k];
      if (k === 's' || k === 'w') { o.flip = !o.flip; if (o.k != null) o.k = 1 - o.k; else { const L = k === 's' ? r.width : r.depth; o.offset = Math.max(0, L - o.offset - o.width); } }   // эти стороны теперь идут в обратную сторону
    });
  };
  FP.lShape = function (r, c) {                         // Г-образная: вырезать угол (40% × 40%)
    const x = r.x, y = r.y, X = r.x + r.width, Y = r.y + r.depth, cw = +(r.width * .4).toFixed(2), cd = +(r.depth * .4).toFixed(2);
    FP.toPoly(r);
    const cfg = {
      tl: [0, [[x, y + cd], [x + cw, y + cd], [x + cw, y]]], tr: [1, [[X - cw, y], [X - cw, y + cd], [X, y + cd]]],
      br: [2, [[X, Y - cd], [X - cw, Y - cd], [X - cw, Y]]], bl: [3, [[x + cw, Y], [x + cw, Y - cd], [x, Y - cd]]]
    }[c] || null;
    if (cfg) FP.polyReplace(r, cfg[0], cfg[1]);
  };

  // ---------- автоопределение комнат по замкнутым контурам свободных стен ----------
  FP.roomsFromWalls = function () {
    const f = FP.floor(), segs = f.walls.filter(w => FP.wlen(w) > .05); if (segs.length < 3) return 0;
    const EPS = .04, N = [], len = segs.map(FP.wlen), cuts = segs.map(() => []);
    const node = (x, y) => { for (let i = 0; i < N.length; i++) if (Math.hypot(N[i][0] - x, N[i][1] - y) < EPS) return i; N.push([x, y]); return N.length - 1; };
    // 1) разрезаем стены в местах касания и пересечения
    for (let i = 0; i < segs.length; i++) for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      const a = segs[i], b = segs[j], L = len[i], ux = (a.x2 - a.x1) / L, uy = (a.y2 - a.y1) / L;
      [[b.x1, b.y1], [b.x2, b.y2]].forEach(p => {
        const t = (p[0] - a.x1) * ux + (p[1] - a.y1) * uy, d = Math.abs(-(p[0] - a.x1) * uy + (p[1] - a.y1) * ux);
        if (d < EPS && t > EPS && t < L - EPS) cuts[i].push(t);
      });
      if (i < j) {
        const Lb = len[j], vx = (b.x2 - b.x1) / Lb, vy = (b.y2 - b.y1) / Lb, den = ux * vy - uy * vx;
        if (Math.abs(den) > 1e-6) {
          const dx = b.x1 - a.x1, dy = b.y1 - a.y1, t = (dx * vy - dy * vx) / den, s = (dx * uy - dy * ux) / den;
          if (t > EPS && t < L - EPS && s > EPS && s < Lb - EPS) { cuts[i].push(t); cuts[j].push(s); }
        }
      }
    }
    // 2) рёбра графа
    const E = new Map(), wallEdges = new Map();
    segs.forEach((w, i) => {
      const ux = (w.x2 - w.x1) / len[i], uy = (w.y2 - w.y1) / len[i], ts = [0, ...cuts[i].sort((p, q) => p - q), len[i]], list = [];
      for (let k = 0; k < ts.length - 1; k++) {
        if (ts[k + 1] - ts[k] < EPS) continue;
        const a = node(w.x1 + ux * ts[k], w.y1 + uy * ts[k]), b = node(w.x1 + ux * ts[k + 1], w.y1 + uy * ts[k + 1]); if (a === b) continue;
        const key = Math.min(a, b) + '-' + Math.max(a, b); if (!E.has(key)) E.set(key, { a, b, t: w.thickness || f.thickness }); list.push(key);
      }
      wallEdges.set(w.id, list);
    });
    // 3) убираем «хвосты» (узлы со степенью 1)
    for (let again = true; again;) {
      again = false; const deg = new Map();
      E.forEach(e => { deg.set(e.a, (deg.get(e.a) || 0) + 1); deg.set(e.b, (deg.get(e.b) || 0) + 1); });
      [...E.keys()].forEach(k => { const e = E.get(k); if (deg.get(e.a) < 2 || deg.get(e.b) < 2) { E.delete(k); again = true; } });
    }
    // 4) обход граней: на каждом узле берём следующее ребро против возрастания угла
    const out = new Map(), add = (u, v, key) => { if (!out.has(u)) out.set(u, []); out.get(u).push({ to: v, ang: Math.atan2(N[v][1] - N[u][1], N[v][0] - N[u][0]), key }); };
    E.forEach((e, key) => { add(e.a, e.b, key); add(e.b, e.a, key); });
    out.forEach(l => l.sort((p, q) => p.ang - q.ang));
    const seen = new Set(), faces = [];
    out.forEach((list, u) => list.forEach(h0 => {
      if (seen.has(u + '>' + h0.to)) return;
      const pts = [], keys = []; let cu = u, h = h0;
      for (let g = 0; g < 500; g++) {
        const id = cu + '>' + h.to; if (seen.has(id)) break; seen.add(id); pts.push(cu); keys.push(h.key);
        const v = h.to, lst = out.get(v), idx = lst.findIndex(q => q.to === cu); cu = v; h = lst[(idx - 1 + lst.length) % lst.length];
      }
      faces.push({ pts, keys });
    }));
    // 5) внутренние грани (площадь > 0) → комнаты; внутренний контур = ось стены, сдвинутая внутрь на t/2
    const used = new Set(), made = [];
    faces.forEach(fc => {
      const V = fc.pts.map(i => N[i]); if (V.length < 3 || FP.polyArea(V) < .05) return;
      const th = fc.keys.map(k => E.get(k).t); fc.keys.forEach(k => used.add(k));
      const idx = f.rooms.length + made.length, r = { id: FP.uid(), name: 'Комната ' + (idx + 1), x: 0, y: 0, width: 1, depth: 1, wt: {}, material: 'oak', color: FP.PALETTE[idx % FP.PALETTE.length] };
      r.poly = FP.inner() ? FP.offsetPoly(V, th.map(t => t / 2)) : V.map(q => q.slice());
      th.forEach((t, i) => { r.wt['p' + i] = t; }); FP.fixPoly(r); made.push(r);
    });
    if (!made.length) return 0;
    FP.snap();
    const kill = new Set(); segs.forEach(w => { const l = wallEdges.get(w.id); if (l && l.length && l.every(k => used.has(k))) kill.add(w.id); });
    f.walls = f.walls.filter(w => !kill.has(w.id)); f.openings = f.openings.filter(o => !kill.has(o.wallId));
    made.forEach(r => f.rooms.push(r)); FP.changed(); return made.length;
  };
})();
