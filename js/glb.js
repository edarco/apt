(function () {
  // Хранилище GLB: память (buf), IndexedDB (постоянно), готовые шаблоны Three.js (tpl)
  const G = FP.glb = { buf: new Map(), tpl: new Map(), pend: new Map() };

  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const rq = indexedDB.open('fp_glb', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('m');
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  }));
  const tx = (mode, fn) => db().then(d => new Promise((res, rej) => {
    const t = d.transaction('m', mode), r = fn(t.objectStore('m'));
    t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
  }));
  const b64 = ab => { let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;

  G.save = (id, ab) => { G.buf.set(id, ab); return tx('readwrite', s => s.put(ab, id)).catch(() => {}); };

  // PBR-материалы GLB → Phong (под наш свет r128 без sRGB); текстуры считаем «как есть»
  const conv = m => {
    if (Array.isArray(m)) return m.map(conv);
    if (m.map) { m.map.encoding = THREE.LinearEncoding; m.map.needsUpdate = true; }
    return new THREE.MeshPhongMaterial({ color: m.color || 0xffffff, map: m.map || null, transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest || 0, vertexColors: m.vertexColors, emissive: m.emissive || 0x000000, emissiveMap: m.emissiveMap || null, shininess: 25 });
  };

  // разобрать GLB в шаблон (центр по XZ, низ на полу); рамер модели в метрах
  G.ensure = id => {
    if (G.tpl.has(id)) return Promise.resolve(G.tpl.get(id));
    if (G.pend.has(id)) return G.pend.get(id);
    if (!G.buf.has(id)) return Promise.reject(new Error('нет данных модели ' + id));
    if (!THREE.GLTFLoader) return Promise.reject(new Error('GLTFLoader не загрузился (нужен интернет)'));
    const p = new Promise((res, rej) => new THREE.GLTFLoader().parse(G.buf.get(id), '', gltf => {
      const o = gltf.scene; o.traverse(n => { if (n.isMesh) { n.material = conv(n.material); n.castShadow = n.receiveShadow = true; } });
      const bb = new THREE.Box3().setFromObject(o), s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), wrap = new THREE.Group();
      o.position.set(-c.x, -bb.min.y, -c.z); wrap.add(o);
      const rec = { obj: wrap, w: s.x, h: s.y, d: s.z }; G.tpl.set(id, rec); res(rec);
    }, rej));
    G.pend.set(id, p);
    p.then(() => { G.pend.delete(id); FP.v3 && FP.v3.invalidate && FP.v3.invalidate(); }, e => { G.pend.delete(id); console.warn('GLB', id, e); });
    return p;
  };
  G.get = id => { const r = G.tpl.get(id); if (!r) { G.ensure(id).catch(() => {}); return null; } return r.obj.clone(true); };   // клон или null (ещё грузится)
  G.add = ab => { const id = 'g_' + Date.now().toString(36); G.save(id, ab); return G.ensure(id).then(r => ({ id, w: r.w, h: r.h, d: r.d })); };

  // встраивание в JSON проекта
  G.pack = ids => { const r = {}; let n = 0; ids.forEach(id => { if (G.buf.has(id)) { r[id] = b64(G.buf.get(id)); n++; } }); return n ? r : null; };
  G.unpack = o => Object.keys(o || {}).forEach(id => { try { G.save(id, unb64(o[id])); G.ensure(id).catch(() => {}); } catch (e) {} });

  // при старте: подгрузить сохранённые модели из IndexedDB
  Object.keys(FP.LIB.models).forEach(id => {
    if (!FP.LIB.models[id].glb) return;
    tx('readonly', s => s.get(id)).then(ab => { if (ab) { G.buf.set(id, ab); G.ensure(id).catch(() => {}); } }, () => {});
  });
})();
