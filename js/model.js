(function () {
  const FP = window.FP = {};
  FP.$ = id => document.getElementById(id);
  FP.uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

  FP.PALETTE = ['#ddc5a3','#c8a97e','#8b6b4a','#d1d8d4','#eee9df','#cfd4d8','#a8b0b5','#e8d5c4','#b5c4b1','#c9b8d4','#f2d7d5','#f6e7a8','#9fc5e8','#444a50'];
  FP.FPAL = ['#e8e1d3','#d8cdb7','#c9b79c','#b89b78','#a07b52','#7a5636','#5a3e2b','#3b2a20','#f2f0ec','#cfcfcb','#a3a5a6','#6b6e72','#3a3d42','#1f2023','#b7c2a6','#7d9078','#4f6b5a','#9fb1c4','#5f7a94','#2f4057','#c98b6b','#a8553d','#d6a93c','#8a2f3a','#d9a9a3','#b7a4c8'];
  FP.OP_RU = { door: 'Дверь', window: 'Окно', gap: 'Проём' };
  FP.KIND_RU = {
    bed: 'Кровать', nightstand: 'Тумба', wardrobe: 'Шкаф', dresser: 'Комод', sofa: 'Диван', armchair: 'Кресло',
    table: 'Стол журнальный', roundtable: 'Стол круглый', dining: 'Стол обеденный', desk: 'Рабочий стол', chair: 'Стул',
    counter: 'Кухонный модуль', sink: 'Раковина / мойка', stove: 'Плита', fridge: 'Холодильник', washer: 'Стир./посудомоечная машина',
    bath: 'Ванна', shower: 'Душ', toilet: 'Унитаз', shelf: 'Тумба / стеллаж', rug: 'Ковёр', plant: 'Растение', box: 'Блок / колонна'
  };
  FP.MATERIALS = [['oak','Дуб'],['wood','Тёмное дерево'],['tile','Плитка'],['white','Белый'],['concrete','Бетон'],['carpet','Ковролин']];
  // [kind, name, width, depth, height, color]
  FP.CATALOG = [
    {cat:'Спальня',items:[['bed','Кровать 160',1.65,2.15,0.65,'#e5dfd1'],['bed','Кровать 90',0.95,2.05,0.6,'#e5dfd1'],['nightstand','Тумба',0.45,0.45,0.5,'#ba9b7c'],['wardrobe','Шкаф',1.8,0.6,2.2,'#d6cdbb'],['dresser','Комод',1.2,0.5,0.85,'#c9b08a']]},
    {cat:'Гостиная',items:[['sofa','Диван',2.3,0.95,0.78,'#c4c2b2'],['armchair','Кресло',0.85,0.85,0.8,'#bf8c6c'],['table','Журнальный стол',1.1,0.65,0.4,'#b99570'],['shelf','ТВ-тумба',1.6,0.4,0.5,'#b99570'],['shelf','Стеллаж',1.6,0.35,1.9,'#b99570'],['rug','Ковёр',2.8,2,0.025,'#e2d6c1']]},
    {cat:'Кухня',items:[['dining','Обеденный стол',1.7,0.9,0.75,'#bd9a73'],['roundtable','Круглый стол',1,1,0.75,'#bd9a73'],['chair','Стул',0.45,0.5,0.85,'#b18c68'],['counter','Кухонный модуль',0.6,0.6,0.9,'#899a87'],['sink','Мойка',0.8,0.6,0.91,'#d9d9d0'],['stove','Плита',0.6,0.6,0.9,'#cfcfcf'],['fridge','Холодильник',0.6,0.65,1.8,'#e2e2dc'],['washer','Стир. машина',0.6,0.6,0.85,'#f0f0f0']]},
    {cat:'Ванная',items:[['bath','Ванна',1.7,0.8,0.58,'#edece6'],['shower','Душ',0.9,0.9,2,'#bfe0ee'],['toilet','Унитаз',0.42,0.7,0.45,'#edece6'],['sink','Раковина',0.6,0.5,0.85,'#edece6']]},
    {cat:'Прочее',items:[['desk','Рабочий стол',1.2,0.6,0.75,'#b99570'],['plant','Растение',0.65,0.65,1.25,'#688366'],['box','Колонна / блок',0.4,0.4,2.7,'#bdbdbd']]}
  ];

  FP.data = null; FP.fi = 0; FP.sel = null; FP.view = '2d';
  FP.listeners = [];
  let undoS = [], redoS = [], saveT = 0;

  FP.floor = () => FP.data.floors[FP.fi];
  FP.settings = () => FP.data.settings;

  // ---------- история / события ----------
  FP.snap = function () { undoS.push(JSON.stringify(FP.data)); if (undoS.length > 100) undoS.shift(); redoS = []; };
  function restore(str) {
    FP.data = JSON.parse(str);
    if (FP.fi >= FP.data.floors.length) FP.fi = 0;
    if (!FP.selObj()) FP.sel = null;
    FP.changed();
  }
  FP.undo = function () { if (!undoS.length) return; redoS.push(JSON.stringify(FP.data)); restore(undoS.pop()); };
  FP.redo = function () { if (!redoS.length) return; undoS.push(JSON.stringify(FP.data)); restore(redoS.pop()); };
  FP.resetHistory = () => { undoS = []; redoS = []; };
  FP.changed = function (noSave) {
    if (!noSave) {
      clearTimeout(saveT);
      saveT = setTimeout(() => { try { localStorage.setItem('fp_v1', JSON.stringify(FP.data)); } catch (e) {} }, 300);
    }
    FP.listeners.forEach(fn => fn(!!noSave));
  };
  FP.select = (type, id) => { FP.sel = type ? { type, id } : null; FP.changed(true); };
  FP.selObj = function () {
    if (!FP.sel || !FP.data) return null;
    const f = FP.floor();
    const L = { room: f.rooms, wall: f.walls, opening: f.openings, furniture: f.furniture }[FP.sel.type];
    return (L && L.find(o => o.id === FP.sel.id)) || null;
  };

  // ---------- нормализация / файлы ----------
  const num = (v, d) => (isFinite(+v) && v !== null && v !== '' ? +v : d);
  FP.newFloor = name => ({ id: FP.uid(), name, rooms: [], walls: [], openings: [], furniture: [], height: 2.7, thickness: 0.16 });
  FP.normalize = function (d) {
    d = d && typeof d === 'object' ? d : {};
    d.version = 1; d.id = d.id || FP.uid(); d.name = d.name || 'Проект'; d.units = 'm';
    d.settings = Object.assign({ wallColor: '#f2efe9', snap: 0.05, dims: true, moveFurn: true, wallMode: 'inner', planTex: false }, d.settings || {});
    if (!Array.isArray(d.floors) || !d.floors.length) d.floors = [FP.newFloor('Этаж 1')];
    d.floors.forEach(f => {
      f.id = f.id || FP.uid(); f.name = f.name || 'Этаж';
      f.height = num(f.height, 2.7); f.thickness = num(f.thickness, 0.16);
      ['rooms', 'walls', 'openings', 'furniture'].forEach(k => { if (!Array.isArray(f[k])) f[k] = []; });
      f.rooms.forEach(r => { r.id = r.id || FP.uid(); r.name = r.name || 'Комната'; r.x = num(r.x, 0); r.y = num(r.y, 0); r.width = Math.max(.1, num(r.width, 3)); r.depth = Math.max(.1, num(r.depth, 3)); r.material = r.material || 'white'; r.color = r.color || '#eeeeee'; });
      f.walls = f.walls.filter(w => w && isFinite(+w.x1)).map(w => ({ id: w.id || FP.uid(), x1: +w.x1, y1: +w.y1, x2: +w.x2, y2: +w.y2, thickness: num(w.thickness, f.thickness), color: w.color, fin: w.fin }));
      f.openings.forEach(o => { o.id = o.id || FP.uid(); o.offset = num(o.offset, 0); o.width = num(o.width, 0.9); o.kind = (o.kind === 'window' || o.kind === 'gap') ? o.kind : 'door'; o.flip = !!o.flip; o.open = o.open !== false; });
      f.furniture.forEach(m => { m.id = m.id || FP.uid(); m.kind = m.kind || 'box'; m.name = m.name || m.kind; m.x = num(m.x, 0); m.y = num(m.y, 0); m.width = num(m.width, .5); m.depth = num(m.depth, .5); m.height = num(m.height, .5); m.rotation = num(m.rotation, 0); m.color = m.color || '#bbbbbb'; });
    });
    return d;
  };
  FP.toJSON = function () {
    const d = JSON.parse(JSON.stringify(FP.data));
    d.updatedAt = new Date().toISOString();
    delete d.models;                                  // свои модели мебели, использованные в проекте, едут вместе с файлом
    const usedM = {}; d.floors.forEach(f => f.furniture.forEach(m => { if (FP.userLib.models[m.kind]) usedM[m.kind] = FP.userLib.models[m.kind]; }));
    if (Object.keys(usedM).length) d.models = usedM;
    delete d.glbs;
    if (FP.glb && Object.keys(usedM).length) { const gl = FP.glb.pack(Object.keys(usedM)); if (gl) d.glbs = gl; }   // сами .glb внутри JSON проекта
    return JSON.stringify(d, (k, v) => typeof v === 'number' ? +v.toFixed(4) : v, 2);
  };
  FP.load = function (text) {
    let d; try { d = JSON.parse(text); } catch (e) { return false; }
    if (!d || !Array.isArray(d.floors)) return false;
    if (d.models) {
      FP.mergeModels(d.models);
      Object.keys(d.models).forEach(k => { if (FP.LIB.models[k]) FP.userLib.models[k] = FP.LIB.models[k]; });     // чтобы модели пережили перезагрузку страницы
      try { localStorage.setItem('fp_userlib', JSON.stringify(FP.userLib)); } catch (e) {}
    }
    if (d.glbs && FP.glb) FP.glb.unpack(d.glbs); delete d.glbs;
    FP.data = FP.normalize(d); FP.fi = 0; FP.sel = null; FP.resetHistory(); FP.changed();
    return true;
  };
  FP.demo = function () {
    const d = { name: 'Пример', floors: [FP.newFloor('Этаж 1')] }, f = d.floors[0], id = FP.uid;
    const r1 = { id: id(), name: 'Гостиная', x: 0, y: 0, width: 5, depth: 4, material: 'oak', color: '#ddc5a3' };
    const r2 = { id: id(), name: 'Спальня', x: 5.16, y: 0, width: 3.5, depth: 4, material: 'oak', color: '#c8a97e' };
    f.rooms.push(r1, r2);
    f.openings.push(
      { id: id(), wallId: r1.id + ':n', offset: 1.5, width: 1.8, kind: 'window', flip: false },
      { id: id(), wallId: r1.id + ':e', offset: 1.5, width: 0.9, kind: 'door', flip: false },
      { id: id(), wallId: r2.id + ':n', offset: 1, width: 1.5, kind: 'window', flip: false },
      { id: id(), wallId: r1.id + ':s', offset: 3.5, width: 0.9, kind: 'door', flip: false });
    f.furniture.push(
      { id: id(), kind: 'sofa', name: 'Диван', width: 2.3, depth: .95, height: .78, color: '#c4c2b2', x: 2.5, y: 3.3, rotation: 180 },
      { id: id(), kind: 'table', name: 'Журнальный стол', width: 1.1, depth: .65, height: .4, color: '#b99570', x: 2.5, y: 2.2, rotation: 0 },
      { id: id(), kind: 'bed', name: 'Кровать 160', width: 1.65, depth: 2.15, height: .65, color: '#e5dfd1', x: 6.8, y: 1.3, rotation: 0 });
    return FP.normalize(d);
  };

  // ---------- геометрия ----------
  FP.wlen = w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);

  FP.wt = function (r, side, f) {            // толщина стены комнаты с данной стороны
    f = f || FP.floor();
    const v = (r.wt && r.wt[side] != null) ? r.wt[side] : (r.wall != null ? r.wall : f.thickness);
    return +v > 0 ? +v : f.thickness;
  };
  FP.inner = () => FP.data.settings.wallMode !== 'center';
  FP.hasRail = r => !!r.rail && Object.keys(r.rail).some(k => r.rail[k]);

  FP.getWalls = function (f) {
    const out = [], inner = FP.inner();
    f.rooms.forEach(r => {
      const t = { n: FP.wt(r, 'n', f), s: FP.wt(r, 's', f), w: FP.wt(r, 'w', f), e: FP.wt(r, 'e', f) };
      const X2 = r.x + r.width, Y2 = r.y + r.depth;
      // [x1, y1, x2, y2, удлинение в начале, удлинение в конце]
      const d = inner ? {
        n: [r.x, r.y - t.n / 2, X2, r.y - t.n / 2, t.w, t.e],
        s: [r.x, Y2 + t.s / 2, X2, Y2 + t.s / 2, t.w, t.e],
        w: [r.x - t.w / 2, r.y, r.x - t.w / 2, Y2, t.n, t.s],
        e: [X2 + t.e / 2, r.y, X2 + t.e / 2, Y2, t.n, t.s]
      } : {
        n: [r.x, r.y, X2, r.y, t.n / 2, t.n / 2],
        s: [r.x, Y2, X2, Y2, t.s / 2, t.s / 2],
        w: [r.x, r.y, r.x, Y2, t.w / 2, t.w / 2],
        e: [X2, r.y, X2, Y2, t.e / 2, t.e / 2]
      };
      ['n', 's', 'w', 'e'].forEach(k => out.push({ id: r.id + ':' + k, side: k, room: r, x1: d[k][0], y1: d[k][1], x2: d[k][2], y2: d[k][3], t: t[k], e1: d[k][4], e2: d[k][5], rail: !!(r.rail && r.rail[k]) }));
    });
    f.walls.forEach(w => { const t = w.thickness || f.thickness; out.push({ id: w.id, custom: w, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, t, e1: t / 2, e2: t / 2, color: w.color }); });
    // позиция проёма = доля длины стены (o.k, центр проёма): проём следует за стеной при изменении размеров
    const byId = new Map(out.map(q => [q.id, q]));
    f.openings.forEach(o => {
      const w = byId.get(o.wallId); if (!w) return;
      const L = FP.wlen(w); if (L < 1e-6) return;
      if (o.k == null) o.k = (o.offset + o.width / 2) / L;
      else o.offset = Math.max(0, Math.min(Math.max(0, L - o.width), o.k * L - o.width / 2));
    });
    return out;
  };

  // Перевод старого проекта (размеры «по осям стен») в чистые размеры
  FP.toClear = function () {
    FP.snap(); const f = FP.floor();
    f.rooms.forEach(r => {
      const tn = FP.wt(r, 'n', f), ts = FP.wt(r, 's', f), tw = FP.wt(r, 'w', f), te = FP.wt(r, 'e', f);
      f.openings.forEach(o => {
        if (!o.wallId.startsWith(r.id + ':')) return;
        const side = o.wallId.split(':')[1];
        o.offset = Math.max(0, o.offset - ((side === 'n' || side === 's') ? tw : tn) / 2);
        delete o.k;
      });
      r.x += tw / 2; r.y += tn / 2;
      r.width = Math.max(.1, r.width - (tw + te) / 2); r.depth = Math.max(.1, r.depth - (tn + ts) / 2);
    });
    FP.settings().wallMode = 'inner'; FP.changed();
  };

  // offset проёма отсчитывается от начала стены (n/s — слева направо, w/e — сверху вниз)
  FP.openPos = function (w, o) {
    const L = FP.wlen(w) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    let nx, ny;
    if (w.side) { const n = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[w.side]; nx = n[0]; ny = n[1]; } else { nx = -uy; ny = ux; }
    const sx = w.x1 + ux * o.offset, sy = w.y1 + uy * o.offset;
    return { sx, sy, ex: sx + ux * o.width, ey: sy + uy * o.width, cx: sx + ux * o.width / 2, cy: sy + uy * o.width / 2, ux, uy, nx, ny };
  };
  FP.opDefaults = kind => kind === 'window' ? { width: 1.2, h: 1.3, sill: 0.9 } : { width: 0.9, h: 2.1, sill: 0 };
  FP.wallLabel = function (id) {
    const f = FP.floor();
    if (id.includes(':')) { const [rid, s] = id.split(':'); const r = f.rooms.find(r => r.id === rid); return (r ? r.name : '?') + ' / ' + { n: 'север', s: 'юг', w: 'запад', e: 'восток' }[s]; }
    return 'Свободная стена';
  };
  // проёмы, лежащие на этой же линии (общие стены соседних комнат), пересчитанные в координаты стены w
  FP.spans = function (f, walls, w) {
    const L = FP.wlen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, out = [];
    f.openings.forEach(o => {
      const w2 = walls.find(q => q.id === o.wallId); if (!w2) return;
      if (w2.id === w.id) { out.push({ s: o.offset, e: o.offset + o.width, o, own: true }); return; }
      const L2 = FP.wlen(w2) || 1, u2x = (w2.x2 - w2.x1) / L2, u2y = (w2.y2 - w2.y1) / L2;
      if (Math.abs(ux * u2y - uy * u2x) > 0.01) return;

      if (Math.abs((w2.x1 - w.x1) * (-uy) + (w2.y1 - w.y1) * ux) > 0.5 * (w.t + w2.t) + 0.03) return;

      const ax = w2.x1 + u2x * o.offset, ay = w2.y1 + u2y * o.offset;
      const pa = (ax - w.x1) * ux + (ay - w.y1) * uy, pb = pa + (u2x * ux + u2y * uy) * o.width;
      out.push({ s: Math.min(pa, pb), e: Math.max(pa, pb), o, own: false });
    });
    return out;
  };
  // разбиение стены на куски: стена / стекло / дверь / блок (только для коллизий)
  FP.pieces = function (f, walls, w, cutH) {
    const L = FP.wlen(w), Hf = f.height, H = Math.min(Hf, cutH || Hf), P = [];
    const add = (s, e, z0, z1, type, o, own) => { z1 = Math.min(z1, H); if (e - s > 0.001 && z1 - z0 > 0.001) P.push({ s, e, z0, z1, type, o, own }); };
    const sp = FP.spans(f, walls, w).map(a => ({ o: a.o, own: a.own, s: Math.max(0, a.s), e: Math.min(L, a.e) })).filter(a => a.e > a.s).sort((a, b) => a.s - b.s);
    let cur = 0;
    sp.forEach(a => {
      const o = a.o, win = o.kind === 'window', sill = win ? (o.sill != null ? o.sill : 0.9) : 0, oh = o.h != null ? o.h : (win ? 1.3 : 2.1);
      add(cur, a.s, 0, Hf, 'wall');
      if (sill > 0) add(a.s, a.e, 0, sill, 'wall');
      add(a.s, a.e, sill + oh, Hf, 'wall');
      if (win) { add(a.s, a.e, sill, sill + oh, 'glass', o, a.own); P.push({ s: a.s, e: a.e, z0: 0, z1: Hf, type: 'block' }); }
      else if (o.kind !== 'gap') add(a.s, a.e, 0, oh, 'door', o, a.own);
      cur = Math.max(cur, a.e);
    });
    add(cur, L, 0, Hf, 'wall');
    return P;
  };
  FP.unionArea = function (rooms) {
    const xs = [...new Set(rooms.flatMap(r => [r.x, r.x + r.width]))].sort((a, b) => a - b);
    const ys = [...new Set(rooms.flatMap(r => [r.y, r.y + r.depth]))].sort((a, b) => a - b);
    let a = 0;
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (rooms.some(r => cx > r.x && cx < r.x + r.width && cy > r.y && cy < r.y + r.depth)) a += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
    }
    return a;
  };

  // ---------- операции ----------
  FP.furnInRoom = (f, r) => f.furniture.filter(m => m.x >= r.x && m.x <= r.x + r.width && m.y >= r.y && m.y <= r.y + r.depth);
  FP.moveRoomBy = function (r, dx, dy) {
    if (FP.settings().moveFurn) FP.furnInRoom(FP.floor(), r).forEach(m => { m.x += dx; m.y += dy; });
    r.x += dx; r.y += dy;
  };
  FP.addRoom = function () {
    FP.snap(); const f = FP.floor();
    const x = f.rooms.length ? Math.max(...f.rooms.map(r => r.x + r.width)) + (FP.inner() ? f.thickness : 0) : 0,
      y = f.rooms.length ? f.rooms[0].y : 0;
    const r = { id: FP.uid(), name: 'Комната ' + (f.rooms.length + 1), x, y, width: 3, depth: 3, material: 'oak', color: '#c19a6b', floor: { m: 'lam_oak_nat', c: null } };
    f.rooms.push(r); FP.select('room', r.id); FP.changed();
  };
  FP.addWall = function () {
    FP.snap(); const f = FP.floor(), c = FP.v2.center();
    const w = { id: FP.uid(), x1: c.x - 1, y1: c.y, x2: c.x + 1, y2: c.y, thickness: f.thickness };
    f.walls.push(w); FP.select('wall', w.id); FP.changed();
  };
  FP.addOpening = function (wallId, kind, offset) {
    const f = FP.floor(), w = FP.getWalls(f).find(q => q.id === wallId); if (!w) return null;
    const d = FP.opDefaults(kind), L = FP.wlen(w), width = Math.min(d.width, L);
    FP.snap();
    const o = { id: FP.uid(), wallId, offset: offset == null ? (L - width) / 2 : Math.max(0, Math.min(L - width, offset)), width, kind, flip: false, swing: 1, h: d.h, sill: d.sill, open: true };
    f.openings.push(o); FP.select('opening', o.id); FP.changed(); return o;
  };
  FP.addFurniture = function (it) {
    FP.snap(); const f = FP.floor(), so = FP.selObj(); let x, y;
    if (so && FP.sel.type === 'room') { x = so.x + so.width / 2; y = so.y + so.depth / 2; } else { const c = FP.v2.center(); x = c.x; y = c.y; }
    const k = FP.settings().snap, sn = v => +(Math.round(v / k) * k).toFixed(3);
    const m = { id: FP.uid(), kind: it[0], name: it[1], width: it[2], depth: it[3], height: it[4], color: it[5], x: sn(x), y: sn(y), rotation: 0 };
    if (it[6] != null) m.elev = it[6];      // высота над полом из каталога (розетки, шкафы и т.д.)
    f.furniture.push(m); FP.select('furniture', m.id); FP.changed();
  };
  FP.removeSel = function () {
    const o = FP.selObj(); if (!o) return; FP.snap(); const f = FP.floor(), t = FP.sel.type;
    if (t === 'room') { f.rooms = f.rooms.filter(x => x !== o); f.openings = f.openings.filter(p => !p.wallId.startsWith(o.id + ':')); }
    else if (t === 'wall') { f.walls = f.walls.filter(x => x !== o); f.openings = f.openings.filter(p => p.wallId !== o.id); }
    else if (t === 'opening') f.openings = f.openings.filter(x => x !== o);
    else f.furniture = f.furniture.filter(x => x !== o);
    FP.sel = null; FP.changed();
  };

  // ---------- двери: открыть/закрыть ----------
  FP.setDoors = function (list, v) { FP.snap(); list.forEach(o => { if (!o.locked) o.open = v; }); FP.changed(); };
  FP.nearestDoor = function (x, y, R) {
    const f = FP.floor(), ws = FP.getWalls(f); let best = null, bd = R;
    f.openings.forEach(o => {
      if (o.kind !== 'door') return; const w = ws.find(q => q.id === o.wallId); if (!w) return;
      const p = FP.openPos(w, o), d = Math.hypot(p.cx - x, p.cy - y); if (d < bd) { bd = d; best = o; }
    });
    return best;
  };
  FP.toggleDoorKey = function () {                      // клавиша O
    const f = FP.floor(), so = FP.selObj(); let o = null;
    if (so && FP.sel.type === 'opening' && so.kind === 'door') o = so;
    else { const c = FP.view === '3d' && FP.v3.focus(); if (c) o = FP.nearestDoor(c[0], c[1], 1.8); }
    if (o) FP.setDoors([o], !o.open);
    else { const ds = f.openings.filter(q => q.kind === 'door' && !q.locked); FP.setDoors(ds, !ds.some(q => q.open)); }   // нет выбора и рядом нет двери: все двери
  };

  FP.duplicate = function () {
    const o = FP.selObj(); if (!o || FP.sel.type === 'opening') return; FP.snap(); const f = FP.floor(), c = JSON.parse(JSON.stringify(o)); c.id = FP.uid();
    if (FP.sel.type === 'room') { c.x += .5; c.y += .5; c.name += ' (копия)'; f.rooms.push(c); }
    else if (FP.sel.type === 'wall') { c.x1 += .5; c.x2 += .5; c.y1 += .5; c.y2 += .5; f.walls.push(c); }
    else { c.x += .3; c.y += .3; f.furniture.push(c); }
    FP.select(FP.sel.type, c.id); FP.changed();
  };
  FP.nudge = function (dx, dy) {
    const o = FP.selObj(); if (!o) return; const t = FP.sel.type; if (t === 'opening') return; FP.snap();
    if (t === 'room') FP.moveRoomBy(o, dx, dy);
    else if (t === 'wall') { o.x1 += dx; o.x2 += dx; o.y1 += dy; o.y2 += dy; }
    else { o.x += dx; o.y += dy; }
    FP.changed();
  };
  FP.rotateSel = function (deg) {
    const o = FP.selObj(); if (!o || FP.sel.type !== 'furniture') return; FP.snap();
    o.rotation = ((((o.rotation || 0) + deg) % 360) + 360) % 360; FP.changed();
  };

  // Мебель, которая ставится спиной к стене (прилипает и поворачивается при перетаскивании рядом со стеной; Alt отключает)
  FP.WALLKINDS = new Set('wardrobe wardrobe_mir dresser shelf tvstand shoe_rack nightstand fridge fridge_sbs counter drawer_base sink tall_cab base_oven tall_oven cab_washer stove dishwasher washer vanity boiler sofa sofa_l bed bed1 toilet toilet_wall basin basin_wall desk desk_pc mirror_full radiator'.split(' '));
  // Навесное (розетки, шкафчики, зеркала, ТВ...) и мебель из FP.WALLKINDS: при перетаскивании около стены прилипает к её поверхности и поворачивается задней стороной к стене
  FP.wallSnap = function (m) {
    const M = FP.model(m); if (!M || !(M.wall || FP.WALLKINDS.has(m.kind))) return;
    let best = null, bd = M.wall ? 0.45 : 0.4;

    FP.getWalls(FP.floor()).forEach(w => {
      const L = FP.wlen(w); if (L < .01) return;
      const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, px = m.x - w.x1, py = m.y - w.y1, t0 = px * ux + py * uy;
      if (t0 < -.05 || t0 > L + .05) return;                 // предмет должен быть напротив самой стены, а не её продолжения
      const nx = -uy, ny = ux, sd = px * nx + py * ny; let side = sd >= 0 ? 1 : -1;
      if (w.room) {                                          // стена комнаты: только со стороны комнаты (внутрь)
        const ni = w.nx != null ? [w.nx, w.ny] : { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[w.side];
        side = (ni[0] * nx + ni[1] * ny) >= 0 ? 1 : -1;
        if (sd * side < -w.t / 2) return;                    // середина стены пройдена: это уже соседняя комната
      }
      const d0 = Math.abs(sd * side - w.t / 2), a0 = (m.rotation || 0) * Math.PI / 180, sx = nx * side, sy = ny * side;   // центр → лицевая поверхность стены
      const ex = (m.width / 2) * Math.abs(Math.cos(a0) * sx + Math.sin(a0) * sy) + (m.depth / 2) * Math.abs(-Math.sin(a0) * sx + Math.cos(a0) * sy);   // полуразмер предмета в сторону стены при текущем повороте
      const d = M.wall ? d0 : Math.max(0, d0 - ex);          // для мебели: зазор от края предмета до стены
      if (d < bd) { bd = d; best = { w, t0, nx: nx * side, ny: ny * side, ux, uy, L }; }
    });
    if (!best) return;
    const hw = m.width / 2, t = best.L > 2 * hw ? Math.max(hw, Math.min(best.L - hw, best.t0)) : best.L / 2;   // не заходит за углы стены
    const dist = best.w.t / 2 + m.depth / 2, bx = best.w.x1 + best.ux * t, by = best.w.y1 + best.uy * t;
    m.x = +(bx + best.nx * dist).toFixed(3); m.y = +(by + best.ny * dist).toFixed(3);
    m.rotation = Math.round(((Math.atan2(-best.nx, best.ny) * 180 / Math.PI) + 360) % 360);
  };

})();
