(function () {
  FP.ui = {};

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

  FP.uiForm = { el, row, edit, numIn, textIn, selIn, chkIn, colorBlock, btn };
})();
