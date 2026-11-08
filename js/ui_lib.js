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
})();
