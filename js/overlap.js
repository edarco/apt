(function () {
  // ---- Исключения: правь списки под себя (названия — это kind мебели) ----
  const K = FP.OVERLAP = {
    soft: new Set(['chair', 'office_chair', 'barstool', 'pouf']),                                   // могут стоять у стола и друг у друга
    table: new Set(['table', 'dining', 'roundtable', 'oval', 'desk', 'desk_pc', 'beauty_cart']),    // под них можно задвинуть мягкие
    skip: new Set(['rug', 'rug_round', 'worktop', 'backsplash', 'curtain', 'robot_vac']),           // эти предметы не проверяются вообще
    built: new Set(['hob', 'hob_gas', 'oven', 'microwave', 'washer', 'dishwasher', 'fridge', 'fridge_sbs', 'hood', 'boiler']),   // встраиваемые
    host: new Set(['counter', 'drawer_base', 'tall_cab', 'tall_oven', 'wardrobe', 'wardrobe_mir', 'wall_cab', 'wall_cab2', 'shelf'])  // шкафы, куда встраивают
  };

  // Площадь, которую мебель занимает на полу: список повёрнутых прямоугольников {cx, cy, ux, uy, hl, ht}
  // (у модели может быть поле foot = [[x0, z0, x1, z1], ...] в метрах модели, например у углового дивана)
  FP.footRects = function (m) {
    const M = FP.model(m), W = m.width, D = m.depth, a = (m.rotation || 0) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
    let L = [[-W / 2, -D / 2, W / 2, D / 2]];
    if (M && M.foot) { const kx = W / M.w, kz = D / M.d; L = M.foot.map(r => [r[0] * kx, r[1] * kz, r[2] * kx, r[3] * kz]); }
    if (m.flipX) L = L.map(r => [-r[2], r[1], -r[0], r[3]]);
    return L.map(r => {
      const lx = (r[0] + r[2]) / 2, lz = (r[1] + r[3]) / 2;
      return { cx: m.x + ux * lx - uy * lz, cy: m.y + uy * lx + ux * lz, ux, uy, hl: Math.abs(r[2] - r[0]) / 2, ht: Math.abs(r[3] - r[1]) / 2 };
    });
  };

  // пересекаются ли два повёрнутых прямоугольника (e — допуск: на столько каждый «ужат»)
  const rrHit = (a, b, e) => {
    const ax = [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]], dx = b.cx - a.cx, dy = b.cy - a.cy;
    for (const q of ax) {
      const ra = a.hl * Math.abs(a.ux * q[0] + a.uy * q[1]) + a.ht * Math.abs(-a.uy * q[0] + a.ux * q[1]) - e;
      const rb = b.hl * Math.abs(b.ux * q[0] + b.uy * q[1]) + b.ht * Math.abs(-b.uy * q[0] + b.ux * q[1]) - e;
      if (Math.abs(dx * q[0] + dy * q[1]) >= ra + rb) return false;
    }
    return true;
  };
  // точка внутри прямоугольника (e > 0 — отступ внутрь)
  const inR = (q, x, y, e) => { const dx = x - q.cx, dy = y - q.cy; return Math.abs(dx * q.ux + dy * q.uy) <= q.hl - e && Math.abs(-dx * q.uy + dy * q.ux) <= q.ht - e; };

  // Твёрдые части стен (без проёмов дверей) в виде прямоугольников
  FP.wallRects = function (f, walls) {
    const out = [];
    walls.forEach(w => {
      const L = FP.wlen(w); if (L < .01) return;
      const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
      if (w.rail) { out.push({ cx: w.x1 + ux * L / 2, cy: w.y1 + uy * L / 2, ux, uy, hl: L / 2, ht: .03 }); return; }
      FP.pieces(f, walls, w, undefined).forEach(p => {
        if (!((p.type === 'wall' && p.z0 === 0) || p.type === 'block')) return;
        let s = p.s, e = p.e; if (s <= .0005) s -= w.e1; if (e >= L - .0005) e += w.e2;
        out.push({ cx: w.x1 + ux * (s + e) / 2, cy: w.y1 + uy * (s + e) / 2, ux, uy, hl: (e - s) / 2, ht: w.t / 2 });
      });
    });
    return out;
  };

  // Главная функция: Map(id мебели → [{t: 'furn'|'wall'|'door', text}])
  FP.conflicts = function (f, walls) {
    f = f || FP.floor(); walls = walls || FP.getWalls(f);
    const out = new Map();
    const add = (id, t, text) => { let l = out.get(id); if (!l) out.set(id, l = []); if (!l.some(c => c.text === text)) l.push({ t, text }); };
    const I = f.furniture.map(m => {
      const M = FP.model(m) || {}, e = M.ceil ? f.height - m.height : (m.elev != null ? m.elev : (M.elev || 0));
      return { m, k: m.kind, z0: e, z1: e + m.height, rects: FP.footRects(m), skip: !!(M.sym || M.ceil || K.skip.has(m.kind)) };
    }).filter(a => !a.skip);

    const pairOK = (a, b) => {
      const sa = K.soft.has(a.k), sb = K.soft.has(b.k);
      if ((sa && (sb || K.table.has(b.k))) || (sb && K.table.has(a.k))) return true;                        // стул/кресло у стола
      const emb = (x, y) => K.built.has(x.k) && K.host.has(y.k) && y.rects.some(q => inR(q, x.m.x, x.m.y, 0)); // встроено в шкаф
      return emb(a, b) || emb(b, a);
    };

    // 1) мебель с мебелью
    for (let i = 0; i < I.length; i++) for (let j = i + 1; j < I.length; j++) {
      const a = I[i], b = I[j];
      if (Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) < .03) continue;                  // на разной высоте
      if (!a.rects.some(p => b.rects.some(q => rrHit(p, q, .005)))) continue;
      if (pairOK(a, b)) continue;
      add(a.m.id, 'furn', 'пересекается с «' + b.m.name + '»'); add(b.m.id, 'furn', 'пересекается с «' + a.m.name + '»');
    }
    // 2) мебель со стенами
    const WR = FP.wallRects(f, walls);
    I.forEach(a => { if (WR.some(q => a.rects.some(p => rrHit(p, q, .01)))) add(a.m.id, 'wall', 'заходит в стену'); });
    // 3) двери: зона открывания (четверть круга) и проход с другой стороны
    f.openings.forEach(o => {
      if (o.kind !== 'door') return;
      const w = walls.find(q => q.id === o.wallId); if (!w) return;
      const p = FP.openPos(w, o), wd = o.width, ly = ((p.nx * -p.uy + p.ny * p.ux) >= 0 ? 1 : -1) * (o.swing === -1 ? -1 : 1);
      const vx = -p.uy * ly, vy = p.ux * ly, hx = o.flip ? p.ex : p.sx, hy = o.flip ? p.ey : p.sy, sg = o.flip ? -1 : 1, pts = [];
      [.3, .6, .95].forEach(r => { for (let g = 0; g <= 6; g++) { const an = g * Math.PI / 12, c = Math.cos(an) * wd * r, s = Math.sin(an) * wd * r; pts.push([hx + p.ux * sg * c + vx * s, hy + p.uy * sg * c + vy * s]); } });
      for (let k = 0; k < 5; k++) [.2, .45].forEach(d => pts.push([p.sx + p.ux * wd * (k + .5) / 5 - vx * d, p.sy + p.uy * wd * (k + .5) / 5 - vy * d]));
      const nm = FP.wallLabel(o.wallId);
      I.forEach(a => {
        if (a.z0 > 2.05 || a.z1 < .05) return;
        if (pts.some(pt => a.rects.some(q => inR(q, pt[0], pt[1], .02)))) add(a.m.id, 'door', 'мешает двери (' + nm + ')');
      });
    });
    return out;
  };
})();
