(function () {
  const $ = FP.$;
  const { el, btn } = FP.uiForm;

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
  const TOOLS = [['select', 'V', 'Выбор'], ['room', 'R', 'Комната'], ['poly', 'P', 'Многоуг.'], ['wall', 'W', 'Стена'], ['door', 'D', 'Дверь'], ['window', 'N', 'Окно'], ['gap', 'G', 'Проём'], ['measure', 'M', 'Линейка'], ['pan', 'H', 'Рука']];
  function buildLeft() {
    const t = $('tools'); t.innerHTML = '';
    TOOLS.forEach(a => { const b = document.createElement('button'); b.dataset.tool = a[0]; b.innerHTML = a[2] + '<kbd>' + a[1] + '</kbd>'; b.onclick = () => { if (FP.view === '3d') FP.setView('2d'); FP.v2.setTool(a[0]); }; t.appendChild(b); });
    const fit = document.createElement('button'); fit.innerHTML = 'Вписать<kbd>F</kbd>'; fit.onclick = () => FP.v2.fit(); t.appendChild(fit);
    const cat = $('catalog'); cat.innerHTML = '';
    const tb = el('div', 'btns');
    tb.appendChild(btn('+ Своя мебель', () => FP.ui.customDlg())); tb.appendChild(btn('Импорт', () => FP.ui.libImport())); tb.appendChild(btn('Экспорт', () => FP.ui.libExport()));
    cat.appendChild(tb);
    const q = el('input'); q.type = 'text'; q.placeholder = 'Поиск мебели…'; q.style.cssText = 'width:100%;margin-bottom:6px'; cat.appendChild(q);
    FP.CATALOG.forEach((g, gi) => {
      const dt = el('details'); dt.open = gi === 0; dt.appendChild(el('summary', '', g.cat));
      g.items.forEach(it => {
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

  // ---------- запуск ----------
  FP.listeners.push(noSave => {
    FP.ui.props(); if (!noSave) FP.ui.refreshTop();
    if (FP.sel && matchMedia('(max-width:900px)').matches) document.body.classList.remove('hideR');   // телефон: выбрал объект, открылись свойства
  });
  (function boot() {
    let loaded = false;
    try { const s = localStorage.getItem('fp_v1'); if (s) { FP.data = FP.normalize(JSON.parse(s)); loaded = true; } } catch (e) {}
    if (!loaded) FP.data = FP.demo();
    buildLeft(); FP.ui.bindTop(); FP.ui.refreshTop(); FP.v2.setTool('select'); FP.v2.resize(); FP.v2.fit(); FP.ui.props();
  })();
})();
