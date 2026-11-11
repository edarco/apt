(function () {
  const $ = FP.$, { el, edit } = FP.uiForm;

  // ---------- файлы ----------
  function download() {
    const txt = FP.toJSON(), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = (FP.data.name || 'plan').replace(/[^\wа-яё\- ]+/gi, '_') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function loadText(t) { if (FP.load(t)) { FP.v2.fit(); if (FP.view === '3d') FP.v3.fit(); refreshTop(); } else alert('Не удалось прочитать JSON'); }

  function shot(type) {                                   // что видно сейчас: 2D-план или 3D-вид
    if (FP.view === '3d') return FP.v3.shot(type);
    const cv = $('c2d'); return { url: cv.toDataURL(type, .92), w: cv.width, h: cv.height };
  }
  function saveUrl(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
  function saveBlob(b, name) { const u = URL.createObjectURL(b); saveUrl(u, name); setTimeout(() => URL.revokeObjectURL(u), 2000); }
  function pdfFromJpeg(url, w, h) {                       // минимальный PDF: одна страница A4 с JPEG
    const jpg = Uint8Array.from(atob(url.split(',')[1]), ch => ch.charCodeAt(0));
    const land = w >= h, PW = land ? 842 : 595, PH = land ? 595 : 842, k = Math.min((PW - 40) / w, (PH - 40) / h), iw = w * k, ih = h * k;
    const enc = new TextEncoder(), parts = [], off = []; let len = 0;
    const put = d => { const u = typeof d === 'string' ? enc.encode(d) : d; parts.push(u); len += u.length; };
    const obj = (n, head, stream) => { off[n] = len; put(n + ' 0 obj\n' + head); if (stream) { put('\nstream\n'); put(stream); put('\nendstream'); } put('\nendobj\n'); };
    put('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    obj(4, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
    const cs = `q ${iw.toFixed(2)} 0 0 ${ih.toFixed(2)} ${((PW - iw) / 2).toFixed(2)} ${((PH - ih) / 2).toFixed(2)} cm /Im0 Do Q`;
    obj(5, `<< /Length ${cs.length} >>`, cs);
    const xr = len; let t = 'xref\n0 6\n0000000000 65535 f \n'; for (let i = 1; i <= 5; i++) t += String(off[i]).padStart(10, '0') + ' 00000 n \n';
    put(t + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  function planSVG() {                                    // векторный план текущего этажа
    const f = FP.floor(), walls = FP.getWalls(f), K = 50, mg = 1, MI = FP.mergeInfo(f, walls), xs = [], ys = [];
    const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    walls.forEach(w => { xs.push(w.x1 - w.t, w.x1 + w.t, w.x2 - w.t, w.x2 + w.t); ys.push(w.y1 - w.t, w.y1 + w.t, w.y2 - w.t, w.y2 + w.t); });
    f.rooms.forEach(r => FP.rpoly(r).forEach(q => { xs.push(q[0]); ys.push(q[1]); }));
    f.furniture.forEach(m => { const R = Math.max(m.width, m.depth); xs.push(m.x - R, m.x + R); ys.push(m.y - R, m.y + R); });
    if (!xs.length) return '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const x0 = Math.min(...xs) - mg, y0 = Math.min(...ys) - mg, W = (Math.max(...xs) + mg - x0) * K, H = (Math.max(...ys) + mg - y0) * K;
    const X = x => ((x - x0) * K).toFixed(1), Y = y => ((y - y0) * K).toFixed(1), n = v => (v * K).toFixed(1);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" font-family="sans-serif"><rect width="100%" height="100%" fill="#faf8f4"/>`;
    f.rooms.forEach(r => { s += `<polygon fill="${r.color}" points="${FP.rpoly(r).map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}"/>`; });
    walls.forEach(w => {
      const L = FP.wlen(w); if (L < 1e-6) return; const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, segs = [], ms = MI.spans.get(w.id) || []; let cur = -w.e1;
      ms.forEach(q => { if (q[0] > .0005 && q[0] > cur) segs.push([cur, q[0]]); cur = Math.max(cur, q[1]); });
      if (cur < L - .0005) segs.push([cur, L + w.e2]);
      segs.forEach(q => { s += `<line x1="${X(w.x1 + ux * q[0])}" y1="${Y(w.y1 + uy * q[0])}" x2="${X(w.x1 + ux * q[1])}" y2="${Y(w.y1 + uy * q[1])}" stroke="#2f2f33" stroke-width="${n(w.t)}"/>`; });
    });
    f.openings.forEach(o => {
      const w = walls.find(q => q.id === o.wallId); if (!w) return; const p = FP.openPos(w, o);
      s += `<line x1="${X(p.sx)}" y1="${Y(p.sy)}" x2="${X(p.ex)}" y2="${Y(p.ey)}" stroke="#faf8f4" stroke-width="${(w.t * K + 2).toFixed(1)}"/>`;
      if (o.kind === 'window') s += `<line x1="${X(p.sx)}" y1="${Y(p.sy)}" x2="${X(p.ex)}" y2="${Y(p.ey)}" stroke="#2f78d0" stroke-width="3"/>`;
      else if (o.kind === 'door') {
        const hx = o.flip ? p.ex : p.sx, hy = o.flip ? p.ey : p.sy, a = o.flip ? -1 : 1, perp = p.nx * -p.uy + p.ny * p.ux, ly = (perp >= 0 ? 1 : -1) * (o.swing === -1 ? -1 : 1);
        const cx = hx + p.ux * a * o.width, cy = hy + p.uy * a * o.width, lx = hx - p.uy * ly * o.width, lyy = hy + p.ux * ly * o.width;
        const sweep = ((cx - hx) * (lyy - hy) - (cy - hy) * (lx - hx)) > 0 ? 1 : 0;
        s += `<line x1="${X(hx)}" y1="${Y(hy)}" x2="${X(lx)}" y2="${Y(lyy)}" stroke="#555" stroke-width="2"/><path d="M${X(cx)},${Y(cy)} A${n(o.width)},${n(o.width)} 0 0 ${sweep} ${X(lx)},${Y(lyy)}" fill="none" stroke="#555" stroke-dasharray="4 3"/>`;
      }
    });
    f.furniture.forEach(m => {
      const Mo = FP.model(m), round = (Mo && (Mo.plan === 'round' || Mo.plan === 'oval')) || m.kind === 'plant';
      s += `<g transform="translate(${X(m.x)} ${Y(m.y)}) rotate(${m.rotation || 0})">` + (round ? `<ellipse rx="${n(m.width / 2)}" ry="${n(m.depth / 2)}"` : `<rect x="${n(-m.width / 2)}" y="${n(-m.depth / 2)}" width="${n(m.width)}" height="${n(m.depth)}"`) + ` fill="${m.color}" fill-opacity=".9" stroke="#444"/></g>`;
      if (m.width * K > 42) s += `<text x="${X(m.x)}" y="${Y(m.y)}" font-size="10" text-anchor="middle">${esc(m.name)}</text>`;
    });
    f.rooms.forEach(r => { const q = FP.labelPos(r); s += `<text x="${X(q.x)}" y="${Y(q.y)}" font-size="13" font-weight="bold" text-anchor="middle">${esc(r.name)}</text><text x="${X(q.x)}" y="${(+Y(q.y) + 15).toFixed(1)}" font-size="11" text-anchor="middle">${FP.roomArea(r).toFixed(2)} м²</text>`; });
    return s + '</svg>';
  }
  function exportImg(kind) {
    const base = (FP.data.name || 'plan').replace(/[^\wа-яё\- ]+/gi, '_');
    if (kind === 'png') saveUrl(shot('image/png').url, base + '.png');
    else if (kind === 'pdf') { const s = shot('image/jpeg'); saveBlob(pdfFromJpeg(s.url, s.w, s.h), base + '.pdf'); }
    else if (kind === 'svg') saveBlob(new Blob([planSVG()], { type: 'image/svg+xml' }), base + '.svg');
  }

  function refreshTop() {
    $('projName').value = FP.data.name;
    const s = $('floorSel'); s.innerHTML = ''; FP.data.floors.forEach((f, i) => { const o = el('option'); o.value = i; o.textContent = f.name; s.appendChild(o); }); s.value = FP.fi;
    const ds = FP.floor().openings.filter(o => o.kind === 'door' && !o.locked); $('doorsBtn').textContent = (ds.length && ds.every(o => o.open)) ? 'Закрыть двери' : 'Открыть двери';
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
    $('btnCopy').onclick = () => { const t = FP.toJSON(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => alert('JSON скопирован'), () => { $('pasteTa').value = t; $('pasteDlg').showModal(); $('pasteTa').select(); }); };
    $('btnImport').onclick = () => $('fileIn').click();
    $('fileIn').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => loadText(r.result); r.readAsText(f); e.target.value = ''; };
    $('btnPaste').onclick = () => { $('pasteTa').value = ''; $('pasteDlg').showModal(); };
    $('pasteOk').onclick = () => { $('pasteDlg').close(); loadText($('pasteTa').value); };
    $('pasteCancel').onclick = () => $('pasteDlg').close();
    $('btnNew').onclick = () => { if (!confirm('Очистить проект? (Можно отменить через Ctrl+Z)')) return; FP.snap(); FP.data = FP.normalize({ name: 'Новый проект' }); FP.fi = 0; FP.sel = null; FP.changed(); FP.v2.fit(); };
    $('v2d').onclick = () => FP.setView('2d'); $('v3d').onclick = () => FP.setView('3d');
    $('btnHelp').onclick = () => $('helpDlg').showModal();

    const syncEdge = () => { $('btnL').textContent = document.body.classList.contains('hideL') ? '›' : '‹'; $('btnR').textContent = document.body.classList.contains('hideR') ? '‹' : '›'; };
    FP.ui.syncEdge = syncEdge;
    $('btnL').onclick = () => { document.body.classList.toggle('hideL'); syncEdge(); };
    $('btnR').onclick = () => { document.body.classList.toggle('hideR'); syncEdge(); };
    $('btnFs').onclick = () => { const c = $('center'); document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen && c.requestFullscreen(); };
    if (matchMedia('(max-width:900px)').matches) document.body.classList.add('hideL', 'hideR');   // на телефоне панели скрыты
    syncEdge();
    // режим «только двигать план» (см. п. 3)
    $('btnLock').onclick = () => FP.v2.setLock(!FP.v2.lock);
    let lockBefore = false;                                  // в полном экране режим включается сам, при выходе возвращается как был
    document.addEventListener('fullscreenchange', () => {
      const fs = !!document.fullscreenElement;
      if (fs) { lockBefore = FP.v2.lock; FP.v2.setLock(true); } else FP.v2.setLock(lockBefore);
      $('btnFs').textContent = fs ? '✕' : '⛶';
    });

    $('doorsBtn').onclick = () => { const ds = FP.floor().openings.filter(o => o.kind === 'door' && !o.locked); if (ds.length) FP.setDoors(ds, !ds.every(o => o.open)); };
    $('helpClose').onclick = () => $('helpDlg').close();
    // тема
    const applyTheme = t => { document.documentElement.dataset.theme = t; FP.v2 && FP.v2.draw(); try { localStorage.setItem('fp_theme', t); } catch (e) {} };
    let th = 'light'; try { th = localStorage.getItem('fp_theme') || 'light'; } catch (e) {}
    applyTheme(th);
    $('btnTheme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    // тема холста 2D: авто (как сайт) -> светлый -> тёмный
    let ct = 'auto'; try { ct = localStorage.getItem('fp_ctheme') || 'auto'; } catch (e) {}
    const ctName = { auto: 'авто', light: 'светлый', dark: 'тёмный' };
    const applyCt = () => { FP.v2.canvasTheme = ct; $('btnCanvasTheme').title = 'Тема холста: ' + ctName[ct]; try { localStorage.setItem('fp_ctheme', ct); } catch (e) {} FP.v2.draw(); };
    $('btnCanvasTheme').onclick = () => { ct = { auto: 'light', light: 'dark', dark: 'auto' }[ct]; applyCt(); };
    applyCt();
    $('imgSel').onchange = e => { exportImg(e.target.value); e.target.value = ''; };
  }

  FP.ui.download = download; FP.ui.bindTop = bindTop;
})();
