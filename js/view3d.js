(function () {
  const host = FP.$('c3d'), V3 = FP.v3 = {};
  let renderer, scene, camera, root, sun, raf = 0, last = 0, needs = true, cache = new Map(), colRects = [], tour = null;
  let edgeMat = null;
  const orbit = { yaw: 0.6, pitch: 0.75, dist: 14, tx: 0, ty: 0, tz: 0 };
  const walk = { x: 0, z: 0, yaw: 0, pitch: 0, eye: 1.6 };
  const opt = { walls: 'full', cut: 1.0, cam: 'orbit', ceil: true, op: 0.3, fov: 78, night: false };
  let hemi;
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
  function fmat(spec, inner) {                       // inner: внутренняя грань стены (polygonOffset, чтобы не мерцала на общей стене)
    const P = FP.MAT.get(spec.m), col = spec.c || P.c, key = P.id + '|' + col + '|' + (inner ? 1 : 0);
    let m = fcache.get(key);
    if (!m) {
      const o = { color: new THREE.Color(P.tex ? '#ffffff' : col) };
      if (P.tex) o.map = FP.MAT.texture(P, col);
      if (inner) { o.polygonOffset = true; o.polygonOffsetFactor = -1; o.polygonOffsetUnits = -1; }
      m = new THREE.MeshLambertMaterial(o); fcache.set(key, m);
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

  function clearRoot() {
    while (root.children.length) { const o = root.children[0]; root.remove(o); o.traverse(n => { if (n.geometry) n.geometry.dispose(); }); }
    cache.forEach(m => m.dispose()); cache.clear();
  }

  // ---------- модели из библиотеки (FP.LIB) ----------
  const TOK = { wh: '#f4f2ee', bk: '#2a2a2c', ch: '#c9ccd0', gl: '#9ecbf0', dw: '#6f5a44' };
  function shade(col, k) { const c = new THREE.Color(col); if (k < 1) c.multiplyScalar(k); else c.lerp(new THREE.Color('#ffffff'), k - 1); return '#' + c.getHexString(); }
  const pcol = (t, main) => t === 'm' ? main : t === 'd' ? shade(main, .72) : t === 'l' ? shade(main, 1.35) : (TOK[t] || t);
  function buildModel(m, M) {
    const g = new THREE.Group(), main = m.color || '#bbb';
    M.parts.forEach(p => {
      const col = pcol(p.c || 'm', main), o = {}; let mesh, h;
      if (p.op) { o.transparent = true; o.opacity = p.op; o.depthWrite = false; }
      if (p.em && opt.night) o.emissive = new THREE.Color(col);          // светится только в режиме «вечер»
      if (p.b) { mesh = new THREE.Mesh(bgeo(p.b[0], p.b[1], p.b[2]), mat(col, o)); h = p.b[1]; }
      else if (p.y) { mesh = new THREE.Mesh(new THREE.CylinderGeometry(p.y[0], p.y[2], p.y[1], 22), mat(col, o)); h = p.y[1]; }
      else { mesh = new THREE.Mesh(new THREE.SphereGeometry(p.s[0], 16, 12), mat(col, o)); h = p.s[0] * 2; }
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

  function build() {
    clearRoot(); colRects = [];
    hemi.intensity = opt.night ? .12 : .55; sun.intensity = opt.night ? .1 : .85; scene.background.set(opt.night ? '#1a2030' : '#e3e8ee');
    const f = FP.floor(), st = FP.data.settings, walls = FP.getWalls(f), walking = isWalk();
    const wm = (walking && opt.walls !== 'glass') ? 'full' : opt.walls, cutH = wm === 'cut' ? opt.cut : undefined;
    // пол, потолок
    f.rooms.forEach(r => {

      const fs = FP.floorSpec(r), fcol = FP.MAT.eff(fs), frot = r.floorRot === 90;
      const fl = new THREE.Mesh(new THREE.BoxGeometry(r.width, .04, r.depth), [mat(fcol), mat(fcol), fmat(fs, false), mat(fcol), mat(fcol), mat(fcol)]);
      uvFace(fl.geometry, 2, (u, v) => { const X = r.x + u * r.width, Z = r.y + (1 - v) * r.depth; return frot ? [Z, X] : [X, Z]; });   // мировые координаты: рисунок продолжается между комнатами
      fl.position.set(r.x + r.width / 2, -.02, r.y + r.depth / 2); fl.receiveShadow = true; root.add(fl);

      if (walking && opt.ceil) { const cm = new THREE.Mesh(new THREE.PlaneGeometry(r.width, r.depth), mat('#fbfaf7')); cm.rotation.x = Math.PI / 2; cm.position.set(r.x + r.width / 2, f.height, r.y + r.depth / 2); root.add(cm); }
    });
    // стены
    walls.forEach(w => {
      const L = FP.wlen(w); if (L < .01) return;
      const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, ang = -Math.atan2(uy, ux), col = w.color || st.wallColor;
      const put = (a0, a1, z0, z1, th, cc) => { const b = box(a1 - a0, z1 - z0, th, cc, w.x1 + ux * (a0 + a1) / 2, (z0 + z1) / 2, w.y1 + uy * (a0 + a1) / 2); b.rotation.y = ang; root.add(b); return b; };
      FP.pieces(f, walls, w, undefined).forEach(p => { // коллизии: всегда полные высоты
        if ((p.type === 'wall' && p.z0 === 0) || p.type === 'block') {
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
          const m = box(p.e - p.s, p.z1 - p.z0, .03, '#9ecbf0', w.x1 + ux * (p.s + p.e) / 2, (p.z0 + p.z1) / 2, w.y1 + uy * (p.s + p.e) / 2, { transparent: true, opacity: .35, depthWrite: false }); m.rotation.y = ang; m.castShadow = false; root.add(m);
          const fr = '#f5f3ee', fq = .05, mid = (p.s + p.e) / 2, T = w.t + .02;
          put(p.s, p.s + fq, p.z0, p.z1, T, fr); put(p.e - fq, p.e, p.z0, p.z1, T, fr);                    // рама
          put(p.s, p.e, p.z1 - fq, p.z1, T, fr); put(p.s, p.e, p.z0, p.z0 + fq, T, fr);
          put(mid - .02, mid + .02, p.z0, p.z1, .05, fr);                                                 // импост
          put(p.s - .04, p.e + .04, p.z0 - .03, p.z0, w.t + .1, '#ffffff');                               // подоконник
        } else if (p.type === 'door' && p.own) {
          const o = p.o, pos = FP.openPos(w, o), hAlong = o.flip ? p.e : p.s, hx = w.x1 + ux * hAlong, hy = w.y1 + uy * hAlong;
          const al = o.flip ? -1 : 1, sw = o.swing === -1 ? -1 : 1, a = 80 * Math.PI / 180;
          const dx = Math.cos(a) * ux * al + Math.sin(a) * pos.nx * sw, dy = Math.cos(a) * uy * al + Math.sin(a) * pos.ny * sw, wd = p.e - p.s;
          const m = box(wd, p.z1 - p.z0, .04, '#8a6a4a', hx + dx * wd / 2, (p.z0 + p.z1) / 2, hy + dy * wd / 2); m.rotation.y = -Math.atan2(dy, dx); root.add(m);
          const hl = (p.e - p.s) / 2 - .09, hHand = 1.0 - (p.z0 + p.z1) / 2;
          [-1, 1].forEach(sd => m.add(box(.12, .025, .03, '#c9ccd0', hl, hHand, sd * .035)));               // ручка с двух сторон
          put(p.s - .04, p.s, 0, p.z1 + .04, w.t + .03, '#f4f1ea'); put(p.e, p.e + .04, 0, p.z1 + .04, w.t + .03, '#f4f1ea');   // наличники
          put(p.s - .04, p.e + .04, p.z1, p.z1 + .04, w.t + .03, '#f4f1ea');
        }
      });
    });
    // мебель
    let lamps = 0;
    f.furniture.forEach(m => {
      const M = FP.model(m), g = M ? buildModel(m, M) : buildFurn(m);      // нет модели в библиотеке: старая процедурная форма
      const yb = M ? (M.ceil ? f.height - m.height : (m.elev != null ? m.elev : (M.elev || 0))) : 0;
      g.position.set(m.x, yb, m.y); g.rotation.y = -(m.rotation || 0) * Math.PI / 180; if (m.flipX) g.scale.x *= -1; root.add(g);
      if (opt.night && M && M.light && lamps < 14) {
        lamps++; const L = M.light, pl = new THREE.PointLight(L.c, L.i, L.d); pl.position.set(m.x, yb + (L.y || 0) * m.height / M.h, m.y); root.add(pl);
      }
    });
    // свет/тени под размер плана
    const b = bounds(); sun.target.position.set(b.cx, 0, b.cz); sun.position.set(b.cx + b.r * .8, b.r * 1.6, b.cz + b.r * .5);
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
  function updateWalk(dt) {
    const run = keys.ShiftLeft || keys.ShiftRight, sp = (run ? 3.4 : 1.6) * dt;
    const fwd = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
    const str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), turn = ((keys.ArrowRight || keys.KeyE) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyQ) ? 1 : 0);
    walk.yaw += turn * 1.6 * dt;
    const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
    walk.x += (sy * fwd + cy * str) * sp; walk.z += (-cy * fwd + sy * str) * sp;
    if (fwd || str) collide();
    if (tour) {
      tour.t += dt; walk.yaw += .3 * dt;
      if (tour.t > 5) { tour.t = 0; const rs = FP.floor().rooms; if (rs.length) { tour.i = (tour.i + 1) % rs.length; V3.walkAt(rs[tour.i].x + rs[tour.i].width / 2, rs[tour.i].y + rs[tour.i].depth / 2, true); } }
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
      camera.position.set(walk.x, walk.eye, walk.z);
      camera.lookAt(walk.x + Math.sin(walk.yaw) * Math.cos(walk.pitch), walk.eye + Math.sin(walk.pitch), walk.z - Math.cos(walk.yaw) * Math.cos(walk.pitch));
    } else {
      const cp = Math.cos(orbit.pitch);
      camera.position.set(orbit.tx + orbit.dist * cp * Math.sin(orbit.yaw), orbit.ty + orbit.dist * Math.sin(orbit.pitch), orbit.tz + orbit.dist * cp * Math.cos(orbit.yaw));
      camera.lookAt(orbit.tx, orbit.ty, orbit.tz);
    }
  }
  function loop(t) {
    raf = requestAnimationFrame(loop); const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;

    if (needs) { build(); needs = false; }
    // if (needs) { const t0 = performance.now(); build(); needs = false; console.log('build ms:', Math.round(performance.now() - t0)); }

    if (isWalk()) updateWalk(dt);
    placeCamera(); renderer.render(scene, camera);
  }
  function resize() { if (!renderer || !host.clientWidth) return; renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }

  V3.init = function () {
    if (renderer) return true;
    if (!window.THREE) { host.innerHTML = '<p class="warn">Three.js не загрузился. Для 3D нужен интернет (CDN cdnjs.cloudflare.com).</p>'; return false; }
    renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; host.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color('#e3e8ee');
    edgeMat = new THREE.LineBasicMaterial({ color: 0x7d7568 });
    camera = new THREE.PerspectiveCamera(60, 1, .03, 400);
    hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f98, .55); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, .85); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; scene.add(sun, sun.target);
    root = new THREE.Group(); scene.add(root);
    new ResizeObserver(resize).observe(host);
    const cvs = renderer.domElement; let pd = null; cvs.tabIndex = 0;
    cvs.addEventListener('contextmenu', e => e.preventDefault());
    cvs.addEventListener('pointerdown', e => { cvs.focus(); cvs.setPointerCapture(e.pointerId); pd = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey }; });
    cvs.addEventListener('pointerup', () => { pd = null; });
    cvs.addEventListener('pointermove', e => {
      if (!pd) return; const dx = e.clientX - pd.x, dy = e.clientY - pd.y; pd.x = e.clientX; pd.y = e.clientY;
      if (isWalk()) { walk.yaw += dx * .005; walk.pitch = clamp(walk.pitch - dy * .004, -1.3, 1.3); }
      else if (pd.btn === 2 || pd.shift) { const k = orbit.dist * .0018; orbit.tx -= Math.cos(orbit.yaw) * dx * k; orbit.tz += Math.sin(orbit.yaw) * dx * k; orbit.tx += Math.sin(orbit.yaw) * dy * k; orbit.tz += Math.cos(orbit.yaw) * dy * k; }
      else { orbit.yaw -= dx * .007; orbit.pitch = clamp(orbit.pitch + dy * .007, .05, 1.55); }
    });
    cvs.addEventListener('wheel', e => {
      e.preventDefault();
      if (isWalk()) {
        if (e.shiftKey) walk.eye = clamp(walk.eye - e.deltaY * .0005, 1, 2.2);
        else opt.fov = clamp(opt.fov + e.deltaY * .03, 45, 105);
      } else orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * .001), 1.5, 120);
    }, { passive: false });
    document.addEventListener('keydown', e => { if (FP.view === '3d' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { keys[e.code] = true; if (isWalk() && /^(Arrow|Space)/.test(e.code)) e.preventDefault(); } });
    document.addEventListener('keyup', e => { keys[e.code] = false; });
    bindBar(); resize(); return true;
  };
  V3.start = function () { if (!V3.init()) return; needs = true; resize(); cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); refreshRooms(); updateHelp(); };
  V3.stop = function () { cancelAnimationFrame(raf); raf = 0; };

  // ---------- панель 3D ----------
  function refreshRooms() {
    const s = FP.$('o3room'), v = s.value; s.innerHTML = '';
    FP.floor().rooms.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name; s.appendChild(o); });
    if (v) s.value = v;
  }
  function updateHelp() {
    FP.$('o3help').textContent = isWalk() ? 'WASD / стрелки — ходьба, Q/E — поворот, мышь — взгляд, Shift — бег, колесо — угол обзора, Shift+колесо — рост глаз' : 'ЛКМ — вращать, ПКМ/Shift — сдвиг, колесо — масштаб';
    FP.$('o3cutv').textContent = opt.cut.toFixed(1) + ' м';
  }
  function bindBar() {
    FP.$('o3walls').onchange = e => { opt.walls = e.target.value; needs = true; };
    FP.$('o3cut').oninput = e => { opt.cut = +e.target.value; if (opt.walls !== 'cut') { opt.walls = 'cut'; FP.$('o3walls').value = 'cut'; } needs = true; updateHelp(); };
    FP.$('o3ceil').onchange = e => { opt.ceil = e.target.checked; needs = true; };
    FP.$('o3night').onchange = e => { opt.night = e.target.checked; needs = true; };
    FP.$('o3cam').onchange = e => {
      const prev = opt.cam; opt.cam = e.target.value;
      if (opt.cam === 'top') { orbit.pitch = 1.55; orbit.yaw = 0; }
      if (opt.cam === 'orbit' && prev === 'top') { orbit.pitch = .75; orbit.yaw = .6; }
      if (opt.cam === 'walk') { const r = FP.floor().rooms.find(r => r.id === FP.$('o3room').value) || FP.floor().rooms[0]; if (r) { walk.x = r.x + r.width / 2; walk.z = r.y + r.depth / 2; } }
      if (opt.cam !== 'walk') { tour = null; FP.$('o3tour').classList.remove('on'); }
      needs = true; updateHelp();
    };
    FP.$('o3go').onclick = () => { const r = FP.floor().rooms.find(r => r.id === FP.$('o3room').value); if (r) V3.walkAt(r.x + r.width / 2, r.y + r.depth / 2); };
    FP.$('o3tour').onclick = () => {
      if (tour) { tour = null; FP.$('o3tour').classList.remove('on'); return; }
      const rs = FP.floor().rooms; if (!rs.length) return; tour = { i: 0, t: 0 }; FP.$('o3tour').classList.add('on'); V3.walkAt(rs[0].x + rs[0].width / 2, rs[0].y + rs[0].depth / 2, true);
    };
    FP.$('o3fit').onclick = () => { V3.fit(); };
    FP.$('o3op').oninput = e => {
      opt.op = +e.target.value;
      if (opt.walls !== 'glass') { opt.walls = 'glass'; FP.$('o3walls').value = 'glass'; }
      needs = true;
    };
  }
  FP.listeners.push(noSave => { if (!noSave) { needs = true; if (renderer && FP.view === '3d') refreshRooms(); } });
})();
