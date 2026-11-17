/* HARU — 3D atelier room (three.js): sky through the window, warm lights, cameras, props */
(function (H) {
  'use strict';
  const T = window.THREE;
  if (!T) return;
  const add = (...a) => H.add3d(...a);
  const toon = (c, e) => H.toon(c, e);
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cyl = (a, b, h, s = 20) => new T.CylinderGeometry(a, b, h, s);
  const sph = (r, a = 20, b = 14) => new T.SphereGeometry(r, a, b);

  /* 2D layout (1600×900, see room.js) → 3D floor coordinates */
  const toX = (x) => (x - 800) / 250;
  const toZ = (y) => -1.02 + (y - 640) * 0.0068;

  /* camera presets: position + look-at */
  const CAMS = {
    wide: { p: [0.5, 1.75, 3.9], t: [-0.1, 0.95, -0.9], fov: 42, ko: '전체' },
    desk: { p: [0.95, 1.05, 0.45], t: [-0.05, 1.08, -1.0], fov: 38, ko: '책상' },
    close: { p: [0.32, 1.18, -0.3], t: [0, 1.17, -1.02], fov: 32, ko: '가까이' },
    shoulder: { p: [-0.42, 1.42, -1.72], t: [0.25, 0.86, -0.25], fov: 46, ko: '어깨 너머' },
    easel: { p: [0.75, 1.35, 1.75], t: [1.75, 1.0, -0.35], fov: 40, ko: '이젤' },
    window: { p: [-0.45, 1.35, 0.9], t: [-1.35, 1.55, -2.3], fov: 44, ko: '창밖' },
    nook: { p: [-0.75, 1.25, 1.95], t: [-2.0, 0.55, 0.0], fov: 42, ko: '책 읽는 곳' },
  };
  H.CAMERAS3D = CAMS;

  class Room3D {
    constructor(canvas) {
      this.is3D = true;
      this.canvas = canvas;
      const mobile = document.documentElement.classList.contains('mobile');
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFShadowMap;
      this.maxDpr = mobile ? 1.5 : 2;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(42, 16 / 9, 0.05, 80);
      this.recCamera = new T.PerspectiveCamera(42, 16 / 9, 0.05, 80);
      this.cam = this.camState('wide'); this.camTarget = this.camState('wide');
      this.recCam = this.camState('wide');
      this.orbitOff = null;
      this.items = new Set(); this.artworks = []; this.artTex = []; this.particles = [];
      this.hours = 12; this.weather = null; this.lampOn = false; this.musicLevel = 0; this.neonText = ''; this.flash = 0; this.t = 0;
      this.paintCanvas = null; this.paintTex = null; this.lastPaintDrawn = -1;
      this.hitMap = [];
      this.buildLights(mobile);
      this.buildSky();
      this.buildRoom();
      this.buildItems();
      this.char = null;
    }

    camState(name) {
      const c = CAMS[name] || CAMS.wide;
      const st = { p: new T.Vector3(...c.p), t: new T.Vector3(...c.t), fov: c.fov };
      /* desk-side shots follow the fitted desk height (presets were framed for a 0.77 m desk) */
      if (this.fit && (name === 'desk' || name === 'shoulder' || name === 'close')) {
        const dy = ((this.fit.deskLive ?? this.fit.desk) || 0.77) - 0.77;
        st.p.y += dy; st.t.y += dy * (name === 'shoulder' ? 0.6 : 1);
      }
      return st;
    }

    /* ---------------- lights ---------------- */
    buildLights(mobile) {
      const s = this.scene;
      this.hemi = new T.HemisphereLight('#dfe8ff', '#8a7464', 1.0); s.add(this.hemi);
      this.amb = new T.AmbientLight('#ffffff', 0.25); s.add(this.amb);
      this.sun = new T.DirectionalLight('#fff0d6', 2.2);
      this.sun.position.set(-3.5, 5, -7); this.sun.target.position.set(0.2, 0, 0.2);
      this.sun.castShadow = true;
      const sz = mobile ? 1024 : 2048;
      this.sun.shadow.mapSize.set(sz, sz);
      Object.assign(this.sun.shadow.camera, { left: -4.5, right: 4.5, top: 4, bottom: -3, near: 1, far: 20 });
      this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.02;
      s.add(this.sun); s.add(this.sun.target);
      this.lamp = new T.PointLight('#ffb35c', 0, 4.5, 1.6); this.lamp.position.set(-0.62, 1.32, -0.68); s.add(this.lamp);
      this.fill = new T.PointLight('#ffd6a0', 0, 5, 1.8); this.fill.position.set(-2.1, 1.4, 0.6); s.add(this.fill);
      this.neonLight = new T.PointLight('#ff5fa2', 0, 3, 2); this.neonLight.position.set(1.9, 2.55, -1.9); s.add(this.neonLight);
    }

    /* ---------------- sky outside the window ---------------- */
    buildSky() {
      const s = this.scene;
      this.skyMat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false,
        uniforms: { top: { value: new T.Color('#5d9fe6') }, bot: { value: new T.Color('#c4e1f8') }, sunDir: { value: new T.Vector3(0, 0.3, -1) }, sunCol: { value: new T.Color('#fff2d0') }, sunAmt: { value: 1 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; varying vec3 vP;
          void main(){ float h = clamp(vP.y * 1.6 + 0.15, 0.0, 1.0); vec3 c = mix(bot, top, pow(h, 0.8));
            float d = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += sunCol * (pow(d, 400.0) * 1.5 + pow(d, 12.0) * 0.35) * sunAmt;
            gl_FragColor = vec4(c, 1.0); }`,
      });
      this.skyMat.toneMapped = false;
      s.add(new T.Mesh(new T.SphereGeometry(40, 32, 16), this.skyMat));
      /* stars */
      const pts = []; const r = H.rng(5);
      for (let i = 0; i < 500; i++) { const a = r() * Math.PI - Math.PI, el = r() * 0.9 + 0.05; pts.push(Math.cos(el) * Math.sin(a) * 35, Math.sin(el) * 35, Math.cos(el) * Math.cos(a) * 35 - 4); }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      this.stars = new T.Points(sg, new T.PointsMaterial({ color: '#fffbe8', size: 0.09, transparent: true, opacity: 0, depthWrite: false }));
      s.add(this.stars);
      /* moon */
      this.moon = new T.Mesh(new T.CircleGeometry(0.9, 32), new T.MeshBasicMaterial({ color: '#faf4dc', transparent: true }));
      this.moon.position.set(-7, 8, -30); this.moon.lookAt(0, 1.5, 0); s.add(this.moon);
      /* clouds: sprite puffs */
      const cc = document.createElement('canvas'); cc.width = 256; cc.height = 128;
      const cx = cc.getContext('2d');
      [[60, 80, 46], [110, 60, 56], [165, 74, 48], [200, 88, 34], [30, 92, 30]].forEach(([x, y, rr]) => { const g = cx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rr, 0, 7); cx.fill(); });
      const ct = new T.CanvasTexture(cc); ct.colorSpace = T.SRGBColorSpace;
      this.clouds = [];
      for (let i = 0; i < 9; i++) {
        const m = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, color: '#ffffff' }));
        const sc = 4 + r() * 5; m.scale.set(sc, sc / 2, 1);
        m.position.set(-20 + r() * 40, 3.5 + r() * 6, -18 - r() * 10); m.userData.v = 0.15 + r() * 0.3;
        s.add(m); this.clouds.push(m);
      }
      /* city skyline */
      const wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; const wx = wc.getContext('2d');
      wx.fillStyle = '#000'; wx.fillRect(0, 0, 64, 128);
      for (let y = 6; y < 124; y += 12) for (let x = 6; x < 60; x += 14) if (r() < 0.45) { wx.fillStyle = r() < 0.7 ? '#ffd68a' : '#bfe0ff'; wx.fillRect(x, y, 7, 6); }
      const wt = new T.CanvasTexture(wc); wt.colorSpace = T.SRGBColorSpace; wt.wrapS = wt.wrapT = T.RepeatWrapping;
      this.cityMat = new T.MeshLambertMaterial({ color: '#8f9bb3', emissive: '#ffffff', emissiveMap: wt, emissiveIntensity: 0 });
      this.city = new T.Group();
      for (let i = 0; i < 26; i++) {
        const w = 1.6 + r() * 2.2, h = 2 + r() * 6, d = 2;
        const g = box(w, h, d);
        const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 1.2, uv.getY(k) * h / 2.4);
        const m = new T.Mesh(g, this.cityMat);
        m.position.set(-34 + i * 2.6 + r() * 0.8, h / 2 - 4.2, -26 - r() * 8);
        this.city.add(m);
      }
      s.add(this.city);
      /* rain / snow particles between window and city */
      const rp = []; for (let i = 0; i < 900; i++) rp.push(-6 + r() * 9, r() * 6, -3 - r() * 6);
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3));
      this.precip = new T.Points(rg, new T.PointsMaterial({ color: '#dfe8ff', size: 0.04, transparent: true, opacity: 0.8, depthWrite: false }));
      this.precip.visible = false; s.add(this.precip);
    }

    /* ---------------- room geometry ---------------- */
    buildRoom() {
      const s = this.scene;
      const hit = (m, name) => { m.userData.hit = name; this.hitMap.push(m); return m; };
      this.wallMat = toon('#efe7dc', { levels: [190, 230, 255] });
      const wood = toon('#c99b72'), woodD = toon('#a77b55'), white = toon('#f6f2ea');
      /* floor with planks */
      const fc = document.createElement('canvas'); fc.width = 512; fc.height = 512; const fx = fc.getContext('2d');
      fx.fillStyle = '#d2ac85'; fx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 8; i++) { fx.fillStyle = i % 2 ? 'rgba(120,80,40,0.07)' : 'rgba(255,255,255,0.05)'; fx.fillRect(0, i * 64, 512, 64); fx.fillStyle = 'rgba(90,60,30,0.25)'; fx.fillRect(0, i * 64, 512, 2); fx.fillRect(((i * 197) % 512), i * 64, 2, 64); }
      const ft = new T.CanvasTexture(fc); ft.colorSpace = T.SRGBColorSpace; ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(3, 3);
      const floor = new T.Mesh(new T.PlaneGeometry(7.2, 4.6), toon('#ffffff', { map: ft, levels: [175, 225, 255] }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -0.1); floor.receiveShadow = true; s.add(floor);
      /* back wall with window hole */
      const shape = new T.Shape(); shape.moveTo(-3.6, 0); shape.lineTo(3.6, 0); shape.lineTo(3.6, 3.2); shape.lineTo(-3.6, 3.2); shape.lineTo(-3.6, 0);
      const hole = new T.Path(); const wx0 = -2.55, wx1 = -0.15, wy0 = 0.95, wy1 = 2.5;
      hole.moveTo(wx0, wy0); hole.lineTo(wx1, wy0); hole.lineTo(wx1, wy1); hole.lineTo(wx0, wy1); hole.lineTo(wx0, wy0); shape.holes.push(hole);
      const back = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }), this.wallMat);
      back.position.set(0, 0, -2.4); back.castShadow = true; back.receiveShadow = true; s.add(back);
      /* wainscot */
      add(s, box(7.2, 0.9, 0.04), toon('#ddd2c2'), { pos: [0, 0.45, -2.18], outline: 0, receive: true });
      add(s, box(7.2, 0.04, 0.06), white, { pos: [0, 0.9, -2.17], outline: 0 });
      /* side walls, front wall and ceiling: single-sided planes facing into the room.
         From inside every direction is closed; the outside "wide" camera sees straight through
         them (back faces are culled), like a dollhouse cut-away. */
      const RW = 3.6, RF = 2.2, RB = -2.4, RH = 3.2;
      const inward = (w, h, mat, pos, rotY, rotX = 0) => {
        const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
        m.position.set(...pos); m.rotation.set(rotX, rotY, 0, 'YXZ'); m.receiveShadow = true;
        s.add(m); return m;
      };
      const wainMat = toon('#ddd2c2'), trim = toon('#f6f2ea');
      inward(RF - RB, RH, this.wallMat, [-RW, RH / 2, (RF + RB) / 2], Math.PI / 2);
      inward(RF - RB, RH, this.wallMat, [RW, RH / 2, (RF + RB) / 2], -Math.PI / 2);
      inward(RF - RB, 0.9, wainMat, [-RW + 0.01, 0.45, (RF + RB) / 2], Math.PI / 2);
      inward(RF - RB, 0.9, wainMat, [RW - 0.01, 0.45, (RF + RB) / 2], -Math.PI / 2);
      inward(RW * 2, RH, toon('#e3d9cb', { levels: [190, 230, 255] }), [0, RH / 2, RF], Math.PI);
      inward(RW * 2, 0.9, wainMat, [0, 0.45, RF - 0.01], Math.PI);
      inward(RW * 2, 0.04, trim, [0, 0.9, RF - 0.015], Math.PI);
      const ceil = inward(RW * 2, RF - RB, toon('#f3ede4', { levels: [200, 235, 255] }), [0, RH, (RF + RB) / 2], 0, Math.PI / 2);
      ceil.receiveShadow = false;
      /* door, light switch, calendar and coat hook on the front wall (planes, invisible from outside) */
      const fz = RF - 0.02;
      inward(1.0, 2.15, toon('#e9e1d4'), [2.35, 1.075, fz + 0.005], Math.PI);
      inward(0.86, 2.05, toon('#b48a64'), [2.35, 1.025, fz], Math.PI);
      inward(0.62, 0.8, toon('#a77b55'), [2.35, 1.55, fz - 0.003], Math.PI);
      inward(0.62, 0.8, toon('#a77b55'), [2.35, 0.6, fz - 0.003], Math.PI);
      const knob = new T.Mesh(new T.CircleGeometry(0.035, 20), toon('#e8c05a')); knob.position.set(2.0, 1.0, fz - 0.006); knob.rotation.y = Math.PI; s.add(knob);
      inward(0.08, 0.12, trim, [1.6, 1.25, fz], Math.PI);
      inward(0.03, 0.05, toon('#cfc6b8'), [1.6, 1.26, fz - 0.003], Math.PI);
      const cal = document.createElement('canvas'); cal.width = 256; cal.height = 320; const cx2 = cal.getContext('2d');
      cx2.fillStyle = '#fbf8f2'; cx2.fillRect(0, 0, 256, 320); cx2.fillStyle = '#e0574f'; cx2.fillRect(0, 0, 256, 60);
      cx2.fillStyle = '#fff'; cx2.font = 'bold 34px Consolas, monospace'; cx2.textAlign = 'center'; cx2.fillText(String(new Date().getMonth() + 1).padStart(2, '0'), 128, 44);
      cx2.fillStyle = '#5c616b'; cx2.font = '18px Consolas, monospace';
      for (let d = 0; d < 30; d++) cx2.fillText(String(d + 1), 30 + (d % 7) * 33, 100 + Math.floor(d / 7) * 44);
      const calTex = new T.CanvasTexture(cal); calTex.colorSpace = T.SRGBColorSpace;
      inward(0.4, 0.5, toon('#ffffff', { map: calTex }), [0.6, 1.75, fz], Math.PI);
      inward(0.9, 0.06, toon('#8a6040'), [-1.2, 1.9, fz], Math.PI);
      ['#c9d3e6', '#e9a77c'].forEach((c, i) => inward(0.28, 0.5, toon(c), [-1.45 + i * 0.45, 1.6, fz - 0.004], Math.PI));
      /* the back wall is 0.2 thick (z −2.4…−2.2): keep the camera clear of it */
      this.roomBounds = { x: RW - 0.25, zMin: RB + 0.45, zMax: RF + 2.0, yMin: 0.3, yMax: RH - 0.2 };
      /* window frame + sill + glass */
      const fm = white;
      add(s, box(2.5, 0.07, 0.24), fm, { pos: [(wx0 + wx1) / 2, wy1 + 0.03, -2.3], outline: 0.004 });
      add(s, box(2.7, 0.07, 0.36), fm, { pos: [(wx0 + wx1) / 2, wy0 - 0.03, -2.2], outline: 0.004, receive: true });
      add(s, box(0.07, wy1 - wy0, 0.24), fm, { pos: [wx0 - 0.03, (wy0 + wy1) / 2, -2.3], outline: 0.004 });
      add(s, box(0.07, wy1 - wy0, 0.24), fm, { pos: [wx1 + 0.03, (wy0 + wy1) / 2, -2.3], outline: 0.004 });
      /* two casement sashes hinged on the outer posts; they swing into the room when the window is opened */
      const sashW = (wx1 - wx0) / 2, sashH = wy1 - wy0;
      const glassMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.04, depthWrite: false, side: T.DoubleSide });
      this.sashes = [-1, 1].map((side) => {
        const hinge = new T.Group();
        hinge.position.set(side < 0 ? wx0 : wx1, (wy0 + wy1) / 2, -2.27); s.add(hinge);
        const dir = side < 0 ? 1 : -1; /* sash extends from the hinge toward the window centre */
        const sg = new T.Group(); sg.position.x = dir * sashW / 2; hinge.add(sg);
        add(sg, box(0.045, sashH, 0.05), fm, { pos: [dir * (sashW / 2 - 0.022), 0, 0], outline: 0.003 });
        add(sg, box(0.04, sashH, 0.05), fm, { pos: [-dir * (sashW / 2 - 0.02), 0, 0], outline: 0.002 });
        add(sg, box(sashW, 0.045, 0.05), fm, { pos: [0, sashH / 2 - 0.022, 0], outline: 0.002 });
        add(sg, box(sashW, 0.045, 0.05), fm, { pos: [0, -sashH / 2 + 0.022, 0], outline: 0.002 });
        add(sg, box(sashW, 0.04, 0.05), fm, { pos: [0, 1.85 - (wy0 + wy1) / 2, 0], outline: 0.002 });
        const gl = new T.Mesh(new T.PlaneGeometry(sashW - 0.06, sashH - 0.06), glassMat); sg.add(hit(gl, 'window'));
        return { hinge, side, open: 0 };
      });
      this.windowOpen = false;
      /* curtains */
      const curtain = (x, flip) => {
        const g = new T.PlaneGeometry(0.55, 2.0, 24, 1);
        const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.035);
        g.computeVertexNormals();
        const m = new T.Mesh(g, toon('#c9d3e6', { side: T.DoubleSide })); m.position.set(x, 1.65, -2.12); m.castShadow = true; m.scale.x = flip ? -1 : 1; s.add(m);
        return m;
      };
      this.curtains = [curtain(wx0 - 0.2, false), curtain(wx1 + 0.22, true)];
      add(s, cyl(0.015, 0.015, 3.0), toon('#8a8070'), { pos: [(wx0 + wx1) / 2, 2.68, -2.14], rot: [0, 0, Math.PI / 2], outline: 0 });
      /* sill plant */
      this.addPlant(s, -2.35, 0.98, -2.15, 0.5);

      /* desk */
      const desk = new T.Group(); desk.position.set(0, 0, -0.6); s.add(desk); this.desk = desk;
      hit(add(desk, box(1.95, 0.05, 0.62), wood, { pos: [0, 0.745, 0], outline: 0.005, receive: true }), 'desk');
      hit(add(desk, box(1.85, 0.52, 0.03), woodD, { pos: [0, 0.46, 0.27], outline: 0.004, receive: true }), 'desk');
      [-0.9, 0.9].forEach((x) => add(desk, box(0.05, 0.72, 0.55), woodD, { pos: [x, 0.36, 0], outline: 0.004 }));
      add(desk, box(0.45, 0.3, 0.5), woodD, { pos: [-0.62, 0.55, 0], outline: 0.004 });
      add(desk, box(0.12, 0.02, 0.01), toon('#e8d3b8'), { pos: [-0.62, 0.6, 0.255], outline: 0 });
      /* keyboard (MIDI) facing her */
      const kb = new T.Group(); kb.position.set(-0.05, 0.775, -0.18); desk.add(kb);
      add(kb, box(0.62, 0.025, 0.16), toon('#2f3240'), { outline: 0.003 });
      this.keys = [];
      for (let i = 0; i < 18; i++) { const k = add(kb, box(0.03, 0.012, 0.11), toon('#f7f5f0'), { pos: [-0.28 + i * 0.033, 0.017, 0.01], outline: 0 }); this.keys.push(k); }
      /* laptop: screen faces her (-Z), lid back faces the room */
      const lap = new T.Group(); lap.position.set(0.55, 0.77, -0.12); lap.rotation.y = 0.35; desk.add(lap);
      add(lap, box(0.34, 0.015, 0.24), toon('#c6cbd6'), { outline: 0.003 });
      const lid = new T.Group(); lid.position.set(0, 0.008, 0.12); lid.rotation.x = 0.35; lap.add(lid);
      add(lid, box(0.34, 0.23, 0.012), toon('#cfd3dc'), { pos: [0, 0.115, 0], outline: 0.003 });
      add(lid, new T.CircleGeometry(0.025, 20), toon('#e0574f'), { pos: [0, 0.12, 0.007], outline: 0 });
      /* laptop screen: a little browser drawn on a canvas (today's news while reading, the DAW while composing) */
      this.screenCanvas = document.createElement('canvas'); this.screenCanvas.width = 620; this.screenCanvas.height = 400;
      this.screenTex = new T.CanvasTexture(this.screenCanvas); this.screenTex.colorSpace = T.SRGBColorSpace; this.screenTex.anisotropy = 4;
      this.screenMat = new T.MeshBasicMaterial({ color: '#ffffff', map: this.screenTex });
      this.screenInfo = null; this.screenKey = ''; this.screenNext = 0;
      add(lid, new T.PlaneGeometry(0.31, 0.2), this.screenMat, { pos: [0, 0.115, -0.007], rot: [0, Math.PI, 0], outline: 0 });
      /* lamp */
      const lampG = new T.Group(); lampG.position.set(-0.75, 0.77, 0.05); desk.add(lampG);
      add(lampG, cyl(0.08, 0.09, 0.025), toon('#3b3644'), { outline: 0.003 });
      add(lampG, cyl(0.012, 0.012, 0.45), toon('#3b3644'), { pos: [0, 0.22, 0], rot: [0, 0, 0.2], outline: 0.002 });
      add(lampG, cyl(0.012, 0.012, 0.3), toon('#3b3644'), { pos: [0.1, 0.5, -0.0], rot: [0, 0, -1.0], outline: 0.002 });
      this.shade = add(lampG, new T.ConeGeometry(0.11, 0.14, 20, 1, true), toon('#f0c35a', { side: T.DoubleSide }), { pos: [0.24, 0.54, 0], rot: [0, 0, 0.9], outline: 0.003 });
      this.bulb = add(lampG, sph(0.035, 12, 8), new T.MeshBasicMaterial({ color: '#fff3d0' }), { pos: [0.22, 0.5, 0], outline: 0 });
      /* mug with steam */
      const mug = new T.Group(); mug.position.set(-0.35, 0.77, -0.05); desk.add(mug);
      add(mug, cyl(0.04, 0.036, 0.1), white, { pos: [0, 0.05, 0], outline: 0.003 });
      add(mug, new T.TorusGeometry(0.025, 0.007, 8, 16), white, { pos: [0.045, 0.05, 0], outline: 0.002 });
      this.steam = this.makeSteam(); this.steam.position.set(-0.35, 0.9, -0.65); s.add(this.steam);
      /* papers */
      add(desk, box(0.2, 0.004, 0.28), toon('#fbfaf6'), { pos: [-0.38, 0.772, 0.12], rot: [0, 0.2, 0], outline: 0 });
      /* split the desk into a frame (stretched to the right height) and a top (moved, never squashed) */
      this.deskTop = new T.Group(); this.deskBase = new T.Group();
      [...desk.children].forEach((o) => (o.position.y >= 0.7 ? this.deskTop : this.deskBase).add(o));
      desk.add(this.deskBase); desk.add(this.deskTop);
      /* chair */
      const ch = new T.Group(); ch.position.set(0, 0, -1.1); s.add(ch); this.chair = ch;
      add(ch, cyl(0.22, 0.22, 0.06, 24), toon('#7d86b0'), { pos: [0, 0.45, 0], outline: 0.004 });
      add(ch, new T.CapsuleGeometry(0.15, 0.12, 6, 16), toon('#7d86b0'), { pos: [0, 0.78, -0.24], rot: [0.12, 0, Math.PI / 2], scale: [1, 1, 0.3], outline: 0.004 });
      add(ch, cyl(0.015, 0.015, 0.3), toon('#2b2e3a'), { pos: [0, 0.6, -0.24], outline: 0 });
      add(ch, cyl(0.025, 0.025, 0.4), toon('#2b2e3a'), { pos: [0, 0.22, 0], outline: 0 });
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(ch, box(0.04, 0.03, 0.3), toon('#2b2e3a'), { pos: [Math.sin(a) * 0.14, 0.03, Math.cos(a) * 0.14], rot: [0, a, 0], outline: 0 }); }

      /* wall: clock, frames, shelves */
      this.clock = this.makeClock(); this.clock.position.set(0.55, 2.5, -2.19); s.add(this.clock);
      this.frames = [];
      /* frames sit between the curtain (right edge x≈0.35) and the bookshelf (x≥1.4) */
      [[0.74, 1.68, 0.46], [1.22, 1.76, 0.36], [0.72, 1.12, 0.32], [1.2, 1.2, 0.4]].forEach(([x, y, sz]) => {
        const g = new T.Group(); g.position.set(x, y, -2.18); s.add(g);
        add(g, box(sz + 0.06, sz + 0.06, 0.03), toon('#3b3644'), { outline: 0 });
        const pic = new T.Mesh(new T.PlaneGeometry(sz, sz), new T.MeshBasicMaterial({ color: '#f6f3ec' }));
        pic.position.z = 0.017; g.add(pic); this.frames.push(pic);
      });
      const shelf = (x0, x1, y) => { add(s, box(x1 - x0, 0.04, 0.26), wood, { pos: [(x0 + x1) / 2, y, -2.07], outline: 0.004, receive: true }); };
      shelf(1.4, 3.1, 2.12); shelf(1.65, 2.95, 1.55);
      const books = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#6d6875', '#b5838d', '#457b9d'];
      let bx = 1.5;
      books.forEach((c, i) => { const h = 0.22 + (i * 13 % 9) / 100, w = 0.05 + (i % 3) * 0.015; add(s, box(w, h, 0.18), toon(c), { pos: [bx, 2.14 + h / 2, -2.08], outline: 0.003 }); bx += w + 0.008; });
      add(s, box(0.06, 0.22, 0.18), toon('#a8dadc'), { pos: [bx + 0.06, 2.24, -2.08], rot: [0, 0, -0.3], outline: 0.003 });
      this.addPlant(s, 1.8, 1.57, -2.07, 0.4);
      const hk = add(s, box(0.2, 0.14, 0.12), toon('#f3c26b'), { pos: [2.45, 1.64, -2.07], outline: 0.003 });
      hit(hk, 'shelf');

      /* easel with the live painting */
      const ea = new T.Group(); ea.position.set(2.15, 0, -0.45); ea.rotation.y = -0.75; s.add(ea); this.easel = ea;
      const legM = toon('#8a6040');
      add(ea, cyl(0.018, 0.022, 1.66), legM, { pos: [-0.2, 0.82, 0.05], rot: [0.06, 0, -0.14], outline: 0.003 });
      add(ea, cyl(0.018, 0.022, 1.66), legM, { pos: [0.2, 0.82, 0.05], rot: [0.06, 0, 0.14], outline: 0.003 });
      add(ea, cyl(0.016, 0.02, 1.6), legM, { pos: [0, 0.78, -0.28], rot: [-0.32, 0, 0], outline: 0.003 });
      add(ea, box(0.8, 0.04, 0.08), legM, { pos: [0, 0.78, 0.13], outline: 0.003 });
      add(ea, box(0.78, 0.78, 0.03), toon('#fbf9f4'), { pos: [0, 1.2, 0.1], rot: [-0.08, 0, 0], outline: 0.004 });
      this.paintMat = new T.MeshBasicMaterial({ color: '#ffffff' });
      this.board = new T.Mesh(new T.PlaneGeometry(0.74, 0.74), this.paintMat);
      this.board.position.set(0, 1.2, 0.118); this.board.rotation.x = -0.08; ea.add(this.board); hit(this.board, 'easel');
      const pt = new T.Group(); pt.position.set(2.55, 0, 0.35); s.add(pt);
      add(pt, box(0.45, 0.5, 0.35), toon('#e9e2d6'), { pos: [0, 0.25, 0], outline: 0.004 });
      ['#f06a6a', '#5ba3f0', '#f2c14e', '#6cc28a'].forEach((c, i) => add(pt, cyl(0.04, 0.04, 0.06, 14), toon(c), { pos: [-0.15 + i * 0.1, 0.53, 0], outline: 0.002 }));

      /* reading nook: beanbag + cushion + blanket */
      const nk = new T.Group(); nk.position.set(-2.0, 0, -0.05); s.add(nk); this.nook = nk;
      this.fit = { seatHip: 0.5, lowHip: 0.36 };
      /* beanbag: one soft blob with a raised back */
      const bb = sph(0.55, 36, 24); const bp = bb.attributes.position;
      for (let i = 0; i < bp.count; i++) { const y = bp.getY(i), z = bp.getZ(i); let ny = y * 0.55; if (z < 0) ny += (-z / 0.55) * 0.28 * Math.max(0, (y + 0.3) / 0.85); bp.setY(i, Math.max(ny, -0.2)); }
      bb.computeVertexNormals();
      /* lap blanket: draped over her legs while she reads on the beanbag */
      {
        const bc = document.createElement('canvas'); bc.width = bc.height = 128; const bx = bc.getContext('2d');
        bx.fillStyle = '#cfdcf3'; bx.fillRect(0, 0, 128, 128);
        bx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 128; i += 32) { bx.fillRect(i, 0, 12, 128); bx.fillRect(0, i, 128, 12); }
        bx.fillStyle = 'rgba(120,140,190,0.35)'; for (let i = 16; i < 128; i += 32) { bx.fillRect(i, 0, 3, 128); bx.fillRect(0, i, 128, 3); }
        const bt = new T.CanvasTexture(bc); bt.colorSpace = T.SRGBColorSpace; bt.wrapS = bt.wrapT = T.RepeatWrapping; bt.repeat.set(2, 2);
        const g = new T.PlaneGeometry(1, 1, 16, 12); const gp = g.attributes.position;
        for (let i = 0; i < gp.count; i++) {
          const u = gp.getX(i) + 0.5, v = gp.getY(i) + 0.5; /* v: 0 = at her waist, 1 = over the knees and down */
          const drop = Math.max(0, v - 0.55) * 1.1 + Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.18;
          gp.setXYZ(i, (u - 0.5), -drop, v * 0.9 + Math.sin(u * 9 + v * 4) * 0.012);
        }
        g.computeVertexNormals();
        this.lapBlanket = add(s, g, toon('#ffffff', { map: bt, side: T.DoubleSide, levels: [170, 225, 255] }), { outline: 0.004 });
        this.lapBlanket.visible = false;
      }
      this.beanbag = add(nk, bb, toon('#e8a07a', { levels: [175, 225, 255] }), { pos: [0, 0.22, -0.05], outline: 0.006 });
      add(nk, new T.CapsuleGeometry(0.1, 0.22, 6, 12), toon('#c9d8f2'), { pos: [0.32, 0.42, -0.32], rot: [0, -0.5, Math.PI / 2 - 0.3], outline: 0.004 });
      /* rug */
      const rug = new T.Mesh(new T.CircleGeometry(1.0, 48), toon('#e7d4c4', { levels: [200, 240, 255] }));
      rug.rotation.x = -Math.PI / 2; rug.position.set(-0.3, 0.005, 0.45); rug.scale.set(1.25, 0.6, 1); rug.receiveShadow = true; s.add(rug); this.rug = rug;
    }

    addPlant(parent, x, y, z, s) {
      const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
      add(g, cyl(0.16, 0.12, 0.25, 18), toon('#d98b62'), { pos: [0, 0.125, 0], outline: 0.006 });
      const leaf = toon('#5d9a5a');
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(g, sph(0.12, 10, 8), leaf, { pos: [Math.sin(a) * 0.12, 0.38 + (i % 3) * 0.08, Math.cos(a) * 0.12], scale: [0.6, 1.4, 0.3], rot: [Math.cos(a) * 0.5, a, Math.sin(a) * 0.5], outline: 0.005 }); }
      return g;
    }

    makeSteam() {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const tex = new T.CanvasTexture(c);
      const grp = new T.Group(); grp.userData.puffs = [];
      for (let i = 0; i < 4; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.setScalar(0.06); grp.add(sp); grp.userData.puffs.push(sp); }
      return grp;
    }

    makeClock() {
      const g = new T.Group();
      add(g, cyl(0.18, 0.18, 0.03, 32), toon('#fbf8f2'), { rot: [Math.PI / 2, 0, 0], outline: 0.006 });
      this.hHand = new T.Group(); this.mHand = new T.Group(); g.add(this.hHand); g.add(this.mHand);
      add(this.hHand, box(0.012, 0.09, 0.006), toon('#2e2a3a'), { pos: [0, 0.045, 0.02], outline: 0 });
      add(this.mHand, box(0.008, 0.14, 0.006), toon('#2e2a3a'), { pos: [0, 0.07, 0.024], outline: 0 });
      return g;
    }

    /* ---------------- buyable items ---------------- */
    buildItems() {
      const s = this.scene, I = this.itemObjs = {};
      const grp = (id) => { const g = new T.Group(); g.visible = false; s.add(g); I[id] = g; return g; };
      /* plant */ { const g = grp('plant'); this.addPlant(g, -3.05, 0, -1.75, 1.6); }
      /* fairy lights along the window top */
      { const g = grp('lights'); this.bulbs = [];
        const cols = ['#ffd27a', '#ff9db0', '#9fd8ff', '#b8f5a8'];
        for (let i = 0; i <= 20; i++) { const x = -2.7 + i * 0.13, y = 2.58 - Math.sin(i / 20 * Math.PI) * 0.18; const m = new T.Mesh(sph(0.022, 8, 6), new T.MeshBasicMaterial({ color: cols[i % 4] })); m.position.set(x, y, -2.1); g.add(m); this.bulbs.push(m); }
        this.lightsGlow = new T.PointLight('#ffc8d8', 0, 3, 2); this.lightsGlow.position.set(-1.35, 2.4, -1.8); g.add(this.lightsGlow); }
      /* record player on the shelf */
      { const g = grp('record'); g.position.set(2.55, 2.14, -2.05);
        add(g, box(0.36, 0.06, 0.26), toon('#7b5b45'), { pos: [0, 0.03, 0], outline: 0.003 });
        this.disc = add(g, cyl(0.11, 0.11, 0.008, 28), toon('#1d1d24'), { pos: [-0.04, 0.065, 0], outline: 0 });
        add(this.disc, cyl(0.035, 0.035, 0.01, 16), toon('#e0574f'), { pos: [0, 0.002, 0], outline: 0 });
        add(this.disc, box(0.04, 0.012, 0.006), toon('#ffffff'), { pos: [0.02, 0.003, 0], outline: 0 }); }
      /* kitty on the sill */
      { const g = grp('kitty'); g.position.set(-0.55, 0.96, -2.2); g.rotation.y = 0.4;
        const fur = toon('#f1e2c8');
        this.kittyBody = add(g, sph(0.13, 16, 12), fur, { pos: [0, 0.07, 0], scale: [1.4, 0.6, 0.8] });
        add(g, sph(0.075, 16, 12), fur, { pos: [-0.17, 0.1, 0.02] });
        [-1, 1].forEach((k) => add(g, new T.ConeGeometry(0.025, 0.05, 4), fur, { pos: [-0.19, 0.17, k * 0.035], rot: [k * 0.3, 0, 0.3] }));
        add(g, sph(0.05, 10, 8), toon('#d8a46a'), { pos: [0.05, 0.11, 0.05], scale: [1, 0.4, 1], outline: 0 });
        g.traverse((o) => { if (o.isMesh) { o.userData.hit = 'kitty'; this.hitMap.push(o); } }); }
      /* fish bowl */
      { const g = grp('fish'); g.position.set(2.85, 2.14, -2.05);
        g.add(new T.Mesh(sph(0.12, 20, 14), new T.MeshPhongMaterial({ color: '#aadcff', transparent: true, opacity: 0.45, shininess: 90 })));
        g.children[0].position.y = 0.11;
        this.fish = add(g, sph(0.025, 10, 8), toon('#ff8a3d'), { pos: [0, 0.1, 0], scale: [1.4, 0.8, 0.6], outline: 0.002 }); }
      /* globe on the desk */
      { const g = grp('globe'); g.position.set(0.85, 0.77, -0.75); this.globeG = g;
        add(g, cyl(0.05, 0.06, 0.02), toon('#8a6040'), { outline: 0.002 });
        add(g, cyl(0.006, 0.006, 0.1), toon('#8a6040'), { pos: [0, 0.05, 0], outline: 0 });
        this.globe = add(g, sph(0.075, 20, 14), toon('#7ab6e8'), { pos: [0, 0.14, 0], outline: 0.003 });
        add(this.globe, sph(0.076, 12, 8, 0, 1.4, 0.6, 1.0), toon('#7cc46e'), { outline: 0 }); }
      /* keyword neon */
      { const g = grp('neon');
        this.neonCanvas = document.createElement('canvas'); this.neonCanvas.width = 512; this.neonCanvas.height = 128;
        this.neonTex = new T.CanvasTexture(this.neonCanvas); this.neonTex.colorSpace = T.SRGBColorSpace;
        const m = new T.Mesh(new T.PlaneGeometry(1.4, 0.35), new T.MeshBasicMaterial({ map: this.neonTex, transparent: true, depthWrite: false }));
        m.position.set(2.25, 2.62, -2.18); g.add(m); this.neonDrawn = null; }
      /* fancy rug */
      { const g = grp('rug'); const m = new T.Mesh(new T.RingGeometry(0.85, 1.05, 48), toon('#f7e1d3')); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.008, 0.4); m.scale.set(1.4, 0.7, 1); g.add(m); }
      /* telescope */
      { const g = grp('telescope'); g.position.set(-0.55, 0, -1.55);
        [[-0.12, 0.2], [0.12, 0.2], [0, -0.15]].forEach(([x, z]) => add(g, cyl(0.012, 0.012, 0.95), toon('#4b4f63'), { pos: [x * 0.5, 0.46, z * 0.5], rot: [z * 0.5, 0, -x * 0.5], outline: 0.002 }));
        add(g, cyl(0.04, 0.055, 0.6, 16), toon('#d9d4e8'), { pos: [0, 1.0, -0.15], rot: [-1.0, 0, 0], outline: 0.003 }); }
      /* speaker */
      { const g = grp('speaker'); g.position.set(1.2, 0, -1.6);
        add(g, box(0.28, 0.85, 0.26), toon('#3b3644'), { pos: [0, 0.425, 0], outline: 0.004 });
        this.cone = add(g, cyl(0.09, 0.09, 0.02, 20), toon('#5a5566'), { pos: [0, 0.3, 0.135], rot: [Math.PI / 2, 0, 0], outline: 0 });
        add(g, cyl(0.05, 0.05, 0.02, 16), toon('#5a5566'), { pos: [0, 0.65, 0.135], rot: [Math.PI / 2, 0, 0], outline: 0 }); }
      /* floor lamp in the nook */
      { const g = grp('floorlamp'); g.position.set(-2.95, 0, -0.6);
        add(g, cyl(0.15, 0.17, 0.03), toon('#3b3644'), { outline: 0.003 });
        add(g, cyl(0.015, 0.015, 1.5), toon('#3b3644'), { pos: [0, 0.75, 0], outline: 0.002 });
        add(g, new T.ConeGeometry(0.22, 0.25, 22, 1, true), toon('#f2d39b', { side: T.DoubleSide }), { pos: [0, 1.55, 0], rot: [Math.PI, 0, 0], outline: 0.003 });
        this.floorLight = new T.PointLight('#ffc777', 0, 4, 1.8); this.floorLight.position.set(0, 1.45, 0); g.add(this.floorLight); }
      /* poster on the left wall */
      { const g = grp('poster');
        const c = document.createElement('canvas'); c.width = 256; c.height = 360; const x = c.getContext('2d');
        x.fillStyle = '#f2e3c7'; x.fillRect(0, 0, 256, 360); x.fillStyle = '#e0574f'; x.beginPath(); x.arc(128, 140, 80, 0, 7); x.fill();
        x.fillStyle = '#2f45ff'; x.fillRect(30, 240, 196, 12); x.fillRect(30, 262, 130, 12);
        x.fillStyle = '#2e2a3a'; x.font = 'bold 28px Consolas, monospace'; x.fillText('WORLD', 30, 316); x.fillText('SOUND FEST', 30, 346);
        const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
        const m = new T.Mesh(new T.PlaneGeometry(0.6, 0.85), toon('#ffffff', { map: tex })); m.position.set(-3.59, 1.75, -0.9); m.rotation.y = Math.PI / 2; g.add(m); }
    }

    /* ---------------- character ---------------- */
    setCharacter(cfg) {
      if (this.char) { this.scene.remove(this.char.root); this.char.dispose(); }
      this.char = new H.Character3D(cfg);
      this.scene.add(this.char.root);
      this.fitFurniture();
    }
    useCharacter(c) {
      if (this.char) { this.scene.remove(this.char.root); this.char.dispose(); }
      this.char = c; this.scene.add(c.root);
      this.fitFurniture();
      return c;
    }
    /* fine fit from the real pose: desk top just under her typing hands and elbows (so forearms rest
       on it instead of sinking in), keyboard under her hands; on the beanbag, hips sit on its surface */
    fitToPose(dt, pet, pose) {
      if (this.lapBlanket && (pet.spot !== 'nook' || pet.target || !pet.seated)) this.lapBlanket.visible = false;
      if (!this.fit || !this.char.bodyWorld || pet.target || !pet.seated) return;
      const k = Math.min(1, dt * 3);
      if (pet.spot === 'desk' && (pose.act === 'type' || pose.act === 'think' || pose.act === 'idle')) {
        const b = this.char.bodyWorld(); if (!b.handL || !b.elbowL) return;
        if (pose.act === 'type') {
          const handY = Math.min(b.handL.y, b.handR.y), elbowY = Math.min(b.elbowL.y, b.elbowR.y);
          /* top must clear her thighs (knees go under it) and stay just below hands/elbows */
          const thighTop = (b.hips ? b.hips.y : this.fit.seatHip) + this.fit.height * 0.07;
          const want = H.clamp(Math.max(thighTop + 0.07, Math.min(handY - 0.035, elbowY - 0.015)), this.fit.seat + 0.14, this.fit.seat + 0.45);
          this.fit.deskLive = this.fit.deskLive == null ? want : H.lerp(this.fit.deskLive, want, k);
          /* slide the desk so the keyboard (desk-local z −0.18) sits under her hands */
          const hz = (b.handL.z + b.handR.z) / 2;
          this.fit.deskZ = H.clamp(hz + 0.18, -0.85, -0.4);
        }
        if (this.fit.deskLive != null) this.applyDesk(this.fit.deskLive, this.fit.deskZ);
      }
      if (pet.spot === 'nook' && this.beanbag) {
        const b = this.char.bodyWorld(); if (!b.hips) return;
        if (this.lapBlanket) {
          const Hc = this.fit.height, hd = this.char.root.rotation.y;
          this.lapBlanket.visible = true;
          this.lapBlanket.scale.set(Hc * 0.42, Hc * 0.42, Hc * 0.42);
          this.lapBlanket.position.set(b.hips.x - Math.sin(hd) * 0.04, b.hips.y + Hc * 0.075, b.hips.z - Math.cos(hd) * 0.04);
          this.lapBlanket.rotation.set(0, hd, 0);
        }
        const rc = new T.Raycaster(new T.Vector3(b.hips.x, 3, b.hips.z), new T.Vector3(0, -1, 0));
        const hit = rc.intersectObject(this.beanbag, false)[0];
        if (hit) {
          const want = hit.point.y + this.fit.height * 0.05;
          this.fit.lowLive = this.fit.lowLive == null ? want : H.lerp(this.fit.lowLive, want, k);
        }
      }
    }
    applyDesk(h, z) {
      this.deskBase.scale.y = h / 0.77;
      this.deskTop.position.y = h - 0.77;
      if (z != null) this.desk.position.z = z;
      const dz = this.desk.position.z;
      if (this.globeG) { this.globeG.position.y = h; this.globeG.position.z = dz - 0.15; }
      if (this.steam) { this.steam.position.y = h + 0.13; this.steam.position.z = dz - 0.05; }
    }
    /* chair, desk and beanbag follow the character's body size (seat ≈ 27 %, desk ≈ 45 % of height) */
    fitFurniture() {
      if (!this.char || !this.deskTop) return;
      const b = new T.Box3().setFromObject(this.char.root);
      const Hc = H.clamp(b.max.y - b.min.y, 0.9, 2.0);
      const seat = H.clamp(Hc * 0.27, 0.3, 0.5), desk = H.clamp(Hc * 0.455, 0.52, 0.8);
      this.desk.position.z = -0.6;
      this.applyDesk(desk);
      const cs = H.clamp(Hc / 1.45, 0.75, 1.2);
      this.chair.scale.set(cs, seat / 0.48, cs);
      const ns = H.clamp(Hc / 1.3, 0.8, 1.3);
      /* a beanbag for her size: about as wide as she is tall, seat surface near knee height */
      const surf = Hc * 0.24;
      this.nook.scale.set(ns, H.clamp(surf / (0.5 * ns), 0.6, 1.2) * ns, ns);
      this.fit = { height: Hc, seat, desk, seatHip: seat + 0.03, lowHip: surf + Hc * 0.05, deskLive: null, lowLive: null };
    }

    /* ---------------- cameras ---------------- */
    setCamera(name) { if (!CAMS[name]) return; this.camName = name; this.orbitOff = null; this.follow = false; const c = this.camState(name); this.camTarget = c; }
    setFollow(on) { this.follow = on; }
    /* user orbit: drag rotates around the current look-at point, wheel/pinch zooms */
    orbit(dx, dy) {
      const c = this.camTarget;
      const off = c.p.clone().sub(c.t);
      const sp = new T.Spherical().setFromVector3(off);
      sp.theta -= dx * 0.005; sp.phi = H.clamp(sp.phi - dy * 0.004, 0.25, 1.65);
      c.p.copy(c.t).add(new T.Vector3().setFromSpherical(sp));
      this.clampCam(c.p);
      this.cam.p.copy(c.p);
    }
    /* move the observer (camera and what it looks at together) — like walking sideways / standing up */
    pan(dx, dy) {
      const c = this.camTarget;
      const off = c.t.clone().sub(c.p);
      const fwd = off.clone().setY(0); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      const right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize();
      const k = H.clamp(off.length(), 0.6, 6) * 0.0018;
      const want = c.p.clone().addScaledVector(right, -dx * k).add(new T.Vector3(0, dy * k, 0));
      this.clampCam(want);
      const delta = want.sub(c.p);
      c.p.add(delta); c.t.add(delta);
      this.cam.p.add(delta); this.cam.t.add(delta);
    }
    zoom(f) {
      const c = this.camTarget;
      const off = c.p.clone().sub(c.t); const d = H.clamp(off.length() * f, 0.35, 7);
      c.p.copy(c.t).add(off.setLength(d));
      this.clampCam(c.p);
    }
    /* keep a user-steered camera inside the room (the open front side may look in from outside) */
    clampCam(p) {
      const b = this.roomBounds; if (!b) return p;
      p.x = H.clamp(p.x, -b.x, b.x); p.y = H.clamp(p.y, b.yMin, b.yMax); p.z = H.clamp(p.z, b.zMin, b.zMax);
      return p;
    }
    setCameraTarget() { /* 2D API compatibility */ }

    /* ---------------- per-frame ---------------- */
    petPlacement(pet) {
      const X = toX(pet.x), Z = toZ(pet.y);
      let heading = 0, seatH = this.fit ? this.fit.seatHip : 0.5, low = false;
      const spot = pet.target ? null : pet.spot;
      if (pet.target) {
        const tx = toX(pet.target.x) - X, tz = toZ(pet.target.y) - Z;
        heading = Math.abs(tx) + Math.abs(tz) > 0.001 ? Math.atan2(tx, tz) : this.lastHeading || 0;
      } else if (spot === 'desk') heading = 0;
      else if (spot === 'nook') { heading = 0.35; seatH = this.fit ? this.fit.lowHip : 0.36; low = true; }
      else if (spot === 'window') heading = Math.PI - 0.35;
      else if (spot === 'easel') heading = 2.2;
      else if (spot === 'center') heading = 0.15;
      this.lastHeading = heading;
      return { X, Z, heading, seatH, low };
    }

    setWindowOpen(open) { this.windowOpen = !!open; }
    update(dt, pet) {
      this.t += dt;
      if (this.sashes) {
        const want = this.windowOpen ? 1 : 0;
        this.sashes.forEach((sh) => {
          sh.open += (want - sh.open) * Math.min(1, dt * 3.2);
          const gust = this.windowOpen ? Math.sin(this.t * 0.9 + sh.side) * 0.04 : 0;
          sh.hinge.rotation.y = sh.side * (sh.open * 1.15 + gust);
        });
        const breeze = this.sashes[0].open;
        (this.curtains || []).forEach((c, i) => {
          const sway = breeze * (Math.sin(this.t * 1.7 + i * 1.3) * 0.5 + Math.sin(this.t * 0.6 + i) * 0.5);
          c.rotation.x = -0.12 * breeze - sway * 0.08;
          c.position.z = -2.12 + breeze * 0.08 + sway * 0.03;
        });
      }
      const h = this.hours, day = H.daylight(h);
      /* sky colours (shared with the 2D room) */
      const [top, bot] = H.skyColors(h);
      const wx = this.weather;
      const gray = wx ? ({ cloudy: 0.45, rain: 0.6, storm: 0.7, fog: 0.55, snow: 0.4, partly: 0.12 }[wx.sky] || 0) : 0;
      const tc = gray ? H.mix(top, H.mix('#7d8597', '#1d2030', 1 - day), gray) : top, bc = gray ? H.mix(bot, H.mix('#aab1bd', '#2a2d40', 1 - day), gray) : bot;
      this.skyMat.uniforms.top.value.set(tc); this.skyMat.uniforms.bot.value.set(bc);
      /* sun path: rises left, sets right, light enters through the window */
      const sp = H.clamp((h - 6) / 13);
      const sunDir = new T.Vector3(-0.9 + sp * 1.8, 0.12 + Math.sin(sp * Math.PI) * 0.55, -1).normalize();
      this.skyMat.uniforms.sunDir.value.copy(sunDir); this.skyMat.uniforms.sunAmt.value = day * (1 - gray);
      const sunset = h > 16.5 && h < 19.5 ? 1 - Math.abs(h - 18) / 1.5 : h > 5.5 && h < 7.5 ? 1 - Math.abs(h - 6.5) : 0;
      this.sun.color.set(H.mix('#fff2dc', '#ff9a5a', H.clamp(sunset)));
      this.sun.intensity = 3.2 * day * (1 - gray * 0.7);
      /* keep the sun behind the window so its light falls into the room through the glass */
      this.sun.position.set(-1.35 + (sp - 0.5) * 2.4, 1.6 + Math.sin(sp * Math.PI) * 3.2, -9);
      this.sun.target.position.set(-0.6 - (sp - 0.5) * 1.2, 0, 0.4);
      const warm = H.mix('#ffffff', '#ffd7b0', H.clamp(sunset));
      this.hemi.intensity = 0.6 + day * 1.0; this.hemi.color.set(H.mix('#5a63a0', warm, day)); this.hemi.groundColor.set(H.mix('#2a2430', '#b59a80', day));
      this.amb.intensity = 0.25 + day * 0.3; this.amb.color.set(H.mix('#8090c0', '#fff4e8', day));
      const lampLit = this.lampOn || day < 0.55;
      this.lamp.intensity = lampLit ? 2.6 : 0; this.bulb.material.color.set(lampLit ? '#fff3d0' : '#d8d2c0');
      this.fill.intensity = (1 - day) * 0.6;
      this.stars.material.opacity = H.clamp((0.6 - day) / 0.6) * (1 - gray) * (this.items.has('telescope') ? 1 : 0.7);
      this.moon.material.opacity = H.clamp((0.5 - day) / 0.5) * (1 - gray * 0.7);
      this.cityMat.color.set(H.mix(H.mix('#20233a', '#9aa6bb', day), bc, 0.45)); this.cityMat.emissiveIntensity = H.clamp(0.9 - day) * 0.9;
      this.clouds.forEach((c) => { c.position.x += c.userData.v * dt * (wx && wx.wind ? 1 + wx.wind / 15 : 1); if (c.position.x > 22) c.position.x = -22; c.material.color.set(H.mix(H.mix('#ffffff', '#ffc7a8', sunset), '#3a3f60', 1 - day)); c.material.opacity = 0.55 + gray * 0.4; c.visible = this.clouds.indexOf(c) < 3 + Math.round(gray * 6); });
      this.screenMat.color.set(H.mix('#d9def0', '#ffffff', day));
      if (this.t > this.screenNext) { this.screenNext = this.t + 1.5; this.drawScreen(); }
      /* precipitation */
      const rain = wx && (wx.sky === 'rain' || wx.sky === 'storm'), snow = wx && wx.sky === 'snow';
      this.precip.visible = !!(rain || snow);
      if (this.precip.visible) {
        const p = this.precip.geometry.attributes.position, v = rain ? 6 : 0.6;
        for (let i = 0; i < p.count; i++) { let y = p.getY(i) - v * dt; if (y < -0.5) y = 6; p.setY(i, y); if (snow) p.setX(i, p.getX(i) + Math.sin(this.t + i) * 0.002); }
        p.needsUpdate = true; this.precip.material.size = rain ? 0.03 : 0.06;
      }
      if (this.flash > 0) this.flash -= dt;
      if (wx && wx.sky === 'storm' && Math.random() < dt * 0.05) this.flash = 0.25;
      this.hemi.intensity += this.flash > 0 ? 2 : 0;
      /* clock */
      const now = new Date(); const hh = (now.getHours() % 12) + now.getMinutes() / 60;
      this.hHand.rotation.z = -hh / 12 * Math.PI * 2; this.mHand.rotation.z = -now.getMinutes() / 60 * Math.PI * 2;
      /* steam */
      this.steam.userData.puffs.forEach((sp2, i) => { const ph = (this.t * 0.35 + i / 4) % 1; sp2.position.set(Math.sin(this.t + i) * 0.02, ph * 0.25, 0); sp2.material.opacity = (1 - ph) * 0.6; sp2.scale.setScalar(0.05 + ph * 0.08); });
      /* items */
      Object.entries(this.itemObjs).forEach(([id, g]) => { g.visible = this.items.has(id); });
      if (this.items.has('lights')) { this.bulbs.forEach((b, i) => { b.material.color.setScalar(1); b.visible = true; b.scale.setScalar(0.8 + 0.3 * Math.sin(this.t * 2 + i * 1.7)); }); this.lightsGlow.intensity = (1 - day) * 0.8; }
      if (this.disc) this.disc.rotation.y += dt * 3.5 * this.musicLevel;
      if (this.kittyBody) this.kittyBody.scale.y = 0.6 + Math.sin(this.t * 1.5) * 0.02;
      if (this.fish) { this.fish.position.x = Math.sin(this.t * 0.9) * 0.06; this.fish.rotation.y = Math.cos(this.t * 0.9) > 0 ? 0 : Math.PI; }
      if (this.globe) this.globe.rotation.y += dt * 0.3;
      if (this.cone) this.cone.scale.setScalar(1 + this.musicLevel * 0.12 * Math.abs(Math.sin(this.t * 8)));
      if (this.floorLight) this.floorLight.intensity = this.items.has('floorlamp') ? 1.4 * (1 - day * 0.7) : 0;
      this.neonLight.intensity = this.items.has('neon') && this.neonText ? 0.8 : 0;
      if (this.items.has('neon') && this.neonText !== this.neonDrawn) this.drawNeon();
      if (this.items.has('rug')) this.rug.material.color.set('#e6b8a2');
      /* keyboard lights while typing */
      const typing = pet && pet.pose && pet.pose.act === 'type';
      this.keys.forEach((k, i) => k.material.color.set(typing && Math.sin(this.t * 17 + i * 2.3) > 0.85 ? '#ffd27a' : '#f7f5f0'));
      /* painting texture + wall art */
      if (this.paintCanvas) {
        if (!this.paintTex || this.paintTex.image !== this.paintCanvas) { this.paintTex = new T.CanvasTexture(this.paintCanvas); this.paintTex.colorSpace = T.SRGBColorSpace; this.paintMat.map = this.paintTex; this.paintMat.needsUpdate = true; }
        const sig = (this.paintCanvas.__drawn || 0);
        if ((this.t * 4 | 0) !== this.lastPaintTick) { this.lastPaintTick = this.t * 4 | 0; this.paintTex.needsUpdate = true; }
        void sig;
      }
      this.artworks.forEach((img, i) => {
        if (!this.frames[i] || !img || !img.complete || !img.naturalWidth) return;
        if (this.artTex[i] && this.artTex[i].image === img) return;
        const tx = new T.Texture(img); tx.colorSpace = T.SRGBColorSpace; tx.needsUpdate = true;
        const sh = Math.min(img.naturalHeight, img.naturalWidth) / img.naturalHeight;
        tx.repeat.set(1, sh); tx.offset.set(0, 1 - sh);
        this.artTex[i] = tx; this.frames[i].material.map = tx; this.frames[i].material.color.set('#ffffff'); this.frames[i].material.needsUpdate = true;
      });
      /* character */
      if (pet && this.char) {
        const pl = this.petPlacement(pet);
        const r = this.char.root;
        r.position.set(pl.X, 0, pl.Z);
        let dh = pl.heading - r.rotation.y; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        r.rotation.y += dh * (1 - Math.exp(-dt * 8));
        if (pet.spot === 'nook' && pet.seated && !pet.target && this.fit && this.fit.lowLive != null) pl.seatH = this.fit.lowLive;
        const pose = Object.assign({}, pet.pose, { seatH: pl.seatH, lowSeat: pl.low });
        if (pet.spot === 'desk' && pet.seated) this.chair.position.set(pl.X, 0, pl.Z - 0.08);
        this.char.update(dt, pose);
        this.fitToPose(dt, pet, pose);
      }
      this.updateParticles(dt);
      /* camera easing */
      const k = 1 - Math.exp(-dt * 2.2);
      if (this.follow && this.char) { const hp = this.char.headWorld(new T.Vector3()); this.camTarget.t.lerp(hp.clone().add(new T.Vector3(0, -0.35, 0)), 0.1); }
      if (this.camName === 'close' && this.char) {
        /* face close-up: stay in front of whatever spot she is at */
        const hp = this.char.headWorld(new T.Vector3()).add(new T.Vector3(0, -0.14, 0));
        const hd = this.char.root.rotation.y + 0.45;
        this.camTarget.t.copy(hp);
        this.camTarget.p.set(hp.x + Math.sin(hd) * 0.85, hp.y + 0.04, hp.z + Math.cos(hd) * 0.85);
        this.camTarget.fov = 30;
      }
      this.cam.p.lerp(this.camTarget.p, k); this.cam.t.lerp(this.camTarget.t, k); this.cam.fov += (this.camTarget.fov - this.cam.fov) * k;
    }

    drawScreen() {
      const info = this.screenInfo || {};
      const key = JSON.stringify([info.mode, info.title, (info.headlines || []).length, (info.keywords || []).join(), info.weather, info.step, Math.floor(this.hours * 4)]);
      if (key === this.screenKey) return;
      this.screenKey = key;
      const c = this.screenCanvas, x = c.getContext('2d'), W = c.width, Hh = c.height;
      const font = (w, px) => `${w} ${px}px "Malgun Gothic", "Segoe UI", sans-serif`;
      const clip = (s, px, max) => { x.font = font(500, px); let t = String(s || ''); while (t.length > 2 && x.measureText(t).width > max) t = t.slice(0, -2); return t === String(s || '') ? t : t + '…'; };
      /* window chrome */
      x.fillStyle = '#eef1f7'; x.fillRect(0, 0, W, Hh);
      x.fillStyle = '#dfe4ee'; x.fillRect(0, 0, W, 54);
      ['#ff6058', '#ffbd2e', '#28c840'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(20 + i * 20, 17, 6, 0, 7); x.fill(); });
      const tab = info.mode === 'compose' ? 'HARU Studio' : info.mode === 'paint' ? 'Palette' : 'HARU News';
      x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(86, 6, 170, 24, [8, 8, 0, 0]); x.fill();
      x.fillStyle = '#2f3240'; x.font = font(600, 13); x.fillText(tab, 98, 23);
      x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(14, 32, W - 28, 18, 9); x.fill();
      x.fillStyle = '#6b7079'; x.font = font(400, 11);
      x.fillText(info.mode === 'compose' ? 'haru.studio/compose' : info.mode === 'paint' ? 'haru.art/palette' : 'news.haru/today', 26, 45);
      const y0 = 64;
      if (info.mode === 'compose') {
        /* tiny DAW: track lanes with blocks + playhead */
        x.fillStyle = '#1d2030'; x.fillRect(0, y0, W, Hh - y0);
        x.fillStyle = '#9aa3c7'; x.font = font(600, 14); x.fillText(clip(info.title || '새 곡', 14, W - 40), 16, y0 + 24);
        x.font = font(400, 11); x.fillStyle = '#6f7798'; x.fillText(info.sub || '', 16, y0 + 42);
        const lanes = ['lead', 'chord', 'bass', 'drum'], cols = ['#ff7aa8', '#7fa2ff', '#7ce0b6', '#ffd36b'];
        lanes.forEach((ln, i) => {
          const ly = y0 + 60 + i * 64;
          x.fillStyle = '#262a3d'; x.fillRect(70, ly, W - 86, 50);
          x.fillStyle = '#9aa3c7'; x.font = font(600, 11); x.fillText(ln.toUpperCase(), 16, ly + 29);
          const blocks = (info.lanes && info.lanes[i]) || [];
          blocks.forEach(([a, b, h]) => { x.fillStyle = cols[i]; x.fillRect(70 + a * (W - 86), ly + 6 + (1 - h) * 34, Math.max(2, (b - a) * (W - 86)), 6); });
        });
        if (info.step != null) { x.fillStyle = '#ffffff'; x.fillRect(70 + info.step * (W - 86), y0 + 56, 2, 4 * 64); }
      } else if (info.mode === 'paint') {
        x.fillStyle = '#ffffff'; x.fillRect(0, y0, W, Hh - y0);
        x.fillStyle = '#2f3240'; x.font = font(700, 18); x.fillText('오늘의 팔레트', 18, y0 + 32);
        (info.palette || []).forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.roundRect(18 + i * 96, y0 + 52, 84, 84, 10); x.fill(); x.fillStyle = '#6b7079'; x.font = font(400, 11); x.fillText(col, 22 + i * 96, y0 + 152); });
        x.fillStyle = '#6b7079'; x.font = font(500, 13); x.fillText(clip(info.sub || '', 13, W - 40), 18, y0 + 190);
      } else {
        /* news front page */
        x.fillStyle = '#ffffff'; x.fillRect(0, y0, W, Hh - y0);
        x.fillStyle = '#2f45ff'; x.font = font(800, 20); x.fillText('오늘의 세상', 18, y0 + 32);
        x.fillStyle = '#6b7079'; x.font = font(400, 12); x.fillText(info.date || '', 150, y0 + 30);
        if (info.weather) { x.textAlign = 'right'; x.fillStyle = '#2f3240'; x.font = font(600, 13); x.fillText(info.weather, W - 18, y0 + 30); x.textAlign = 'left'; }
        let kx = 18;
        (info.keywords || []).slice(0, 6).forEach((k) => { x.font = font(600, 12); const w = x.measureText('#' + k).width + 16; if (kx + w > W - 18) return; x.fillStyle = '#eceaf9'; x.beginPath(); x.roundRect(kx, y0 + 44, w, 22, 11); x.fill(); x.fillStyle = '#2f45ff'; x.fillText('#' + k, kx + 8, y0 + 59); kx += w + 6; });
        const hs = info.headlines || [];
        if (!hs.length) { x.fillStyle = '#9aa0aa'; x.font = font(500, 14); x.fillText('오늘 소식은 작업을 시작하면 모아올게요.', 18, y0 + 110); }
        hs.slice(0, 5).forEach((h, i) => {
          const hy = y0 + 92 + i * 52;
          x.fillStyle = ['#ffd9c2', '#d6e4ff', '#d8f2e3', '#f5e1ff', '#fff0bf'][i]; x.fillRect(18, hy - 14, 54, 40);
          x.fillStyle = '#16181d'; x.fillText('', 0, 0);
          x.fillStyle = '#16181d'; x.font = font(600, 14); x.fillText(clip(h.title, 14, W - 110), 84, hy + 2);
          x.fillStyle = '#8a8f98'; x.font = font(400, 11); x.fillText(h.source || '', 84, hy + 20);
        });
      }
      this.screenTex.needsUpdate = true;
    }

    drawNeon() {
      this.neonDrawn = this.neonText;
      const c = this.neonCanvas, x = c.getContext('2d');
      x.clearRect(0, 0, c.width, c.height);
      x.font = '600 70px "Malgun Gothic", "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = '#ff5fa2'; x.shadowBlur = 24; x.fillStyle = '#ffd1e6';
      x.fillText(String(this.neonText).slice(0, 10), 256, 64); x.fillText(String(this.neonText).slice(0, 10), 256, 64);
      this.neonTex.needsUpdate = true;
    }

    /* ---------------- particles (2D emit API → sprites) ---------------- */
    spriteTex(kind, text, color) {
      const key = kind + '|' + (text || '') + '|' + (color || '');
      this.texCache = this.texCache || {};
      if (this.texCache[key]) return this.texCache[key];
      const c = document.createElement('canvas');
      const x = c.getContext('2d');
      if (kind === 'text') {
        c.width = 512; c.height = 80;
        x.font = '500 34px "Malgun Gothic", sans-serif'; const w = Math.min(500, x.measureText(text).width + 40);
        x.fillStyle = 'rgba(255,255,255,0.92)'; H.roundRect(x, (512 - w) / 2, 12, w, 56, 28); x.fill();
        x.strokeStyle = 'rgba(47,69,255,0.6)'; x.lineWidth = 3; x.stroke();
        x.fillStyle = '#23263a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 41);
      } else {
        c.width = c.height = 128; x.textAlign = 'center'; x.textBaseline = 'middle';
        if (kind === 'dot') { x.fillStyle = color; x.beginPath(); x.arc(64, 64, 40, 0, 7); x.fill(); }
        else { x.font = '96px "Segoe UI Emoji", "Segoe UI Symbol", sans-serif'; x.fillStyle = color || '#5b6cff'; x.fillText(kind === 'heart' ? '♥' : text || '♪', 64, 70); }
      }
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
      this.texCache[key] = t;
      return t;
    }
    map2D(x, y) {
      const X = toX(x);
      let Z = 0.15, Y = 0.2 + (860 - y) / 260;
      if (x > 560 && x < 1040 && y < 640) Z = -0.85;
      else if (x < 780 && y < 480) Z = -2.0;
      else if (x > 1180) Z = -0.35;
      return new T.Vector3(X, Y, Z);
    }
    emit(p) {
      const pos = this.map2D(p.x, p.y);
      const tex = this.spriteTex(p.type === 'snack' ? 'emoji' : p.type, p.text, p.color);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      const size = (p.size || 20) / 200;
      if (p.type === 'text') sp.scale.set(size * 6.4 * 1.6, size * 1.6, 1); else sp.scale.setScalar(p.type === 'dot' ? size * 0.5 : size * 1.1);
      sp.position.copy(pos);
      this.scene.add(sp);
      this.particles.push({ sp, vx: (p.vx || 0) / 250, vy: -(p.vy ?? -20) / 260, g: (p.g || 0) / 260, life: p.life || 2, max: p.life || 2, target: p.target ? this.map2D(p.target.x, p.target.y) : null });
    }
    updateParticles(dt) {
      this.particles = this.particles.filter((q) => {
        q.life -= dt;
        if (q.life <= 0) { this.scene.remove(q.sp); q.sp.material.dispose(); return false; }
        q.sp.position.x += q.vx * dt; q.sp.position.y += q.vy * dt; q.vy -= q.g * dt;
        if (q.target) q.sp.position.lerp(q.target, dt * 1.4);
        q.sp.material.opacity = H.clamp(q.life / q.max * 1.4);
        return true;
      });
    }

    /* ---------------- rendering ---------------- */
    applyCam(camera, st, aspect) {
      camera.aspect = aspect;
      camera.fov = st.fov * (aspect < 1 ? 1.45 : aspect < 1.3 ? 1.18 : 1);
      camera.position.copy(st.p); camera.lookAt(st.t); camera.updateProjectionMatrix();
    }
    render(w, h) {
      const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
      if (this.renderer.getPixelRatio() !== dpr) this.renderer.setPixelRatio(dpr);
      const size = this.renderer.getSize(new T.Vector2());
      if (size.x !== w || size.y !== h) this.renderer.setSize(w, h, false);
      this.applyCam(this.camera, this.cam, w / Math.max(1, h));
      this.vw = w; this.vh = h;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
    /* recorder: render a director camera into an offscreen target and blit into a 2D context */
    draw(ctx, W, Hh, pet, opts = {}) {
      const name = opts.camName || 'wide';
      const want = this.camState(name);
      const k = 0.08;
      this.recCam.p.lerp(want.p, k); this.recCam.t.lerp(want.t, k); this.recCam.fov += (want.fov - this.recCam.fov) * k;
      if (!this.rt || this.rt.width !== W || this.rt.height !== Hh) {
        if (this.rt) this.rt.dispose();
        this.rt = new T.WebGLRenderTarget(W, Hh, { samples: 4 }); this.rt.texture.colorSpace = T.SRGBColorSpace;
        this.rtBuf = new Uint8Array(W * Hh * 4); this.rtImg = new ImageData(W, Hh);
      }
      this.applyCam(this.recCamera, this.recCam, W / Hh);
      this.renderer.setRenderTarget(this.rt);
      this.renderer.render(this.scene, this.recCamera);
      this.renderer.readRenderTargetPixels(this.rt, 0, 0, W, Hh, this.rtBuf);
      this.renderer.setRenderTarget(null);
      const row = W * 4, dst = this.rtImg.data;
      for (let y = 0; y < Hh; y++) dst.set(this.rtBuf.subarray((Hh - 1 - y) * row, (Hh - y) * row), y * row);
      ctx.putImageData(this.rtImg, 0, 0);
    }

    /* ---------------- picking & projection ---------------- */
    headScreen() {
      if (!this.char || !this.vw) return { x: -999, y: -999 };
      const v = this.char.headWorld(new T.Vector3()).project(this.camera);
      return { x: (v.x + 1) / 2 * this.vw, y: (1 - v.y) / 2 * this.vh };
    }
    ray(sx, sy) {
      const rc = new T.Raycaster();
      rc.setFromCamera(new T.Vector2(sx / this.vw * 2 - 1, -(sy / this.vh) * 2 + 1), this.camera);
      return rc;
    }
    hitTest(sx, sy) {
      if (!this.vw) return null;
      const rc = this.ray(sx, sy);
      const targets = this.hitMap.concat(this.char ? this.char.hit : []);
      const hits = rc.intersectObjects(targets, false).filter((h) => h.object.visible && !h.object.userData.outline);
      if (!hits.length) return null;
      const o = hits[0].object;
      if (o.userData.pet) return 'pet';
      return o.userData.hit || null;
    }
    easelUV(sx, sy) {
      const h = this.ray(sx, sy).intersectObject(this.board, false)[0];
      return h && h.uv ? { x: h.uv.x, y: 1 - h.uv.y } : null;
    }
    toScreen() { return { x: 0, y: 0 }; }
    toWorld() { return { x: 0, y: 0 }; }
    get view() { return { s: 1 }; }
  }

  H.Room3D = Room3D;
  H.webglOK = function () { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
})(window.H);
