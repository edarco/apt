(function () {
  const $ = FP.$;
  const { el, btn } = FP.uiForm;

  function selRoom() {                             // комната, к которой относится выбранный объект (или null)
    const f = FP.floor(), s = FP.sel, o = FP.selObj(); if (!o) return null;
    if (s.type === 'room') return o;
    let x, y;
    if (s.type === 'furniture') { x = o.x; y = o.y; }
    else if (s.type === 'wall') { x = (o.x1 + o.x2) / 2; y = (o.y1 + o.y2) / 2; }
    else if (s.type === 'opening') { const w = FP.getWalls(f).find(q => q.id === o.wallId); if (!w) return null; if (w.room) return w.room; const p = FP.openPos(w, o); x = p.cx; y = p.cy; }
    else return null;
    return f.rooms.find(r => FP.pointInRoom(r, x, y)) || null;
  }

  // ---------- вид 2D/3D ----------
  FP.setView = function (v) {
    FP.view = v;
    $('c2d').style.display = v === '2d' ? 'block' : 'none';
    $('c3d').style.display = v === '3d' ? 'block' : 'none';
    $('bar3d').hidden = v !== '3d'; $('btnLock').style.display = v === '2d' ? '' : 'none';
    $('v2d').classList.toggle('on', v === '2d'); $('v3d').classList.toggle('on', v === '3d');

    if (v === '3d') { FP.v3.start(); FP.v3.fit(); const sr = selRoom(); if (sr) FP.v3.enterRoom(sr); } else { FP.v3.stop(); FP.v2.resize(); }

    FP.ui.props();
  };
  FP.ui.walkHere = function (x, y) { FP.setView('3d'); FP.v3.walkAt(x, y); };

  // ---------- левая панель ----------
  const TOOLS = [['select', 'V', 'Выбор', '↖'], ['room', 'R', 'Комната', '▭'], ['poly', 'P', 'Комната-многоугольник', '⬠'], ['wall', 'W', 'Стена', '━'], ['door', 'D', 'Дверь', '🚪'], ['window', 'N', 'Окно', '⊞'], ['gap', 'G', 'Проём без двери', '⊓'], ['measure', 'M', 'Линейка', '📏'], ['pan', 'H', 'Рука (двигать план)', '✋']];

  function buildLeft() {
    const t = $('tools'); t.innerHTML = '';
    TOOLS.forEach(a => {

      const b = document.createElement('button'); b.dataset.tool = a[0]; b.textContent = a[3]; b.title = a[2] + ' (' + a[1] + ')'; b.onclick = () => { if (FP.view === '3d') FP.setView('2d'); FP.v2.setTool(a[0]); }; t.appendChild(b);

      if (a[0] === 'select') {                                    // кнопка «Двигать план» сразу после «Выбор»
        const lk = document.createElement('button'); lk.dataset.lock = '1'; lk.className = FP.v2.lock ? 'on' : ''; lk.textContent = '🔒';
        lk.title = 'Двигать план (L): левая кнопка только двигает план, объекты не двигаются'; lk.onclick = () => { if (FP.view === '3d') FP.setView('2d'); FP.v2.setLock(!FP.v2.lock); }; t.appendChild(lk);
      }
    });

    const fit = document.createElement('button'); fit.textContent = '⤢'; fit.title = 'Вписать весь план (F)'; fit.onclick = () => { if (FP.view === '3d') FP.v3.fitView(); else FP.v2.fit(); }; t.appendChild(fit);

    const cat = $('catalog'); cat.innerHTML = '';
    const tb = el('div', 'btns');

    tb.appendChild(btn('+ Своя мебель', () => FP.ui.customDlg())); tb.appendChild(btn('Импорт GLB', () => FP.ui.glbImport()));
    const gi = btn('ⓘ', () => FP.ui.glbHelp()); gi.title = 'Как импортировать модель GLB'; tb.appendChild(gi);
    tb.appendChild(FP.uiForm.menu('⋯', [['Импорт библиотеки (JSON)…', () => FP.ui.libImport()], ['Экспорт библиотеки (JSON)', () => FP.ui.libExport()]], 'Библиотека мебели'));

    cat.appendChild(tb);
    const q = el('input'); q.type = 'text'; q.placeholder = 'Поиск мебели…'; q.style.cssText = 'width:100%;margin-bottom:6px'; cat.appendChild(q);
    FP.CATALOG.forEach((g, gi) => {
      const dt = el('details'); dt.open = gi === 0; dt.appendChild(el('summary', '', g.cat));
      dt.ontoggle = () => { if (dt.open && !q.value.trim()) cat.querySelectorAll('details').forEach(o => { if (o !== dt) o.open = false; }); };   // аккордеон (при поиске не мешает)
      g.items.slice().sort((a, b) => a[1].localeCompare(b[1], 'ru', { numeric: true })).forEach(it => {   // по алфавиту, «Кровать 90» перед «Кровать 100»
        const b = el('button', '', it[1] + '<small>' + it[2] + '×' + it[3] + '</small>'); b.dataset.n = it[1].toLowerCase();
        b.onclick = () => { if (FP.view === '3d') FP.setView('2d'); FP.addFurniture(it); }; dt.appendChild(b);
      });
      cat.appendChild(dt);
    });
    q.oninput = () => {
      const s = q.value.trim().toLowerCase();
      cat.querySelectorAll('details').forEach(dt => {
        let any = false; dt.querySelectorAll('button').forEach(b => { const ok = !s || b.dataset.n.includes(s); b.style.display = ok ? '' : 'none'; if (ok) any = true; });
        dt.style.display = any ? '' : 'none'; if (s && any) dt.open = true;
      });
    };
  }
  FP.ui.buildLeft = buildLeft;

  // ---------- меню верхней панели (кнопки-оригиналы лежат в скрытом #topHidden, пункты меню «нажимают» их) ----------
  function buildMenus() {
    const m = FP.uiForm.menu, click = id => () => $(id).click(), img = k => () => { const s = $('imgSel'); s.value = k; s.dispatchEvent(new Event('change')); };
    $('mnuFloor').replaceChildren(m('Этаж ▾', [['+ Добавить этаж', click('addFloor')], ['− Удалить этаж', click('delFloor')]], 'Этажи'));
    $('mnuFile').replaceChildren(m('Файл ▾', [['Новый проект', click('btnNew')], '-', ['Импорт JSON…', click('btnImport')], ['Вставить JSON…', click('btnPaste')], '-', ['Экспорт JSON (Ctrl+S)', click('btnExport')], ['Копировать JSON', click('btnCopy')], '-', ['Картинка PNG', img('png')], ['Картинка SVG (план)', img('svg')], ['PDF', img('pdf')]], 'Файл'));
    $('mnuMore').replaceChildren(m('⋯', [['Тема сайта (светлая / тёмная)', click('btnTheme')], ['Тема холста 2D (авто / светлая / тёмная)', click('btnCanvasTheme')], ['Язык / Language', click('btnLang')], '-', ['Справка', click('btnHelp')]], 'Ещё'));
  }

  // ---------- запуск ----------
  FP.listeners.push(noSave => {
    FP.ui.props(); if (!noSave) FP.ui.refreshTop();
    if (FP.sel && matchMedia('(max-width:900px)').matches) { document.body.classList.remove('hideR'); FP.ui.syncEdge && FP.ui.syncEdge(); }   // телефон: выбрал объект, открылись свойства
  });
  (function boot() {
    let loaded = false;
    try { const s = localStorage.getItem('fp_v1'); if (s) { FP.data = FP.normalize(JSON.parse(s)); loaded = true; } } catch (e) {}
    if (!loaded) FP.data = FP.demo();

    buildLeft(); buildMenus(); FP.ui.bindTop(); FP.ui.refreshTop(); FP.v2.setTool('select'); FP.v2.resize(); FP.v2.fit(); FP.ui.props();

  })();
})();
