(function () {
  const $ = FP.$, { el, row, edit, numIn, textIn, selIn, chkIn, colorBlock, btn } = FP.uiForm;

  const matRow = FP.ui.matRow, clone = o => JSON.parse(JSON.stringify(o));
  let finScope = 'all';
  // блок отделки стены: верх + необязательный низ с высотой (getZ — текущая зона, setZ(fn) — меняет копию зоны и сохраняет её в данные)
  function finBlock(root, getZ, setZ) {
    const z = getZ(), E = fn => edit(() => setZ(fn));
    root.appendChild(matRow('Верх стены', 'wall', z.up, s => setZ(q => { q.up = s; }), 'Верх стены'));
    if (z.low) {
      root.appendChild(matRow('Низ стены', 'wall', z.low, s => setZ(q => { q.low = s; }), 'Низ стены (плитка, панели)'));
      const hi = el('input'); hi.type = 'number'; hi.step = .05; hi.min = .1; hi.value = +z.h.toFixed(2);
      hi.onchange = () => { const v = parseFloat(hi.value); if (v > 0) E(q => { q.h = v; }); };
      root.appendChild(row('Высота низа, м', hi));
      const b = el('div', 'btns');
      b.appendChild(btn('До потолка', () => E(q => { q.h = FP.floor().height; })));
      b.appendChild(btn('Убрать низ', () => E(q => { q.low = null; q.h = 0; }), 'danger'));
      root.appendChild(b);
    } else {
      const b = el('div', 'btns');
      b.appendChild(btn('+ Низ стены (плитка, панели)', () => E(q => { q.low = { m: 'tile_sq30_white', c: null }; q.h = 1.2; })));
      root.appendChild(b);
    }
  }

  // ---------- панель свойств ----------
  let pt = 0;
  FP.ui.props = function () { clearTimeout(pt); pt = setTimeout(renderProps, 0); };
  function renderProps() {
    const root = $('props'), act = document.activeElement; let idx = -1;
    const q = () => root.querySelectorAll('input,select,button');
    if (root.contains(act)) idx = [...q()].indexOf(act);
    root.innerHTML = ''; const o = FP.selObj();
    if (!o) summary(root); else ({ room: roomP, wall: wallP, opening: openP, furniture: furnP })[FP.sel.type](root, o);
    if (idx >= 0) { const n = q()[idx]; if (n) { n.focus(); if (n.tagName === 'INPUT' && (n.type === 'number' || n.type === 'text')) try { n.select(); } catch (e) {} } }
  }
  const delRow = (root, withDup) => { const b = el('div', 'btns'); if (withDup) b.appendChild(btn('Дублировать', () => FP.duplicate())); b.appendChild(btn('Удалить', () => FP.removeSel(), 'danger')); b.appendChild(btn('Снять выбор', () => FP.select(null))); root.appendChild(b); };

  function summary(root) {
    const f = FP.floor(), s = FP.settings();
    root.appendChild(el('h3', '', 'Этаж и настройки'));
    root.appendChild(row('Название этажа', textIn(f, 'name')));
    root.appendChild(row('Высота потолка, м', numIn(f, 'height', { min: 1.8, step: .05 })));
    root.appendChild(row('Толщина стен, м', numIn(f, 'thickness', { min: .03, step: .01 })));
    root.appendChild(matRow('Стены по умолчанию', 'wall', FP.defWallFin(), sp => { s.wallFin = sp; }, 'Отделка стен по умолчанию (и внешних сторон)'));
    root.appendChild(row('Шаг сетки, м', selIn([[0.01, '0.01'], [0.05, '0.05'], [0.1, '0.10'], [0.25, '0.25'], [0.5, '0.50']], s.snap, v => { s.snap = +v; })));
    root.appendChild(row('Размер комнаты', selIn([['inner', 'чистый (по внутр. стороне)'], ['center', 'по осям стен']], s.wallMode, v => { s.wallMode = v; })));
    const cb = el('div', 'btns');
    cb.appendChild(btn('Старый проект → чистые размеры', () => { if (confirm('Уменьшить комнаты на половину толщины стен с каждой стороны?')) FP.toClear(); }));
    root.appendChild(cb);

    root.appendChild(row('Размеры на плане', chkIn(s.dims, v => { s.dims = v; })));
    root.appendChild(row('Мебель с комнатой', chkIn(s.moveFurn, v => { s.moveFurn = v; })));
    const b = el('div', 'btns'); b.appendChild(btn('+ Комната', () => FP.addRoom())); b.appendChild(btn('+ Стена', () => FP.addWall())); root.appendChild(b);
    root.appendChild(el('h4', '', 'Площади'));
    const tot = f.rooms.reduce((a, r) => a + r.width * r.depth, 0), un = FP.unionArea(f.rooms), per = f.rooms.reduce((a, r) => a + 2 * (r.width + r.depth), 0);

    const outer = FP.inner() ? FP.unionArea(f.rooms.map(r => {
      const tn = FP.wt(r, 'n'), ts = FP.wt(r, 's'), tw = FP.wt(r, 'w'), te = FP.wt(r, 'e');
      return { x: r.x - tw, y: r.y - tn, width: r.width + tw + te, depth: r.depth + tn + ts };
    })) : un;
    [['Полезная площадь (сумма)', tot.toFixed(2) + ' м²'], ['Полезная без наложений', un.toFixed(2) + ' м²'], ['Вместе с толщиной стен', outer.toFixed(2) + ' м²'], ['Периметр комнат', per.toFixed(2) + ' м'], ['Объём (полезный)', (un * f.height).toFixed(1) + ' м³'], ['Мебели / дверей / окон', f.furniture.length + ' / ' + f.openings.filter(o => o.kind === 'door').length + ' / ' + f.openings.filter(o => o.kind === 'window').length]]
      .forEach(a => root.appendChild(el('div', 'stat', '<span>' + a[0] + '</span><b>' + a[1] + '</b>')));

    root.appendChild(el('h4', '', 'Комнаты'));
    const l = el('div', 'list'); f.rooms.forEach(r => l.appendChild(btn(r.name + ' — ' + (r.width * r.depth).toFixed(2) + ' м²', () => FP.select('room', r.id)))); root.appendChild(l);
    if (f.walls.length) { root.appendChild(el('h4', '', 'Свободные стены')); const l2 = el('div', 'list'); f.walls.forEach((w, i) => l2.appendChild(btn('Стена ' + (i + 1) + ' — ' + FP.wlen(w).toFixed(2) + ' м', () => FP.select('wall', w.id)))); root.appendChild(l2); }
    root.appendChild(el('p', 'hint', 'Клик по объекту на плане выбирает его. Двойной клик по плану — войти в 3D и встать в эту точку.'));
  }

  function roomP(root, r) {
    root.appendChild(el('h3', '', 'Комната'));
    root.appendChild(row('Название', textIn(r, 'name')));
    root.appendChild(row('X, м', numIn(r, 'x'))); root.appendChild(row('Y, м', numIn(r, 'y')));
    root.appendChild(row('Ширина, м', numIn(r, 'width', { min: .1 }))); root.appendChild(row('Глубина, м', numIn(r, 'depth', { min: .1 })));
    root.appendChild(el('div', 'stat', '<span>Площадь</span><b>' + (r.width * r.depth).toFixed(2) + ' м²</b>'));
    root.appendChild(el('div', 'stat', '<span>Периметр</span><b>' + (2 * (r.width + r.depth)).toFixed(2) + ' м</b>'));

    root.appendChild(el('h4', '', 'Пол'));
    root.appendChild(matRow('Покрытие', 'floor', FP.floorSpec(r), s => { r.floor = s; r.color = FP.MAT.eff(s); }, 'Покрытие пола'));
    root.appendChild(row('Рисунок вдоль', selIn([[0, 'оси X (→)'], [90, 'оси Y (↓)']], r.floorRot === 90 ? 90 : 0, v => { r.floorRot = +v; })));
    const bf = el('div', 'btns');
    bf.appendChild(btn('Это покрытие → всем комнатам', () => edit(() => { const s = FP.floorSpec(r); FP.floor().rooms.forEach(q => { q.floor = clone(s); q.color = FP.MAT.eff(s); q.floorRot = r.floorRot; }); })));
    root.appendChild(bf);

    root.appendChild(el('h4', '', 'Отделка стен (внутренняя сторона)'));
    const scSel = el('select');
    [['all', 'Все стены'], ['n', 'Север'], ['s', 'Юг'], ['w', 'Запад'], ['e', 'Восток']].forEach(a => { const o = el('option'); o.value = a[0]; o.textContent = a[1] + (a[0] !== 'all' && r.fin && r.fin[a[0]] ? ' ●' : ''); scSel.appendChild(o); });
    scSel.value = finScope; scSel.onchange = () => { finScope = scSel.value; FP.ui.props(); };
    root.appendChild(row('Сторона', scSel));
    finBlock(root, () => FP.zoneOf(r, finScope), fn => { const z = clone(FP.zoneOf(r, finScope)); fn(z); r.fin = r.fin || {}; r.fin[finScope] = z; });
    const bw2 = el('div', 'btns');
    if (finScope !== 'all' && r.fin && r.fin[finScope]) bw2.appendChild(btn('Сбросить сторону', () => edit(() => { delete r.fin[finScope]; })));
    bw2.appendChild(btn('Отделку → всем комнатам', () => edit(() => { FP.floor().rooms.forEach(q => { if (q !== r) q.fin = clone(r.fin || {}); }); })));
    root.appendChild(bw2);
    root.appendChild(el('p', 'hint', 'Сторона с отдельной отделкой отмечена ●. Она заменяет «Все стены». Внешняя сторона берётся из «Стены по умолчанию» (настройки этажа).'));

    root.appendChild(el('h4', '', 'Толщина стен комнаты, м'));
    const all = el('input'); all.type = 'number'; all.step = .01; all.min = .03; all.placeholder = FP.floor().thickness;
    all.value = r.wall != null ? r.wall : '';
    all.onchange = () => { const v = parseFloat(all.value); edit(() => { if (v > 0) { r.wall = v; delete r.wt; } else { delete r.wall; delete r.wt; } }); };
    root.appendChild(row('Все стены', all));
    [['n', 'Север'], ['s', 'Юг'], ['w', 'Запад'], ['e', 'Восток']].forEach(([k, n]) => {
      const i = el('input'); i.type = 'number'; i.step = .01; i.min = .03; i.value = +FP.wt(r, k).toFixed(3);
      i.onchange = () => { const v = parseFloat(i.value); if (!(v > 0)) return; edit(() => { r.wt = r.wt || {}; r.wt[k] = v; }); };
      root.appendChild(row(n, i));
    });

    root.appendChild(el('h4', '', 'Добавить проём'));
    const sd = selIn([['n', 'Север (верх)'], ['s', 'Юг (низ)'], ['w', 'Запад (лево)'], ['e', 'Восток (право)']], 'n', () => {}); sd.onchange = null;
    root.appendChild(row('Сторона', sd));
    const b = el('div', 'btns'); b.appendChild(btn('+ Дверь', () => FP.addOpening(r.id + ':' + sd.value, 'door'))); b.appendChild(btn('+ Окно', () => FP.addOpening(r.id + ':' + sd.value, 'window'))); b.appendChild(btn('+ Проём', () => FP.addOpening(r.id + ':' + sd.value, 'gap'))); root.appendChild(b);
    const ops = FP.floor().openings.filter(o => o.wallId.startsWith(r.id + ':'));
    if (ops.length) { root.appendChild(el('h4', '', 'Проёмы комнаты')); const l = el('div', 'list'); ops.forEach(o => l.appendChild(btn(FP.OP_RU[o.kind] + ' · ' + FP.wallLabel(o.wallId).split(' / ')[1] + ' · ' + o.width.toFixed(2) + ' м', () => FP.select('opening', o.id)))); root.appendChild(l); }
    delRow(root, true);
  }

  function wallP(root, w) {
    root.appendChild(el('h3', '', 'Стена'));
    root.appendChild(row('X1, м', numIn(w, 'x1'))); root.appendChild(row('Y1, м', numIn(w, 'y1')));
    root.appendChild(row('X2, м', numIn(w, 'x2'))); root.appendChild(row('Y2, м', numIn(w, 'y2')));
    const L = FP.wlen(w), ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI;
    const li = el('input'); li.type = 'number'; li.step = .01; li.min = .05; li.value = +L.toFixed(3);
    li.onchange = () => { const v = parseFloat(li.value); if (!(v > 0)) return; edit(() => { const a = Math.atan2(w.y2 - w.y1, w.x2 - w.x1); w.x2 = w.x1 + Math.cos(a) * v; w.y2 = w.y1 + Math.sin(a) * v; }); };
    root.appendChild(row('Длина, м', li));
    const ai = el('input'); ai.type = 'number'; ai.step = 1; ai.value = +ang.toFixed(2);
    ai.onchange = () => { const v = parseFloat(ai.value); if (isNaN(v)) return; edit(() => { const len = FP.wlen(w), a = v * Math.PI / 180; w.x2 = w.x1 + Math.cos(a) * len; w.y2 = w.y1 + Math.sin(a) * len; }); };
    root.appendChild(row('Угол, °', ai));
    root.appendChild(row('Толщина, м', numIn(w, 'thickness', { min: .03, step: .01 })));
    root.appendChild(el('h4', '', 'Отделка (обе стороны)'));
    finBlock(root, () => FP.wallZone(w), fn => { const z = clone(FP.wallZone(w)); fn(z); w.fin = z; delete w.color; });
    const b = el('div', 'btns'); b.appendChild(btn('+ Дверь', () => FP.addOpening(w.id, 'door'))); b.appendChild(btn('+ Окно', () => FP.addOpening(w.id, 'window'))); b.appendChild(btn('+ Проём', () => FP.addOpening(w.id, 'gap'))); b.appendChild(btn('Развернуть', () => edit(() => { [w.x1, w.x2] = [w.x2, w.x1]; [w.y1, w.y2] = [w.y2, w.y1]; FP.floor().openings.forEach(o => { if (o.wallId === w.id && o.k != null) o.k = 1 - o.k; }); }))); root.appendChild(b);
    delRow(root, true);
  }

  function openP(root, o) {
    root.appendChild(el('h3', '', FP.OP_RU[o.kind]));
    root.appendChild(el('div', 'stat', '<span>Стена</span><b>' + FP.wallLabel(o.wallId) + '</b>'));
    root.appendChild(row('Тип', selIn([['door', 'Дверь'], ['window', 'Окно'], ['gap', 'Проём (без двери)']], o.kind, v => { o.kind = v; const d = FP.opDefaults(v); o.h = d.h; o.sill = d.sill; o.width = d.width; })));
    root.appendChild(row('Смещение, м', numIn(o, 'offset', { min: 0, cb: () => { delete o.k; } })));
    root.appendChild(row('Ширина, м', numIn(o, 'width', { min: .2 })));
    const hh = { h: o.h != null ? o.h : FP.opDefaults(o.kind).h, sill: o.sill != null ? o.sill : FP.opDefaults(o.kind).sill };
    root.appendChild(row('Высота проёма, м', numIn(Object.assign(o, { h: hh.h }), 'h', { min: .3 })));
    if (o.kind === 'window') root.appendChild(row('Высота подоконника', numIn(Object.assign(o, { sill: hh.sill }), 'sill', { min: 0 })));
    if (o.kind === 'door') {
      root.appendChild(row('Петли справа', chkIn(o.flip, v => { o.flip = v; })));
      root.appendChild(row('Открывается', selIn([[1, 'в одну сторону'], [-1, 'в другую']], o.swing === -1 ? -1 : 1, v => { o.swing = +v; })));
    }
    root.appendChild(el('p', 'hint', 'Смещение отсчитывается от начала стены: слева направо для N/S, сверху вниз для W/E. Проём можно тянуть мышью вдоль стены.'));
    delRow(root, false);
  }

  function furnP(root, m) {
    root.appendChild(el('h3', '', 'Мебель'));
    root.appendChild(row('Название', textIn(m, 'name')));
    root.appendChild(row('Тип', selIn(Object.keys(FP.LIB.models).map(k => [k, FP.LIB.models[k].name]).sort((a, b) => a[1].localeCompare(b[1], 'ru')), m.kind, v => { m.kind = v; })));
    root.appendChild(row('X, м', numIn(m, 'x'))); root.appendChild(row('Y, м', numIn(m, 'y')));
    root.appendChild(row('Ширина, м', numIn(m, 'width', { min: .05 }))); root.appendChild(row('Глубина, м', numIn(m, 'depth', { min: .05 }))); root.appendChild(row('Высота, м', numIn(m, 'height', { min: .01 })));
    const MM = FP.model(m);
    if (!(MM && MM.ceil)) { if (m.elev == null) m.elev = (MM && MM.elev) || 0; root.appendChild(row('Над полом, м', numIn(m, 'elev', { min: 0 }))); }
    root.appendChild(row('Поворот, °', numIn(m, 'rotation', { step: 1, cb: v => { m.rotation = ((v % 360) + 360) % 360; } })));
    const b = el('div', 'btns');
    [['⟲ 90', -90], ['⟲ 15', -15], ['⟳ 15', 15], ['⟳ 90', 90]].forEach(a => b.appendChild(btn(a[0], () => FP.rotateSel(a[1]))));
    root.appendChild(b);
    const b2 = el('div', 'btns'); b2.appendChild(btn('Отзеркалить', () => edit(() => { m.flipX = !m.flipX; }))); b2.appendChild(btn('Поменять ширину/глубину', () => edit(() => { [m.width, m.depth] = [m.depth, m.width]; }))); root.appendChild(b2);
    colorBlock(root, 'Цвет', m, 'color');
    delRow(root, true);
  }

})();
