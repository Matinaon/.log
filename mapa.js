/* .log — mapa 3D de Buenos Aires
   Calles: OpenStreetMap (© colaboradores de OpenStreetMap, ODbL).
   Manzanas: derivadas de las calles. Alturas: ilustrativas, no reales. */
(function(){
  const D = window.MAPA_DATA;
  const box = document.getElementById("mapa-canvas");
  const AZUL = 0x085cf0, ROSA = 0xff4684, LINEA = 0x9a9a9a;

  /* ---------- datos: calles ---------- */
  const [nombresTxt, viasTxt] = D.calles.split("\n");
  const NOMBRES = nombresTxt.split("|");
  const CALLES = viasTxt.split(";").map(v => {
    const a = v.split(",").map(Number);
    let x = a[2], y = a[3]; const pts = [[x*D.u, y*D.u]];
    for (let i = 4; i < a.length; i += 2){ x += a[i]; y += a[i+1]; pts.push([x*D.u, y*D.u]); }
    return {clase:a[0], nombre:NOMBRES[a[1]], pts};
  });

  /* ---------- lugares del catálogo (coordenadas en metros desde el Obelisco) ---------- */
  const LUG = [
    {id:"iglesia-san-nicolas-de-bari", nombre:"Iglesia San Nicolás de Bari", hoy:"Obelisco", x:0, y:0},
    {id:"pabellon-argentino", nombre:"Pabellón Argentino", hoy:"Plaza San Martín", x:458, y:946},
    {id:"palacio-miro", nombre:"Palacio Miró", hoy:"Plaza Lavalle", x:-385, y:278},
    {id:"palacio-unzue", nombre:"Palacio Unzué", hoy:"Biblioteca Nacional", x:-1100, y:2193},
    {id:"penitenciaria-nacional", nombre:"Penitenciaría Nacional", hoy:"Parque Las Heras", x:-2300, y:2080}
  ];

  /* ---------- escena ---------- */
  const W = () => box.clientWidth, H = () => box.clientHeight;
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W(), H());
  renderer.setClearColor(0xffffff, 1);
  box.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, W()/H(), 5, 20000);
  const P = (x, y, z) => new THREE.Vector3(x, z || 0, -y);   // x este, y norte, z altura

  // piso
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshBasicMaterial({color:0xffffff}));
  piso.rotation.x = -Math.PI/2; piso.position.set(-1400, -0.5, -700); scene.add(piso);

  // calles: líneas finas (las avenidas un poco más marcadas)
  const capas = [[], [], []];
  CALLES.forEach(c => {
    const k = c.clase <= 1 ? 0 : (c.clase <= 3 ? 1 : 2);
    for (let i = 0; i < c.pts.length - 1; i++){
      capas[k].push(c.pts[i][0], 0.2, -c.pts[i][1], c.pts[i+1][0], 0.2, -c.pts[i+1][1]);
    }
  });
  [0x5a7cf0, 0xb4b4b4, 0xd9d9d9].forEach((col, k) => {
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(capas[k], 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:col, transparent:true, opacity:k ? 1 : .55})));
  });

  /* ---------- manzanas: volúmenes simples ---------- */
  function rnd(i){ const s = Math.sin(i*127.1 + 311.7)*43758.5453; return s - Math.floor(s); }
  function dentro(px, py, poly){ let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi)*(py - yi)/(yj - yi) + xi)) c = !c; }
    return c; }
  function alto(cx, cy, i){
    const dc = Math.hypot(cx - 250, cy - 150);                  // microcentro
    const base = dc < 900 ? 34 : dc < 1800 ? 24 : 15;
    return base + rnd(i)*base*0.9;
  }
  const MZ = D.manzanas.map((m, i) => {
    const poly = []; for (let k = 1; k < m.length; k += 2) poly.push([m[k], m[k+1]]);
    let cx = 0, cy = 0; poly.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= poly.length; cy /= poly.length;
    return {plaza:m[0] === 1 && !(Math.abs(cx - 560) < 200 && Math.abs(cy - 170) < 200), poly, cx, cy, i};
  });
  // la manzana de cada lugar se pinta de azul
  LUG.forEach(l => { const m = MZ.find(z => dentro(l.x, l.y, z.poly)); if (m) { m.lugar = l; l.mz = m; } });

  const geoms = {blanco:[], azul:[], plaza:[]};
  MZ.forEach(m => {
    const sh = new THREE.Shape(m.poly.map(p => new THREE.Vector2(p[0], p[1])));
    const h = m.lugar ? 6 : (m.plaza ? 1.2 : alto(m.cx, m.cy, m.i));
    const g = new THREE.ExtrudeGeometry(sh, {depth:h, bevelEnabled:false});
    g.rotateX(-Math.PI/2);          // la forma (x,y) queda en el plano x,-z; la altura en +y
    (m.lugar ? geoms.azul : m.plaza ? geoms.plaza : geoms.blanco).push(g);
  });
  function capa(lista, colorCara, colorLinea, op){
    if (!lista.length) return;
    const g = THREE.BufferGeometryUtils.mergeBufferGeometries(lista, false);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:colorCara, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1, transparent:op < 1, opacity:op}));
    scene.add(mesh);
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), new THREE.LineBasicMaterial({color:colorLinea})));
    return mesh;
  }
  capa(geoms.blanco, 0xffffff, LINEA, 1);
  capa(geoms.plaza, 0xf0f0f0, 0xc8c8c8, 1);
  capa(geoms.azul, AZUL, AZUL, 0.9);

  // marcadores de los lugares: columna azul + etiqueta
  const etq = document.getElementById("mapa-etiquetas");
  LUG.forEach(l => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 140, 6), new THREE.MeshBasicMaterial({color:AZUL}));
    col.position.copy(P(l.x, l.y, 70)); scene.add(col);
    l.el = document.createElement("button");
    l.el.className = "mp-etq";
    l.el.innerHTML = `<b>${l.nombre}</b><span>hoy: ${l.hoy}</span>`;
    l.el.addEventListener("click", () => { location.hash = "catalogo"; setTimeout(() => window.__selLugar && window.__selLugar(l.id), 50); });
    etq.appendChild(l.el);
    l.anc = P(l.x, l.y, 150);
  });

  // marcador de búsqueda (rosa)
  const pin = new THREE.Group();
  pin.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 110, 6), new THREE.MeshBasicMaterial({color:ROSA})));
  pin.children[0].position.y = 55;
  const anillo = new THREE.Mesh(new THREE.RingGeometry(14, 22, 32), new THREE.MeshBasicMaterial({color:ROSA, side:THREE.DoubleSide}));
  anillo.rotation.x = -Math.PI/2; anillo.position.y = 0.6; pin.add(anillo);
  pin.visible = false; scene.add(pin);
  const pinEl = document.createElement("div"); pinEl.className = "mp-etq mp-pin"; pinEl.hidden = true; etq.appendChild(pinEl);

  /* ---------- cámara y controles ---------- */
  const ctl = new THREE.MapControls(cam, renderer.domElement);
  ctl.enableDamping = true; ctl.dampingFactor = 0.08;
  ctl.screenSpacePanning = false;
  ctl.minDistance = 120; ctl.maxDistance = 9000;
  ctl.maxPolarAngle = Math.PI*0.47;
  cam.position.copy(P(-500, -2400, 2300)); ctl.target.copy(P(-700, 900, 0)); ctl.update();

  let vuelo = null;
  function volarA(x, y, dist){
    const t0 = ctl.target.clone(), c0 = cam.position.clone();
    const t1 = P(x, y, 0), off = c0.clone().sub(t0).normalize().multiplyScalar(dist || 700);
    if (off.y < dist*0.35) { off.y = (dist||700)*0.6; }
    const c1 = t1.clone().add(off);
    vuelo = {t0, c0, t1, c1, s:performance.now()};
  }

  /* ---------- búsqueda de direcciones ---------- */
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\b(avenida|av\.?|avda\.?|calle|pasaje|pje\.?)\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const porNombre = {};
  const DISP = {};
  CALLES.forEach(c => { if (!c.nombre) return; const k = norm(c.nombre); (porNombre[k] ||= []).push(c);
    if (!DISP[k] || c.nombre.length > DISP[k].length) DISP[k] = c.nombre; });
  const LISTA = Object.keys(porNombre);
  function buscarCalle(q){
    const n = norm(q); if (!n) return null;
    let mejor = null, pts = 0;
    LISTA.forEach(nm => {
      const m = nm; let s = 0;
      if (m === n) s = 100; else if (m.endsWith(" " + n) || m.startsWith(n + " ")) s = 80 - m.length/10;
      else if (m.includes(n)) s = 60 - m.length/10;
      else { const ws = n.split(" "); if (ws.every(w => m.includes(w))) s = 40 - m.length/10; }
      if (s > pts){ pts = s; mejor = nm; }
    });
    return mejor;
  }
  function cruce(a, b){
    const r = [];
    porNombre[a].forEach(A => porNombre[b].forEach(B => {
      for (let i = 0; i < A.pts.length - 1; i++) for (let j = 0; j < B.pts.length - 1; j++){
        const p1 = A.pts[i], p2 = A.pts[i+1], p3 = B.pts[j], p4 = B.pts[j+1];
        const d = (p2[0]-p1[0])*(p4[1]-p3[1]) - (p2[1]-p1[1])*(p4[0]-p3[0]); if (!d) continue;
        const t = ((p3[0]-p1[0])*(p4[1]-p3[1]) - (p3[1]-p1[1])*(p4[0]-p3[0]))/d;
        const u = ((p3[0]-p1[0])*(p2[1]-p1[1]) - (p3[1]-p1[1])*(p2[0]-p1[0]))/d;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) r.push([p1[0] + t*(p2[0]-p1[0]), p1[1] + t*(p2[1]-p1[1])]);
      }
    }));
    if (!r.length) return null;
    return [r.reduce((s, p) => s + p[0], 0)/r.length, r.reduce((s, p) => s + p[1], 0)/r.length];
  }
  // numeración aproximada: se calibra con cruces de referencia conocidos y se camina sobre la calle
  const REF_NS = {"Avenida Rivadavia":0, "Rivadavia":0, "Avenida Corrientes":400, "Avenida Santa Fe":1100};
  const REF_EO = {"Avenida Eduardo Madero":50, "Avenida Leandro N. Alem":150, "Avenida Paseo Colón":150,
                  "Avenida 9 de Julio":1050, "Avenida Callao":1800, "Avenida Pueyrredón":2850};
  function cerca(calle, x, y){
    let best = null, bd = Infinity;
    porNombre[calle].forEach(t => { for (let i = 0; i < t.pts.length - 1; i++){
      const [ax, ay] = t.pts[i], [bx, by] = t.pts[i+1], vx = bx-ax, vy = by-ay, l2 = vx*vx + vy*vy || 1;
      const k = Math.max(0, Math.min(1, ((x-ax)*vx + (y-ay)*vy)/l2)), px = ax + k*vx, py = ay + k*vy;
      const d = Math.hypot(px - x, py - y); if (d < bd){ bd = d; best = [px, py]; } } });
    return [best, bd];
  }
  function caminar(calle, desde, dir, dist){
    let p = desde, [dx, dy] = dir, rest = Math.abs(dist);
    if (dist < 0){ dx = -dx; dy = -dy; }
    while (rest > 0){
      const st = Math.min(25, rest), [q, d] = cerca(calle, p[0] + dx*st, p[1] + dy*st);
      const L = Math.hypot(q[0]-p[0], q[1]-p[1]);
      if (d > 20 || L < st*0.5) return rest < 60 ? p : null;      // se terminó la calle
      dx = (q[0]-p[0])/L; dy = (q[1]-p[1])/L; p = q; rest -= st;
    }
    return p;
  }
  function porAltura(calle, num){
    let refs = [];
    for (const R of [REF_NS, REF_EO]){
      refs = [];
      for (const nm0 in R){ const nm = norm(nm0); if (!porNombre[nm] || nm === calle) continue; const c = cruce(calle, nm); if (c) refs.push({h:R[nm0], p:c}); }
      if (refs.length) { refs.ns = R === REF_NS; break; }
    }
    if (!refs.length) return null;
    refs.sort((a, b) => a.h - b.h);
    // referencias dobles (calle y avenida con el mismo número) se unen
    refs = refs.filter((r, i) => !i || r.h !== refs[i-1].h);
    let a = refs[0];
    refs.forEach(r => { if (r.h <= num) a = r; });
    const b = refs.find(r => r.h > a.h) || refs.slice().reverse().find(r => r.h < a.h);
    let dir, m = 1.3;
    if (b){
      const L = Math.hypot(b.p[0]-a.p[0], b.p[1]-a.p[1]);
      dir = [(b.p[0]-a.p[0])/L*Math.sign(b.h - a.h), (b.p[1]-a.p[1])/L*Math.sign(b.h - a.h)];
      m = Math.min(1.7, Math.max(1, L/Math.abs(b.h - a.h)));
    } else {
      // sin segunda referencia: los números crecen hacia el norte (calles N-S) o lejos del río (E-O)
      const pts = [].concat(...porNombre[calle].map(t => t.pts));
      const f = refs.ns ? (p => p[1]) : (p => -Math.hypot(p[0] - 1800, p[1] - 1200));
      const lejos = pts.reduce((q, p) => f(p) > f(q) ? p : q, pts[0]);
      const L = Math.hypot(lejos[0]-a.p[0], lejos[1]-a.p[1]) || 1;
      dir = [(lejos[0]-a.p[0])/L, (lejos[1]-a.p[1])/L];
    }
    return caminar(calle, a.p, dir, (num - a.h)*m);
  }
  const form = document.getElementById("mapa-buscar"), msg = document.getElementById("mapa-msg");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const q = form.q.value.trim(); if (!q) return;
    let res = null, txt = "";
    const y = q.split(/\s+(?:y|e|esq\.?|esquina|&)\s+/i);
    if (y.length === 2){
      const a = buscarCalle(y[0]), b = buscarCalle(y[1]);
      if (a && b && a !== b){ res = cruce(a, b); txt = `${DISP[a]} y ${DISP[b]}`; }
    } else {
      const m = q.match(/^(.*?)[\s,]+(\d{1,5})$/);
      if (m){ const c = buscarCalle(m[1]); if (c){ res = porAltura(c, +m[2]); txt = `${DISP[c]} ${m[2]} <i>(aprox.)</i>`; } }
      else { const c = buscarCalle(q); if (c){ const t = porNombre[c][0].pts; res = t[Math.floor(t.length/2)]; txt = DISP[c]; } }
    }
    if (!res){ msg.innerHTML = "No encontré esa dirección en esta zona del mapa."; pin.visible = false; pinEl.hidden = true; return; }
    msg.innerHTML = txt;
    pin.position.copy(P(res[0], res[1], 0)); pin.visible = true;
    pinEl.innerHTML = `<b>${txt}</b>`; pinEl.hidden = false; pin.anc = P(res[0], res[1], 120);
    volarA(res[0], res[1], 650);
  });
  document.querySelectorAll("#mapa-lugares button").forEach(b => b.addEventListener("click", () => {
    const l = LUG.find(z => z.id === b.dataset.id); volarA(l.x, l.y, 600);
  }));

  /* ---------- nombre de la calle al pasar el mouse ---------- */
  const tip = document.getElementById("mapa-tip"), ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  renderer.domElement.addEventListener("pointermove", e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left)/r.width*2 - 1, -(e.clientY - r.top)/r.height*2 + 1);
    ray.setFromCamera(mouse, cam);
    if (!ray.ray.intersectPlane(plano, hit)){ tip.hidden = true; return; }
    const x = hit.x, y = -hit.z, lim = Math.max(10, cam.position.distanceTo(hit)/90);
    let nm = "", bd = lim;
    CALLES.forEach(c => { if (!c.nombre) return; for (let i = 0; i < c.pts.length - 1; i++){
      const [ax, ay] = c.pts[i], [bx, by] = c.pts[i+1], vx = bx-ax, vy = by-ay, l2 = vx*vx + vy*vy || 1;
      const k = Math.max(0, Math.min(1, ((x-ax)*vx + (y-ay)*vy)/l2)), d = Math.hypot(ax + k*vx - x, ay + k*vy - y);
      if (d < bd){ bd = d; nm = c.nombre; } } });
    if (!nm){ tip.hidden = true; return; }
    tip.hidden = false; tip.textContent = nm;
    tip.style.left = (e.clientX - r.left + 14) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px";
  });
  renderer.domElement.addEventListener("pointerleave", () => tip.hidden = true);

  /* ---------- bucle ---------- */
  const v = new THREE.Vector3();
  function etiqueta(el, anc){
    v.copy(anc).project(cam);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    el.style.display = vis ? "" : "none";
    if (vis){ el.style.transform = `translate(${(v.x*0.5 + 0.5)*W()}px, ${(-v.y*0.5 + 0.5)*H()}px) translate(-50%, -100%)`; }
  }
  function frame(t){
    if (vuelo){
      const k = Math.min(1, (t - vuelo.s)/1100), e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2;
      ctl.target.lerpVectors(vuelo.t0, vuelo.t1, e); cam.position.lerpVectors(vuelo.c0, vuelo.c1, e);
      if (k >= 1) vuelo = null;
    }
    ctl.update();
    renderer.render(scene, cam);
    LUG.forEach(l => etiqueta(l.el, l.anc));
    if (pin.visible) etiqueta(pinEl, pin.anc);
    if (document.body.classList.contains("r-mapa")) requestAnimationFrame(frame); else corriendo = false;
  }
  let corriendo = false;
  window.__mapaActivar = () => {
    renderer.setSize(W(), H()); cam.aspect = W()/H(); cam.updateProjectionMatrix();
    if (!corriendo){ corriendo = true; requestAnimationFrame(frame); }
  };
  window.addEventListener("resize", () => { if (document.body.classList.contains("r-mapa")) window.__mapaActivar(); });
  window.__mapaIr = id => { const l = LUG.find(z => z.id === id); window.__mapaPend = null; if (l) volarA(l.x, l.y, 600); };
  window.__mapaActivar();
  if (window.__mapaPend) window.__mapaIr(window.__mapaPend);
})();
