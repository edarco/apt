(function () {
  const M = FP.MAT = { list: [], byId: {} };
  const cl = v => Math.max(0, Math.min(255, v));
  const rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const hx = a => '#' + a.map(v => ('0' + Math.round(cl(v)).toString(16)).slice(-2)).join('');
  // k<1 — темнее, k>1 — светлее (k-1 = доля смешивания с белым)
  const shade = (h, k) => { const a = rgb(h); return hx(k < 1 ? a.map(v => v * k) : a.map(v => v + (255 - v) * (k - 1))); };
  const rgba = (h, a) => { const c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hh = (a, b, s, seed) => { const x = Math.sin(a * 127.1 + b * 311.7 + s * 74.7 + (seed || 0) * 13.37) * 43758.5453; return x - Math.floor(x); };
  const autoGrout = c => { const a = rgb(c); return (a[0] + a[1] + a[2]) / 3 > 140 ? shade(c, .8) : shade(c, 1.35); };
  const grain = (g, tw, th, R, n, c1, c2, a, sz) => {
    for (let i = 0; i < n; i++) { g.globalAlpha = a * (.4 + .6 * R()); g.fillStyle = R() < .5 ? c1 : c2; const s = sz * (.5 + R()); g.fillRect(R() * tw, R() * th, s, s); }
    g.globalAlpha = 1;
  };
  M.shade = shade;

  // ---------- генераторы: K[вид](параметры) → { tw, th (размер повторяющегося куска, м), draw(g, R) } ----------
  // g уже масштабирован: 1 единица = 1 метр
  const K = {};

  K.plank = P => {                                  // доска со смещением рядов
    const bw = P.bw || .19, bl = P.bl || 1.2, rows = P.rows || 6, tw = 2 * bl, th = rows * bw, c = P.c;
    return { tw, th, draw(g, R) {
      const gap = P.gw == null ? .0015 : P.gw;
      g.fillStyle = P.grout || shade(c, .45); g.fillRect(0, 0, tw, th);
      for (let i = 0; i < rows; i++) {
        const o = R() * bl, y = i * bw;
        for (let j = 0; j < 2; j++) {
          const x0 = o + j * bl, base = shade(c, .86 + R() * .26), w = bl - gap, h = bw - gap, lines = [];
          for (let l = 0; l < 22; l++) lines.push({ y: R() * h, a: .05 + R() * .12, wd: .0006 + R() * .0016, ph: R() * 6.28, amp: .0008 + R() * .003, k: 1 + Math.floor(R() * 3) });
          [-tw, 0, tw].forEach(dx => {
            const x = x0 + dx; if (x > tw || x + bl < 0) return;
            g.save(); g.beginPath(); g.rect(x + gap / 2, y + gap / 2, w, h); g.clip();
            g.fillStyle = base; g.fillRect(x, y, bl, bw);
            lines.forEach(ln => {
              g.strokeStyle = rgba(shade(c, .4), ln.a); g.lineWidth = ln.wd; g.beginPath();
              for (let s = 0; s <= 8; s++) { const xx = x + s * bl / 8, yy = y + ln.y + ln.amp * Math.sin(ln.ph + ln.k * 6.2832 * s / 8); s ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
              g.stroke();
            });
            g.restore();
          });
        }
      }
    } };
  };

  K.herring = P => {                                // паркет «ёлочка» (доски n×1, под 90°)
    const n = P.n || 4, Wd = P.bw || .1, S = 2 * n, c = P.c, size = S * Wd;
    return { tw: size, th: size, draw(g) {
      const sd = P.seed || 0, gp = P.gp == null ? .03 : P.gp;
      g.save(); g.scale(Wd, Wd); g.fillStyle = P.grout || shade(c, .4); g.fillRect(0, 0, S, S);
      const board = (x, y, w, h, horiz, id) => {
        const mx = ((x % S) + S) % S, my = ((y % S) + S) % S, hs = k => hh(mx, my, k + id, sd);
        g.save(); g.beginPath(); g.rect(x + gp, y + gp, w - 2 * gp, h - 2 * gp); g.clip();
        g.fillStyle = shade(c, .86 + hs(1) * .28); g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(60,35,10,.12)';
        for (let l = 0; l < 6; l++) {
          g.lineWidth = .01 + hs(10 + l) * .03; g.globalAlpha = .4 + hs(20 + l) * .6; g.beginPath();
          if (horiz) { const yy = y + hs(30 + l) * h; g.moveTo(x, yy); g.lineTo(x + w, yy + (hs(40 + l) - .5) * .1); }
          else { const xx = x + hs(30 + l) * w; g.moveTo(xx, y); g.lineTo(xx + (hs(40 + l) - .5) * .1, y + h); }
          g.stroke();
        }
        g.globalAlpha = 1; g.restore();
      };
      for (let i = -2 * n; i <= 2 * n; i++) for (let j = -2 * n; j <= 2 * n; j++) {
        const hx0 = i * n + j, hy0 = -i * n + j;
        if (hx0 < S && hx0 + n > 0 && hy0 < S && hy0 + 1 > 0) board(hx0, hy0, n, 1, true, 0);
        const vx = hx0 + n - 1, vy = hy0 - n;
        if (vx < S && vx + 1 > 0 && vy < S && vy + n > 0) board(vx, vy, 1, n, false, 100);
      }
      g.restore();
    } };
  };

  K.tile = P => {                                   // плитка: квадрат, прямоугольник, метро, шахматка, мозаика, мрамор, кирпич
    const a = P.a, b = P.b || P.a, stag = P.stag || 0, c = P.c, u = P.u || 1.2;
    let cx = Math.max(1, Math.round(u / a)), cy = Math.max(1, Math.round(u / b));
    if (stag || P.chess) cy += cy % 2;
    if (P.chess) cx += cx % 2;
    const tw = cx * a, th = cy * b;
    return { tw, th, draw(g, R) {
      const gw = P.gw == null ? .003 : P.gw, vr = P.var == null ? .06 : P.var, sd = P.seed || 0;
      g.fillStyle = P.grout || autoGrout(c); g.fillRect(0, 0, tw, th);
      for (let j = 0; j < cy; j++) for (let i = -1; i <= cx; i++) {
        const off = stag && j % 2 ? a * stag : 0, ii = ((i % cx) + cx) % cx;
        const x0 = i * a + off + gw / 2, y0 = j * b + gw / 2, w = a - gw, h = b - gw;
        let col;
        if (P.pal) col = P.pal[Math.floor(hh(ii, j, 5, sd) * P.pal.length)];
        else if (P.chess) col = (ii + j) % 2 ? (P.c2 || '#ffffff') : c;
        else if (P.mix) col = shade(c, [.8, 1, 1.25, 1.5][Math.floor(hh(ii, j, 5, sd) * 4)]);
        else col = shade(c, 1 + (hh(ii, j, 3, sd) - .5) * vr * 2);
        g.fillStyle = col; g.fillRect(x0, y0, w, h);
        if (P.gloss || P.veins || P.bevel || P.rough) {
          g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
          if (P.veins) {
            const vc = P.vc || shade(c, .55);
            for (let v = 0; v < (P.nv || 4); v++) {
              const s1 = hh(ii, j, v + 11, sd), s2 = hh(ii, j, v + 23, sd), s3 = hh(ii, j, v + 37, sd), s4 = hh(ii, j, v + 51, sd);
              g.strokeStyle = rgba(vc, .12 + s3 * .3); g.lineWidth = .0008 + s4 * .003; g.beginPath(); g.moveTo(x0 + s1 * w, y0);
              g.bezierCurveTo(x0 + s2 * w * 1.5 - w * .25, y0 + h * .35, x0 + (1 - s2) * w, y0 + h * .65, x0 + s3 * w, y0 + h); g.stroke();
            }
            for (let v = 0; v < 2; v++) {
              const px = x0 + hh(ii, j, 70 + v, sd) * w, py = y0 + hh(ii, j, 80 + v, sd) * h, rr = w * .45, gr = g.createRadialGradient(px, py, 0, px, py, rr);
              gr.addColorStop(0, rgba(vc, .13)); gr.addColorStop(1, rgba(vc, 0)); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
            }
          }
          if (P.rough) for (let k = 0; k < P.rough; k++) { g.globalAlpha = .25 * R(); g.fillStyle = R() < .5 ? '#000000' : '#ffffff'; g.fillRect(x0 + R() * w, y0 + R() * h, .004, .004); }
          g.globalAlpha = 1;
          if (P.gloss) { const gr = g.createLinearGradient(x0, y0, x0 + w, y0 + h); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.07)'); g.fillStyle = gr; g.fillRect(x0, y0, w, h); }
          if (P.bevel) { const t = Math.min(.004, h * .06); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0, y0, w, t); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0, y0 + h - t, w, t); }
          g.restore();
        }
      }
    } };
  };

  K.hex = P => {                                    // соты
    const r = P.r || .06, H = Math.sqrt(3) * r, NC = 2 * Math.max(1, Math.round(.8 / (3 * r))), NR = Math.max(1, Math.round(.8 / H)), tw = NC * 1.5 * r, th = NR * H, c = P.c;
    return { tw, th, draw(g) {
      const gw = P.gw == null ? .004 : P.gw, vr = P.var == null ? .1 : P.var;
      g.fillStyle = P.grout || autoGrout(c); g.fillRect(0, 0, tw, th);
      for (let col = -2; col <= NC + 1; col++) for (let row = -2; row <= NR + 1; row++) {
        const cx = col * 1.5 * r, cy = (row + (((col % 2) + 2) % 2) * .5) * H, ci = ((col % NC) + NC) % NC, ri = ((row % NR) + NR) % NR;
        g.fillStyle = shade(c, 1 + (hh(ci, ri, 3, P.seed) - .5) * vr * 2);
        g.beginPath();
        for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3, rr = r - gw * .6, px = cx + rr * Math.cos(an), py = cy + rr * Math.sin(an); k ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath(); g.fill();
      }
    } };
  };

  K.terrazzo = P => {
    const tw = P.tw || 1.2, th = P.th || 1.2, c = P.c;
    return { tw, th, draw(g, R) {
      g.fillStyle = c; g.fillRect(0, 0, tw, th);
      const cols = [shade(c, .55), '#f4f1ea', '#c9a27a', '#7a8b99', '#3a3b3e', shade(c, 1.4)];
      for (let i = 0; i < 520; i++) {
        const x = R() * tw, y = R() * th, r = .004 + R() * R() * .018, col = cols[Math.floor(R() * cols.length)], pts = [];
        for (let k = 0; k < 5; k++) { const an = k * 1.2566 + R() * .5, rr = r * (.6 + R() * .6); pts.push([rr * Math.cos(an), rr * Math.sin(an)]); }
        g.fillStyle = col;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const X = x + dx * tw, Y = y + dy * th; if (X + r * 2 < 0 || X - r * 2 > tw || Y + r * 2 < 0 || Y - r * 2 > th) continue;
          g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(X + q[0], Y + q[1]) : g.moveTo(X + q[0], Y + q[1])); g.closePath(); g.fill();
        }
      }
      grain(g, tw, th, R, 3000, shade(c, .8), shade(c, 1.2), .25, .004);
    } };
  };

  K.mottle = P => {                                 // штукатурка, микроцемент, бетон (пятна + штрихи + зерно)
    const tw = P.tw || 1, th = P.th || 1, c = P.c;
    return { tw, th, draw(g, R) {
      g.fillStyle = c; g.fillRect(0, 0, tw, th);
      const dk = shade(c, P.dk || .8), lt = shade(c, P.lt || 1.18);
      for (let i = 0; i < (P.n || 300); i++) {
        const x = R() * tw, y = R() * th, r = (P.r0 || .02) + R() * ((P.r1 || .1) - (P.r0 || .02)), col = R() < .5 ? dk : lt;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const X = x + dx * tw, Y = y + dy * th; if (X + r < 0 || X - r > tw || Y + r < 0 || Y - r > th) continue;
          const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, rgba(col, P.a || .12)); gr.addColorStop(1, rgba(col, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r, 0, 6.2832); g.fill();
        }
      }
      for (let i = 0; i < (P.st || 0); i++) {
        const x = R() * tw, y = R() * th, L = P.sl * (.5 + R()), an = (P.sang || 0) + (R() - .5) * (P.sj || .6), ca = Math.cos(an) * L, sa = Math.sin(an) * L;
        g.strokeStyle = rgba(R() < .5 ? dk : lt, P.sa2 || .1); g.lineWidth = P.sw * (.5 + R()); g.lineCap = 'round';
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const X = x + dx * tw, Y = y + dy * th;
          if (Math.max(X, X + ca) < 0 || Math.min(X, X + ca) > tw || Math.max(Y, Y + sa) < 0 || Math.min(Y, Y + sa) > th) continue;
          g.beginPath(); g.moveTo(X, Y); g.lineTo(X + ca, Y + sa); g.stroke();
        }
      }
      grain(g, tw, th, R, P.gr || 6000, dk, lt, P.ga || .25, .004);
    } };
  };

  K.carpet = P => ({ tw: .5, th: .5, draw(g, R) { g.fillStyle = P.c; g.fillRect(0, 0, .5, .5); grain(g, .5, .5, R, 14000, shade(P.c, .8), shade(P.c, 1.2), .45, .006); } });

  K.slats = P => {                                  // деревянные рейки
    const sw = P.sw || .03, gap = P.gap || .02, n = P.n || 12, p = sw + gap, tw = n * p, th = 1.2, c = P.c;
    return { tw, th, draw(g, R) {
      g.fillStyle = shade(c, .22); g.fillRect(0, 0, tw, th);
      for (let i = 0; i < n; i++) {
        const x = i * p + gap / 2, k = 1 + Math.floor(R() * 3);
        g.fillStyle = shade(c, .88 + R() * .24); g.fillRect(x, 0, sw, th);
        for (let l = 0; l < 10; l++) {
          const xx = x + R() * sw, ph = R() * 6.28; g.strokeStyle = rgba(shade(c, .5), .06 + R() * .12); g.lineWidth = .0006 + R() * .0012; g.beginPath();
          for (let s = 0; s <= 20; s++) { const y = s * th / 20, px = xx + .0015 * Math.sin(ph + k * 6.2832 * s / 20); s ? g.lineTo(px, y) : g.moveTo(px, y); }
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + sw - .004, 0, .004, th); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, 0, .003, th);
      }
    } };
  };

  K.panel = P => {                                  // стеновые панели с молдингом
    const tw = P.pw || .9, th = P.ph || 1.2, c = P.c;
    return { tw, th, draw(g) {
      g.fillStyle = c; g.fillRect(0, 0, tw, th);
      const m = .1, x = m, y = m, w = tw - 2 * m, h = th - 2 * m, t = .012;
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, w, t); g.fillRect(x, y, t, h);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + h - t, w, t); g.fillRect(x + w - t, y, t, h);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x + t, y + t, w - 2 * t, .01);
      g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = .003; g.strokeRect(x - .006, y - .006, w + .012, h + .012);
    } };
  };

  K.stripe = P => {
    const sw = P.sw || .03, tw = 2 * sw, th = Math.max(.08, tw);
    return { tw, th, draw(g, R) {
      g.fillStyle = P.c; g.fillRect(0, 0, tw, th); g.fillStyle = P.c2 || shade(P.c, .85); g.fillRect(sw, 0, sw, th);
      grain(g, tw, th, R, 400, '#000000', '#ffffff', .05, Math.min(.004, sw / 5));
    } };
  };

  K.dots = P => {
    const sp = P.sp || .09, r = P.r || .012;
    return { tw: sp, th: sp, draw(g, R) {
      g.fillStyle = P.c; g.fillRect(0, 0, sp, sp); g.fillStyle = P.c2 || '#ffffff';
      [[0, 0], [sp, 0], [0, sp], [sp, sp], [sp / 2, sp / 2]].forEach(q => { g.beginPath(); g.arc(q[0], q[1], r, 0, 6.2832); g.fill(); });
      grain(g, sp, sp, R, 300, '#000000', '#ffffff', .05, .002);
    } };
  };

  K.rhombus = P => {
    const s = P.s || .16, tw = s, th = s * 1.5;
    return { tw, th, draw(g) {
      const c2 = P.c2 || shade(P.c, .85); g.fillStyle = c2; g.fillRect(0, 0, tw, th);
      const dia = (cx, cy, col) => {
        g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy - th / 2); g.lineTo(cx + tw / 2, cy); g.lineTo(cx, cy + th / 2); g.lineTo(cx - tw / 2, cy); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = .002; g.stroke();
      };
      [[0, 0], [tw, 0], [0, th], [tw, th]].forEach(q => dia(q[0], q[1], P.c)); dia(tw / 2, th / 2, c2);
    } };
  };

  K.scales = P => {                                 // «чешуя»
    const r = P.r || .06, tw = 2 * r, th = 2 * r;
    return { tw, th, draw(g) {
      g.fillStyle = shade(P.c, .8); g.fillRect(0, 0, tw, th);
      for (let j = -2; j <= 3; j++) for (let i = -1; i <= 1; i++) {
        const cx = i * 2 * r + (((j % 2) + 2) % 2) * r, cy = j * r, gr = g.createRadialGradient(cx, cy, r * .2, cx, cy, r);
        gr.addColorStop(0, shade(P.c, 1.12)); gr.addColorStop(1, P.c);
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill(); g.strokeStyle = rgba(shade(P.c, .6), .6); g.lineWidth = .0025; g.stroke();
      }
    } };
  };

  // ---------- каталог ----------
  const add = (cat, id, name, use, k, c, p) => { const P = { id, cat, name, use, k, c, p: p || {}, tex: k !== 'paint' && k !== 'plain' }; M.list.push(P); M.byId[id] = P; return P; };
  M.get = id => M.byId[id] || M.byId.paint;
  M.eff = s => (s && s.c) || M.get(s && s.m).c;

  add(null, 'paint', 'Краска', 'wall', 'paint', '#f2efe9');
  add('Прочее', 'plain', 'Однотонный (свой цвет)', 'floor', 'plain', '#eeeeee');

  // краска
  [['Белый', '#f5f3ee'], ['Молочный', '#efe9dc'], ['Слоновая кость', '#e9dfc8'], ['Бежевый', '#dccfb6'], ['Песок', '#cdb99a'], ['Грейдж', '#bfb5a6'], ['Светло-серый', '#d4d4d2'], ['Серый', '#a7a8a8'], ['Графит', '#5c5f64'], ['Чёрный', '#26272a'],
    ['Шалфей', '#b7c2a6'], ['Оливка', '#8a9068'], ['Эвкалипт', '#9fb5a8'], ['Мята', '#cfe3d6'], ['Небо', '#b9d3e3'], ['Пыльный синий', '#8aa1b6'], ['Тёмно-синий', '#2f4057'], ['Бирюза', '#5e9a9a'], ['Терракота', '#c47a5a'], ['Глина', '#b0846a'],
    ['Пудровый розовый', '#e6c4be'], ['Лаванда', '#c9bedb'], ['Горчичный', '#d6a93c'], ['Бордо', '#6e2a36'], ['Изумруд', '#2f6b55'], ['Какао', '#8a6a55']]
    .forEach((q, i) => add('Краска', 'paint_' + i, q[0], 'wall', 'paint', q[1]));

  // штукатурка
  const PL = [['белая', '#f1eee7'], ['слоновая кость', '#e6dcc7'], ['песочная', '#d3c0a1'], ['грейдж', '#b9b0a2'], ['серая', '#a6a7a6'], ['терракота', '#c0805f'], ['шалфей', '#a9b59a'], ['серо-голубая', '#93a4b3']];
  [['pl_fine', 'Мелкая', { tw: 1, th: 1, n: 260, r0: .03, r1: .13, a: .08, dk: .93, lt: 1.07, gr: 9000, ga: .3 }],
   ['pl_bark', 'Короед', { tw: 1, th: 1, n: 120, r0: .05, r1: .2, a: .06, dk: .9, lt: 1.1, st: 1400, sl: .06, sw: .004, sang: 1.5708, sj: .5, sa2: .18, gr: 2000, ga: .2 }],
   ['pl_ven', 'Венецианка', { tw: 1.2, th: 1.2, n: 220, r0: .12, r1: .4, a: .07, dk: .9, lt: 1.1, st: 90, sl: .4, sw: .07, sang: .7, sj: .9, sa2: .06, gr: 3000, ga: .15 }],
   ['pl_mic', 'Микроцемент', { tw: 1.2, th: 1.2, n: 180, r0: .1, r1: .35, a: .1, dk: .88, lt: 1.1, gr: 5000, ga: .35 }]]
    .forEach(k => PL.forEach((q, i) => add('Штукатурка', k[0] + '_' + i, k[1] + ' · ' + q[0], 'wall', 'mottle', q[1], k[2])));

  // обои
  [.02, .06].forEach(w => [['беж', '#e8e0cf', '#d3c6ab'], ['мята', '#dfe6e1', '#b9c9c0'], ['голубая', '#e6e9ee', '#9fb1c7'], ['пудра', '#f1e4e1', '#d2a9a2'], ['графит', '#3a4656', '#586579']]
    .forEach((q, i) => add('Обои', 'wp_str' + (w * 100) + '_' + i, 'Полоса ' + (w < .05 ? 'тонкая' : 'широкая') + ' · ' + q[0], 'wall', 'stripe', q[1], { sw: w, c2: q[2] })));
  [['белый на синем', '#2f4057', '#f1eee7'], ['серый на белом', '#f1eee7', '#a7a8a8'], ['золото на графите', '#34363b', '#c9a24f'], ['белый на зелёном', '#6f8f7b', '#f1eee7']]
    .forEach((q, i) => add('Обои', 'wp_dot_' + i, 'Горох · ' + q[0], 'wall', 'dots', q[1], { c2: q[2] }));
  [['беж', '#e3d8c3', '#d1c2a5'], ['серый', '#d6d8da', '#b3b7bb'], ['зелёный', '#a9b9a6', '#8fa38c'], ['синий', '#6c86a0', '#556e88']]
    .forEach((q, i) => add('Обои', 'wp_rh_' + i, 'Ромбы · ' + q[0], 'wall', 'rhombus', q[1], { c2: q[2] }));
  [['сине-зелёная', '#3f7f86'], ['розовая', '#e0b3ac'], ['графит', '#454a52']].forEach((q, i) => add('Обои', 'wp_sc_' + i, 'Чешуя · ' + q[0], 'wall', 'scales', q[1]));

  // кирпич, рейки, панели, бетон
  const BC = 'Кирпич, рейки, бетон';
  [['красный', '#a8553d', '#cfc7b9'], ['белёный', '#e9e5dc', '#cfcac0'], ['серый', '#8a8c8e', '#c0c0bd'], ['чёрный', '#3a3b3e', '#6a6a6a'], ['песочный', '#c4a47c', '#d8ccb8']]
    .forEach((q, i) => add(BC, 'br_' + i, 'Кирпич · ' + q[0], 'wall', 'tile', q[1], { a: .26, b: .075, stag: .5, gw: .01, grout: q[2], rough: 60, var: .18, u: 1.0 }));
  [['дуб', '#c9a46f'], ['орех', '#6f4a30'], ['чёрные', '#2b2b2d'], ['белый дуб', '#e1cfae']].forEach((q, i) => add(BC, 'sl_' + i, 'Рейки · ' + q[0], 'wall', 'slats', q[1], {}));
  [['белые', '#f1eee7'], ['серые', '#b8bcc0'], ['зелёные', '#9fb09b'], ['синие', '#8ea4b8'], ['бежевые', '#d8cdb7'], ['тёмные', '#3d4149']].forEach((q, i) => add(BC, 'pn_' + i, 'Панели · ' + q[0], 'wall', 'panel', q[1], {}));
  [['светлый', '#b5b5b2'], ['серый', '#8f9091'], ['тёмный', '#5d5f62']].forEach((q, i) => add(BC, 'wcon_' + i, 'Бетон лофт · ' + q[0], 'wall', 'mottle', q[1], { tw: 1.2, th: 1.2, n: 200, r0: .08, r1: .35, a: .12, dk: .85, lt: 1.12, gr: 7000, ga: .4 }));

  // плитка (стены и пол)
  const TC = [['белая', 'white', '#f2f0ea'], ['бежевая', 'beige', '#e0d4bd'], ['серая', 'grey', '#b9bbbc'], ['тёмно-серая', 'dgrey', '#5b5e63'], ['чёрная', 'black', '#2a2b2e'], ['зелёная', 'green', '#8fa88f'], ['голубая', 'blue', '#7f9fb5'], ['терракот', 'terra', '#bf7a5a']];
  TC.forEach(q => add('Плитка', 'tile_sq30_' + q[1], 'Квадрат 30×30 · ' + q[0], 'both', 'tile', q[2], { a: .3, gw: .003, var: .07, gloss: 1 }));
  [['светло-серая', 'lgrey', '#cfd0cf'], ['бежевая', 'beige', '#d7cbb6'], ['графит', 'graph', '#4d5156'], ['белая', 'white', '#ecebe7'], ['бетон', 'conc', '#9d9c98']]
    .forEach(q => add('Плитка', 'tile_sq60_' + q[1], 'Крупная 60×60 · ' + q[0], 'both', 'tile', q[2], { a: .6, gw: .004, var: .05 }));
  ['white', 'grey', 'green', 'blue', 'terra'].forEach(k => { const q = TC.find(t => t[1] === k); add('Плитка', 'tile_sq10_' + k, 'Квадрат 10×10 · ' + q[0], 'both', 'tile', q[2], { a: .1, gw: .003, var: .05, gloss: 1, u: 1.0 }); });
  [['белая', 'white', '#f4f2ee'], ['графит', 'graph', '#4a4e54'], ['зелёная', 'green', '#4f7a64'], ['синяя', 'blue', '#3f6f8f'], ['бежевая', 'beige', '#e3d5bd'], ['розовая', 'pink', '#d9aaa0'], ['чёрная', 'black', '#2a2b2e']]
    .forEach(q => add('Плитка', 'tile_metro_' + q[1], 'Метро 10×20 · ' + q[0], 'both', 'tile', q[2], { a: .2, b: .1, stag: .5, gw: .003, var: .05, bevel: 1, gloss: 1 }));
  [['белая', 'white', '#f4f2ee'], ['изумруд', 'emer', '#2d6b57'], ['тёмно-синяя', 'navy', '#2a3f5c'], ['шалфей', 'sage', '#a9b59a'], ['кремовая', 'cream', '#efe6d2']]
    .forEach(q => add('Плитка', 'tile_kab_' + q[1], 'Кабанчик 7,5×15 · ' + q[0], 'both', 'tile', q[2], { a: .15, b: .075, stag: .5, gw: .003, var: .06, bevel: 1, gloss: 1, u: 1.2 }));
  [['чёрно-белая', 'bw', '#2a2b2e', '#f2f0ea'], ['серо-белая', 'gw', '#a9abae', '#f2f0ea'], ['зелёно-белая', 'gr', '#6f8f7b', '#f2f0ea'], ['синяя/крем', 'nv', '#2a3f5c', '#efe6d2'], ['терракот/крем', 'tc', '#bf7a5a', '#efe6d2']]
    .forEach(q => add('Плитка', 'tile_chess_' + q[1], 'Шахматка 30×30 · ' + q[0], 'both', 'tile', q[2], { a: .3, gw: .003, chess: 1, c2: q[3], gloss: 1 }));
  [['серые', 'grey', '#b9bbbc'], ['графит', 'graph', '#4d5156'], ['белые', 'white', '#f2f0ea'], ['зелёные', 'green', '#7f9f8a'], ['терракот', 'terra', '#bf7a5a']]
    .forEach(q => add('Плитка', 'tile_hex_' + q[1], 'Соты · ' + q[0], 'both', 'hex', q[2], { r: .06, gw: .004, var: .1 }));
  [['голубая', 'blue', '#7aa6c2', null], ['серая', 'grey', '#a9abae', null], ['зелёная', 'green', '#8fb09a', null], ['песочная', 'sand', '#d3c0a1', null], ['чёрно-белая', 'bw', '#2a2b2e', ['#2a2b2e', '#f2f0ea', '#8d8f93']]]
    .forEach(q => add('Плитка', 'tile_mos_' + q[1], 'Мозаика · ' + q[0], 'both', 'tile', q[2], { a: .025, gw: .003, u: .5, mix: q[3] ? 0 : 1, pal: q[3] || null, gloss: 0 }));
  [['Каррара', 'carr', '#ecebe8', '#8b8f94'], ['серый', 'grey', '#b7b8ba', '#5c6066'], ['Маркина', 'black', '#26272a', '#d8d2c4'], ['крема', 'crema', '#d9cdb8', '#a58c68'], ['зелёный', 'green', '#4d6b5c', '#cfe0d0']]
    .forEach(q => add('Плитка', 'tile_mar_' + q[1], 'Мрамор 60×60 · ' + q[0], 'both', 'tile', q[2], { a: .6, gw: .003, veins: 1, vc: q[3], nv: 5, gloss: 1, var: .03 }));
  [['светлое', 'l', '#e4ded2'], ['серое', 'g', '#b0b0ad'], ['тёмное', 'd', '#4b4d51'], ['розовое', 'p', '#e2c3b8']].forEach(q => add('Плитка', 'tile_ter_' + q[1], 'Терраццо · ' + q[0], 'both', 'terrazzo', q[2], {}));
  [['белая', 'white', '#e9e6df'], ['серая', 'grey', '#8b8d90'], ['дерево', 'wood', '#b99b7a']].forEach(q => add('Плитка', 'tile_her_' + q[1], 'Ёлочка · ' + q[0], 'both', 'herring', q[2], { bw: .075, n: 4, gp: .06, grout: autoGrout(q[2]) }));
  [['дуб', 'oak', '#b98e5f'], ['серое дерево', 'grey', '#8f8d88'], ['тёмное', 'dark', '#5a4332'], ['белёное', 'white', '#d8d2c4']]
    .forEach(q => add('Плитка', 'tile_wood_' + q[1], 'Под дерево · ' + q[0], 'floor', 'plank', q[2], { bw: .2, bl: .8, rows: 6, gw: .003, grout: '#7a7268' }));

  // ламинат и паркет
  const LC = [['Дуб светлый', 'oak_light', '#d5b283'], ['Дуб натуральный', 'oak_nat', '#c19a6b'], ['Дуб золотой', 'oak_gold', '#c8934f'], ['Дуб беленый', 'oak_white', '#e3d3b5'], ['Дуб серый', 'oak_grey', '#a59c8f'], ['Дуб тёмный', 'oak_dark', '#7b5636'],
    ['Орех', 'walnut', '#6b4429'], ['Венге', 'wenge', '#3d2b22'], ['Ясень', 'ash', '#d8c9a8'], ['Бук', 'beech', '#cf9e6e'], ['Вишня', 'cherry', '#9a5b3c'], ['Сосна', 'pine', '#dfc08c']];
  LC.forEach(q => add('Ламинат', 'lam_' + q[1], q[0] + ' · доска', 'floor', 'plank', q[2], { bw: .19, bl: 1.2, rows: 6, gw: .0012 }));
  LC.slice(0, 8).forEach(q => add('Ламинат', 'lamw_' + q[1], q[0] + ' · широкая', 'floor', 'plank', q[2], { bw: .24, bl: 1.4, rows: 5, gw: .0012 }));
  LC.slice(0, 10).forEach(q => add('Паркет', 'par_' + q[1], q[0] + ' · ёлочка', 'floor', 'herring', q[2], { bw: .1, n: 4 }));

  // прочее (пол)
  [['серый', 'grey', '#9a9a9a'], ['бежевый', 'beige', '#cdbfa6'], ['синий', 'blue', '#5d7488'], ['зелёный', 'green', '#7d9078'], ['антрацит', 'anth', '#45484d']].forEach(q => add('Прочее', 'carpet_' + q[1], 'Ковролин · ' + q[0], 'floor', 'carpet', q[2]));
  [['светлый', 'light', '#c9c8c4'], ['серый', 'grey', '#a3a3a0'], ['тёплый', 'warm', '#bdb3a4'], ['тёмный', 'dark', '#6d6e70']]
    .forEach(q => add('Прочее', 'cem_' + q[1], 'Микроцемент · ' + q[0], 'floor', 'mottle', q[2], { tw: 1.2, th: 1.2, n: 180, r0: .1, r1: .35, a: .1, dk: .88, lt: 1.1, gr: 5000, ga: .35 }));

  // ---------- рисование текстуры ----------
  M.canvasFor = (P, color, S) => {
    const spec = Object.assign({}, P.p, { c: color || P.c, seed: hashStr(P.id) % 977 }), kd = K[P.k](spec), cv = document.createElement('canvas');
    cv.width = cv.height = S; const g = cv.getContext('2d'); g.setTransform(S / kd.tw, 0, 0, S / kd.th, 0, 0);
    kd.draw(g, rng(hashStr(P.id) + 7));
    return { cv, tw: kd.tw, th: kd.th };
  };
  const texCache = new Map();
  M.texture = (P, color) => {
    const key = P.id + '|' + (color || P.c); let t = texCache.get(key); if (t) return t;
    const r = M.canvasFor(P, color, 512);
    t = new THREE.CanvasTexture(r.cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / r.tw, 1 / r.th); t.anisotropy = 4;
    texCache.set(key, t);
    if (texCache.size > 80) { const k = texCache.keys().next().value; texCache.get(k).dispose(); texCache.delete(k); }
    return t;
  };

  // ---------- выбор отделки для комнат и стен ----------
  const LEG = { oak: 'lam_oak_nat', wood: 'lam_walnut', tile: 'tile_sq30_grey', white: 'plain', concrete: 'cem_grey', carpet: 'carpet_grey' };
  FP.floorSpec = r => r.floor && r.floor.m ? { m: r.floor.m, c: r.floor.c || null } : { m: LEG[r.material] || 'plain', c: r.color };
  FP.defWallFin = () => { const s = FP.data.settings; return s.wallFin && s.wallFin.m ? { m: s.wallFin.m, c: s.wallFin.c || null } : { m: 'paint', c: s.wallColor || '#f2efe9' }; };
  FP.defCeil = () => { const s = FP.data.settings; return s.ceilFin && s.ceilFin.m ? { m: s.ceilFin.m, c: s.ceilFin.c || null } : { m: 'paint', c: '#fbfaf7' }; };
  FP.ceilSpec = r => r.ceilFin && r.ceilFin.m ? { m: r.ceilFin.m, c: r.ceilFin.c || null } : FP.defCeil();
  FP.zoneNorm = (z, def) => {
    z = z || {}; const up = z.up || def, low = z.low || null;
    return { up: { m: up.m, c: up.c || null }, low: low ? { m: low.m, c: low.c || null } : null, h: low ? (z.h > 0 ? +z.h : 1.2) : 0 };
  };
  FP.zoneOf = (r, side) => { const f = r.fin || {}; return FP.zoneNorm(f[side] || f.all, FP.defWallFin()); };
  FP.wallZone = c => FP.zoneNorm(c.fin || (c.color ? { up: { m: 'paint', c: c.color } } : null), FP.defWallFin());
  // отделка стены из FP.getWalls(): inSign — какая грань (+z или -z) смотрит в комнату
  FP.wallFin = function (w) {
    const def = FP.defWallFin();
    if (w.room) return { both: false, inSign: w.inSign != null ? w.inSign : { n: 1, s: -1, w: -1, e: 1 }[w.side], inn: FP.zoneOf(w.room, w.side), out: def };
    return { both: true, inn: FP.wallZone(w.custom || {}), out: def };
  };
})();
