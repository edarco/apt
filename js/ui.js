(function () {
  const $ = FP.$;
  FP.ui = {};

  // ---------- вид 2D/3D ----------
  FP.setView = function (v) {
    FP.view = v;
    $('c2d').style.display = v === '2d' ? 'block' : 'none';
    $('c3d').style.display = v === '3d' ? 'block' : 'none';
    $('bar3d').hidden = v !== '3d';
    $('v2d').classList.toggle('on', v === '2d'); $('v3d').classList.toggle('on', v === '3d');
    if (v === '3d') { FP.v3.start(); FP.v3.fit(); } else { FP.v3.stop(); FP.v2.resize(); }
    FP.ui.props();
  };
  FP.ui.walkHere = function (x, y) { FP.setView('3d'); FP.v3.walkAt(x, y); };

  // ---------- левая панель ----------
  const TOOLS = [['select', 'V', 'Выбор'], ['room', 'R', 'Комната'], ['wall', 'W', 'Стена'], ['door', 'D', 'Дверь'], ['window', 'N', 'Окно'], ['gap', 'G', 'Проём'], ['measure', 'M', 'Линейка'], ['pan', 'H', 'Рука']];
  function buildLeft() {
    const t = $('tools'); t.innerHTML = '';
    TOOLS.forEach(a => { const b = document.createElement('button'); b.dataset.tool = a[0]; b.innerHTML = a[2] + '<kbd>' + a[1] + '</kbd>'; b.onclick = () => { if (FP.view === '3d') FP.setView('2d'); FP.v2.setTool(a[0]); }; t.appendChild(b); });
    const fit = document.createElement('button'); fit.innerHTML = 'Вписать<kbd>F</kbd>'; fit.onclick = () => FP.v2.fit(); t.appendChild(fit);
    const cat = $('catalog'); cat.innerHTML = '<h4 style="margin-top:0">Мебель (клик — добавить)</h4>';
    FP.CATALOG.forEach(g => {
      const h = document.createElement('h4'); h.textContent = g.cat; cat.appendChild(h);
      g.items.forEach(it => { const b = document.createElement('button'); b.innerHTML = it[1] + '<small>' + it[2] + '×' + it[3] + '</small>'; b.onclick = () => { if (FP.view === '3d') FP.setView('2d'); FP.addFurniture(it); }; cat.appendChild(b); });
    });
  }

  // ---------- вспомогательные элементы формы ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const row = (label, input) => { const d = el('label', 'row'); d.appendChild(el('span', '', label)); d.appendChild(input); return d; };
  const edit = fn => { FP.snap(); fn(); FP.changed(); };
  function numIn(obj, key, o) {
    o = o || {}; const i = el('input'); i.type = 'number'; i.step = o.step || 0.01; if (o.min != null) i.min = o.min;
    i.value = +(+obj[key]).toFixed(3);
    i.onchange = () => { let v = parseFloat(i.value); if (isNaN(v)) { i.value = obj[key]; return; } if (o.min != null) v = Math.max(o.min, v); edit(() => { obj[key] = v; o.cb && o.cb(v); }); };
    return i;
  }
  function textIn(obj, key) { const i = el('input'); i.type = 'text'; i.value = obj[key] || ''; i.onchange = () => edit(() => { obj[key] = i.value; }); return i; }
  function selIn(opts, val, cb) { const s = el('select'); opts.forEach(o => { const p = el('option'); p.value = o[0]; p.textContent = o[1]; s.appendChild(p); }); s.value = val; s.onchange = () => edit(() => cb(s.value)); return s; }
  function chkIn(val, cb) { const i = el('input'); i.type = 'checkbox'; i.checked = !!val; i.onchange = () => edit(() => cb(i.checked)); return i; }
  function colorBlock(parent, label, obj, key) {
    const i = el('input'); i.type = 'color'; i.value = /^#[0-9a-f]{6}$/i.test(obj[key] || '') ? obj[key] : '#cccccc';
    i.onchange = () => edit(() => { obj[key] = i.value; });
    parent.appendChild(row(label, i));
    const pal = el('div', 'pal'); FP.PALETTE.forEach(c => { const s = el('i'); s.style.background = c; s.title = c; s.onclick = () => edit(() => { obj[key] = c; }); pal.appendChild(s); }); parent.appendChild(pal);
  }
  const btn = (text, fn, cls) => { const b = el('button', cls || '', text); b.onclick = fn; return b; };

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
    colorBlock(root, 'Цвет стен (3D)', s, 'wallColor');
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
    root.appendChild(row('Покрытие', selIn(FP.MATERIALS, r.material, v => { r.material = v; })));
    colorBlock(root, 'Цвет пола', r, 'color');

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
    colorBlock(root, 'Цвет (3D)', w, 'color');
    const b = el('div', 'btns'); b.appendChild(btn('+ Дверь', () => FP.addOpening(w.id, 'door'))); b.appendChild(btn('+ Окно', () => FP.addOpening(w.id, 'window'))); b.appendChild(btn('+ Проём', () => FP.addOpening(w.id, 'gap'))); b.appendChild(btn('Развернуть', () => edit(() => { [w.x1, w.x2] = [w.x2, w.x1]; [w.y1, w.y2] = [w.y2, w.y1]; }))); root.appendChild(b);
    delRow(root, true);
  }

  function openP(root, o) {
    root.appendChild(el('h3', '', FP.OP_RU[o.kind]));
    root.appendChild(el('div', 'stat', '<span>Стена</span><b>' + FP.wallLabel(o.wallId) + '</b>'));
    root.appendChild(row('Тип', selIn([['door', 'Дверь'], ['window', 'Окно'], ['gap', 'Проём (без двери)']], o.kind, v => { o.kind = v; const d = FP.opDefaults(v); o.h = d.h; o.sill = d.sill; o.width = d.width; })));
    root.appendChild(row('Смещение, м', numIn(o, 'offset', { min: 0 })));
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
    root.appendChild(row('Тип', selIn(Object.keys(FP.KIND_RU).map(k => [k, FP.KIND_RU[k]]), m.kind, v => { m.kind = v; })));
    root.appendChild(row('X, м', numIn(m, 'x'))); root.appendChild(row('Y, м', numIn(m, 'y')));
    root.appendChild(row('Ширина, м', numIn(m, 'width', { min: .05 }))); root.appendChild(row('Глубина, м', numIn(m, 'depth', { min: .05 }))); root.appendChild(row('Высота, м', numIn(m, 'height', { min: .01 })));
    root.appendChild(row('Поворот, °', numIn(m, 'rotation', { step: 1, cb: v => { m.rotation = ((v % 360) + 360) % 360; } })));
    const b = el('div', 'btns');
    [['⟲ 90', -90], ['⟲ 15', -15], ['⟳ 15', 15], ['⟳ 90', 90]].forEach(a => b.appendChild(btn(a[0], () => FP.rotateSel(a[1]))));
    root.appendChild(b);
    const b2 = el('div', 'btns'); b2.appendChild(btn('Отзеркалить', () => edit(() => { m.flipX = !m.flipX; }))); b2.appendChild(btn('Поменять ширину/глубину', () => edit(() => { [m.width, m.depth] = [m.depth, m.width]; }))); root.appendChild(b2);
    colorBlock(root, 'Цвет', m, 'color');
    delRow(root, true);
  }

  // ---------- файлы ----------
  function download() {
    const txt = FP.toJSON($('compat').checked), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = (FP.data.name || 'plan').replace(/[^\wа-яё\- ]+/gi, '_') + '.floorplandrawer.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function loadText(t) { if (FP.load(t)) { FP.v2.fit(); if (FP.view === '3d') FP.v3.fit(); refreshTop(); } else alert('Не удалось прочитать JSON'); }

  function refreshTop() {
    $('projName').value = FP.data.name;
    const s = $('floorSel'); s.innerHTML = ''; FP.data.floors.forEach((f, i) => { const o = el('option'); o.value = i; o.textContent = f.name; s.appendChild(o); }); s.value = FP.fi;
  }
  FP.ui.refreshTop = refreshTop;

  // ---------- кнопки ----------
  function bindTop() {
    $('projName').onchange = e => edit(() => { FP.data.name = e.target.value; });
    $('floorSel').onchange = e => { FP.fi = +e.target.value; FP.sel = null; FP.v2.fit(); FP.changed(true); if (FP.view === '3d') FP.v3.fit(); };
    $('addFloor').onclick = () => edit(() => { FP.data.floors.push(FP.newFloor('Этаж ' + (FP.data.floors.length + 1))); FP.fi = FP.data.floors.length - 1; FP.sel = null; });
    $('delFloor').onclick = () => { if (FP.data.floors.length < 2) return alert('Нужен хотя бы один этаж'); if (!confirm('Удалить этаж «' + FP.floor().name + '»?')) return; edit(() => { FP.data.floors.splice(FP.fi, 1); FP.fi = 0; FP.sel = null; }); };
    $('undo').onclick = () => FP.undo(); $('redo').onclick = () => FP.redo();
    $('btnExport').onclick = download;
    $('btnCopy').onclick = () => { const t = FP.toJSON($('compat').checked); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => alert('JSON скопирован'), () => { $('pasteTa').value = t; $('pasteDlg').showModal(); $('pasteTa').select(); }); };
    $('btnImport').onclick = () => $('fileIn').click();
    $('fileIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => loadText(r.result); r.readAsText(f); e.target.value = ''; };
    $('btnPaste').onclick = () => { $('pasteTa').value = ''; $('pasteDlg').showModal(); };
    $('pasteOk').onclick = () => { $('pasteDlg').close(); loadText($('pasteTa').value); };
    $('pasteCancel').onclick = () => $('pasteDlg').close();
    $('btnNew').onclick = () => { if (!confirm('Очистить проект? (Можно отменить через Ctrl+Z)')) return; FP.snap(); FP.data = FP.normalize({ name: 'Новый проект' }); FP.fi = 0; FP.sel = null; FP.changed(); FP.v2.fit(); };
    $('v2d').onclick = () => FP.setView('2d'); $('v3d').onclick = () => FP.setView('3d');
    $('btnHelp').onclick = () => $('helpDlg').showModal();
    $('helpClose').onclick = () => $('helpDlg').close();
    // тема
    const applyTheme = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('fp_theme', t); } catch (e) {} };
    let th = 'light'; try { th = localStorage.getItem('fp_theme') || 'light'; } catch (e) {}
    applyTheme(th);
    $('btnTheme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  // ---------- клавиатура ----------
  document.addEventListener('keydown', e => {
    const t = e.target; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) && t.type !== 'checkbox' && t.type !== 'range') return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      if (k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? FP.redo() : FP.undo(); }
      else if (k.toLowerCase() === 'y') { e.preventDefault(); FP.redo(); }
      else if (k.toLowerCase() === 's') { e.preventDefault(); download(); }
      else if (k.toLowerCase() === 'd' && FP.view === '2d') { e.preventDefault(); FP.duplicate(); }
      return;
    }
    if (FP.view === '3d') return;
    const key = k.toLowerCase(), map = { v: 'select', r: 'room', w: 'wall', d: 'door', n: 'window', g: 'gap', m: 'measure', h: 'pan' };
    if (map[key] && !e.altKey) { FP.v2.setTool(map[key]); return; }
    if (key === 'f') FP.v2.fit();
    else if (k === ']') FP.rotateSel(e.shiftKey ? 90 : 15);
    else if (k === '[') FP.rotateSel(e.shiftKey ? -90 : -15);
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); FP.removeSel(); }
    else if (k === 'Escape') { if (FP.v2.tool !== 'select') FP.v2.setTool('select'); else FP.select(null); FP.v2.cancel(); }

    else if (k.startsWith('Arrow') && FP.selObj()) {                 // есть выбор: двигаем объект
      e.preventDefault();
      const st = e.shiftKey ? .01 : FP.settings().snap;
      FP.nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
    }
    else if (k.startsWith('Arrow')) {                                // нет выбора: двигаем холст
      e.preventDefault();
      const st = e.shiftKey ? 200 : 60;
      FP.v2.panBy(k === 'ArrowLeft' ? st : k === 'ArrowRight' ? -st : 0, k === 'ArrowUp' ? st : k === 'ArrowDown' ? -st : 0);
    }

  });

  // ---------- запуск ----------
  FP.listeners.push(noSave => { FP.ui.props(); if (!noSave) refreshTop(); });
  (function boot() {
    let loaded = false;
    try { const s = localStorage.getItem('fp_v1'); if (s) { FP.data = FP.normalize(JSON.parse(s)); loaded = true; } } catch (e) {}
    if (!loaded) FP.data = FP.demo();
    buildLeft(); bindTop(); refreshTop(); FP.v2.setTool('select'); FP.v2.resize(); FP.v2.fit(); FP.ui.props();
  })();
})();
