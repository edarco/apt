(function () {
  const cv = FP.$('c2d'), c = cv.getContext('2d');
  const V = FP.v2 = { s: 60, ox: 120, oy: 90, tool: 'select', lock: false };

  const LIGHT = { bg: '#faf8f4', g1: '#ddd7ca', g2: '#eee9df', wall: '#2f2f33', lblBg: 'rgba(255,255,255,.88)', lblTx: '#222', room1: '#333', room2: '#555', door: '#555' };
  const DARK  = { bg: '#3E3838', g1: '#5f636f', g2: '#555965', wall: '#010101', lblBg: 'rgba(37,38,43,.92)', lblTx: '#eee', room1: '#eee', room2: '#bbb', door: '#b8b6b6' };
  let C = LIGHT; const theme = () => { const m = V.canvasTheme || 'auto'; return (m === 'dark' || (m === 'auto' && document.documentElement.dataset.theme === 'dark')) ? DARK : LIGHT; };

  let W = 1, H = 1, dpr = 1, drag = null, tmp = null, hover = null, meas = null, space = false, rafP = 0, CF = new Map(), note = '';
  const sx = x => V.ox + x * V.s, sy = y => V.oy + y * V.s, wx = p => (p - V.ox) / V.s, wy = p => (p - V.oy) / V.s;
  const set = () => FP.data.settings;
  const P = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const snv = (v, e) => { if (e && e.altKey) return v; const k = set().snap; return +(Math.round(v / k) * k).toFixed(4); };
  V.center = () => ({ x: wx(W / 2), y: wy(H / 2) });
  V.setTool = function (t) {
    V.tool = t; tmp = null; hover = null;
    cv.style.cursor = V.lock ? 'grab' : ({ select: 'default', pan: 'grab', measure: 'crosshair' }[t] || 'crosshair');
    document.querySelectorAll('#tools button[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    V.draw();
  };
  V.setLock = function (v) {                         // true: левая кнопка/палец только двигают план
    V.lock = !!v;
    cv.style.cursor = V.lock ? 'grab' : ({ select: 'default', pan: 'grab', measure: 'crosshair' }[V.tool] || 'crosshair');
    document.querySelectorAll('[data-lock]').forEach(b => b.classList.toggle('on', V.lock));
  };
  function resize() {
    const r = cv.parentElement.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); V.draw();
  }
  new ResizeObserver(resize).observe(cv.parentElement);

  V.fit = function () {
    const f = FP.floor(); const xs = [], ys = [];
    f.rooms.forEach(r => { xs.push(r.x, r.x + r.width); ys.push(r.y, r.y + r.depth); });
    f.walls.forEach(w => { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); });
    f.furniture.forEach(m => { xs.push(m.x); ys.push(m.y); });
    if (!xs.length) { V.s = 60; V.ox = 120; V.oy = 90; V.draw(); return; }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    V.s = Math.max(8, Math.min(250, Math.min((W - 120) / Math.max(.5, x1 - x0), (H - 120) / Math.max(.5, y1 - y0))));
    V.ox = (W - (x1 - x0) * V.s) / 2 - x0 * V.s; V.oy = (H - (y1 - y0) * V.s) / 2 - y0 * V.s; V.draw();
  };
  V.panBy = function (dx, dy) { V.ox += dx; V.oy += dy; V.draw(); };

  let hl = null; V.hl = h => { hl = h; V.draw(); };      // подсветка вершины/стороны i из панели свойств

  // ---------- хит-тесты ----------
  function segProj(px, py, w) {
    const L = FP.wlen(w); if (L < 1e-6) return { d: Math.hypot(px - w.x1, py - w.y1), t: 0 };
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, t = Math.max(0, Math.min(L, (px - w.x1) * ux + (py - w.y1) * uy));
    return { d: Math.hypot(px - (w.x1 + ux * t), py - (w.y1 + uy * t)), t };
  }
  function ptSnap(x, y, skip) {
    const f = FP.floor(), tol = 10 / V.s; let best = null, bd = tol;
    const test = (px, py) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x: px, y: py }; } };
    f.rooms.forEach(r => {
      if (r === skip) return;
      if (r.poly) r.poly.forEach(q => test(q[0], q[1])); else { test(r.x, r.y); test(r.x + r.width, r.y); test(r.x, r.y + r.depth); test(r.x + r.width, r.y + r.depth); }
    });
    f.walls.forEach(w => { test(w.x1, w.y1); test(w.x2, w.y2); });
    return best;
  }
  function hitTest(x, y) {
    const f = FP.floor(), tol = 6 / V.s, walls = FP.getWalls(f);
    for (const o of f.openings) {
      const w = walls.find(q => q.id === o.wallId); if (!w) continue;
      const p = FP.openPos(w, o), dx = x - p.cx, dy = y - p.cy;
      const al = dx * p.ux + dy * p.uy, ac = -dx * p.uy + dy * p.ux;
      if (Math.abs(al) <= o.width / 2 + tol && Math.abs(ac) <= Math.max(w.t / 2, .1) + tol) return { type: 'opening', id: o.id };
    }
    for (let i = f.furniture.length - 1; i >= 0; i--) {
      const m = f.furniture[i];
      if (FP.footRects(m).some(q => { const dx = x - q.cx, dy = y - q.cy; return Math.abs(dx * q.ux + dy * q.uy) <= Math.max(q.hl, 8 / V.s) && Math.abs(-dx * q.uy + dy * q.ux) <= Math.max(q.ht, 8 / V.s); })) return { type: 'furniture', id: m.id };
    }
    for (const w of f.walls) if (segProj(x, y, w).d <= Math.max((w.thickness || f.thickness) / 2, tol)) return { type: 'wall', id: w.id };
    let best = null, ba = 1e9;
    f.rooms.forEach(r => { if (FP.pointInRoom(r, x, y) && FP.roomArea(r) < ba) { ba = FP.roomArea(r); best = { type: 'room', id: r.id }; } });
    return best;
  }
  function handleHit(px, py) {
    const o = FP.selObj(); if (!o) return null; const r = 9;
    if (FP.sel.type === 'room') {
      if (o.poly) {
        for (let i = 0; i < o.poly.length; i++) if (Math.hypot(px - sx(o.poly[i][0]), py - sy(o.poly[i][1])) <= r) return { kind: 'pv', i };
        for (let i = 0; i < o.poly.length; i++) { const a = o.poly[i], b = o.poly[(i + 1) % o.poly.length]; if (Math.hypot(px - sx((a[0] + b[0]) / 2), py - sy((a[1] + b[1]) / 2)) <= 7) return { kind: 'pm', i }; }
        return null;
      }
      for (const [cx, cy, n] of [[o.x, o.y, 'tl'], [o.x + o.width, o.y, 'tr'], [o.x, o.y + o.depth, 'bl'], [o.x + o.width, o.y + o.depth, 'br']])
        if (Math.hypot(px - sx(cx), py - sy(cy)) <= r) return { kind: 'corner', c: n };
    } else if (FP.sel.type === 'wall') {
      if (Math.hypot(px - sx(o.x1), py - sy(o.y1)) <= r) return { kind: 'wend', end: 1 };
      if (Math.hypot(px - sx(o.x2), py - sy(o.y2)) <= r) return { kind: 'wend', end: 2 };
    } else if (FP.sel.type === 'furniture') {
      const h = o.depth / 2 + 0.4 * (60 / V.s > 1 ? 1 : 1), a = (o.rotation || 0) * Math.PI / 180;
      if (Math.hypot(px - sx(o.x + h * Math.sin(a)), py - sy(o.y - h * Math.cos(a))) <= r) return { kind: 'rot' };
    }
    return null;
  }

  // ---------- рисование ----------
  function lbl(text, px, py, rot) {
    c.save(); c.translate(px, py); if (rot) c.rotate(rot); c.font = '11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 8; c.fillStyle = C.lblBg; c.fillRect(-w / 2, -8, w, 16); c.fillStyle = C.lblTx; c.fillText(text, 0, 0); c.restore();
  }
  function drawOpening(w, o, alpha) {
    const p = FP.openPos(w, o), s = V.s, len = o.width * s, ht = Math.max(w.t * s / 2, 2) + 1.5;
    c.save(); c.globalAlpha = alpha || 1; c.translate(sx(p.sx), sy(p.sy)); c.rotate(Math.atan2(p.uy, p.ux));
    c.fillStyle = C.bg; c.fillRect(0, -ht, len, 2 * ht);
    if (o.kind === 'window') {
      c.strokeStyle = '#2f78d0'; c.lineWidth = 1.5; c.strokeRect(0, -ht * .55, len, ht * 1.1);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(len, 0); c.stroke();
    } else if (o.kind === 'gap') {            // проём без двери: пунктир по краям
      c.strokeStyle = '#888'; c.lineWidth = 1; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(0, -ht); c.lineTo(0, ht); c.moveTo(len, -ht); c.lineTo(len, ht); c.stroke(); c.setLineDash([]);
    } else { // дверь
      const perp = p.nx * (-p.uy) + p.ny * p.ux, ly = (perp >= 0 ? 1 : -1) * (o.swing === -1 ? -1 : 1);
      const hx = o.flip ? len : 0, a1 = o.flip ? Math.PI : 0, d = o.flip ? -ly : ly, a2 = a1 + d * Math.PI / 2;

      c.strokeStyle = C.door; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx, 0);
      if (o.open) c.lineTo(hx, ly * len); else c.lineTo(o.flip ? 0 : len, 0);      // открытая: полотно под 90°, закрытая: вдоль стены
      c.stroke();

      c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.arc(hx, 0, len, a1, a2, d < 0); c.stroke(); c.setLineDash([]);
    }
    c.restore();
  }
  // условные значки: розетка / выключатель / светильник (фиксированный размер в пикселях)
  function drawSym(m, sym) {
    c.save(); c.translate(sx(m.x), sy(m.y)); c.rotate((m.rotation || 0) * Math.PI / 180);
    c.strokeStyle = { outlet: '#c05a00', switch: '#1e6fbf', light: '#d19a00' }[sym]; c.fillStyle = (sym === 'light' && m.on !== false) ? '#ffe9a0' : '#fff'; c.lineWidth = 1.8; c.beginPath();
    if (sym === 'switch') c.rect(-6, -6, 12, 12); else c.arc(0, 0, sym === 'light' ? 9 : 6, 0, 7);
    c.fill(); c.stroke(); c.beginPath();
    if (sym === 'light') { c.moveTo(-6, -6); c.lineTo(6, 6); c.moveTo(6, -6); c.lineTo(-6, 6); }
    else if (sym === 'outlet') { c.moveTo(-2.5, -2); c.lineTo(-2.5, 2); c.moveTo(2.5, -2); c.lineTo(2.5, 2); }
    else { c.moveTo(0, -3); c.lineTo(0, 3); }
    c.stroke(); c.restore();
  }
  function drawFurn(m) {
    const s = V.s, w = m.width * s, d = m.depth * s;
    const M = FP.model(m); if (M && M.sym) { drawSym(m, M.sym); return; }
    c.save(); c.translate(sx(m.x), sy(m.y)); c.rotate((m.rotation || 0) * Math.PI / 180); if (m.flipX) c.scale(-1, 1);
    const round = (M && (M.plan === 'round' || M.plan === 'oval')) || m.kind === 'plant' || m.kind === 'roundtable';
    const hi = M && (M.ceil || (m.elev != null ? m.elev : (M.elev || 0)) > 0.3);       // навесное / потолочное: пунктир
    c.fillStyle = m.color || '#bbb'; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.globalAlpha = m.kind === 'rug' ? .75 : hi ? .55 : 1;

    if (hi) c.setLineDash([4, 3]);
    c.beginPath();
    if (round) c.ellipse(0, 0, w / 2, d / 2, 0, 0, 7);
    else if (M && M.outline) { const kx = m.width / M.w, kz = m.depth / M.d; M.outline.forEach((q, i) => { const X = q[0] * kx * s, Y = q[1] * kz * s; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); }   // Г-образный диван
    else c.rect(-w / 2, -d / 2, w, d);
    c.fill(); c.globalAlpha = 1; c.stroke(); c.setLineDash([]);
    if (CF.has(m.id)) { c.fillStyle = 'rgba(224,32,31,.28)'; c.fill(); c.strokeStyle = '#e0201f'; c.lineWidth = 2.5; c.stroke(); }   // конфликт: красным

    c.strokeStyle = 'rgba(0,0,0,.35)';
    const E = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.stroke(); };
    const R = (x, y, a, b) => c.strokeRect(x, y, a, b);
    const Ln = (a, b, cc, dd) => { c.beginPath(); c.moveTo(a, b); c.lineTo(cc, dd); c.stroke(); };
    switch (m.kind) {
      case 'bed':
        if (m.width < 1.35) R(-w * .35, -d / 2 + d * .04, w * .7, d * .14);
        else { R(-w / 2 + w * .06, -d / 2 + d * .04, w * .4, d * .14); R(w / 2 - w * .46, -d / 2 + d * .04, w * .4, d * .14); }
        Ln(-w / 2, -d / 2 + d * .3, w / 2, -d / 2 + d * .3); break;
      case 'sofa': case 'armchair': R(-w / 2, -d / 2, w, d * .25); break;
      case 'sofa_l': R(-w / 2, -d / 2, w, d * .126); break;
      case 'chair': Ln(-w / 2, -d / 2 + d * .2, w / 2, -d / 2 + d * .2); break;
      case 'bath': R(-w / 2 + w * .1, -d / 2 + d * .08, w * .8, d * .84); break;
      case 'sink': E(0, 0, w * .32, d * .3); break;
      case 'toilet': R(-w / 2, -d / 2, w, d * .3); E(0, d * .15, w * .35, d * .3); break;
      case 'stove': [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]].forEach(q => E(q[0] * w, q[1] * d, w * .15, d * .15)); break;
      case 'plant': E(0, 0, w * .22, d * .22); break;
      case 'shower': Ln(-w / 2, -d / 2, w / 2, d / 2); Ln(w / 2, -d / 2, -w / 2, d / 2); break;
      case 'washer': E(0, 0, w * .3, d * .3); break;
    }
    c.restore();
    if (w > 42) { c.fillStyle = '#222'; c.font = '10px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.name.length > 16 ? m.name.slice(0, 15) + '…' : m.name, sx(m.x), sy(m.y)); }
  }

  function polyPath(pts) { c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(sx(q[0]), sy(q[1])) : c.moveTo(sx(q[0]), sy(q[1]))); c.closePath(); }
  function polyDims(r) {                              // длины сторон многоугольника (снаружи контура)
    const P = r.poly, sg = FP.polySign(P);
    P.forEach((a, i) => {
      const b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L * V.s < 36) return;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, off = (FP.inner() ? FP.wt(r, 'p' + i) : 0) + 14 / V.s;
      lbl(L.toFixed(2), sx((a[0] + b[0]) / 2 + uy * sg * off), sy((a[1] + b[1]) / 2 - ux * sg * off));
    });
  }
  function polyPt(e) {                                // точка для инструмента «Многоугольник»
    let x = snv(V.mx, e), y = snv(V.my, e); const q = ptSnap(V.mx, V.my); if (q && !e.altKey) { x = q.x; y = q.y; }
    if (e.shiftKey && tmp && tmp.pts) { const l = tmp.pts[tmp.pts.length - 1]; if (Math.abs(V.mx - l[0]) > Math.abs(V.my - l[1])) y = l[1]; else x = l[0]; }
    return { x, y };
  }
  function finishPoly() {
    if (!tmp || !tmp.pts || tmp.pts.length < 3) { tmp = null; V.draw(); return; }
    FP.snap(); const f = FP.floor();
    const r = { id: FP.uid(), name: 'Комната ' + (f.rooms.length + 1), x: 0, y: 0, width: 1, depth: 1, poly: tmp.pts.map(q => q.slice()), material: 'oak', color: '#c19a6b', floor: { m: 'lam_oak_nat', c: null } };
    FP.fixPoly(r); f.rooms.push(r); tmp = null; V.setTool('select'); FP.select('room', r.id); FP.changed();
  }

  const patC = new Map();
  function floorPat(spec) {
    const P = FP.MAT.get(spec.m); if (!P.tex) return null;
    const k = P.id + '|' + (spec.c || P.c); let e = patC.get(k);
    if (!e) { const r = FP.MAT.canvasFor(P, spec.c || null, 256); e = { pat: c.createPattern(r.cv, 'repeat'), tw: r.tw, th: r.th }; patC.set(k, e); }
    return e;
  }

  V.draw = function () {
    if (!FP.data) return;
    C = theme(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
    const f = FP.floor(), s = V.s, walls = FP.getWalls(f), sel = FP.sel, so = FP.selObj();
    const MI = FP.mergeInfo(f, walls), MA = FP.mergeAreas(f, walls), GC = {};

    f.rooms.forEach(q => { if (q.merge) GC[q.merge] = (GC[q.merge] || 0) + 1; });
    CF = set().showConf === false ? new Map() : FP.conflicts(f, walls);
    const step = s >= 90 ? .25 : s >= 35 ? .5 : 1; c.lineWidth = 1;

    for (let x = Math.floor(wx(0) / step) * step; x <= wx(W); x += step) { c.strokeStyle = Math.abs(x - Math.round(x)) < 1e-6 ? C.g1 : C.g2; c.beginPath(); c.moveTo(Math.round(sx(x)) + .5, 0); c.lineTo(Math.round(sx(x)) + .5, H); c.stroke(); }
    for (let y = Math.floor(wy(0) / step) * step; y <= wy(H); y += step) { c.strokeStyle = Math.abs(y - Math.round(y)) < 1e-6 ? C.g1 : C.g2; c.beginPath(); c.moveTo(0, Math.round(sy(y)) + .5); c.lineTo(W, Math.round(sy(y)) + .5); c.stroke(); }

    f.rooms.forEach(r => {
      const fill = () => { if (r.poly) { polyPath(r.poly); c.fill(); } else c.fillRect(sx(r.x), sy(r.y), r.width * s, r.depth * s); };
      c.fillStyle = r.color; fill();
      if (set().planTex) {                                  // текстура пола на плане
        const e = floorPat(FP.floorSpec(r));
        if (e) { const kx = e.tw * s / 256, ky = e.th * s / 256; e.pat.setTransform(new DOMMatrix(r.floorRot === 90 ? [0, kx, ky, 0, V.ox, V.oy] : [kx, 0, 0, ky, V.ox, V.oy])); c.fillStyle = e.pat; fill(); }
      }
    });

    MI.bridges.forEach(b => { c.fillStyle = c.strokeStyle = b.room.color; c.lineWidth = 1.5; polyPath(b.pts); c.fill(); c.stroke(); });   // пол на месте убранной стены

    f.rooms.forEach(r => {
      c.fillStyle = C.room1; c.textAlign = 'center'; c.textBaseline = 'middle';
      let px, py, lw;
      if (r.poly) { const q = FP.labelPos(r); px = sx(q.x); py = sy(q.y) - 8; lw = q.w; } else { px = sx(r.x + r.width / 2); py = sy(r.y) + 16; lw = r.width; }
      if (lw * s > 60) {
        c.font = 'bold 12px system-ui'; c.fillText(r.name, px, py);
        c.font = '11px system-ui'; c.fillStyle = C.room2; c.fillText(FP.roomArea(r).toFixed(2) + ' м²', px, py + 15);
        if (r.merge && GC[r.merge] > 1 && MA[r.merge] != null) { c.fillStyle = '#b5400f'; c.fillText('Σ ' + MA[r.merge].toFixed(2) + ' м²', px, py + 30); }   // площадь объединённой зоны
      }
    });

    walls.forEach(w => {
      const L = FP.wlen(w), a = Math.atan2(w.y2 - w.y1, w.x2 - w.x1), th = w.rail ? Math.max(2, .05 * s) : Math.max(1.5, w.t * s);
      c.save(); c.translate(sx(w.x1), sy(w.y1)); c.rotate(a); c.fillStyle = w.rail ? '#6f8aa3' : C.wall;
      const segs = [], ms = MI.spans.get(w.id) || []; let cur = -w.e1;
      ms.forEach(q => { if (q[0] > .0005 && q[0] > cur) segs.push([cur, q[0]]); cur = Math.max(cur, q[1]); });
      if (cur < L - .0005) segs.push([cur, L + w.e2]);
      segs.forEach(q => c.fillRect(q[0] * s, -th / 2, (q[1] - q[0]) * s, th));
      if (w.rail) { c.fillStyle = '#4d6377'; const nn = Math.max(1, Math.round(L)); for (let i = 0; i <= nn; i++) c.fillRect(L * i / nn * s - 2, -4, 4, 8); }
      c.restore();
    });

    f.openings.forEach(o => { const w = walls.find(q => q.id === o.wallId); if (w) drawOpening(w, o); });
    [...f.furniture].sort((a, b) => (b.kind === 'rug') - (a.kind === 'rug')).forEach(drawFurn);

    // размеры
    if (set().dims) {

      f.rooms.forEach(r => {
        if (r.poly) { polyDims(r); return; }
        const tn = FP.inner() ? FP.wt(r, 'n') : 0, tw = FP.inner() ? FP.wt(r, 'w') : 0;
        lbl(r.width.toFixed(2), sx(r.x + r.width / 2), sy(r.y) - 12 - tn * V.s);
        lbl(r.depth.toFixed(2), sx(r.x) - 14 - tw * V.s, sy(r.y + r.depth / 2), -Math.PI / 2);
      });

      f.walls.forEach(w => lbl(FP.wlen(w).toFixed(2), sx((w.x1 + w.x2) / 2), sy((w.y1 + w.y2) / 2) - 12));
    } else if (so && sel.type === 'room') {
      lbl(so.width.toFixed(2), sx(so.x + so.width / 2), sy(so.y) - 12); lbl(so.depth.toFixed(2), sx(so.x) - 14, sy(so.y + so.depth / 2), -Math.PI / 2);
    } else if (so && sel.type === 'wall') lbl(FP.wlen(so).toFixed(2), sx((so.x1 + so.x2) / 2), sy((so.y1 + so.y2) / 2) - 12);

    // выделение
    const ACC = '#e0451f';
    if (so) {
      c.strokeStyle = ACC; c.fillStyle = '#fff'; c.lineWidth = 2; c.setLineDash([6, 4]);

      if (sel.type === 'room') {
        if (so.poly) {
          polyPath(so.poly); c.stroke(); c.setLineDash([]);
          so.poly.forEach((q, i) => { const b = so.poly[(i + 1) % so.poly.length]; c.beginPath(); c.arc(sx((q[0] + b[0]) / 2), sy((q[1] + b[1]) / 2), 4, 0, 7); c.stroke(); c.beginPath(); c.rect(sx(q[0]) - 5, sy(q[1]) - 5, 10, 10); c.fill(); c.stroke(); });
          so.poly.forEach((q, i) => lbl('В' + (i + 1), sx(q[0]) + 16, sy(q[1]) - 14));   // номера вершин
          if (hl && so.poly[hl.i]) {                                                    // подсветка выбранной в панели вершины и стороны
            const a = so.poly[hl.i], b = so.poly[(hl.i + 1) % so.poly.length];
            c.strokeStyle = '#1e6fbf'; c.fillStyle = '#1e6fbf'; c.lineWidth = 5;
            c.beginPath(); c.moveTo(sx(a[0]), sy(a[1])); c.lineTo(sx(b[0]), sy(b[1])); c.stroke();
            c.beginPath(); c.arc(sx(a[0]), sy(a[1]), 8, 0, 7); c.fill(); c.lineWidth = 2;
          }
        } else {
          c.strokeRect(sx(so.x), sy(so.y), so.width * s, so.depth * s); c.setLineDash([]);
          [[so.x, so.y], [so.x + so.width, so.y], [so.x, so.y + so.depth], [so.x + so.width, so.y + so.depth]].forEach(q => { c.beginPath(); c.rect(sx(q[0]) - 5, sy(q[1]) - 5, 10, 10); c.fill(); c.stroke(); });
        }
      } else if (sel.type === 'wall') {
        c.setLineDash([]); c.lineWidth = Math.max(3, (so.thickness || f.thickness) * s + 2); c.globalAlpha = .45; c.beginPath(); c.moveTo(sx(so.x1), sy(so.y1)); c.lineTo(sx(so.x2), sy(so.y2)); c.stroke(); c.globalAlpha = 1; c.lineWidth = 2;
        [[so.x1, so.y1], [so.x2, so.y2]].forEach(q => { c.beginPath(); c.arc(sx(q[0]), sy(q[1]), 6, 0, 7); c.fill(); c.stroke(); });
      } else if (sel.type === 'opening') {
        const w = walls.find(q => q.id === so.wallId);
        if (w) { const p = FP.openPos(w, so); c.setLineDash([]); c.save(); c.translate(sx(p.sx), sy(p.sy)); c.rotate(Math.atan2(p.uy, p.ux)); const ht = Math.max(w.t * s / 2, 2) + 4; c.strokeRect(-2, -ht, so.width * s + 4, ht * 2); c.restore(); }
      } else if (sel.type === 'furniture') {
        c.save(); c.translate(sx(so.x), sy(so.y)); c.rotate((so.rotation || 0) * Math.PI / 180); c.strokeRect(-so.width * s / 2 - 2, -so.depth * s / 2 - 2, so.width * s + 4, so.depth * s + 4); c.setLineDash([]);
        const h = (so.depth / 2 + .4) * s; c.beginPath(); c.moveTo(0, -so.depth * s / 2); c.lineTo(0, -h); c.stroke(); c.beginPath(); c.arc(0, -h, 6, 0, 7); c.fill(); c.stroke(); c.restore();
      }
      c.setLineDash([]);
    }
    // предпросмотры
    if (tmp && V.tool === 'room') {
      const x = Math.min(tmp.x0, tmp.x1), y = Math.min(tmp.y0, tmp.y1), w = Math.abs(tmp.x1 - tmp.x0), h = Math.abs(tmp.y1 - tmp.y0);
      c.fillStyle = 'rgba(224,69,31,.12)'; c.strokeStyle = ACC; c.lineWidth = 2; c.fillRect(sx(x), sy(y), w * s, h * s); c.strokeRect(sx(x), sy(y), w * s, h * s);
      lbl(w.toFixed(2) + ' × ' + h.toFixed(2) + ' = ' + (w * h).toFixed(2) + ' м²', sx(x + w / 2), sy(y + h / 2));
    }
    if (tmp && V.tool === 'wall') {
      c.strokeStyle = ACC; c.lineWidth = Math.max(2, f.thickness * s); c.globalAlpha = .6; c.beginPath(); c.moveTo(sx(tmp.x0), sy(tmp.y0)); c.lineTo(sx(tmp.x1), sy(tmp.y1)); c.stroke(); c.globalAlpha = 1;
      const L = Math.hypot(tmp.x1 - tmp.x0, tmp.y1 - tmp.y0), ang = Math.atan2(tmp.y1 - tmp.y0, tmp.x1 - tmp.x0) * 180 / Math.PI;
      lbl(L.toFixed(2) + ' м  ' + ang.toFixed(0) + '°', sx((tmp.x0 + tmp.x1) / 2), sy((tmp.y0 + tmp.y1) / 2) - 14);
    }

    if (tmp && V.tool === 'poly' && tmp.pts) {
      c.fillStyle = 'rgba(224,69,31,.12)'; c.strokeStyle = ACC; c.lineWidth = 2; c.beginPath();
      tmp.pts.forEach((q, i) => i ? c.lineTo(sx(q[0]), sy(q[1])) : c.moveTo(sx(q[0]), sy(q[1]))); c.lineTo(sx(tmp.cur[0]), sy(tmp.cur[1])); c.fill(); c.stroke();
      tmp.pts.forEach(q => { c.beginPath(); c.arc(sx(q[0]), sy(q[1]), 4, 0, 7); c.fillStyle = ACC; c.fill(); });
      const l = tmp.pts[tmp.pts.length - 1]; lbl(Math.hypot(tmp.cur[0] - l[0], tmp.cur[1] - l[1]).toFixed(2) + ' м', sx((l[0] + tmp.cur[0]) / 2), sy((l[1] + tmp.cur[1]) / 2) - 12);
    }
    if ((V.tool === 'door' || V.tool === 'window' || V.tool === 'gap') && hover) drawOpening(hover.w, hover.o, .6);
    if (meas) {
      c.strokeStyle = '#7a2fd0'; c.fillStyle = '#7a2fd0'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx(meas.a.x), sy(meas.a.y)); c.lineTo(sx(meas.b.x), sy(meas.b.y)); c.stroke();
      [meas.a, meas.b].forEach(q => { c.beginPath(); c.arc(sx(q.x), sy(q.y), 4, 0, 7); c.fill(); });
      lbl(Math.hypot(meas.b.x - meas.a.x, meas.b.y - meas.a.y).toFixed(3) + ' м', sx((meas.a.x + meas.b.x) / 2), sy((meas.a.y + meas.b.y) / 2) - 12);
    }
    const st = FP.$('status');

    st.textContent = (note ? note + ' · ' : '') + `x ${(V.mx || 0).toFixed(2)}  y ${(V.my || 0).toFixed(2)} м · сетка ${set().snap} м · комнат ${f.rooms.length} · площадь ${FP.unionArea(f.rooms).toFixed(2)} м²` + (CF.size ? ` · ⚠ конфликтов: ${CF.size}` : '');
  };

  // ---------- мышь ----------
  function wallEnd(e) {
    let x = snv(V.mx, e), y = snv(V.my, e);
    const q = ptSnap(V.mx, V.my); if (q && !e.altKey) { x = q.x; y = q.y; }
    if (e.shiftKey && tmp) {
      const dx = V.mx - tmp.x0, dy = V.my - tmp.y0, L = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
      const Ls = snv(L, e); x = +(tmp.x0 + Math.cos(a) * Ls).toFixed(4); y = +(tmp.y0 + Math.sin(a) * Ls).toFixed(4);
    }
    return { x, y };
  }
  function magnet(r, nx, ny) {
    const thr = 10 / V.s, inn = FP.inner(); let bx = null, by = null, dxm = thr, dym = thr;
    FP.floor().rooms.forEach(o => {
      if (o === r) return;
      const gxR = inn ? Math.max(FP.wt(o, 'e'), FP.wt(r, 'w')) : 0, gxL = inn ? Math.max(FP.wt(r, 'e'), FP.wt(o, 'w')) : 0;
      const gyB = inn ? Math.max(FP.wt(o, 's'), FP.wt(r, 'n')) : 0, gyT = inn ? Math.max(FP.wt(r, 's'), FP.wt(o, 'n')) : 0;
      [o.x - r.width - gxL, o.x + o.width + gxR, o.x, o.x + o.width - r.width].forEach(cx => { const d = Math.abs(nx - cx); if (d < dxm) { dxm = d; bx = cx; } });
      [o.y - r.depth - gyT, o.y + o.depth + gyB, o.y, o.y + o.depth - r.depth].forEach(cy => { const d = Math.abs(ny - cy); if (d < dym) { dym = d; by = cy; } });
    });
    return { x: bx != null ? bx : nx, y: by != null ? by : ny };
  }
  const schedProps = () => { if (rafP) return; rafP = requestAnimationFrame(() => { rafP = 0; FP.ui && FP.ui.props(); }); };

  cv.addEventListener('contextmenu', e => e.preventDefault());

  const ptrs = new Map(); let pinch = null;
  const pinchSt = () => { const a = [...ptrs.values()], r = cv.getBoundingClientRect(); return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, cx: (a[0].x + a[1].x) / 2 - r.left, cy: (a[0].y + a[1].y) / 2 - r.top }; };
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size >= 2) { drag = null; tmp = null; if (ptrs.size === 2) pinch = Object.assign(pinchSt(), { s: V.s, ox: V.ox, oy: V.oy }); e.stopImmediatePropagation(); }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {                        // щипок: масштаб + сдвиг двумя пальцами
      const now = pinchSt(), ns = Math.max(8, Math.min(400, pinch.s * now.d / pinch.d)), wx0 = (pinch.cx - pinch.ox) / pinch.s, wy0 = (pinch.cy - pinch.oy) / pinch.s;
      V.s = ns; V.ox = now.cx - wx0 * ns; V.oy = now.cy - wy0 * ns; V.draw(); e.stopImmediatePropagation();
    }
  });
  const ptrEnd = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
  cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd);

  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); const p = P(e), x = wx(p.x), y = wy(p.y); V.mx = x; V.my = y;
    if (e.button === 1 || e.button === 2 || V.tool === 'pan' || space || V.lock) { drag = { mode: 'pan', px: p.x, py: p.y, ox: V.ox, oy: V.oy }; cv.style.cursor = 'grabbing'; return; }
    const f = FP.floor();
    switch (V.tool) {
      case 'room': tmp = { x0: snv(x, e), y0: snv(y, e), x1: snv(x, e), y1: snv(y, e) }; drag = { mode: 'draw' }; return;
      case 'wall': {
        if (!tmp) { const q = wallEnd(e); tmp = { x0: q.x, y0: q.y, x1: q.x, y1: q.y }; }
        else {
          const q = wallEnd(e);
          if (Math.hypot(q.x - tmp.x0, q.y - tmp.y0) > 0.05) {
            FP.snap(); const nw = { id: FP.uid(), x1: tmp.x0, y1: tmp.y0, x2: q.x, y2: q.y, thickness: f.thickness };
            f.walls.push(nw); tmp = { x0: q.x, y0: q.y, x1: q.x, y1: q.y }; FP.select('wall', nw.id); FP.changed();
          }
        }
        V.draw(); return;
      }
      case 'poly': {
        const q = polyPt(e);
        if (!tmp || !tmp.pts) tmp = { pts: [[q.x, q.y]], cur: [q.x, q.y] };
        else {
          const f0 = tmp.pts[0], last = tmp.pts[tmp.pts.length - 1];
          if (tmp.pts.length >= 3 && Math.hypot(sx(q.x) - sx(f0[0]), sy(q.y) - sy(f0[1])) < 10) { finishPoly(); return; }
          if (Math.hypot(q.x - last[0], q.y - last[1]) > .02) tmp.pts.push([q.x, q.y]);
        }
        V.draw(); return;
      }
      case 'door': case 'window': case 'gap':
        if (hover) { FP.addOpening(hover.w.id, V.tool, hover.o.offset); hover = null; } return;
      case 'measure': {
        const q = ptSnap(x, y) || { x: snv(x, e), y: snv(y, e) };
        if (!meas || meas.done) meas = { a: q, b: q, done: false }; else meas.done = true;
        V.draw(); return;
      }
    }
    // выбор
    const hh = handleHit(p.x, p.y);
    if (hh) {
      const o = FP.selObj();
      if (hh.kind === 'pm') {                           // «+» на стороне: добавить вершину и сразу тащить её
        FP.snap(); const a = o.poly[hh.i], b = o.poly[(hh.i + 1) % o.poly.length];
        FP.polyInsert(o, hh.i, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        drag = { mode: 'pv', i: hh.i + 1, o: JSON.parse(JSON.stringify(o)), moved: true }; FP.changed(); return;
      }
      if (hh.kind === 'pv' && e.shiftKey) { if (o.poly.length > 3) { FP.snap(); FP.polyRemove(o, hh.i); FP.changed(); } return; }
      drag = Object.assign({ mode: hh.kind, o: JSON.parse(JSON.stringify(o)), moved: false }, hh); return;
    }

    const h = hitTest(x, y);
    if (!h) {                                   // клик по пустому месту: сбросить выбор и тащить холст
      FP.select(null);
      drag = { mode: 'pan', px: p.x, py: p.y, ox: V.ox, oy: V.oy };
      cv.style.cursor = 'grabbing';
      V.draw();
      return;
    }
    FP.select(h.type, h.id);

    const o = FP.selObj();
    if (o) {
      drag = { mode: 'move', type: FP.sel.type, sx: x, sy: y, o: JSON.parse(JSON.stringify(o)), moved: false };
      if (FP.sel.type === 'room') drag.furn = FP.furnInRoom(f, o).map(m => ({ id: m.id, x: m.x, y: m.y }));
    }
    V.draw();
  });
  cv.addEventListener('pointermove', e => {
    const p = P(e), x = wx(p.x), y = wy(p.y); V.mx = x; V.my = y;
    if (drag) {
      if (drag.mode === 'pan') { V.ox = drag.ox + p.x - drag.px; V.oy = drag.oy + p.y - drag.py; V.draw(); return; }
      if (drag.mode === 'draw') { tmp.x1 = snv(x, e); tmp.y1 = snv(y, e); V.draw(); return; }
      const o = FP.selObj(); if (!o) return;
      if (!drag.moved) { FP.snap(); drag.moved = true; }
      const f = FP.floor();
      if (drag.mode === 'move') {
        const dx = x - drag.sx, dy = y - drag.sy;
        if (drag.type === 'room') {
          let nx = snv(drag.o.x + dx, e), ny = snv(drag.o.y + dy, e);
          if (!e.altKey) { const m = magnet(o, nx, ny); nx = m.x; ny = m.y; }
          if (FP.settings().moveFurn) drag.furn.forEach(q => { const m = f.furniture.find(z => z.id === q.id); if (m) { m.x = q.x + nx - drag.o.x; m.y = q.y + ny - drag.o.y; } });
          if (drag.o.poly) o.poly = drag.o.poly.map(q => [q[0] + nx - drag.o.x, q[1] + ny - drag.o.y]);
          o.x = nx; o.y = ny;
        } else if (drag.type === 'wall') {
          const ddx = snv(dx, e), ddy = snv(dy, e); o.x1 = drag.o.x1 + ddx; o.x2 = drag.o.x2 + ddx; o.y1 = drag.o.y1 + ddy; o.y2 = drag.o.y2 + ddy;
        } else if (drag.type === 'furniture') { o.x = snv(drag.o.x + dx, e); o.y = snv(drag.o.y + dy, e); if (!e.altKey) FP.wallSnap(o); }
        else if (drag.type === 'opening') {
          const w = FP.getWalls(f).find(q => q.id === o.wallId);
          if (w) { const L = FP.wlen(w), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, pr = (x - w.x1) * ux + (y - w.y1) * uy; o.offset = Math.max(0, Math.min(L - o.width, snv(pr - o.width / 2, e))); delete o.k; }
        }
      } else if (drag.mode === 'corner') {
        const od = drag.o, fx = drag.c.includes('l') ? od.x + od.width : od.x, fy = drag.c.includes('t') ? od.y + od.depth : od.y;
        let mx = snv(x, e), my = snv(y, e), nw = Math.abs(mx - fx), nd = Math.abs(my - fy);
        if (nw < .3) { nw = .3; mx = fx + (mx < fx ? -.3 : .3); } if (nd < .3) { nd = .3; my = fy + (my < fy ? -.3 : .3); }
        o.x = Math.min(fx, mx); o.y = Math.min(fy, my); o.width = nw; o.depth = nd;
      } else if (drag.mode === 'wend') {
        let nx = snv(x, e), ny = snv(y, e); const q = ptSnap(x, y); if (q && !e.altKey) { nx = q.x; ny = q.y; }
        if (e.shiftKey) { const ox = drag.end === 1 ? o.x2 : o.x1, oy = drag.end === 1 ? o.y2 : o.y1, L = Math.hypot(x - ox, y - oy), a = Math.round(Math.atan2(y - oy, x - ox) / (Math.PI / 4)) * Math.PI / 4; nx = ox + Math.cos(a) * snv(L, e); ny = oy + Math.sin(a) * snv(L, e); }
        if (drag.end === 1) { o.x1 = nx; o.y1 = ny; } else { o.x2 = nx; o.y2 = ny; }
      } else if (drag.mode === 'pv') {
        let nx = snv(x, e), ny = snv(y, e); const q = ptSnap(x, y, o); if (q && !e.altKey) { nx = q.x; ny = q.y; }
        o.poly[drag.i] = [nx, ny]; FP.syncBox(o);
      } else if (drag.mode === 'rot') {
        let a = Math.atan2(x - o.x, -(y - o.y)) * 180 / Math.PI; if (!e.altKey) a = Math.round(a / 5) * 5; o.rotation = ((a % 360) + 360) % 360;
      }
      V.draw(); schedProps(); return;
    }
    if (V.tool === 'wall' && tmp) { const q = wallEnd(e); tmp.x1 = q.x; tmp.y1 = q.y; }
    else if (V.tool === 'poly' && tmp && tmp.pts) { const q = polyPt(e); tmp.cur = [q.x, q.y]; }
    else if (V.tool === 'measure' && meas && !meas.done) { meas.b = ptSnap(x, y) || { x: snv(x, e), y: snv(y, e) }; }
    else if (V.tool === 'door' || V.tool === 'window' || V.tool === 'gap') {
      const walls = FP.getWalls(FP.floor()); let best = null, bd = 16 / V.s;
      walls.forEach(w => { const r = segProj(x, y, w); if (r.d < bd) { bd = r.d; best = { w, t: r.t }; } });
      if (best) { const d = FP.opDefaults(V.tool), L = FP.wlen(best.w), wd = Math.min(d.width, L); hover = { w: best.w, o: { offset: Math.max(0, Math.min(L - wd, snv(best.t - wd / 2, e))), width: wd, kind: V.tool, flip: false, swing: 1, open: true } }; } else hover = null;
    }
    V.draw();
  });
  cv.addEventListener('pointerup', e => {
    if (!drag) return;
    if (drag.mode === 'draw') {
      const w = Math.abs(tmp.x1 - tmp.x0), h = Math.abs(tmp.y1 - tmp.y0);
      if (w >= .3 && h >= .3) {
        FP.snap(); const f = FP.floor(), r = { id: FP.uid(), name: 'Комната ' + (f.rooms.length + 1), x: Math.min(tmp.x0, tmp.x1), y: Math.min(tmp.y0, tmp.y1), width: w, depth: h, material: 'oak', color: '#c19a6b', floor: { m: 'lam_oak_nat', c: null } };
        f.rooms.push(r); FP.select('room', r.id); FP.changed();
      }
      tmp = null;
    } else if (drag.mode === 'pan') cv.style.cursor = (V.tool === 'pan' || V.lock) ? 'grab' : 'default';
    else if (drag.moved) {
      if (drag.mode === 'move' && drag.type === 'furniture' && set().noOverlap !== false) {   // запрет наложения: вернуть на прежнее место
        const o = FP.selObj(), bad = o ? FP.conflicts(FP.floor()).get(o.id) : null;
        if (bad && bad.length) {
          o.x = drag.o.x; o.y = drag.o.y; o.rotation = drag.o.rotation;
          note = '⛔ Сюда нельзя: ' + bad[0].text; setTimeout(() => { note = ''; V.draw(); }, 3000);
        }
      }
      FP.changed();
    }
    drag = null; V.draw(); FP.ui && FP.ui.props();
  });
  cv.addEventListener('dblclick', e => {
    if (V.tool === 'poly') { finishPoly(); return; }
    if (V.tool === 'wall') { tmp = null; V.draw(); return; }
    if (V.tool === 'select') {
      const p = P(e), h = hitTest(wx(p.x), wy(p.y)), op = h && h.type === 'opening' && FP.floor().openings.find(q => q.id === h.id);
      if (op && op.kind === 'door') { if (!op.locked) { FP.snap(); op.open = !op.open; FP.changed(); } return; }   // двойной клик по двери: открыть / закрыть
      FP.ui.walkHere(wx(p.x), wy(p.y));                                                                              // иначе: встать в эту точку в 3D
    }
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.shiftKey) { V.ox -= (e.deltaX || e.deltaY); V.draw(); return; }   // Shift + колесо: по горизонтали
    if (e.altKey)   { V.oy -= (e.deltaX || e.deltaY); V.draw(); return; }   // Alt + колесо: по вертикали
    const p = P(e), k = e.deltaY < 0 ? 1.12 : 1 / 1.12, ns = Math.max(8, Math.min(400, V.s * k)), x = wx(p.x), y = wy(p.y);
    V.s = ns; V.ox = p.x - x * ns; V.oy = p.y - y * ns; V.draw();
  }, { passive: false });
  document.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) && FP.view === '2d') { space = true; e.preventDefault(); } });
  document.addEventListener('keyup', e => { if (e.code === 'Space') space = false; });
  V.cancel = () => { tmp = null; hover = null; V.draw(); };
  V.resize = resize;
  V.finishPoly = finishPoly;
  FP.listeners.push(() => V.draw());
})();
