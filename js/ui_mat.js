(function () {
  const $ = FP.$, { el, row, edit } = FP.uiForm;
  const CATS = { floor: ['Ламинат', 'Паркет', 'Плитка', 'Прочее'], wall: ['Краска', 'Штукатурка', 'Обои', 'Кирпич, рейки, бетон', 'Плитка'] };
  const thumbs = new Map(), urls = new Map();
  let cur = null, cb = null, useK = 'wall', tab = null, token = 0;

  function flat(color) { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 8, 8); return c; }
  function thumb(P, color) {
    const k = P.id + '|' + (color || P.c); let cv = thumbs.get(k);
    if (!cv) { cv = P.tex ? FP.MAT.canvasFor(P, color, 96).cv : flat(color || P.c); thumbs.set(k, cv); }
    return cv;
  }
  // маленький квадратик-образец для кнопки в панели свойств
  FP.ui.matSwatch = spec => {
    const P = FP.MAT.get(spec.m), col = spec.c || null, d = el('span', 'msw'), k = P.id + '|' + (col || P.c);
    if (!P.tex) d.style.background = col || P.c;
    else { let u = urls.get(k); if (!u) { u = thumb(P, col).toDataURL(); urls.set(k, u); } d.style.backgroundImage = 'url(' + u + ')'; }
    return d;
  };
  // строка панели: «подпись [образец + название]»; set(spec) — обычный мутатор данных, undo/перерисовка делаются здесь
  FP.ui.matRow = (label, use, spec, set, title) => {
    const b = el('button', 'matb'); b.appendChild(FP.ui.matSwatch(spec)); b.appendChild(el('span', '', FP.MAT.get(spec.m).name + (spec.c ? ' *' : '')));
    b.onclick = () => FP.ui.pickMaterial(use, spec, title || label, s => edit(() => set(s)));
    return row(label, b);
  };

  function buildTabs() {
    const t = $('matTabs'); t.innerHTML = '';
    CATS[useK].forEach(c => { const b = el('button', c === tab ? 'on' : '', c); b.onclick = () => { tab = c; buildTabs(); render(); }; t.appendChild(b); });
  }
  function syncColor() { $('matColor').value = FP.MAT.eff(cur); }
  function render() {
    const g = $('matGrid'); g.innerHTML = ''; const my = ++token, q = [];
    FP.MAT.list.filter(p => p.cat === tab && (p.use === useK || p.use === 'both')).forEach(P => {
      const s = el('div', 'sw' + (cur.m === P.id ? ' on' : '')), ph = el('div', 'ph');
      s.appendChild(ph); s.appendChild(el('div', 'nm', P.name)); s.title = P.name;
      s.onclick = () => { cur = { m: P.id, c: null }; cb({ m: cur.m, c: null }); g.querySelectorAll('.sw.on').forEach(x => x.classList.remove('on')); s.classList.add('on'); syncColor(); };
      g.appendChild(s); q.push([P, ph]);
    });
    (function step() {                                 // превью рисуем порциями, чтобы окно открывалось сразу
      if (my !== token) return;
      for (let i = 0; i < 3 && q.length; i++) { const it = q.shift(); it[1].appendChild(thumb(it[0], null)); }
      if (q.length) setTimeout(step, 0);
    })();
  }
  FP.ui.pickMaterial = (use, spec, title, set) => {
    useK = use; cur = { m: spec.m, c: spec.c || null }; cb = set; $('matTitle').textContent = title || 'Материал';
    const c0 = FP.MAT.get(cur.m).cat; tab = CATS[use].includes(c0) ? c0 : CATS[use][0];
    buildTabs(); render(); syncColor(); $('matDlg').showModal();
  };
  $('matColor').onchange = () => { cur = { m: cur.m, c: $('matColor').value }; cb({ m: cur.m, c: cur.c }); };
  $('matReset').onclick = () => { cur = { m: cur.m, c: null }; cb({ m: cur.m, c: null }); syncColor(); };
  $('matClose').onclick = () => $('matDlg').close();
})();
