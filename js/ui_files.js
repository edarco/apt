(function () {
  const $ = FP.$, { el, edit } = FP.uiForm;

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

  FP.ui.download = download; FP.ui.bindTop = bindTop;
})();
