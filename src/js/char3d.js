/* HARU — 3D anime-style character (procedural, cel-shaded, outlined) + VRM avatar adapter */
(function (H) {
  'use strict';
  const T = window.THREE;
  if (!T) return;

  /* ---------- shared materials ---------- */
  const GRADS = {};
  function gradient(levels = [150, 210, 255]) {
    const k = levels.join(',');
    if (GRADS[k]) return GRADS[k];
    const data = new Uint8Array(levels.length * 4);
    levels.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    const g = new T.DataTexture(data, levels.length, 1, T.RGBAFormat);
    g.minFilter = g.magFilter = T.NearestFilter; g.generateMipmaps = false; g.needsUpdate = true;
    GRADS[k] = g;
    return g;
  }
  H.toonGradient = gradient;
  H.toon = (color, extra) => {
    const e = Object.assign({}, extra || {});
    const levels = e.levels; delete e.levels;
    return new T.MeshToonMaterial(Object.assign({ color: new T.Color(color), gradientMap: gradient(levels) }, e));
  };
  /* anime head: sphere with a tapered chin, one mesh (no seams) */
  function headGeom(r) {
    const g = new T.SphereGeometry(r, 40, 30);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0) {
        const t = Math.min(1, -y / r);
        const k = 1 - 0.38 * Math.pow(t, 1.6);
        x *= k; z *= 1 - 0.22 * Math.pow(t, 1.8);
        y *= 1 + 0.12 * t;
        if (z > 0) z += 0.012 * t * (1 - Math.abs(x) / r);
      }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }
  const OUTLINE_CACHE = {};
  function outlineMat(thick, color = '#2b2533') {
    const k = thick + color;
    if (OUTLINE_CACHE[k]) return OUTLINE_CACHE[k];
    const m = new T.ShaderMaterial({
      uniforms: { c: { value: new T.Color(color) }, t: { value: thick } },
      vertexShader: 'uniform float t; void main(){ vec3 p = position + normalize(normal) * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }',
      side: T.BackSide,
    });
    OUTLINE_CACHE[k] = m;
    return m;
  }
  H.outlineMat = outlineMat;

  /* add a mesh (+ inverted-hull outline) to a parent */
  function add(parent, geom, mat, o = {}) {
    const m = new T.Mesh(geom, mat);
    if (o.pos) m.position.set(...o.pos);
    if (o.rot) m.rotation.set(...o.rot);
    if (o.scale) m.scale.set(...o.scale);
    m.castShadow = o.shadow !== false; m.receiveShadow = !!o.receive;
    if (o.outline !== 0) {
      const ol = new T.Mesh(geom, outlineMat(o.outline ?? 0.006, o.ink));
      ol.castShadow = false; ol.userData.outline = true;
      m.add(ol);
    }
    parent.add(m);
    return m;
  }
  H.add3d = add;

  /* tapered strand (hair lock / tail) along a curve */
  function strand(pts, r0, fx = 1, fz = 0.45, seg = 14, rad = 7, tipPow = 0.75) {
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)));
    const frames = curve.computeFrenetFrames(seg, false);
    const pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, p = curve.getPointAt(t);
      const r = Math.max(0.0015, r0 * Math.pow(1 - t, tipPow) * (i === 0 ? 0.85 : 1));
      const N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j < rad; j++) {
        const a = j / rad * Math.PI * 2;
        pos.push(p.x + (N.x * Math.cos(a) * fx + B.x * Math.sin(a) * fz) * r, p.y + (N.y * Math.cos(a) * fx + B.y * Math.sin(a) * fz) * r, p.z + (N.z * Math.cos(a) * fx + B.z * Math.sin(a) * fz) * r);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * rad + j, b = i * rad + (j + 1) % rad, c = (i + 1) * rad + j, d = (i + 1) * rad + (j + 1) % rad;
      idx.push(a, b, c, b, d, c);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  H.strandGeom = strand;

  const capsule = (r, len) => { const g = new T.CapsuleGeometry(r, len, 6, 14); g.translate(0, -len / 2, 0); return g; };
  const sph = (r, ws = 24, hs = 16) => new T.SphereGeometry(r, ws, hs);
  /* point on head sphere from yaw (left/right, + = character's left/+X) & pitch (up) */
  const onHead = (R, yaw, pitch) => [R * Math.cos(pitch) * Math.sin(yaw), R * Math.sin(pitch), R * Math.cos(pitch) * Math.cos(yaw)];

  /* ---------- face texture (anime eyes) ---------- */
  const HIP = 0.71;
  const FACE_L = 1.55, FACE_T0 = 0.3 * Math.PI, FACE_TL = 0.46 * Math.PI;
  function faceXY(yaw, pitch) { /* to canvas px (512) */
    const theta = Math.PI / 2 - pitch;
    return [256 + yaw / FACE_L * 512, (theta - FACE_T0) / FACE_TL * 512];
  }

  function drawFace(ctx, cfg, st) {
    ctx.clearRect(0, 0, 512, 512);
    const eye = cfg.eye, ink = '#2b2533';
    const blink = st.blink, emo = st.emo;
    const brow = H.shade(cfg.hair, -0.25);
    /* blush */
    ctx.fillStyle = emo === 'love' ? 'rgba(255,110,140,0.55)' : 'rgba(255,135,150,0.32)';
    [-1, 1].forEach((s) => { const [x, y] = faceXY(s * 0.42, -0.2); ctx.beginPath(); ctx.ellipse(x, y, 36, 15, 0, 0, Math.PI * 2); ctx.fill(); });
    if (cfg.cheek !== false || emo === 'love') {
      ctx.strokeStyle = 'rgba(230,90,110,0.45)'; ctx.lineWidth = 3;
      [-1, 1].forEach((s) => { const [x, y] = faceXY(s * 0.42, -0.2); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 12 - 4, y + 6); ctx.lineTo(x + i * 12 + 4, y - 6); ctx.stroke(); } });
    }
    [-1, 1].forEach((s) => {
      const [ex, ey] = faceXY(s * 0.3, -0.04);
      /* eyebrow */
      ctx.strokeStyle = brow; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const bt = emo === 'annoyed' ? 10 * s : emo === 'sad' ? -10 * s : 0;
      ctx.beginPath(); ctx.moveTo(ex - 34 * s, ey - 74 - bt * 0.3); ctx.quadraticCurveTo(ex, ey - 86 - (emo === 'surprised' ? 10 : 0), ex + 32 * s, ey - 78 + bt); ctx.stroke();
      if (st.sleep || emo === 'sleepy') {
        ctx.strokeStyle = ink; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(ex, ey - 6, 34, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + 34 * s, ey + 2); ctx.lineTo(ex + 44 * s, ey + 8); ctx.stroke();
        return;
      }
      if (emo === 'happy' || emo === 'love') {
        ctx.strokeStyle = ink; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(ex, ey + 18, 36, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        return;
      }
      const open = Math.max(0.06, blink) * (emo === 'focus' ? 0.72 : emo === 'annoyed' ? 0.55 : 1);
      const big = (emo === 'surprised' ? 1.15 : 1) * 1.12;
      const w = 40 * big, h = 54 * big * open;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey + (1 - open) * 22, w, h, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#fbfbff'; ctx.fillRect(ex - 60, ey - 80, 120, 160);
      /* iris */
      const lx = (st.look ? st.look.x : 0) * 7, ly = (st.look ? st.look.y : 0) * 6;
      const g = ctx.createLinearGradient(0, ey - 50, 0, ey + 50);
      g.addColorStop(0, H.shade(eye, -0.35)); g.addColorStop(0.55, eye); g.addColorStop(1, H.shade(eye, 0.45));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex + lx, ey + 6 + ly, 30 * big, 44 * big, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = H.shade(eye, -0.55); ctx.beginPath(); ctx.ellipse(ex + lx, ey + 4 + ly, 13, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = H.shade(eye, -0.5); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ex + lx, ey + 6 + ly, 30 * big, 44 * big, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex + lx - 12 * s, ey - 16 + ly, 11, 15, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + lx + 12 * s, ey + 26 + ly, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      /* upper lid / lashes */
      ctx.strokeStyle = ink; ctx.lineWidth = 9; ctx.lineCap = 'round';
      const top = ey + (1 - open) * 22 - h;
      ctx.beginPath(); ctx.moveTo(ex - w * s - 2 * s, top + h * 0.55); ctx.quadraticCurveTo(ex - 8 * s, top - 8, ex + w * s + 6 * s, top + h * 0.35); ctx.lineTo(ex + w * s + 16 * s, top + h * 0.22); ctx.stroke();
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ex - w * 0.6, ey + 50 * open); ctx.quadraticCurveTo(ex, ey + 58 * open, ex + w * 0.6, ey + 50 * open); ctx.stroke();
    });
    /* nose */
    const [nx, ny] = faceXY(0, -0.2);
    ctx.fillStyle = 'rgba(200,120,110,0.6)'; ctx.beginPath(); ctx.ellipse(nx + 2, ny, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    /* mouth */
    const [mx, my] = faceXY(0, -0.37);
    ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.fillStyle = '#b8485a';
    const talk = st.talk || 0;
    if (talk > 0.08 || emo === 'surprised') {
      const o = emo === 'surprised' ? 16 : 6 + talk * 12;
      ctx.beginPath(); ctx.ellipse(mx, my + 4, 12, o, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (emo === 'happy' || emo === 'love') {
      ctx.beginPath(); ctx.moveTo(mx - 20, my); ctx.quadraticCurveTo(mx, my + 26, mx + 20, my); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f08a96'; ctx.beginPath(); ctx.ellipse(mx, my + 13, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (emo === 'annoyed' || emo === 'sad') {
      ctx.beginPath(); ctx.moveTo(mx - 14, my + 8); ctx.quadraticCurveTo(mx, my - 4, mx + 14, my + 8); ctx.stroke();
    } else if (cfg.species === 'cat' || cfg.species === 'fox') {
      ctx.beginPath(); ctx.moveTo(mx - 18, my); ctx.quadraticCurveTo(mx - 9, my + 12, mx, my + 1); ctx.quadraticCurveTo(mx + 9, my + 12, mx + 18, my); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(mx - 14, my); ctx.quadraticCurveTo(mx, my + 12, mx + 14, my); ctx.stroke();
    }
  }

  /* hand props in the procedural hand frame (limb along −Y, facing +Z) */
  function buildProps(handL, handR) {
    const P = {};
    P.tablet = new T.Group(); handR.add(P.tablet);
    add(P.tablet, new T.BoxGeometry(0.2, 0.14, 0.012), H.toon('#2f3240'), { pos: [0.08, -0.04, 0.02], outline: 0.003 });
    add(P.tablet, new T.PlaneGeometry(0.18, 0.12), new T.MeshBasicMaterial({ color: '#d9ecff' }), { pos: [0.08, -0.04, 0.0265], outline: 0 });
    P.brush = new T.Group(); handR.add(P.brush);
    add(P.brush, new T.CylinderGeometry(0.005, 0.004, 0.16), H.toon('#8a5a3b'), { pos: [0, -0.03, 0.05], rot: [1.1, 0, 0], outline: 0.002 });
    const brushTip = add(P.brush, sph(0.012, 8, 6), H.toon('#5b7cfa'), { pos: [0, 0.0, 0.12], outline: 0 });
    P.palette = new T.Group(); handL.add(P.palette);
    add(P.palette, new T.CylinderGeometry(0.08, 0.08, 0.01, 20), H.toon('#e8d2ae'), { pos: [0.02, -0.04, 0.05], rot: [Math.PI / 2, 0, 0.3], scale: [1, 1, 0.7], outline: 0.003 });
    ['#f06a6a', '#5ba3f0', '#f2c14e', '#6cc28a'].forEach((c, i) => add(P.palette, sph(0.012, 8, 6), H.toon(c), { pos: [-0.02 + i * 0.022, -0.03 + (i % 2) * 0.02, 0.058], outline: 0 }));
    P.mug = new T.Group(); handR.add(P.mug);
    add(P.mug, new T.CylinderGeometry(0.035, 0.03, 0.08, 16), H.toon('#f5f1ea'), { pos: [0, -0.05, 0.04], outline: 0.003 });
    Object.values(P).forEach((p) => { p.visible = false; });
    return { props: P, brushTip };
  }

  /* ====================================================================
     Procedural anime character
     ==================================================================== */
  class Character3D {
    constructor(cfg) {
      this.root = new T.Group();
      this.cur = {};
      this.t = 0;
      this.build(cfg);
    }

    dispose() {
      this.root.traverse((o) => { if (o.geometry && !o.userData.outline) o.geometry.dispose(); });
      if (this.faceTex) this.faceTex.dispose();
    }

    build(cfg) {
      cfg = this.cfg = Object.assign({}, H.DEFAULT_CHARACTER, cfg || {});
      while (this.root.children.length) this.root.remove(this.root.children[0]);
      const J = this.j = {};
      const skin = H.toon(cfg.skin, { levels: [205, 238, 255] }), hair = H.toon(H.shade(cfg.hair, 0.08), { levels: [140, 200, 255] }), cloth = H.toon(cfg.cloth), clothD = H.toon(H.shade(cfg.cloth, -0.2));
      const pants = H.toon(H.shade(cfg.cloth, -0.55)), shoe = H.toon('#f4f2ee'), accent = H.toon(cfg.accent), ink = H.toon('#2f3240');
      this.mats = { skin, hair, cloth, accent };
      const hitList = this.hit = [];
      const A = (p, g, m, o) => { const mesh = add(p, g, m, o); hitList.push(mesh); return mesh; };

      /* skeleton */
      const grp = (parent, name, pos) => { const g = new T.Group(); g.name = name; if (pos) g.position.set(...pos); parent.add(g); J[name] = g; return g; };
      const hips = grp(this.root, 'hips', [0, HIP, 0]);
      const spine = grp(hips, 'spine', [0, 0.02, 0]);
      const chest = grp(spine, 'chest', [0, 0.17, 0]);
      const neck = grp(chest, 'neck', [0, 0.2, 0]);
      const head = grp(neck, 'head', [0, 0.06, 0]);

      /* torso: hoodie as one lathe silhouette (neck → shoulders → waist → hem) */
      const prof = [[0.0, 0.215], [0.06, 0.21], [0.11, 0.19], [0.145, 0.15], [0.15, 0.08], [0.14, 0.0], [0.13, -0.09], [0.14, -0.17], [0.15, -0.22], [0.12, -0.235], [0.0, -0.24]].reverse().map(([x, y]) => new T.Vector2(x, y));
      const torso = new T.LatheGeometry(prof, 28);
      A(chest, torso, cloth, { scale: [1.12, 1, 0.78] });
      A(hips, sph(0.12, 20, 12), pants, { scale: [1.1, 0.7, 0.85], pos: [0, -0.02, 0] });
      if (cfg.outfit === 'hoodie') {
        A(chest, new T.TorusGeometry(0.085, 0.042, 10, 20, Math.PI * 1.3), clothD, { pos: [0, 0.17, -0.035], rot: [Math.PI / 2 - 0.35, 0, Math.PI * 0.85] });
        add(chest, new T.BoxGeometry(0.16, 0.07, 0.03), clothD, { pos: [0, -0.05, 0.105], outline: 0.004 });
        [-0.035, 0.035].forEach((x) => add(chest, new T.CylinderGeometry(0.004, 0.004, 0.1), H.toon('#f5f2ea'), { pos: [x, 0.09, 0.105], outline: 0 }));
      } else if (cfg.outfit === 'overall') {
        add(chest, new T.BoxGeometry(0.2, 0.17, 0.05), accent, { pos: [0, -0.03, 0.085], outline: 0.004 });
        [-1, 1].forEach((s) => add(chest, new T.BoxGeometry(0.03, 0.2, 0.02), H.toon(H.shade(cfg.accent, -0.2)), { pos: [s * 0.07, 0.09, 0.1], rot: [0.15, 0, 0], outline: 0 }));
      } else if (cfg.outfit === 'sweater') {
        A(chest, new T.TorusGeometry(0.075, 0.03, 10, 22), H.toon(H.shade(cfg.cloth, 0.2)), { pos: [0, 0.18, 0], rot: [Math.PI / 2, 0, 0] });
      } else if (cfg.outfit === 'smock') {
        add(chest, new T.CylinderGeometry(0.13, 0.16, 0.34, 18, 1, true, -1.1, 2.2), H.toon('#f2ece0', { side: T.DoubleSide }), { pos: [0, 0.02, 0.012], outline: 0.004 });
        ['#f06a6a', '#5ba3f0', '#f2c14e'].forEach((c, i) => add(chest, sph(0.012, 8, 6), H.toon(c), { pos: [-0.04 + i * 0.04, -0.02 + (i % 2) * 0.05, 0.155], outline: 0 }));
      }
      if (cfg.accessory === 'scarf') A(chest, new T.TorusGeometry(0.08, 0.035, 10, 22), accent, { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] });
      add(neck, new T.CylinderGeometry(0.035, 0.04, 0.09, 12), skin, { pos: [0, 0.02, 0], outline: 0.004 });

      /* arms */
      ['L', 'R'].forEach((side) => {
        const s = side === 'L' ? 1 : -1;
        const sh = grp(chest, 'shoulder' + side, [s * 0.15, 0.14, 0]);
        A(sh, sph(0.055, 14, 10), cloth, { scale: [1, 0.9, 1] });
        A(sh, capsule(0.047, 0.17), cloth);
        const el = grp(sh, 'elbow' + side, [0, -0.19, 0]);
        A(el, capsule(0.044, 0.15), cloth);
        add(el, new T.TorusGeometry(0.04, 0.012, 8, 16), clothD, { pos: [0, -0.16, 0], rot: [Math.PI / 2, 0, 0], outline: 0.003 });
        const hand = grp(el, 'hand' + side, [0, -0.185, 0]);
        A(hand, sph(0.036, 14, 10), skin, { scale: [0.85, 1.1, 0.7], pos: [0, -0.02, 0] });
        A(hand, capsule(0.012, 0.025), skin, { pos: [s * 0.03, 0, 0.01], rot: [0, 0, s * 0.6] });
      });

      /* legs */
      ['L', 'R'].forEach((side) => {
        const s = side === 'L' ? 1 : -1;
        const th = grp(hips, 'thigh' + side, [s * 0.075, -0.02, 0]);
        A(th, capsule(0.068, 0.26), pants);
        const kn = grp(th, 'knee' + side, [0, -0.31, 0]);
        A(kn, capsule(0.055, 0.26), pants);
        const ft = grp(kn, 'foot' + side, [0, -0.31, 0]);
        A(ft, sph(0.05, 14, 10), shoe, { scale: [0.95, 0.7, 1.6], pos: [0, -0.015, 0.035] });
      });

      /* head (anime proportions: a bit larger than life) */
      head.scale.setScalar(1.12);
      A(head, headGeom(0.13), skin, { scale: [1, 1.04, 0.98], pos: [0, 0.12, 0] });
      /* ears (human) */
      if (cfg.species === 'human') [-1, 1].forEach((s) => A(head, sph(0.03, 10, 8), skin, { scale: [0.5, 1, 0.8], pos: [s * 0.128, 0.105, 0] }));
      /* face plane */
      this.faceCanvas = document.createElement('canvas'); this.faceCanvas.width = this.faceCanvas.height = 512;
      this.faceTex = new T.CanvasTexture(this.faceCanvas); this.faceTex.colorSpace = T.SRGBColorSpace;
      this.faceTex.anisotropy = 4;
      const faceG = new T.SphereGeometry(0.1315, 48, 32, Math.PI / 2 - FACE_L / 2, FACE_L, FACE_T0, FACE_TL);
      const face = new T.Mesh(faceG, new T.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      face.scale.set(1, 1.04, 0.98); face.position.set(0, 0.12, 0); face.renderOrder = 2;
      head.add(face);
      this.faceKey = '';

      /* hair */
      const hd = new T.Group(); hd.position.set(0, 0.12, 0); hd.scale.set(1, 1.04, 0.98); head.add(hd); J.hairRoot = hd;
      const R = 0.142;
      A(hd, new T.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, 0.3 * Math.PI), hair);
      const backLen = { bob: 0.83, long: 0.86, short: 0.66, bun: 0.7, twin: 0.72, messy: 0.72 }[cfg.hairStyle] || 0.75;
      A(hd, new T.SphereGeometry(R + 0.006, 32, 18, Math.PI / 2 + 0.62, Math.PI * 2 - 1.24, 0.28 * Math.PI, (backLen - 0.28) * Math.PI), hair, { scale: cfg.hairStyle === 'bob' ? [1.1, 1, 1.08] : [1.03, 1, 1.04] });
      const r = H.rng(H.hash(cfg.hairStyle + cfg.hair));
      /* bangs: a few wide locks ending above the eyes, longest at the sides */
      const nB = cfg.hairStyle === 'messy' ? 8 : 7;
      for (let i = 0; i < nB; i++) {
        const u = i / (nB - 1) * 2 - 1;
        const yaw = u * 0.78 + (i % 2 ? 0.03 : -0.03);
        const jit = cfg.hairStyle === 'messy' ? 0.1 : 0.03;
        const endPitch = 0.3 - Math.abs(u) * 0.16 + (i % 3 === 1 ? 0.05 : 0) + (r() - 0.5) * jit;
        const p0 = onHead(R * 0.97, yaw * 0.4, 1.05), p1 = onHead(R + 0.02, yaw * 0.85, 0.62);
        const p2 = onHead(R + 0.014, yaw * 1.0, endPitch + 0.08), p3 = onHead(R + 0.006, yaw * 1.04, endPitch);
        A(hd, strand([p0, p1, p2, p3], 0.05 - Math.abs(u) * 0.008, 1, 0.3, 14, 8, 1.1), hair, { outline: 0.003 });
      }
      const sideLen = { bob: -0.62, long: -1.2, short: -0.28, bun: -0.45, twin: -0.5, messy: -0.42 }[cfg.hairStyle] ?? -0.5;
      [-1, 1].forEach((s) => {
        const a = onHead(R, s * 0.95, 0.5), b = onHead(R + 0.02, s * 1.12, 0.0), c = onHead(R + 0.015, s * 1.08, -0.4);
        const end = [c[0] * 1.03, sideLen * 0.2, c[2] * 0.9];
        A(hd, strand([a, b, c, end], 0.04, 1, 0.42), hair, { outline: 0.004 });
        if (cfg.hairStyle === 'bob' || cfg.hairStyle === 'messy') {
          for (let k = 0; k < 3; k++) {
            const yaw = s * (1.6 + k * 0.45);
            const q0 = onHead(R + 0.005, yaw, 0.2), q1 = onHead(R + 0.03, yaw, -0.35), q2 = onHead(R + 0.04, yaw + s * 0.1, -0.75);
            A(hd, strand([q0, q1, q2, [q2[0] * 1.06, q2[1] - 0.04, q2[2] * 1.06]], 0.05, 1, 0.45), hair, { outline: 0.004 });
          }
        }
      });
      if (cfg.hairStyle === 'long') {
        for (let k = -3; k <= 3; k++) {
          const yaw = Math.PI + k * 0.28;
          const q0 = onHead(R, yaw, 0.1), q1 = onHead(R + 0.03, yaw, -0.6);
          A(hd, strand([q0, q1, [q1[0] * 1.1, -0.32, q1[2] * 1.2 - 0.02], [q1[0] * 1.05, -0.55, q1[2] * 1.2 - 0.06]], 0.06, 1, 0.42), hair, { outline: 0.004 });
        }
      } else if (cfg.hairStyle === 'twin') {
        [-1, 1].forEach((s) => {
          const base = onHead(R, s * 1.75, 0.35);
          A(hd, sph(0.03, 10, 8), accent, { pos: base });
          A(hd, strand([base, [base[0] + s * 0.07, base[1] - 0.05, base[2] - 0.02], [base[0] + s * 0.1, -0.2, base[2]], [base[0] + s * 0.06, -0.42, base[2] + 0.03]], 0.065, 1, 0.6), hair, { outline: 0.004 });
        });
      } else if (cfg.hairStyle === 'bun') {
        A(hd, sph(0.065, 18, 12), hair, { pos: onHead(R + 0.02, Math.PI, 0.95) });
      } else if (cfg.hairStyle === 'short' || cfg.hairStyle === 'messy') {
        for (let k = 0; k < 6; k++) {
          const yaw = Math.PI + (k - 2.5) * 0.4;
          const q0 = onHead(R, yaw, 0.6), q1 = onHead(R + 0.035, yaw, 0.15);
          A(hd, strand([q0, q1, [q1[0] * 1.15, q1[1] - 0.07, q1[2] * 1.15]], 0.04, 1, 0.45), hair, { outline: 0.004 });
        }
      }
      /* ahoge */
      const ah0 = onHead(R, 0.1, 1.3);
      A(hd, strand([ah0, [ah0[0] + 0.02, ah0[1] + 0.06, ah0[2] + 0.02], [ah0[0] + 0.05, ah0[1] + 0.07, ah0[2] + 0.05]], 0.012, 1, 0.5), hair, { outline: 0.003 });

      /* animal ears / sprout */
      const sp = cfg.species;
      const inner = H.toon('#f6b8c6');
      if (sp === 'cat' || sp === 'fox') {
        const earC = sp === 'fox' ? H.toon(H.mix(cfg.hair, '#e8874a', 0.5)) : hair;
        [-1, 1].forEach((s) => {
          const e = new T.Group(); e.position.set(...onHead(R, s * 0.55, 0.92)); e.rotation.set(-0.15, 0, -s * 0.42); hd.add(e); J['ear' + (s > 0 ? 'L' : 'R')] = e;
          const big = sp === 'fox' ? 1.25 : 1;
          A(e, new T.ConeGeometry(0.05 * big, 0.09 * big, 4, 1), earC, { pos: [0, 0.035 * big, 0], scale: [1, 1, 0.55], rot: [0, Math.PI / 4, 0] });
          add(e, new T.ConeGeometry(0.03 * big, 0.06 * big, 4, 1), inner, { pos: [0, 0.03 * big, 0.012], scale: [1, 1, 0.3], rot: [0, Math.PI / 4, 0], outline: 0 });
        });
      } else if (sp === 'bunny') {
        [-1, 1].forEach((s) => {
          const e = new T.Group(); e.position.set(...onHead(R, s * 0.3, 1.05)); e.rotation.set(-0.2, 0, -s * 0.18); hd.add(e); J['ear' + (s > 0 ? 'L' : 'R')] = e;
          A(e, capsule(0.03, 0.16), H.toon('#fffaf4'), { rot: [Math.PI, 0, 0], scale: [1, 1, 0.6] });
          add(e, capsule(0.016, 0.13), inner, { rot: [Math.PI, 0, 0], pos: [0, 0.01, 0.012], scale: [1, 1, 0.3], outline: 0 });
        });
      } else if (sp === 'bear') {
        [-1, 1].forEach((s) => { A(hd, sph(0.04, 12, 10), hair, { pos: onHead(R, s * 0.7, 0.85), scale: [1, 1, 0.6] }); });
      } else if (sp === 'sprout') {
        const st = new T.Group(); st.position.set(...onHead(R, 0, 1.4)); hd.add(st); J.sprout = st;
        add(st, new T.CylinderGeometry(0.004, 0.006, 0.06), H.toon('#4f8a4b'), { pos: [0, 0.03, 0], outline: 0 });
        [-1, 1].forEach((s) => A(st, sph(0.03, 10, 8), H.toon('#7cc46e'), { pos: [s * 0.03, 0.065, 0], scale: [1.2, 0.35, 0.7], rot: [0, 0, s * 0.4] }));
      }

      /* accessories */
      const acc = cfg.accessory;
      if (acc === 'headphones') {
        A(hd, new T.TorusGeometry(R + 0.02, 0.011, 8, 32, Math.PI), accent, { pos: [0, 0.0, -0.01] });
        [-1, 1].forEach((s) => {
          A(hd, new T.CylinderGeometry(0.05, 0.05, 0.035, 20), accent, { pos: [s * (R + 0.012), -0.01, -0.005], rot: [0, 0, Math.PI / 2] });
          add(hd, new T.CylinderGeometry(0.036, 0.036, 0.04, 16), H.toon(H.shade(cfg.accent, -0.35)), { pos: [s * (R + 0.02), -0.01, -0.005], rot: [0, 0, Math.PI / 2], outline: 0 });
        });
      } else if (acc === 'beret') {
        A(hd, sph(0.13, 24, 12), H.toon(H.shade(cfg.accent, -0.3)), { pos: [-0.02, 0.1, -0.01], scale: [1.15, 0.35, 1.12], rot: [0.1, 0, 0.2] });
      } else if (acc === 'glasses') {
        [-1, 1].forEach((s) => add(hd, new T.TorusGeometry(0.036, 0.0045, 6, 24), ink, { pos: onHead(R - 0.002, s * 0.3, -0.04).map((v, i) => (i === 2 ? v + 0.012 : v)), outline: 0 }));
        add(hd, new T.CylinderGeometry(0.003, 0.003, 0.04), ink, { pos: onHead(R + 0.012, 0, -0.02), rot: [0, 0, Math.PI / 2], outline: 0 });
      } else if (acc === 'ribbon') {
        const rb = new T.Group(); rb.position.set(...onHead(R + 0.01, -0.85, 0.65)); rb.rotation.set(0, -0.8, 0.3); hd.add(rb);
        [-1, 1].forEach((s) => A(rb, new T.ConeGeometry(0.035, 0.07, 4), accent, { pos: [s * 0.035, 0, 0], rot: [0, 0, s * Math.PI / 2], scale: [1, 1, 0.4] }));
        A(rb, sph(0.016, 8, 6), accent);
      } else if (acc === 'flower') {
        const fl = new T.Group(); fl.position.set(...onHead(R + 0.01, 0.85, 0.55)); hd.add(fl);
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; A(fl, sph(0.018, 8, 6), accent, { pos: [Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0], scale: [1, 1, 0.5] }); }
        add(fl, sph(0.012, 8, 6), H.toon('#fff3b0'), { outline: 0 });
      }

      /* tail */
      if (sp === 'cat' || sp === 'fox' || sp === 'bunny' || sp === 'bear') {
        const tl = grp(hips, 'tail', [0, 0.0, -0.12]);
        if (sp === 'cat') {
          let p = tl; this.tailSegs = [];
          for (let k = 0; k < 6; k++) { const seg = new T.Group(); seg.position.set(0, k ? -0.075 : 0, 0); p.add(seg); A(seg, capsule(0.02 - k * 0.0015, 0.07), hair, { outline: 0.003 }); this.tailSegs.push(seg); p = seg; }
        } else if (sp === 'fox') {
          const fc = H.toon(H.mix(cfg.hair, '#e8874a', 0.5));
          A(tl, sph(0.08, 16, 12), fc, { pos: [0, -0.05, -0.1], scale: [0.8, 1.5, 0.8], rot: [-0.9, 0, 0] });
          add(tl, sph(0.045, 12, 8), H.toon('#fff8ef'), { pos: [0, -0.02, -0.2], outline: 0.004 });
        } else {
          A(tl, sph(0.04, 12, 8), sp === 'bunny' ? H.toon('#fffaf4') : hair, { pos: [0, -0.02, -0.02] });
        }
      }

      /* props held in hands (shown per activity) */
      const pr = buildProps(J.handL, J.handR);
      this.props = pr.props; this.brushTip = pr.brushTip;
      this.root.traverse((o) => { if (o.isMesh) o.userData.pet = true; });
    }

    /* ---------- poses ---------- */
    targetPose(p) {
      const t = this.t, act = p.act || 'idle';
      const Q = {
        hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
        shoulderL: [0.05, 0, 0.12], shoulderR: [0.05, 0, -0.12], elbowL: [-0.15, 0, 0], elbowR: [-0.15, 0, 0], handL: [0, 0, 0], handR: [0, 0, 0],
        thighL: [0, 0, 0.02], thighR: [0, 0, -0.02], kneeL: [0, 0, 0], kneeR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0],
        hipY: HIP, props: {},
      };
      const breath = Math.sin(t * 2.1) * 0.015;
      Q.chest[0] = breath; Q.head[2] = Math.sin(t * 0.7) * 0.03;
      const seated = p.seated;
      if (seated) {
        Q.hipY = p.seatH || 0.5;
        Q.thighL = [-1.5, 0, 0.08]; Q.thighR = [-1.5, 0, -0.08]; Q.kneeL = [1.45, 0, 0]; Q.kneeR = [1.45, 0, 0]; Q.footL = [0.05, 0, 0]; Q.footR = [0.05, 0, 0];
        /* beanbag: knees together, both legs folded to one side (side-sit) instead of spread apart */
        if (p.lowSeat) { Q.thighL = [-1.35, 0.42, -0.04]; Q.thighR = [-1.3, 0.42, 0.06]; Q.kneeL = [1.95, 0, 0]; Q.kneeR = [2.0, 0, 0]; Q.footL = [0.3, 0, 0]; Q.footR = [0.3, 0, 0]; }
      }
      switch (act) {
        case 'type': {
          Q.spine[0] = 0.12; Q.head[0] = 0.22 + Math.sin(t * 1.3) * 0.04;
          const a = Math.sin(t * 17) > 0 ? 0.06 : 0, b = Math.sin(t * 17 + 1.7) > 0 ? 0.06 : 0;
          /* upper arms forward, forearms raised to the keyboard (desk height is fitted to this pose) */
          Q.shoulderL = [-0.72 - a, 0, 0.16]; Q.elbowL = [-1.25, 0, 0]; Q.handL = [0.35, 0, 0];
          Q.shoulderR = [-0.72 - b, 0, -0.16]; Q.elbowR = [-1.25, 0, 0]; Q.handR = [0.35, 0, 0];
          break;
        }
        case 'paint': {
          const ang = t * 3.2;
          Q.chest[1] = -0.1; Q.head[1] = 0.15; Q.head[0] = 0.05;
          Q.shoulderR = [-1.35 + Math.sin(ang * 1.3) * 0.15, 0, -0.25 + Math.cos(ang) * 0.12]; Q.elbowR = [-0.5, 0, 0]; Q.handR = [-0.3, 0, 0];
          Q.shoulderL = [-0.5, 0, 0.3]; Q.elbowL = [-1.3, 0, 0]; Q.handL = [0, 0, 0.4];
          Q.props.brush = true; Q.props.palette = true;
          break;
        }
        case 'read': {
          Q.head[0] = 0.35; Q.spine[0] = 0.05;
          Q.shoulderL = [-0.6, 0, 0.12]; Q.elbowL = [-1.25, 0, 0]; Q.handL = [0, -0.4, 0];
          Q.shoulderR = [-0.6, 0, -0.12]; Q.elbowR = [-1.25, 0, 0]; Q.handR = [0, 0.4, 0];
          Q.props.tablet = true;
          break;
        }
        case 'sleep': {
          Q.spine[0] = -0.3; Q.head = [0.25, 0.1, 0.38]; Q.shoulderL = [0.1, 0, 0.18]; Q.shoulderR = [0.1, 0, -0.18]; Q.elbowL = [-0.5, 0, 0]; Q.elbowR = [-0.5, 0, 0];
          break;
        }
        case 'think': {
          Q.head = [-0.15, 0.25, 0.1]; Q.shoulderR = [-0.9, 0, -0.35]; Q.elbowR = [-2.1, 0, 0]; Q.handR = [0.2, 0, 0]; Q.shoulderL = [-0.2, 0, 0.25]; Q.elbowL = [-1.4, 0.4, 0];
          break;
        }
        case 'surprised': Q.shoulderL = [-0.4, 0, 1.6]; Q.shoulderR = [-0.4, 0, -1.6]; Q.elbowL = [-0.8, 0, 0]; Q.elbowR = [-0.8, 0, 0]; Q.head[0] = -0.12; if (!seated) Q.hipY += 0.04; break;
        case 'happy': {
          Q.shoulderL = [-0.6, 0, 0.5]; Q.shoulderR = [-0.6, 0, -0.5]; Q.elbowL = [-1.7, 0, 0]; Q.elbowR = [-1.7, 0, 0];
          Q.head[2] = Math.sin(t * 6) * 0.12; if (!seated) Q.hipY += Math.abs(Math.sin(t * 8)) * 0.04;
          break;
        }
        case 'drink': { const sip = (Math.sin(t * 1.2) + 1) / 2; Q.shoulderR = [-0.6 - sip * 0.5, 0, -0.25]; Q.elbowR = [-1.6 - sip * 0.4, 0, 0]; Q.head[0] = -0.1 * sip; Q.props.mug = true; break; }
        case 'wave': Q.shoulderR = [-0.2, 0, -2.5]; Q.elbowR = [0, 0, -0.35 + Math.sin(t * 9) * 0.35]; Q.head[2] = 0.1; break;
        case 'listen': Q.shoulderL = [-0.3, 0, 2.3]; Q.shoulderR = [-0.3, 0, -2.3]; Q.elbowL = [-1.9, 0, 0]; Q.elbowR = [-1.9, 0, 0]; Q.head[2] = Math.sin(t * 3) * 0.12; Q.head[0] = 0.1; break;
        case 'stretch': { const s = (Math.sin(t * 1.5) + 1) / 2; Q.shoulderL = [0, 0, 2.8 + s * 0.1]; Q.shoulderR = [0, 0, -2.8 - s * 0.1]; Q.elbowL = [-0.2, 0, 0]; Q.elbowR = [-0.2, 0, 0]; Q.head[0] = -0.25; Q.spine[0] = -0.1; break; }
        case 'dance': { const s = Math.sin(t * 6); Q.hips[2] = s * 0.08; Q.chest[2] = -s * 0.1; Q.head[2] = s * 0.15; Q.shoulderL = [-0.4, 0, 1 + s * 0.6]; Q.shoulderR = [-0.4, 0, -1 + s * 0.6]; Q.elbowL = [-1.0, 0, 0]; Q.elbowR = [-1.0, 0, 0]; if (!seated) { Q.hipY += Math.abs(s) * 0.04; Q.kneeL = [Math.max(0, s) * 0.4, 0, 0]; Q.kneeR = [Math.max(0, -s) * 0.4, 0, 0]; } break; }
        case 'walk': {
          const s = Math.sin(t * 9);
          Q.thighL = [-s * 0.45, 0, 0.02]; Q.thighR = [s * 0.45, 0, -0.02]; Q.kneeL = [Math.max(0, s) * 0.7, 0, 0]; Q.kneeR = [Math.max(0, -s) * 0.7, 0, 0];
          Q.shoulderL = [s * 0.4, 0, 0.12]; Q.shoulderR = [-s * 0.4, 0, -0.12]; Q.elbowL = [-0.4, 0, 0]; Q.elbowR = [-0.4, 0, 0];
          Q.hipY = HIP + Math.abs(Math.cos(t * 9)) * 0.025; Q.chest[1] = s * 0.08;
          break;
        }
        default: {
          const s = Math.sin(t * 1.3);
          Q.shoulderL = [0.05 + s * 0.03, 0, 0.12]; Q.shoulderR = [0.05 - s * 0.03, 0, -0.12];
          if (seated) { Q.shoulderL = [-0.5, 0, 0.15]; Q.shoulderR = [-0.5, 0, -0.15]; Q.elbowL = [-0.9, 0, 0]; Q.elbowR = [-0.9, 0, 0]; }
        }
      }
      if (p.look && act !== 'type' && act !== 'read' && act !== 'sleep') { Q.head[1] += p.look.x * 0.12; Q.head[0] += p.look.y * 0.06; }
      return Q;
    }

    update(dt, p) {
      this.t = p.t ?? (this.t + dt);
      const Q = this.targetPose(p);
      const k = 1 - Math.exp(-dt * 10);
      const J = this.j;
      Object.keys(Q).forEach((name) => {
        const g = J[name]; if (!g || !Array.isArray(Q[name])) return;
        g.rotation.x += (Q[name][0] - g.rotation.x) * k;
        g.rotation.y += (Q[name][1] - g.rotation.y) * k;
        g.rotation.z += (Q[name][2] - g.rotation.z) * k;
      });
      J.hips.position.y += (Q.hipY - J.hips.position.y) * k;
      Object.entries(this.props).forEach(([n, g]) => { g.visible = !!Q.props[n]; });
      if (p.brushColor && this.brushTip) this.brushTip.material.color.set(p.brushColor);
      /* tail + ears */
      if (this.tailSegs) this.tailSegs.forEach((s, i) => { s.rotation.x = i === 0 ? 1.85 : -0.28; s.rotation.z = Math.sin(this.t * (p.act === 'happy' ? 7 : 2) - i * 0.6) * (p.act === 'happy' ? 0.35 : 0.18); });
      else if (J.tail) J.tail.rotation.y = Math.sin(this.t * 2) * 0.15;
      if (J.earL && Math.sin(this.t * 0.9) > 0.985) J.earL.rotation.z = -0.65; else if (J.earL) J.earL.rotation.z += (-0.42 * (J.earL.position.x > 0 ? 1 : -1) - J.earL.rotation.z) * k;
      if (J.sprout) J.sprout.rotation.z = Math.sin(this.t * 1.6) * 0.2;
      /* face */
      const st = { blink: p.blink ?? 1, emo: p.emo || 'neutral', talk: p.talk || 0, sleep: p.act === 'sleep', look: p.look };
      const key = `${st.emo}|${Math.round(st.blink * 6)}|${Math.round(st.talk * 4)}|${st.sleep}|${st.look ? Math.round(st.look.x * 3) + ',' + Math.round(st.look.y * 3) : ''}`;
      if (key !== this.faceKey) { this.faceKey = key; drawFace(this.faceCanvas.getContext('2d'), this.cfg, st); this.faceTex.needsUpdate = true; }
    }

    headWorld(v) { this.j.head.updateWorldMatrix(true, false); return this.j.head.localToWorld(v.set(0, 0.32, 0)); }
    /* world positions used to fit furniture to the actual pose */
    bodyWorld() {
      const w = (n, y = 0) => { const g = this.j[n]; if (!g) return null; g.updateWorldMatrix(true, false); return g.localToWorld(new T.Vector3(0, y, 0)); };
      return { handL: w('handL', -0.06), handR: w('handR', -0.06), elbowL: w('elbowL'), elbowR: w('elbowR'), hips: w('hips') };
    }
  }
  H.Character3D = Character3D;

  /* ====================================================================
     VRM avatar (user-made, e.g. VRoid Studio) with the same interface
     ==================================================================== */
  class VrmCharacter {
    constructor(vrm) {
      this.vrm = vrm; this.root = new T.Group(); this.t = 0;
      const ext = window.THREE_EXT;
      ext.VRMUtils.rotateVRM0(vrm);
      this.root.add(vrm.scene);
      vrm.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.userData.pet = true; } });
      this.hit = []; vrm.scene.traverse((o) => { if (o.isMesh) this.hit.push(o); });
      const hb = vrm.humanoid;
      this.b = (n) => hb.getNormalizedBoneNode(n);
      const hips = this.b('hips');
      this.hipRest = hips ? hips.position.y : 0.8;
      this.scale = HIP / Math.max(0.4, this.hipRest);
      this.root.scale.setScalar(Math.min(1.3, Math.max(0.7, this.scale)));
      /* props: containers that map the procedural hand frame onto the VRM hand bones */
      const v0 = vrm.meta && vrm.meta.metaVersion === '0';
      const holder = (bone, s) => {
        const c = new T.Group();
        const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), s * Math.PI / 2);
        if (v0) { q.x = -q.x; q.z = -q.z; }
        c.quaternion.copy(q);
        if (v0) c.rotateY(Math.PI);
        c.scale.setScalar(1 / this.root.scale.x);
        const b = this.b(bone); (b || this.root).add(c);
        return c;
      };
      const pr = buildProps(holder('leftHand', 1), holder('rightHand', -1));
      this.props = pr.props; this.brushTip = pr.brushTip;
    }
    static async fromBuffer(buf) {
      const ext = window.THREE_EXT;
      const loader = new ext.GLTFLoader();
      loader.register((parser) => new ext.VRMLoaderPlugin(parser));
      const gltf = await loader.parseAsync(buf, '');
      const vrm = gltf.userData.vrm;
      if (!vrm) throw new Error('VRM 파일이 아니에요');
      ext.VRMUtils.removeUnnecessaryVertices(gltf.scene);
      return new VrmCharacter(vrm);
    }
    dispose() { this.vrm.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    /* poses are authored for the procedural rig (facing +Z, limbs hanging along −Y).
       Convert to VRM normalized bones: arms rest in T-pose, and VRM 0.x rigs face −Z (flip x/z). */
    update(dt, p) {
      this.t = p.t ?? (this.t + dt);
      const Q = Character3D.prototype.targetPose.call({ t: this.t }, p);
      const k = 1 - Math.exp(-dt * 10);
      const v0 = this.vrm.meta && this.vrm.meta.metaVersion === '0';
      const eq = (a) => new T.Quaternion().setFromEuler(new T.Euler(a[0], a[1], a[2]));
      const apply = (bone, q) => {
        const b = this.b(bone); if (!b) return;
        if (v0) { q.x = -q.x; q.z = -q.z; }
        b.quaternion.slerp(q, k);
      };
      [['hips', 'hips'], ['spine', 'spine'], ['chest', 'chest'], ['neck', 'neck'], ['head', 'head'],
        ['thighL', 'leftUpperLeg'], ['thighR', 'rightUpperLeg'], ['kneeL', 'leftLowerLeg'], ['kneeR', 'rightLowerLeg'], ['footL', 'leftFoot'], ['footR', 'rightFoot'],
      ].forEach(([q, bone]) => { if (Q[q]) apply(bone, eq(Q[q])); });
      ['L', 'R'].forEach((side) => {
        const s = side === 'L' ? 1 : -1, pre = side === 'L' ? 'left' : 'right';
        const down = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), -s * Math.PI / 2);
        const up = down.clone().invert();
        apply(pre + 'UpperArm', eq(Q['shoulder' + side]).multiply(down));
        apply(pre + 'LowerArm', up.clone().multiply(eq(Q['elbow' + side])).multiply(down));
        apply(pre + 'Hand', up.clone().multiply(eq(Q['hand' + side])).multiply(down));
      });
      const hips = this.b('hips');
      if (hips) hips.position.y += (this.hipRest * (Q.hipY / HIP) - hips.position.y) * k;
      Object.entries(this.props).forEach(([n, g]) => { g.visible = !!Q.props[n]; });
      if (p.brushColor && this.brushTip) this.brushTip.material.color.set(p.brushColor);
      const em = this.vrm.expressionManager;
      if (em) {
        const emo = p.emo || 'neutral';
        const set = (n, v) => { if (em.getExpression(n)) em.setValue(n, v); };
        const closed = p.act === 'sleep' || emo === 'sleepy';
        set('blink', closed ? 1 : H.clamp(1 - (p.blink ?? 1)));
        set('happy', emo === 'happy' || emo === 'love' ? 1 : 0);
        set('relaxed', emo === 'focus' ? 0.35 : 0);
        set('surprised', emo === 'surprised' ? 1 : 0);
        set('sad', emo === 'sad' ? 0.8 : 0);
        set('angry', emo === 'annoyed' ? 0.6 : 0);
        set('aa', (p.talk || 0) * 0.8);
      }
      this.vrm.update(dt);
    }

    /* accessories from the character config, attached to the VRM head (e.g. headphones) */
    setAccessory(cfg) {
      const head = this.b('head'); if (!head) return;
      if (this.acc) { head.remove(this.acc); this.acc = null; }
      if (!cfg || cfg.accessory !== 'headphones') return;
      const g = new T.Group(); g.position.set(0, 0.075, -0.005);
      const col = H.toon(cfg.accent || '#ffcf6b'), dark = H.toon(H.shade(cfg.accent || '#ffcf6b', -0.35));
      const R = 0.098;
      add(g, new T.TorusGeometry(R + 0.012, 0.009, 8, 32, Math.PI), col, { outline: 0.003 });
      [-1, 1].forEach((s) => {
        add(g, new T.CylinderGeometry(0.042, 0.042, 0.03, 20), col, { pos: [s * (R + 0.006), -0.005, 0], rot: [0, 0, Math.PI / 2], outline: 0.003 });
        add(g, new T.CylinderGeometry(0.03, 0.03, 0.034, 16), dark, { pos: [s * (R + 0.012), -0.005, 0], rot: [0, 0, Math.PI / 2], outline: 0 });
      });
      if (this.vrm.meta && this.vrm.meta.metaVersion === '0') g.rotation.y = Math.PI;
      head.add(g); this.acc = g;
    }
    headWorld(v) { const h = this.b('head'); h.updateWorldMatrix(true, false); return h.localToWorld(v.set(0, 0.25, 0)); }
    bodyWorld() {
      /* raw (posed) bones — the normalized ones are copied onto these after vrm.update */
      const hb = this.vrm.humanoid;
      const w = (n) => { const b = hb.getRawBoneNode ? hb.getRawBoneNode(n) : this.b(n); if (!b) return null; b.updateWorldMatrix(true, false); return b.getWorldPosition(new T.Vector3()); };
      return { handL: w('leftHand'), handR: w('rightHand'), elbowL: w('leftLowerArm'), elbowR: w('rightLowerArm'), hips: w('hips') };
    }
  }
  H.VrmCharacter = VrmCharacter;

  /* ====================================================================
     CharStage: one character on its own small canvas (creator preview, desktop mini avatar)
     ==================================================================== */
  const modelCache = {};
  H.loadModelBytes = async (model) => {
    if (modelCache[model]) return modelCache[model];
    if (!window.haru) return null;
    const bytes = model === 'custom' ? await window.haru.readAvatar() : await window.haru.readAsset(`avatars/${model}.vrm`);
    if (bytes && model !== 'custom') modelCache[model] = bytes;
    return bytes;
  };
  class CharStage {
    constructor(canvas, opts = {}) {
      this.canvas = canvas; this.alpha = !!opts.alpha;
      this.r = new T.WebGLRenderer({ canvas, antialias: true, alpha: !!opts.alpha });
      this.r.outputColorSpace = T.SRGBColorSpace;
      if (opts.alpha) this.r.setClearColor(0x000000, 0);
      this.scene = new T.Scene();
      if (!opts.alpha) this.scene.background = new T.Color(opts.bg || '#f3f1ec');
      this.scene.add(new T.HemisphereLight('#ffffff', '#c8b6a2', 1.7));
      const d = new T.DirectionalLight('#fff3e2', 1.6); d.position.set(1.2, 2.5, 3); this.scene.add(d);
      this.cam = new T.PerspectiveCamera(opts.fov || 26, 1, 0.05, 30);
      this.framing = opts.framing || 'full';
      this.char = null; this.key = '';
    }
    async setModel(cfg) {
      const model = cfg.model || 'shibu';
      const key = model + (model === 'procedural' ? JSON.stringify(cfg) : '');
      if (key === this.key) { if (this.char && this.char.setAccessory) this.char.setAccessory(cfg); return; }
      this.key = key;
      let c;
      try {
        if (model === 'procedural') c = new Character3D(cfg);
        else {
          const bytes = await H.loadModelBytes(model);
          if (!bytes || this.key !== key) return;
          c = await VrmCharacter.fromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
          c.setAccessory(cfg);
        }
      } catch (e) { console.warn(e); c = new Character3D(Object.assign({}, cfg, { model: 'procedural' })); }
      if (this.key !== key) { c.dispose(); return; }
      if (this.char) { this.scene.remove(this.char.root); this.char.dispose(); }
      this.char = c; this.scene.add(c.root);
    }
    render(dt, pose, w, h, yaw = 0) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (this.r.getPixelRatio() !== dpr) this.r.setPixelRatio(dpr);
      const s = this.r.getSize(new T.Vector2()); if (s.x !== w || s.y !== h) this.r.setSize(w, h, false);
      if (this.char) {
        this.char.root.rotation.y = yaw;
        this.char.update(dt, pose);
        const hp = this.char.headWorld(new T.Vector3());
        this.cam.aspect = w / h;
        if (this.framing === 'bust') { this.cam.position.set(0, hp.y - 0.15, 1.35); this.cam.lookAt(0, hp.y - 0.2, 0); }
        else { const top = hp.y + 0.05; const dist = top / 2 / Math.tan(this.cam.fov * Math.PI / 360) * 1.15 / Math.min(1, this.cam.aspect * 1.4); this.cam.position.set(0, top * 0.55, dist); this.cam.lookAt(0, top * 0.48, 0); }
        this.cam.updateProjectionMatrix();
      }
      this.r.render(this.scene, this.cam);
      if (this.alpha && this.char) {
        /* MToon writes alpha < 1 on some surfaces; on a transparent window that lets the desktop
           show through the body. Second pass: write alpha = 1 wherever the character is drawn. */
        const gl = this.r.getContext();
        this.alphaMat = this.alphaMat || new T.MeshBasicMaterial({ color: '#ffffff', depthWrite: false, depthFunc: T.LessEqualDepth });
        this.r.autoClear = false; this.scene.overrideMaterial = this.alphaMat;
        gl.colorMask(false, false, false, true);
        this.r.render(this.scene, this.cam);
        gl.colorMask(true, true, true, true);
        this.scene.overrideMaterial = null; this.r.autoClear = true;
      }
    }
    dispose() { if (this.char) this.char.dispose(); this.r.dispose(); }
  }
  H.CharStage = CharStage;
})(window.H);
