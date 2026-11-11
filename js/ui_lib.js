(function () {
  const $ = FP.$, { el, row } = FP.uiForm, F = {};
  F.name = el('input'); F.name.type = 'text'; F.name.value = 'Моя мебель';
  F.shape = el('select'); Object.keys(FP.CUSTOM_SHAPES).forEach(k => { const o = el('option'); o.value = k; o.textContent = FP.CUSTOM_SHAPES[k]; F.shape.appendChild(o); });
  ['w', 'd', 'h'].forEach((k, i) => { F[k] = el('input'); F[k].type = 'number'; F[k].step = .05; F[k].min = .05; F[k].value = [1, .6, .8][i]; });
  F.color = el('input'); F.color.type = 'color'; F.color.value = '#b99570';
  const form = $('customForm');
  [['Название', F.name], ['Форма', F.shape], ['Ширина, м', F.w], ['Глубина, м', F.d], ['Высота, м', F.h], ['Цвет', F.color]].forEach(a => form.appendChild(row(a[0], a[1])));
  $('customCancel').onclick = () => $('customDlg').close();
  $('customOk').onclick = () => {
    const w = +F.w.value, d = +F.d.value, h = +F.h.value; if (!(w > 0 && d > 0 && h > 0)) return;
    const id = 'u_' + Date.now().toString(36), name = F.name.value || 'Моя мебель';
    FP.addUserLib({ models: { [id]: FP.customModel(F.shape.value, w, d, h, name) }, catalog: [{ cat: 'Мои', items: [[id, name, w, d, h, F.color.value]] }] });
    $('customDlg').close(); FP.ui.buildLeft();
  };
  FP.ui.customDlg = () => $('customDlg').showModal();
  FP.ui.libExport = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(FP.userLib, null, 2)], { type: 'application/json' }));
    a.download = 'my-furniture-library.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  FP.ui.libImport = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = () => { const r = new FileReader(); r.onload = () => { try { FP.addUserLib(JSON.parse(r.result)); FP.ui.buildLeft(); } catch (e) { alert('Не удалось прочитать библиотеку: ' + e.message); } }; r.readAsText(i.files[0]); };
    i.click();
  };

  // ---------- импорт модели .glb ----------
  FP.ui.glbImport = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.glb,model/gltf-binary';
    inp.onchange = () => {
      const file = inp.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => FP.glb.add(rd.result).then(info => glbDialog(file.name.replace(/\.[^.]+$/, ''), info), e => alert('Не удалось прочитать GLB: ' + (e.message || e)));
      rd.readAsArrayBuffer(file);
    };
    inp.click();
  };
  function glbDialog(name, info) {
    const k = Math.max(info.w, info.h, info.d) > 20 ? .01 : 1;           // если модель в сантиметрах: переводим в метры
    const dlg = document.createElement('dialog'), form = el('div'), G = {};
    dlg.appendChild(el('h3', '', 'Импорт модели GLB')); form.style.minWidth = '320px';
    G.name = el('input'); G.name.type = 'text'; G.name.value = name;
    G.cat = el('input'); G.cat.type = 'text'; G.cat.value = 'Мои';
    ['w', 'd', 'h'].forEach(q => { G[q] = el('input'); G[q].type = 'number'; G[q].step = .01; G[q].min = .01; G[q].value = +(info[q] * k).toFixed(2); });
    G.color = el('input'); G.color.type = 'color'; G.color.value = '#b99570';
    [['Название', G.name], ['Группа каталога', G.cat], ['Ширина, м', G.w], ['Глубина, м', G.d], ['Высота, м', G.h], ['Цвет на плане 2D', G.color]].forEach(a => form.appendChild(row(a[0], a[1])));
    dlg.appendChild(form);
    const b = el('div', 'dlgBtns'), ok = el('button', '', 'Добавить'), no = el('button', '', 'Отмена');
    const close = () => { dlg.close(); dlg.remove(); };
    ok.onclick = () => {
      const w = +G.w.value, d = +G.d.value, h = +G.h.value; if (!(w > 0 && d > 0 && h > 0)) return;
      const nm = G.name.value || 'Модель', cat = G.cat.value || 'Мои';
      FP.addUserLib({ models: { [info.id]: { name: nm, w, d, h, parts: [], glb: true } }, catalog: [{ cat, items: [[info.id, nm, w, d, h, G.color.value]] }] });
      close(); FP.ui.buildLeft();
    };
    no.onclick = close; b.appendChild(ok); b.appendChild(no); dlg.appendChild(b);
    document.body.appendChild(dlg); dlg.showModal();
  }

})();
