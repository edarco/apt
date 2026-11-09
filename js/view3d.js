(function () {
  const host = FP.$('c3d'), V3 = FP.v3 = {};
  let renderer, scene, camera, root, sun, raf = 0, last = 0, needs = true, cache = new Map(), colRects = [], tour = null;
  let edgeMat = null;
  const orbit = { yaw: 0.6, pitch: 0.75, dist: 14, tx: 0, ty: 0, tz: 0 };
  const walk = { x: 0, z: 0, yaw: 0, pitch: 0, eye: 1.6 };
  const opt = { walls: 'full', cut: 1.0, cam: 'orbit', ceil: true, op: 0.3, fov: 78, night: false, lamp: 1, light: false, sunAz: null };
  let hemi;
  let env = null, dome = null, fill = null, envMats = null, skyTex = {}, doors = [];
  const dAng = new Map(), DOOR_A = 82 * Math.PI / 180;
  const vel = { x: 0, z: 0 }; let bobT = 0;
  const keys = {}, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isWalk = () => opt.cam === 'walk';

  const gcache = new Map();
  function bgeo(w, h, d) {
    const k = w.toFixed(4) + '|' + h.toFixed(4) + '|' + d.toFixed(4); let g = gcache.get(k);
    if (!g) { g = new THREE.BoxGeometry(w, h, d); gcache.set(k, g); }
    return g;
  }

  function mat(color, o) {
    const k = color + (o ? JSON.stringify(o) : ''); let m = cache.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(color) }, o || {})); cache.set(k, m); }
    return m;
  }
  function box(w, h, d, color, x, y, z, o) {
    const m = new THREE.Mesh(bgeo(Math.max(w, .001), Math.max(h, .001), Math.max(d, .001)), mat(color, o));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
  }
  // ---------- отделка: материалы с текстурами ----------
  const fcache = new Map();
  function fmat(spec, inner, ceil) {                 // ceil: потолок (смотрит вниз, поэтому добавляем самосвечение)
    const P = FP.MAT.get(spec.m), col = spec.c || P.c, key = P.id + '|' + col + '|' + (inner ? 1 : 0) + '|' + (ceil ? (opt.night ? 'cn' : 'cd') : 0);
    let m = fcache.get(key);
    if (!m) {
      const o = { color: new THREE.Color(P.tex ? '#ffffff' : col) };
      if (P.tex) o.map = FP.MAT.texture(P, col);
      if (inner) { o.polygonOffset = true; o.polygonOffsetFactor = -1; o.polygonOffsetUnits = -1; }
      if (ceil) {
        o.emissive = new THREE.Color(P.tex ? '#ffffff' : col); if (P.tex) o.emissiveMap = o.map;
        o.emissiveIntensity = opt.night ? .03 : .3;
      }
      m = (P.p && (P.p.gloss || P.p.veins)) ? new THREE.MeshPhongMaterial(Object.assign(o, { shininess: 45, specular: new THREE.Color('#3a3a3a') })) : new THREE.MeshLambertMaterial(o);
      fcache.set(key, m);
    }
    return m;
  }
  // перезапись UV грани куба (0..1) в метры: текстуры получают реальный масштаб
  function uvFace(geo, f, fn) {
    const a = geo.attributes.uv;
    for (let i = f * 4; i < f * 4 + 4; i++) { const r = fn(a.getX(i), a.getY(i)); a.setXY(i, r[0], r[1]); }
    a.needsUpdate = true;
  }
  // кусок стены: делится по высоте на «низ» и «верх»; внутренняя грань — отделка комнаты, внешняя — по умолчанию
  function wallSeg(w, s, e, z0, z1, ux, uy, ang) {
    const fin = FP.wallFin(w), len = e - s, cx = w.x1 + ux * (s + e) / 2, cz = w.y1 + uy * (s + e) / 2, hz = fin.inn.low ? fin.inn.h : 0, zones = [];
    if (hz > z0 + .001 && hz < z1 - .001) zones.push([z0, hz, 'low'], [hz, z1, 'up']);
    else zones.push([z0, z1, (fin.inn.low && hz >= z1 - .001) ? 'low' : 'up']);
    const capM = mat(FP.MAT.eff(fin.both ? fin.inn.up : fin.out));
    zones.forEach(q => {
      const a = q[0], b = q[1], inn = fmat(q[2] === 'low' ? fin.inn.low : fin.inn.up, true), out = fmat(fin.out, false);
      const zin = fin.both ? [inn, inn] : (fin.inSign > 0 ? [inn, out] : [out, inn]);       // [грань +z, грань -z]
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, b - a, w.t), [capM, capM, capM, capM, zin[0], zin[1]]);
      m.position.set(cx, (a + b) / 2, cz); m.rotation.y = ang; m.castShadow = m.receiveShadow = true;
      uvFace(m.geometry, 4, (u, v) => [s + u * len, a + v * (b - a)]);
      uvFace(m.geometry, 5, (u, v) => [s + (1 - u) * len, a + v * (b - a)]);
      root.add(m); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), edgeMat));
    });
  }

  // плоская заливка многоугольника (пол / потолок): pts [[x,z]...], y — высота, dir = ±1 (куда смотрит нормаль), uv(X,Z) → текстурные координаты в метрах
  function flatGeo(pts, y, dir, uv) {
    const tri = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []), pos = [], nor = [], uvs = [], idx = [];
    pts.forEach(p => { pos.push(p[0], y, p[1]); nor.push(0, dir, 0); const q = uv(p[0], p[1]); uvs.push(q[0], q[1]); });
    tri.forEach(t => {
      const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]], cr = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
      idx.push(...(((cr > 0) === (dir > 0)) ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]]));
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    return g;
  }

  // Окружение создаётся один раз. Оно видно только в режиме «ходьба». Для вечера меняются небо, огни окон и цвет облаков.
  const GROUND = -9.5;                                   // земля ~ на уровне 4-го этажа вниз
  function skyCanvas(night) {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    (night ? [[0, '#0b1020'], [.45, '#1a2440'], [.5, '#2a3558'], [1, '#2a3558']] : [[0, '#5d93d1'], [.45, '#a9cbe9'], [.5, '#dbe8f3'], [1, '#dbe8f3']]).forEach(s => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(cv);
  }
  function facadeTex(night) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = night ? '#1b1f2b' : '#e6e0d4'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const lit = night && ((i * 7 + j * 13 + 3) % 5 < 2); g.fillStyle = lit ? '#ffd98a' : (night ? '#2a3144' : '#7f9bb5'); g.fillRect(i * 32 + 6, j * 32 + 7, 18, 18); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function buildEnv() {
    skyTex = { d: skyCanvas(false), n: skyCanvas(true) };
    dome = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: skyTex.d }));
    dome.renderOrder = -1; scene.add(dome);
    env = new THREE.Group(); scene.add(env);
    let s = 4242; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(380, 40), new THREE.MeshLambertMaterial({ color: '#7e8d74' })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = GROUND; env.add(gnd);
    const sg = new THREE.SphereGeometry(1, 10, 8), gm = ['#5f8a4f', '#4f7a45', '#6d9a56', '#3f6b3d'].map(c => new THREE.MeshLambertMaterial({ color: c }));
    for (let i = 0; i < 90; i++) {                       // верхушки деревьев
      const a = R() * 6.283, d = 28 + R() * 70, r = 2 + R() * 1.6, t = new THREE.Mesh(sg, gm[i % 4]);
      t.scale.set(r, r * 1.15, r); t.position.set(Math.cos(a) * d, GROUND + 4.5 + R() * 3.5, Math.sin(a) * d); env.add(t);
    }
    const houses = [], tint = ['#ffffff', '#f2e6d3', '#dde2e8', '#eadfd6'], fd = facadeTex(false), fn = facadeTex(true);
    for (let i = 0; i < 18; i++) {                       // дальние дома
      const a = i / 18 * 6.283 + R() * .3, d = 75 + R() * 90, w = 14 + R() * 18, dp = 12 + R() * 10, h = 14 + R() * 30;
      const td = fd.clone(), tn = fn.clone(); td.needsUpdate = tn.needsUpdate = true; td.repeat.set(w / 12, h / 12); tn.repeat.set(w / 12, h / 12);
      const day = new THREE.MeshLambertMaterial({ map: td, color: tint[i % 4] }), night = new THREE.MeshBasicMaterial({ map: tn });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), day); m.position.set(Math.cos(a) * d, GROUND + h / 2, Math.sin(a) * d); m.rotation.y = R() * 3; env.add(m); houses.push({ m, day, night });
    }
    const cm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, fog: false, depthWrite: false });
    for (let i = 0; i < 6; i++) {                        // немного облаков
      const a = R() * 6.283, d = 160 + R() * 100, g = new THREE.Group();
      for (let k = 0; k < 4; k++) { const r = 12 + R() * 10, p = new THREE.Mesh(sg, cm); p.scale.set(r * 1.8, r * .6, r); p.position.set(k * r * 1.1 - 2 * r, R() * 4, R() * 6); g.add(p); }
      g.position.set(Math.cos(a) * d, 45 + R() * 50, Math.sin(a) * d); g.rotation.y = a; env.add(g);
    }
    envMats = { cloud: cm, houses };
  }

  function clearRoot() {
    while (root.children.length) { const o = root.children[0]; root.remove(o); o.traverse(n => { if (n.geometry) n.geometry.dispose(); }); }
    cache.forEach(m => m.dispose()); cache.clear();
  }

  // ---------- модели из библиотеки (FP.LIB) ----------
  const TOK = { wh: '#f4f2ee', bk: '#2a2a2c', ch: '#c9ccd0', gl: '#9ecbf0', dw: '#6f5a44' };
  function shade(col, k) { const c = new THREE.Color(col); if (k < 1) c.multiplyScalar(k); else c.lerp(new THREE.Color('#ffffff'), k - 1); return '#' + c.getHexString(); }
  const pcol = (t, main) => t === 'm' ? main : t === 'd' ? shade(main, .72) : t === 'l' ? shade(main, 1.35) : (TOK[t] || t);

  // ---------- отделка мебели: блеск и текстура ----------
  const STY = {
    matte:   { sh: 6,   sp: '#1a1a1a' },
    gloss:   { sh: 70,  sp: '#777777' },
    plastic: { sh: 40,  sp: '#444444' },
    chrome:  { sh: 110, sp: '#dddddd' },
    glass:   { sh: 140, sp: '#ffffff' },
    wood:    { sh: 24,  sp: '#3a3a3a', tex: 'wood', ts: .6 },
    fabric:  { sh: 3,   sp: '#0d0d0d', tex: 'fabric', ts: .2 },
    leather: { sh: 38,  sp: '#555555', tex: 'leather', ts: .5 }
  };
  Object.keys(STY).forEach(k => { STY[k].id = k; });
  const TSTY = { ch: 'chrome', gl: 'glass', bk: 'plastic', wh: 'gloss', dw: 'wood' };   // цветовые токены деталей → отделка
  const DEF_FIN = {};
  [['wood', 'nightstand wardrobe dresser table dining roundtable oval desk desk_pc chair shelf tvstand shoe_rack hanger wall_shelf mirror_full mirror mirror_round'],
   ['fabric', 'bed bed1 sofa sofa_l armchair pouf office_chair curtain rug rug_round'],
   ['leather', 'barstool'],
   ['plastic', 'counter drawer_base sink wall_cab wall_cab2 tall_cab'],
   ['gloss', 'fridge fridge_sbs stove washer dishwasher oven microwave hood bath toilet basin shower shower_cabin shower_tile ac tv tv_desk worktop backsplash towel_rail radiator trash robot_vac']]
    .forEach(a => a[1].split(' ').forEach(k => { DEF_FIN[k] = a[0]; }));
  const finOf = m => (m.finish && m.finish !== 'auto' && STY[m.finish]) ? m.finish : (DEF_FIN[m.kind] || 'matte');

  const tcache = new Map();
  function stex(kind, color) {                       // маленькая процедурная текстура (ткань / дерево / кожа), окрашенная в цвет
    const key = kind + color; let t = tcache.get(key); if (t) return t;
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    let s = 7919; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = color; g.fillRect(0, 0, S, S);
    const dk = shade(color, .62), lt = shade(color, 1.25);
    if (kind === 'wood') {
      for (let i = 0; i < 46; i++) {
        const y0 = R() * S, k = 1 + Math.floor(R() * 3), ph = R() * 6.28, am = 1 + R() * 3;
        g.globalAlpha = .08 + R() * .18; g.strokeStyle = R() < .75 ? dk : lt; g.lineWidth = .5 + R() * 1.6; g.beginPath();
        for (let x = 0; x <= S; x += 4) { const y = y0 + am * Math.sin(ph + k * 6.2832 * x / S); x ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
    } else if (kind === 'fabric') {
      g.globalAlpha = .07; g.fillStyle = '#000'; for (let i = 0; i < S; i += 2) { g.fillRect(0, i, S, 1); g.fillRect(i, 0, 1, S); }
      for (let i = 0; i < 2600; i++) { g.globalAlpha = .1 + R() * .2; g.fillStyle = R() < .5 ? dk : lt; g.fillRect(R() * S, R() * S, 1, 1); }
    } else {
      for (let i = 0; i < 700; i++) { g.globalAlpha = .05 + R() * .08; g.fillStyle = R() < .5 ? dk : lt; g.beginPath(); g.arc(R() * S, R() * S, 1 + R() * 3, 0, 6.2832); g.fill(); }
      g.globalAlpha = .12; g.fillStyle = dk; for (let i = 0; i < 1500; i++) g.fillRect(R() * S, R() * S, 1, 1);
    }
    g.globalAlpha = 1;
    t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / STY[kind].ts, 1 / STY[kind].ts); t.anisotropy = 4;
    tcache.set(key, t); if (tcache.size > 120) { const k = tcache.keys().next().value; tcache.get(k).dispose(); tcache.delete(k); }
    return t;
  }
  const pmcache = new Map();
  function pmat(col, st, o) {
    const k = col + '|' + st.id + '|' + (o ? JSON.stringify(o) : ''); let m = pmcache.get(k);
    if (!m) {
      const q = Object.assign({ color: new THREE.Color(st.tex ? '#ffffff' : col), shininess: st.sh, specular: new THREE.Color(st.sp) }, o || {});
      if (st.tex) q.map = stex(st.tex, col);
      m = new THREE.MeshPhongMaterial(q); pmcache.set(k, m);
    }
    return m;
  }
  // параллелепипед со скруглёнными рёбрами (r — радиус); UV в метрах, чтобы текстура имела реальный масштаб
  const rgcache = new Map();
  function rgeo(w, h, d, r) {
    r = Math.max(.0005, Math.min(r, Math.min(w, h, d) * .45));
    const key = [w, h, d, r].map(v => v.toFixed(4)).join('|'); let g = rgcache.get(key); if (g) return g;
    g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, hw = w / 2, hh = h / 2, hd = d / 2;
    const mp = (p, hs) => [-hs, -(hs - r), 0, hs - r, hs][Math.round((p / hs + 1) * 2)];
    const cp = (p, hs) => Math.max(-(hs - r), Math.min(hs - r, p));
    for (let i = 0; i < P.count; i++) {
      const x = mp(P.getX(i), hw), y = mp(P.getY(i), hh), z = mp(P.getZ(i), hd), f = Math.floor(i / 25);
      U.setXY(i, f < 2 ? z + hd : x + hw, f < 2 ? y + hh : f < 4 ? z + hd : y + hh);
      const cx = cp(x, hw), cy = cp(y, hh), cz = cp(z, hd), dx = x - cx, dy = y - cy, dz = z - cz, L = Math.hypot(dx, dy, dz) || 1;
      P.setXYZ(i, cx + dx / L * r, cy + dy / L * r, cz + dz / L * r); N.setXYZ(i, dx / L, dy / L, dz / L);
    }
    rgcache.set(key, g); return g;
  }

  function buildModel(m, M) {
    const g = new THREE.Group(), main = m.color || '#bbb', acc = m.color2 || TOK.dw, fin = finOf(m), on = m.on !== false, soft = fin === 'fabric' || fin === 'leather';
    M.parts.forEach(p => {
      const t = p.c || 'm', isMain = t === 'm' || t === 'd' || t === 'l', col = t === 'dw' ? acc : pcol(t, main);
      const st = STY[isMain ? fin : (TSTY[t] || 'gloss')], o = {}; let mesh, h;
      if (p.op) { o.transparent = true; o.opacity = p.op; o.depthWrite = false; }
      if (p.em && opt.light && on) o.emissive = new THREE.Color(col);          // светится, если свет включён (днём тоже)
      const mt = pmat(col, st, o);
      if (p.b) {
        const mn = Math.min(p.b[0], p.b[1], p.b[2]), mx = Math.max(p.b[0], p.b[1], p.b[2]);
        mesh = new THREE.Mesh(mx < .12 ? bgeo(p.b[0], p.b[1], p.b[2]) : rgeo(p.b[0], p.b[1], p.b[2], isMain && soft ? Math.min(.045, mn * .38) : Math.min(.012, mn * .3)), mt); h = p.b[1];
      }
      else if (p.y) { mesh = new THREE.Mesh(new THREE.CylinderGeometry(p.y[0], p.y[2], p.y[1], 22), mt); h = p.y[1]; }
      else { mesh = new THREE.Mesh(new THREE.SphereGeometry(p.s[0], 16, 12), mt); h = p.s[0] * 2; }
      mesh.position.set(p.at[0], p.rot ? p.at[1] : p.at[1] + h / 2, p.at[2]);   // у повёрнутых деталей at = центр
      if (p.rot) mesh.rotation.set(p.rot[0] * Math.PI / 180, p.rot[1] * Math.PI / 180, p.rot[2] * Math.PI / 180);
      if (p.k) mesh.scale.set(p.k[0], p.k[1], p.k[2]);
      mesh.castShadow = !p.op && !p.em; mesh.receiveShadow = true; g.add(mesh);
    });
    g.scale.set(m.width / M.w, m.height / M.h, m.depth / M.d);
    return g;
  }

  function buildFurn(m) {
    const g = new THREE.Group(), c = m.color || '#bbb', W = m.width, D = m.depth, H = m.height;
    const A = (w, h, d, x, y, z, col, o) => { const b = box(w, h, d, col || c, x, y, z, o); g.add(b); return b; };
    const dark = '#6f5a44';
    switch (m.kind) {
      case 'bed':
        A(W, H * .45, D, 0, H * .225, 0, dark); A(W * .96, H * .35, D * .96, 0, H * .45 + H * .175, 0);
        A(W, H * 1.6, .08, 0, H * .8, -D / 2 + .04, dark);
        A(W * .4, .1, .38, -W * .22, H * .8 + .03, -D / 2 + .35, '#ffffff'); A(W * .4, .1, .38, W * .22, H * .8 + .03, -D / 2 + .35, '#ffffff'); break;
      case 'sofa': case 'armchair': {
        const arm = Math.min(.18, W * .12);
        A(W, H * .45, D, 0, H * .225, 0); A(W - 2 * arm, H * .35, D * .75, 0, H * .45 + H * .1, D * .1, c);
        A(W, H, D * .22, 0, H / 2, -D / 2 + D * .11); A(arm, H * .75, D, -W / 2 + arm / 2, H * .375, 0); A(arm, H * .75, D, W / 2 - arm / 2, H * .375, 0); break; }
      case 'chair':
        A(W, .06, D, 0, .45, 0); A(W, .42, .05, 0, .66, -D / 2 + .025);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => A(.04, .45, .04, q[0] * (W / 2 - .03), .225, q[1] * (D / 2 - .03), dark)); break;
      case 'table': case 'dining': case 'desk':
        A(W, .05, D, 0, H - .025, 0);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => A(.06, H - .05, .06, q[0] * (W / 2 - .06), (H - .05) / 2, q[1] * (D / 2 - .06), dark)); break;
      case 'roundtable': {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, .05, 28), mat(c)); t.position.y = H - .025; t.castShadow = t.receiveShadow = true; g.add(t);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, H - .05, 10), mat(dark)); l.position.y = (H - .05) / 2; g.add(l); break; }
      case 'plant': {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(W * .25, W * .2, .3, 14), mat('#8a5a3c')); pot.position.y = .15; pot.castShadow = true; g.add(pot);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(W * .45, 14, 10), mat(c)); leaf.position.y = H * .6; leaf.castShadow = true; g.add(leaf); break; }
      case 'counter': case 'dresser': A(W, H - .04, D, 0, (H - .04) / 2, 0); A(W + .02, .04, D + .02, 0, H - .02, 0, '#e8e4da'); break;
      case 'sink': A(W, H - .04, D, 0, (H - .04) / 2, 0); A(W + .02, .04, D + .02, 0, H - .02, 0, '#e8e4da'); A(W * .6, .02, D * .6, 0, H + .001, 0, '#9fb4bf'); break;
      case 'stove': A(W, H - .03, D, 0, (H - .03) / 2, 0); A(W, .03, D, 0, H - .015, 0, '#2a2a2a'); break;
      case 'fridge': A(W, H, D, 0, H / 2, 0); A(.03, H * .35, .03, W / 2 - .06, H * .65, D / 2 + .015, '#888'); break;
      case 'washer': A(W, H, D, 0, H / 2, 0); { const d = new THREE.Mesh(new THREE.CylinderGeometry(W * .3, W * .3, .03, 20), mat('#7aa7c7')); d.rotation.x = Math.PI / 2; d.position.set(0, H * .5, D / 2 + .005); g.add(d); } break;
      case 'bath': A(W, H, D, 0, H / 2, 0); A(W * .82, .02, D * .88, 0, H + .001, 0, '#bcd8e6'); break;
      case 'toilet': A(W, .4, D * .62, 0, .2, D * .19); A(W, .42, D * .26, 0, .21 + .2, -D / 2 + D * .13); break;
      case 'shower': A(W, .06, D, 0, .03, 0, '#e6e6e6'); A(W, H, D, 0, H / 2, 0, c, { transparent: true, opacity: .28, depthWrite: false }); break;
      case 'rug': A(W, H, D, 0, H / 2, 0); break;
      default: A(W, H, D, 0, H / 2, 0);
    }
    return g;
  }

  function lampsOn() { return opt.light; }
  function setLamps(on) { opt.light = on; needs = true; updLampBtn(); }      // день/вечер не трогаем
  function updLampBtn() { const b = FP.$('o3lamps'); if (b) b.textContent = opt.light ? 'Выключить свет' : 'Включить свет'; }

  // Функция затемнения у стен
  const aoc = new Map();
  function aoTex(w, d) {
    const k = w.toFixed(2) + 'x' + d.toFixed(2); let t = aoc.get(k); if (t) return t;
    const S = 64, W = Math.max(8, Math.min(1024, Math.round(w * S))), H = Math.max(8, Math.min(1024, Math.round(d * S))), e = .45 * S;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); };
    edge(0, 0, e, 0, 0, 0, e, H); edge(W, 0, W - e, 0, W - e, 0, e, H); edge(0, 0, 0, e, 0, 0, W, e); edge(0, H, 0, H - e, 0, H - e, W, e);   // в углах затемнение суммируется
    t = new THREE.CanvasTexture(cv); aoc.set(k, t); return t;
  }

  function autoAz() {                                       // сторона, куда смотрит больше всего окон (+25° чтобы свет шёл под углом)
    const f = FP.floor(), ws = FP.getWalls(f), acc = {};
    f.openings.forEach(o => {
      if (o.kind !== 'window') return; const w = ws.find(q => q.id === o.wallId); if (!w) return;
      const p = FP.openPos(w, o), k = ((Math.round(Math.atan2(-p.ny, -p.nx) / (Math.PI / 2)) % 4) + 4) % 4; acc[k] = (acc[k] || 0) + o.width;
    });
    const ks = Object.keys(acc); if (!ks.length) return 45;
    return +ks.sort((a, b) => acc[b] - acc[a])[0] * 90 + 25;
  }
  let aoMat = null;
  function cornerAO(r, f, H) {                              // затемнение вертикальных внутренних углов комнаты
    if (!aoMat) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 4; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0);
      gr.addColorStop(0, 'rgba(0,0,0,.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
      aoMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    }
    let P = FP.rpoly(r);
    if (!FP.inner()) P = FP.offsetPoly(P, P.map((_, i) => FP.wt(r, r.poly ? 'p' + i : ['n', 'e', 's', 'w'][i], f) / 2));
    const n = P.length, sg = FP.polySign(P), W = .35;
    const strip = (p0, p1) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([p0[0], 0, p0[1], p1[0], 0, p1[1], p1[0], H, p1[1], p0[0], H, p0[1]], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
      root.add(new THREE.Mesh(g, aoMat));
    };
    P.forEach((Q, i) => {
      const A = P[(i + n - 1) % n], Cn = P[(i + 1) % n], ax = Q[0] - A[0], ay = Q[1] - A[1], cx = Cn[0] - Q[0], cy = Cn[1] - Q[1], la = Math.hypot(ax, ay), lc = Math.hypot(cx, cy);
      if (la < .3 || lc < .3 || (ax * cy - ay * cx) * sg <= 0) return;      // только внутренние углы
      const ux = ax / la, uy = ay / la, vx = cx / lc, vy = cy / lc;
      strip([Q[0] - uy * sg * .004, Q[1] + ux * sg * .004], [Q[0] - ux * W - uy * sg * .004, Q[1] - uy * W + ux * sg * .004]);
      strip([Q[0] - vy * sg * .004, Q[1] + vx * sg * .004], [Q[0] + vx * W - vy * sg * .004, Q[1] + vy * W + vx * sg * .004]);
    });
  }

  function build() {
    clearRoot(); colRects = [];
    hemi.intensity = opt.night ? .2 : .7; sun.intensity = opt.night ? .08 : .55; fill.intensity = opt.night ? .04 : .2;
    scene.background.set(opt.night ? '#1a2030' : '#e3e8ee');
    // яркость = экспозиция (вечером), цвета не «выжигаются»
    renderer.toneMapping = opt.night ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = opt.night ? opt.lamp : 1;
    doors = [];
    const f = FP.floor(), st = FP.data.settings, walls = FP.getWalls(f), walking = isWalk();
    const wm = (walking && opt.walls !== 'glass') ? 'full' : opt.walls, cutH = wm === 'cut' ? opt.cut : undefined;

    if (env) {
      const n = opt.night; env.visible = dome.visible = walking;
      dome.material.map = n ? skyTex.n : skyTex.d; dome.material.needsUpdate = true;
      scene.fog.color.set(n ? '#2a3558' : '#cfdbe6'); scene.fog.near = walking ? 22 : 1e5; scene.fog.far = walking ? 120 : 1e5 + 500;
      const eb = bounds(); env.position.set(eb.cx, 0, eb.cz);
      envMats.cloud.color.set(n ? '#39415c' : '#ffffff'); envMats.houses.forEach(h => { h.m.material = n ? h.night : h.day; });
    }

    // пол, потолок
    f.rooms.forEach(r => {
      if (r.poly) {                                      // многоугольная комната: пол и потолок по контуру
        const fs = FP.floorSpec(r), frot = r.floorRot === 90;
        const mf = new THREE.Mesh(flatGeo(r.poly, 0, 1, (X, Z) => frot ? [Z, X] : [X, Z]), fmat(fs, false)); mf.receiveShadow = true; root.add(mf);
        if (walking && opt.ceil && !FP.hasRail(r)) { const pc = new THREE.Mesh(flatGeo(r.poly, f.height, -1, (X, Z) => [X, Z]), fmat(FP.ceilSpec(r), false, true)); pc.castShadow = true; root.add(pc); }
        return;
      }

      const fs = FP.floorSpec(r), fcol = FP.MAT.eff(fs), frot = r.floorRot === 90;
      const fl = new THREE.Mesh(new THREE.BoxGeometry(r.width, .04, r.depth), [mat(fcol), mat(fcol), fmat(fs, false), mat(fcol), mat(fcol), mat(fcol)]);
      uvFace(fl.geometry, 2, (u, v) => { const X = r.x + u * r.width, Z = r.y + (1 - v) * r.depth; return frot ? [Z, X] : [X, Z]; });   // мировые координаты: рисунок продолжается между комнатами
      fl.position.set(r.x + r.width / 2, -.02, r.y + r.depth / 2); fl.receiveShadow = true; root.add(fl);

      const ao = new THREE.Mesh(new THREE.PlaneGeometry(r.width, r.depth), new THREE.MeshBasicMaterial({ map: aoTex(r.width, r.depth), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      ao.rotation.x = -Math.PI / 2; ao.position.set(r.x + r.width / 2, .003, r.y + r.depth / 2); root.add(ao);

      if (walking && opt.ceil && !FP.hasRail(r)) {
        const cm = new THREE.Mesh(new THREE.PlaneGeometry(r.width, r.depth), fmat(FP.ceilSpec(r), false, true));
        const ua = cm.geometry.attributes.uv; for (let i = 0; i < 4; i++) ua.setXY(i, r.x + ua.getX(i) * r.width, r.y + ua.getY(i) * r.depth);   // текстура в метрах
        cm.rotation.x = Math.PI / 2; cm.position.set(r.x + r.width / 2, f.height, r.y + r.depth / 2); cm.castShadow = true; root.add(cm);
      }
    });

    // объединённые комнаты: пол на месте убранной стены
    FP.mergeInfo(f, walls).bridges.forEach(b => {
      const fs = FP.floorSpec(b.room), frot = b.room.floorRot === 90;
      const mb = new THREE.Mesh(flatGeo(b.pts, 0, 1, (X, Z) => frot ? [Z, X] : [X, Z]), fmat(fs, false)); mb.receiveShadow = true; root.add(mb);
    });

    // стены
    walls.forEach(w => {
      const L = FP.wlen(w); if (L < .01) return;
      const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, ang = -Math.atan2(uy, ux), col = w.color || st.wallColor;
      const put = (a0, a1, z0, z1, th, cc) => { const b = box(a1 - a0, z1 - z0, th, cc, w.x1 + ux * (a0 + a1) / 2, (z0 + z1) / 2, w.y1 + uy * (a0 + a1) / 2); b.rotation.y = ang; root.add(b); return b; };
      if (w.rail) {                                                   // перила вместо стены
        colRects.push({ cx: w.x1 + ux * L / 2, cy: w.y1 + uy * L / 2, ux, uy, hl: L / 2 + .02, ht: .04 });
        if (wm !== 'none') {
          const s0 = -w.e1 / 2, s1 = L + w.e2 / 2, RH = Math.min(1.05, cutH || 1.05), n = Math.max(1, Math.round((s1 - s0) / 1.0));
          put(s0, s1, RH - .045, RH, .06, '#5a5f66');                 // поручень
          put(s0, s1, .08, .13, .03, '#6d747c');                      // нижняя перекладина
          for (let i = 0; i <= n; i++) { const a = s0 + (s1 - s0) * i / n; put(a - .02, a + .02, 0, RH, .05, '#5a5f66'); }   // стойки
          for (let a = s0 + .1; a < s1 - .05; a += .11) put(a - .007, a + .007, .13, RH - .045, .014, '#7b8793');             // балясины
        }
        return;
      }

      FP.pieces(f, walls, w, undefined).forEach(p => { // коллизии: всегда полные высоты
        if ((p.type === 'wall' && p.z0 === 0) || p.type === 'block' || (p.type === 'door' && !(p.o && p.o.open))) {
          let s = p.s, e = p.e; if (s <= .0005) s -= w.e1; if (e >= L - .0005) e += w.e2;
          colRects.push({ cx: w.x1 + ux * (s + e) / 2, cy: w.y1 + uy * (s + e) / 2, ux, uy, hl: (e - s) / 2, ht: w.t / 2 });
        }
      });
      if (wm === 'none') return;
      FP.pieces(f, walls, w, cutH).forEach(p => {
        if (p.type === 'wall') {
          let s = p.s, e = p.e; if (s <= .0005) s -= w.e1; if (e >= L - .0005) e += w.e2;
          if (wm === 'glass') {
            const m = box(e - s, p.z1 - p.z0, w.t, col, w.x1 + ux * (s + e) / 2, (p.z0 + p.z1) / 2, w.y1 + uy * (s + e) / 2, { transparent: true, opacity: opt.op, depthWrite: false });
            m.castShadow = false; m.rotation.y = ang; root.add(m);
          } else wallSeg(w, s, e, p.z0, p.z1, ux, uy, ang);
        } else if (p.type === 'glass' && p.own) {
          const m = box(p.e - p.s, p.z1 - p.z0, .03, '#d5e3ee', w.x1 + ux * (p.s + p.e) / 2, (p.z0 + p.z1) / 2, w.y1 + uy * (p.s + p.e) / 2, { transparent: true, opacity: .55, depthWrite: false }); m.rotation.y = ang; m.castShadow = false; root.add(m);
          const fr = '#f5f3ee', fq = .05, mid = (p.s + p.e) / 2, T = w.t + .02;
          put(p.s, p.s + fq, p.z0, p.z1, T, fr); put(p.e - fq, p.e, p.z0, p.z1, T, fr);                    // рама
          put(p.s, p.e, p.z1 - fq, p.z1, T, fr); put(p.s, p.e, p.z0, p.z0 + fq, T, fr);
          put(mid - .02, mid + .02, p.z0, p.z1, .05, fr);                                                 // импост
          put(p.s - .04, p.e + .04, p.z0 - .03, p.z0, w.t + .1, '#ffffff');                               // подоконник
        } else if (p.type === 'door' && p.own) {
          const o = p.o, pos = FP.openPos(w, o), wd = p.e - p.s, hAlong = o.flip ? p.e : p.s, hgt = p.z1 - p.z0;
          const al = o.flip ? -1 : 1, sw = o.swing === -1 ? -1 : 1, dX = ux * al, dY = uy * al, nX = pos.nx * sw, nY = pos.ny * sw;
          const th0 = Math.atan2(dY, dX), sgn = (dX * nY - dY * nX) >= 0 ? 1 : -1;
          const T = o.main ? .055 : .042, dm = fmat(FP.doorSpec(o), false), hm = pmat('#cfd2d6', STY.chrome);
          const dg = new THREE.Group(); dg.position.set(w.x1 + ux * hAlong, p.z0, w.y1 + uy * hAlong);   // начало группы = петля
          const part = (geo, mt, x, y, z) => { const q = new THREE.Mesh(geo, mt); q.position.set(x, y, z); q.castShadow = q.receiveShadow = true; dg.add(q); return q; };
          part(rgeo(wd - .008, hgt - .006, T, .008), dm, wd / 2, hgt / 2, 0);                                  // полотно со скруглёнными кромками
          [[.27, .28], [.7, .4]].forEach(q => [-1, 1].forEach(sd => part(rgeo(wd * .66, hgt * q[1], .012, .004), dm, wd / 2, hgt * q[0], sd * (T / 2 + .002))));   // филёнки
          const hx = wd - .07, hy = Math.min(1.0, hgt * .48);
          [-1, 1].forEach(sd => {                                                                              // ручка-рычаг и розетка с двух сторон
            const ro = part(new THREE.CylinderGeometry(.026, .026, .012, 16), hm, hx, hy, sd * (T / 2 + .006)); ro.rotation.x = Math.PI / 2;
            part(rgeo(.12, .02, .02, .008), hm, hx - .05, hy, sd * (T / 2 + .022));
          });
          [.2, hgt / 2, hgt - .2].forEach(y => part(new THREE.CylinderGeometry(.011, .011, .09, 8), hm, 0, y, 0));   // петли
          if (o.main) part(new THREE.CylinderGeometry(.008, .008, .02, 8), hm, wd / 2, 1.55 < hgt ? 1.55 : hgt - .3, T / 2 + .004).rotation.x = Math.PI / 2;   // глазок
          root.add(dg); doors.push({ g: dg, o, th0, sgn });
          put(p.s - .04, p.s, 0, p.z1 + .04, w.t + .03, '#f4f1ea'); put(p.e, p.e + .04, 0, p.z1 + .04, w.t + .03, '#f4f1ea');   // наличники
          put(p.s - .04, p.e + .04, p.z1, p.z1 + .04, w.t + .03, '#f4f1ea');
        }
      });
    });
    // мебель
    if (wm !== 'none' && wm !== 'glass') f.rooms.forEach(r => { if (!r.merge) cornerAO(r, f, Math.min(f.height, cutH || f.height)); });
    let lamps = 0;
    f.furniture.forEach(m => {
      const M = FP.model(m), g = M ? buildModel(m, M) : buildFurn(m);      // нет модели в библиотеке: старая процедурная форма
      const yb = M ? (M.ceil ? f.height - m.height : (m.elev != null ? m.elev : (M.elev || 0))) : 0;
      g.position.set(m.x, yb, m.y); g.rotation.y = -(m.rotation || 0) * Math.PI / 180; if (m.flipX) g.scale.x *= -1; root.add(g);
      g.userData.fid = m.id;
      if (opt.light && M && M.light && m.on !== false && lamps < 12) {
        lamps++; const L = M.light, py = yb + (L.y || 0) * m.height / M.h;
        const pl = new THREE.PointLight(L.c, L.i, L.d); pl.position.set(m.x, py, m.y); root.add(pl);
        // «отражённый свет»: низкий слабый источник подсвечивает потолок и верх стен
        const bl = new THREE.PointLight(L.c, L.i * .35, L.d * 1.4); bl.position.set(m.x, Math.min(1.1, f.height * .4), m.y); root.add(bl);
      }
    });
    // свет/тени под размер плана
    const b = bounds();

    const saz = (opt.sunAz != null ? opt.sunAz : autoAz()) * Math.PI / 180, sev = 38 * Math.PI / 180, SD = b.r * 2 + 12;
    sun.target.position.set(b.cx, 0, b.cz); sun.position.set(b.cx + Math.cos(saz) * Math.cos(sev) * SD, Math.sin(sev) * SD, b.cz + Math.sin(saz) * Math.cos(sev) * SD);
    fill.target.position.set(b.cx, 0, b.cz); fill.position.set(b.cx - Math.cos(saz) * b.r, b.r * .8, b.cz - Math.sin(saz) * b.r);

    const sc = sun.shadow.camera, R = b.r * 1.1 + 2; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = .5; sc.far = b.r * 5 + 20; sc.updateProjectionMatrix();
  }
  function bounds() {
    const f = FP.floor(); const xs = [], zs = [];
    f.rooms.forEach(r => { xs.push(r.x, r.x + r.width); zs.push(r.y, r.y + r.depth); });
    f.walls.forEach(w => { xs.push(w.x1, w.x2); zs.push(w.y1, w.y2); });
    if (!xs.length) return { cx: 0, cz: 0, r: 5 };
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, r: Math.max(x1 - x0, z1 - z0) / 2 + 1 };
  }
  V3.fit = function () { const b = bounds(); orbit.tx = b.cx; orbit.tz = b.cz; orbit.ty = 0; orbit.dist = b.r * 2.6 + 3; };

  V3.shot = type => { renderer.render(scene, camera); const c = renderer.domElement; return { url: c.toDataURL(type, .92), w: c.width, h: c.height }; };

  V3.focus = () => (renderer && isWalk()) ? [walk.x, walk.z] : null;

  // ---------- ходьба ----------
  function collide() {
    const r = .15;
    for (let it = 0; it < 3; it++) colRects.forEach(q => {
      const dx = walk.x - q.cx, dz = walk.z - q.cy, lx = dx * q.ux + dz * q.uy, ly = -dx * q.uy + dz * q.ux;
      const px = clamp(lx, -q.hl, q.hl), py = clamp(ly, -q.ht, q.ht), ex = lx - px, ey = ly - py, d = Math.hypot(ex, ey);
      if (d >= r) return;
      let nl, nly;
      if (d < 1e-6) { nl = lx; nly = (ly >= 0 ? 1 : -1) * (q.ht + r); } else { nl = px + ex * r / d; nly = py + ey * r / d; }
      walk.x = q.cx + q.ux * nl - q.uy * nly; walk.z = q.cy + q.uy * nl + q.ux * nly;
    });
  }
  // автообход
  function updateWalk(dt) {
    const run = keys.ShiftLeft || keys.ShiftRight, sp = run ? 3.4 : 1.6;
    const fwd = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
    const str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), turn = ((keys.ArrowRight || keys.KeyE) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyQ) ? 1 : 0);
    walk.yaw += turn * 1.6 * dt;
    const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw), k = Math.min(1, dt * 9);
    vel.x += ((sy * fwd + cy * str) * sp - vel.x) * k; vel.z += ((-cy * fwd + sy * str) * sp - vel.z) * k;   // инерция
    walk.x += vel.x * dt; walk.z += vel.z * dt;
    const spd = Math.hypot(vel.x, vel.z); bobT += spd * dt * 4.2; walk.bob = Math.sin(bobT) * .012 * Math.min(1, spd / 1.6);   // покачивание головы
    if (spd > .01) collide();
    if (tour) {
      tour.t += dt; walk.yaw += .3 * dt;
      if (tour.t > 5) { tour.t = 0; const rs = FP.floor().rooms; if (rs.length) { tour.i = (tour.i + 1) % rs.length; V3.walkAt(...FP.roomCenter(rs[tour.i]), true); } }
    }
  }

  V3.walkAt = function (x, y, keepTour) {
    walk.x = x; walk.z = y; if (!keepTour) { tour = null; FP.$('o3tour').classList.remove('on'); }
    if (!isWalk()) { opt.cam = 'walk'; FP.$('o3cam').value = 'walk'; needs = true; }
    updateHelp();
  };
  function placeCamera() {

    const wantFov = isWalk() ? opt.fov : 60;
    if (camera.fov !== wantFov) { camera.fov = wantFov; camera.updateProjectionMatrix(); }

    if (isWalk()) {
      camera.position.set(walk.x, walk.eye + (walk.bob || 0), walk.z);
      camera.lookAt(walk.x + Math.sin(walk.yaw) * Math.cos(walk.pitch), walk.eye + Math.sin(walk.pitch), walk.z - Math.cos(walk.yaw) * Math.cos(walk.pitch));
    } else {
      const cp = Math.cos(orbit.pitch);
      camera.position.set(orbit.tx + orbit.dist * cp * Math.sin(orbit.yaw), orbit.ty + orbit.dist * Math.sin(orbit.pitch), orbit.tz + orbit.dist * cp * Math.cos(orbit.yaw));
      camera.lookAt(orbit.tx, orbit.ty, orbit.tz);
    }
  }

  function animDoors(dt) {                               // плавное открытие/закрытие
    doors.forEach(d => {
      const t = d.o.open ? DOOR_A : 0; let a = dAng.has(d.o.id) ? dAng.get(d.o.id) : t;
      if (Math.abs(a - t) > 1e-3) a += (t - a) * Math.min(1, dt * 7); else a = t;
      dAng.set(d.o.id, a); d.g.rotation.y = -(d.th0 + d.sgn * a);
    });
  }

  function loop(t) {
    raf = requestAnimationFrame(loop); const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;

    if (needs) { build(); needs = false; }
    // if (needs) { const t0 = performance.now(); build(); needs = false; console.log('build ms:', Math.round(performance.now() - t0)); }
    animDoors(dt);
    if (isWalk()) updateWalk(dt);
    placeCamera(); if (dome && dome.visible) dome.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  function resize() { if (!renderer || !host.clientWidth) return; renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }

  V3.init = function () {
    if (renderer) return true;
    if (!window.THREE) { host.innerHTML = '<p class="warn">Three.js не загрузился. Для 3D нужен интернет (CDN cdnjs.cloudflare.com).</p>'; return false; }
    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; host.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color('#e3e8ee');
    edgeMat = new THREE.LineBasicMaterial({ color: 0x5c564b });
    camera = new THREE.PerspectiveCamera(60, 1, .03, 400);
    hemi = new THREE.HemisphereLight(0xdfe9f5, 0x8a8f98, .55); scene.add(hemi);

    sun = new THREE.DirectionalLight(0xffffff, .85); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
    fill = new THREE.DirectionalLight(0xdfe6f0, .3); scene.add(fill, fill.target);              // заполняющий свет с обратной стороны

    root = new THREE.Group(); scene.add(root);

    scene.fog = new THREE.Fog(0xdbe8f3, 1e5, 1e5 + 500); buildEnv();

    new ResizeObserver(resize).observe(host);
    const cvs = renderer.domElement; let pd = null; cvs.tabIndex = 0;
    cvs.addEventListener('contextmenu', e => e.preventDefault());

    const tp = new Map(); let pinch = null;
    cvs.addEventListener('pointerdown', e => {
      cvs.focus(); cvs.setPointerCapture(e.pointerId); tp.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (tp.size === 2) { const a = [...tp.values()]; pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, cy: (a[0].y + a[1].y) / 2 }; pd = null; return; }
      pd = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, shift: e.shiftKey };
    });
    cvs.addEventListener('pointerup', e => {
      tp.delete(e.pointerId); if (tp.size < 2) pinch = null;
      if (pd && pd.btn === 0 && Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy) < 4) pickLamp(e); pd = null;
    });
    cvs.addEventListener('pointercancel', e => { tp.delete(e.pointerId); pinch = null; pd = null; });
    cvs.addEventListener('pointermove', e => {
      if (tp.has(e.pointerId)) tp.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && tp.size >= 2) {                           // два пальца: щипок = зум/FOV, вертикальный сдвиг = идти вперёд/назад
        const a = [...tp.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, cy = (a[0].y + a[1].y) / 2, k = pinch.d / d;
        if (isWalk()) { opt.fov = clamp(opt.fov * k, 45, 105); const dy = cy - pinch.cy; walk.x += Math.sin(walk.yaw) * -dy * .012; walk.z += -Math.cos(walk.yaw) * -dy * .012; collide(); }
        else orbit.dist = clamp(orbit.dist * k, 1.5, 120);
        pinch.d = d; pinch.cy = cy; return;
      }
      if (!pd) return; const dx = e.clientX - pd.x, dy = e.clientY - pd.y; pd.x = e.clientX; pd.y = e.clientY;
      if (isWalk()) { walk.yaw += dx * .005; walk.pitch = clamp(walk.pitch - dy * .004, -1.3, 1.3); }
      else if (pd.btn === 2 || pd.shift) { const k = orbit.dist * .0018; orbit.tx -= Math.cos(orbit.yaw) * dx * k; orbit.tz += Math.sin(orbit.yaw) * dx * k; orbit.tx += Math.sin(orbit.yaw) * dy * k; orbit.tz += Math.cos(orbit.yaw) * dy * k; }
      else { orbit.yaw -= dx * .007; orbit.pitch = clamp(orbit.pitch + dy * .007, .05, 1.55); }
    });

    // клик (без перетаскивания) по лампе / экрану / подсветке: вкл-выкл
    const ray = new THREE.Raycaster(), mv = new THREE.Vector2(); ray.params.Line.threshold = 0.01;
    function pickLamp(e) {
      const rc = cvs.getBoundingClientRect();
      mv.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(mv, camera);
      const hit = ray.intersectObjects(root.children, true)[0]; if (!hit) return;
      let o = hit.object; while (o && !(o.userData && o.userData.fid)) o = o.parent;
      if (!o) return;
      const m = FP.floor().furniture.find(q => q.id === o.userData.fid);
      if (!m || !FP.isLamp(FP.model(m))) return;
      const nowOn = !(opt.light && m.on !== false); FP.snap();
      if (nowOn && !opt.light) { FP.floor().furniture.forEach(q => { if (q !== m && FP.isLamp(FP.model(q))) q.on = false; }); opt.light = true; }   // свет был выключен: включается только эта лампа
      m.on = nowOn; FP.changed();
    }

    cvs.addEventListener('wheel', e => {
      e.preventDefault();
      if (isWalk()) {
        if (e.shiftKey) walk.eye = clamp(walk.eye - e.deltaY * .0005, 1, 2.2);
        else if (e.ctrlKey) opt.fov = clamp(opt.fov + e.deltaY * .03, 45, 105);          // Ctrl+колесо: угол обзора
        else { const st = -clamp(e.deltaY, -120, 120) * .006; walk.x += Math.sin(walk.yaw) * st; walk.z += -Math.cos(walk.yaw) * st; collide(); }   // колесо: шаг вперёд/назад
      } else orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * .001), 1.5, 120);
    }, { passive: false });
    document.addEventListener('keydown', e => { if (FP.view === '3d' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { keys[e.code] = true; if (isWalk() && /^(Arrow|Space)/.test(e.code)) e.preventDefault(); } });
    document.addEventListener('keyup', e => { keys[e.code] = false; });
    bindBar(); resize(); return true;
  };
  V3.start = function () { if (!V3.init()) return; needs = true; resize(); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); refreshRooms(); updateHelp(); updLampBtn(); if (opt.sunAz == null) FP.$('o3sun').value = Math.round(autoAz()); };
  V3.stop = function () { cancelAnimationFrame(raf); raf = 0; };

  // ---------- панель 3D ----------
  function refreshRooms() {
    const s = FP.$('o3room'), v = s.value; s.innerHTML = '';
    FP.floor().rooms.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; s.appendChild(o); });
    if (v) s.value = v;
  }
  function updateHelp() {
    FP.$('o3help').textContent = isWalk() ? 'WASD / стрелки — ходьба, Q/E — поворот, мышь — взгляд, Shift — бег, колесо — вперёд/назад, Ctrl+колесо — угол обзора, Shift+колесо — рост глаз' : 'ЛКМ — вращать, ПКМ/Shift — сдвиг, колесо — масштаб';
    FP.$('o3cutv').textContent = opt.cut.toFixed(1) + ' м';
  }
  function bindBar() {
    FP.$('o3walls').onchange = e => { opt.walls = e.target.value; needs = true; };
    FP.$('o3cut').oninput = e => { opt.cut = +e.target.value; if (opt.walls !== 'cut') { opt.walls = 'cut'; FP.$('o3walls').value = 'cut'; } needs = true; updateHelp(); };
    FP.$('o3ceil').onchange = e => { opt.ceil = e.target.checked; needs = true; };
    FP.$('o3night').onchange = e => { opt.night = e.target.checked; if (opt.night) opt.light = true; needs = true; updLampBtn(); };   // при «вечер» свет сразу включён, дальше можно выключить
    FP.$('o3lamp').oninput = e => { opt.lamp = +e.target.value; if (renderer) renderer.toneMappingExposure = opt.night ? opt.lamp : 1; };   // без пересборки сцены
    FP.$('o3lamps').onclick = () => {
      if (!FP.floor().furniture.some(m => { const M = FP.model(m); return M && M.light; })) { alert('В плане нет ламп. Добавьте люстру, торшер или светильник из каталога «Свет и электрика».'); return; }
      setLamps(!opt.light);
    };
    FP.$('o3sun').oninput = e => { opt.sunAz = +e.target.value; needs = true; };
    FP.$('o3sunAuto').onclick = () => { opt.sunAz = null; FP.$('o3sun').value = Math.round(autoAz()); needs = true; };

    FP.$('o3cam').onchange = e => {
      const prev = opt.cam; opt.cam = e.target.value;
      if (opt.cam === 'top') { orbit.pitch = 1.55; orbit.yaw = 0; }
      if (opt.cam === 'orbit' && prev === 'top') { orbit.pitch = .75; orbit.yaw = .6; }
      if (opt.cam === 'walk') { const r = FP.floor().rooms.find(r => r.id === FP.$('o3room').value) || FP.floor().rooms[0]; if (r) { const c0 = FP.roomCenter(r); walk.x = c0[0]; walk.z = c0[1]; } }
      if (opt.cam !== 'walk') { tour = null; FP.$('o3tour').classList.remove('on'); }
      needs = true; updateHelp();
    };
    FP.$('o3go').onclick = () => { const r = FP.floor().rooms.find(r => r.id === FP.$('o3room').value); if (r) V3.walkAt(...FP.roomCenter(r)) };
    FP.$('o3tour').onclick = () => {
      if (tour) { tour = null; FP.$('o3tour').classList.remove('on'); return; }
      const rs = FP.floor().rooms; if (!rs.length) return; tour = { i: 0, t: 0 }; FP.$('o3tour').classList.add('on'); V3.walkAt(...FP.roomCenter(rs[0]), true);
    };
    FP.$('o3fit').onclick = () => { V3.fit(); };
    FP.$('o3op').oninput = e => {
      opt.op = +e.target.value;
      if (opt.walls !== 'glass') { opt.walls = 'glass'; FP.$('o3walls').value = 'glass'; }
      needs = true;
    };
  }
  FP.listeners.push(noSave => { if (!noSave) { needs = true; if (renderer && FP.view === '3d') refreshRooms(); } updLampBtn(); });
})();
