/* HARU — main controller */
(function (H) {
  'use strict';
  const el = H.el;
  const $ = (id) => document.getElementById(id);

  const DEFAULT_SETTINGS = {
    setupDone: false, petName: '모모', userName: '',
    character: Object.assign({}, H.DEFAULT_CHARACTER),
    general: { autoCreate: true, autoCreateHour: 9, sessionMinutes: 12, pomodoro: { on: false, work: 25, brk: 5 }, chatty: 0.5, sleepAtNight: true, sleepFrom: 25, sleepTo: 7, notify: true, minimizeToMini: true, closeAction: 'tray', autoStart: false, startHidden: false, outputDir: '' },
    mini: { enabled: true, mode: 'float', size: 1, opacity: 1, speed: 1, alwaysOnTop: true, bubble: true, showWhenMainVisible: false },
    sources: { googleNewsKR: true, googleNewsWorld: true, bbc: true, trendsKR: true, trendsUS: true, wikipedia: true, hackerNews: true, custom: [], weather: true, city: '서울', lat: 37.5665, lon: 126.978 },
    audio: { master: 0.8, music: 0.8, ambient: 0.5, sfx: 0.6, lofi: 0.3, voice: true, autoWeather: true, amb: { rain: 0, vinyl: 0.25, wind: 0, cafe: 0, fire: 0, waves: 0, night: 0, birds: 0, keys: 0.5 } },
    creation: { songSeconds: 75, artStyle: 'auto', posterSize: 1600, video: true, videoFps: 30, videoAudio: true },
    visual: { theme: 'auto', camera: 'auto', showHud: true, reduceMotion: false, uiScale: 1, renderer: '3d' },
    ai: { enabled: false, model: 'claude-opus-5-5' },
  };

  function merge(base, over) {
    if (Array.isArray(base)) return Array.isArray(over) ? over : base.slice();
    if (base && typeof base === 'object') {
      const out = {};
      Object.keys(base).forEach((k) => { out[k] = merge(base[k], over ? over[k] : undefined); });
      if (over && typeof over === 'object') Object.keys(over).forEach((k) => { if (!(k in out)) out[k] = over[k]; });
      return out;
    }
    return over === undefined ? base : over;
  }

  const app = H.app = {
    fast: false, paused: false, muted: false, view: 'room', camMode: 'auto', camName: 'wide', camFree: false,
    labPlaying: false, splashColor: null, visible: true, works: [],
    toast: (m, k) => H.toast(m, k),
  };

  /* ================= boot ================= */
  async function boot() {
    const init = window.haru ? await window.haru.init() : { settings: {}, state: {}, fast: location.search.includes('fast') };
    app.settings = merge(DEFAULT_SETTINGS, init.settings || {});
    app.state = merge(H.DEFAULT_STATE, init.state || {});
    app.fast = !!init.fast; app.hasKey = !!init.hasKey; app.version = init.version; app.versions = init.versions; app.shot = init.shot;
    app.mobile = !!init.mobile;
    if (app.mobile && !(init.settings && init.settings.creation)) { app.settings.creation.posterSize = 1200; app.settings.general.sessionMinutes = 6; }

    app.audio = new H.AudioEngine();
    app.painter = new H.Painter(900);
    app.use3D = app.settings.visual.renderer !== '2d' && !!H.Room3D && H.webglOK();
    if (app.use3D) {
      try {
        app.room = new H.Room3D($('room3d-canvas'));
        app.room.setCharacter(app.settings.character);
        $('room3d-canvas').classList.remove('hidden'); $('room-canvas').classList.add('hidden');
        loadModel();
      } catch (e) { console.error('3D init failed, using 2D', e); app.use3D = false; }
    }
    if (!app.use3D) app.room = new H.Room();
    app.room.paintCanvas = app.painter.canvas;
    app.pet = new H.Pet(app.state, app.settings.character);
    app.creation = new H.Creation(app);
    app.orbit = new H.OrbitView();
    app.loud = new H.LoudnessTrail();

    buildChrome(); buildRoomHud(); buildStudio(); buildLab(); buildShop(); bindWorld();
    applyAll();
    if (window.haru) {
      window.haru.on('mini:poke', () => tool('pat', true));
      window.haru.on('visibility', (v) => { app.visible = v; });
      window.haru.on('cmd', (c) => command(c));
      window.haru.on('settings:external', (s) => { if (s && s.mini) { app.settings.mini = Object.assign(app.settings.mini, s.mini); } });
      window.haru.on('toast', (m) => H.toast(m));
      window.haru.on('back', () => {
        const back = document.querySelector('.modal-back');
        if (back) { back.querySelector('.modal-head .icon-btn').click(); return; }
        if (!$('tool-pop').classList.contains('hidden')) { closePop(); return; }
        if (app.view !== 'room') setView('room');
      });
    }
    if (app.shot) command(app.shot);
    requestAnimationFrame(frame);
    setInterval(logicTimer, 100);
    setInterval(slowTimer, 1000);
    setInterval(autopilot, 15000);
    window.addEventListener('resize', () => resizeAll());
    document.addEventListener('keydown', onKey);
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => app.audio.resume(), { once: false, passive: true }));
    app.audio.init();
    refreshArchive();
    const today = H.dateKey();
    if (app.state.patsDate !== today) { app.state.patsDate = today; app.state.patsToday = 0; }
    if (!app.settings.setupDone) setTimeout(() => H.openCreator(app, true), 400);
    else greet();
    if (app.state.creation && app.state.creation.date === today) {
      setTimeout(() => { app.creation.resume(app.state.creation); H.toast('하던 작업을 이어서 해요.'); }, 1500);
    } else app.state.creation = null;
    if (app.fast && app.settings.setupDone) setTimeout(() => { if (!app.creation.active) app.creation.start({}); }, 2500);
    setTimeout(autopilot, 4000);
  }

  function command(c) {
    if (!c) return;
    if (c.view) setView(c.view);
    if (c.cam) setCam(c.cam);
    if (c.create && !app.creation.active) app.creation.start({ extra: app.state.lastWorkDate === H.dateKey() });
    if (c.settings) H.openSettings(app);
    if (c.intervene && app.creation.active) app.creation.intervene(c.intervene.kind, Object.assign({}, c.intervene));
    if (c.tool) tool(c.tool);
    if (c.creator) H.openCreator(app);
    if (c.closeModal) { const b = document.querySelector('.modal-back'); if (b) b.querySelector('.modal-head .icon-btn').click(); }
    if (c.time != null) app.debugHours = c.time;
    if (c.noAuto) app.settings.general.autoCreate = false;
    if (c.items) { app.state.items = c.items.split(','); applyItems(); }
    if (c.act) { const map = { type: ['desk', 'type', 'desk'], paint: ['easel', 'paint', 'easel'], read: ['nook', 'read', 'nook'] }[c.act]; if (map) { app.holdIdleUntil = performance.now() + 60000; app.pet.goTo(map[0], map[1]); setCam(map[2]); } }
    if (c.weather) app.room.weather = Object.assign({ temp: 3, ko: c.weather }, H.describeWeather({ clear: 0, rain: 61, snow: 71, cloudy: 3, storm: 95 }[c.weather] ?? 0));
  }

  /* ================= persistence ================= */
  let saveT = null, saveS = null;
  app.saveState = () => { clearTimeout(saveT); saveT = setTimeout(() => { if (window.haru) window.haru.saveState(app.state); }, 400); };
  app.saveSettings = () => { clearTimeout(saveS); saveS = setTimeout(() => { if (window.haru) window.haru.saveSettings(app.settings); }, 300); };
  app.saveWork = async (folder, files) => {
    if (!window.haru) return { path: '(browser)' };
    return window.haru.saveWork(folder, files.map((f) => ({ name: f.name, data: typeof f.data === 'string' ? f.data : f.data })));
  };
  app.petRenderState = () => app.pet;

  app.onSettingChanged = (key, val) => {
    if (key.startsWith('audio') || key === 'character.voice') applyAudio();
    if (key.startsWith('visual')) applyVisual();
    if (key.startsWith('mini') || key.startsWith('general.autoStart') || key.startsWith('general.startHidden') || key.startsWith('general.closeAction') || key.startsWith('general.minimizeToMini')) window.haru && window.haru.applyWindowSettings(app.settings);
    if (key === 'petName') renderHud();
    app.saveSettings();
    if (key === 'visual.renderer') { H.toast('방 그래픽을 바꾸는 중… 잠시 후 다시 열려요.'); setTimeout(() => location.reload(), 700); }
  };

  app.applyCharacter = () => {
    app.pet.cfg = app.settings.character; applyAudio(); renderHud();
    if (!app.room.is3D) return;
    const cfg = app.settings.character;
    if (cfg.model !== app.loadedModel) loadModel();
    else if (cfg.model === 'procedural') app.room.setCharacter(cfg);
    else if (app.room.char && app.room.char.setAccessory) app.room.char.setAccessory(cfg);
  };

  /* 3D models: bundled CC0 VRoid samples (shibu / vivi), the procedural character, or the user's own .vrm */
  H.AVATARS = [
    { id: 'shibu', ko: '시부', sub: 'Sendagaya Shibu · CC0', thumb: 'assets/avatars/shibu.png' },
    { id: 'vivi', ko: '비비', sub: 'Vivi · CC0', thumb: 'assets/avatars/vivi.png' },
    { id: 'procedural', ko: '직접 꾸미기', sub: '종족·머리·옷을 고르는 캐릭터' },
    { id: 'custom', ko: '내 VRM', sub: 'VRoid 등에서 만든 .vrm 파일' },
  ];
  const toBuf = (bytes) => (bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes);
  async function loadModel() {
    if (!app.room.is3D) return;
    const cfg = app.settings.character;
    const model = cfg.model || 'shibu';
    app.loadedModel = model;
    if (model === 'procedural') { app.room.setCharacter(cfg); return; }
    if (!window.haru) return;
    try {
      const bytes = model === 'custom' ? await window.haru.readAvatar() : await window.haru.readAsset(`avatars/${model}.vrm`);
      if (!bytes) throw new Error('missing model file');
      const c = await H.VrmCharacter.fromBuffer(toBuf(bytes));
      if (app.loadedModel !== model) { c.dispose(); return; }
      c.setAccessory(cfg);
      app.room.useCharacter(c);
    } catch (e) {
      console.warn('model load failed', e);
      H.toast('3D 캐릭터를 불러오지 못해서 기본 캐릭터로 보여줄게요.', 'error');
      app.room.setCharacter(cfg);
    }
  }
  app.importVrm = async (file) => {
    const buf = await file.arrayBuffer();
    await H.VrmCharacter.fromBuffer(buf.slice(0));
    if (window.haru && window.haru.saveAvatar) await window.haru.saveAvatar(new Uint8Array(buf));
    app.settings.character.model = 'custom'; app.settings.character.vrmName = file.name; app.saveSettings();
    app.loadedModel = null; app.applyCharacter();
  };
  app.onFirstSetupDone = () => {
    app.state.firstRun = false; app.saveState();
    setTimeout(() => app.say(`안녕! 나는 ${app.settings.petName}. 매일 세상 소식을 듣고 음악이랑 그림을 만들 거야.`, { duration: 6 }), 600);
    setTimeout(() => app.say(app.settings.general.autoCreate ? '오늘 첫 작품, 지금 바로 시작해볼까?' : '시작하고 싶을 땐 오른쪽 위 버튼을 눌러줘.', {
      choices: [['응, 시작하자!', () => app.creation.start({})], ['조금 이따가', () => app.say('알겠어. 천천히 둘러봐!')]],
      duration: 30,
    }), 7000);
  };

  app.resetPet = () => {
    app.creation.active && app.creation.cancel();
    app.state = merge(H.DEFAULT_STATE, {});
    app.pet.state = app.state;
    app.saveState(); applyItems(); renderShop(); renderHud();
    H.toast('처음부터 다시 시작해요.');
  };

  /* ================= apply settings ================= */
  function applyAll() { applyVisual(); applyAudio(); applyItems(); window.haru && window.haru.applyWindowSettings(app.settings); }

  function applyVisual() {
    const v = app.settings.visual;
    const h = new Date().getHours();
    const dark = v.theme === 'dark' || (v.theme === 'auto' && (h >= 20 || h < 7));
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.body.style.zoom = v.uiScale || 1;
    $('hud-status').classList.toggle('hidden', !v.showHud);
    app.camMode = v.camera === 'manual' ? 'manual' : app.camFree ? 'manual' : 'auto';
    renderCamButtons();
  }

  function applyAudio() {
    const a = app.settings.audio;
    app.audio.setLevels({ master: app.muted ? 0 : a.master, music: a.music, ambient: a.ambient, sfx: a.sfx });
    app.audio.voiceOn = a.voice; app.audio.voicePitch = app.settings.character.voice || 1;
    applyAmbience();
    $('btn-mute').innerHTML = app.muted ? H.ICON.mute : H.ICON.vol;
  }

  function applyAmbience() {
    const a = app.settings.audio;
    const lv = Object.assign({}, a.amb);
    if (a.autoWeather) {
      const w = app.room.weather; const h = hoursNow();
      if (w && (w.sky === 'rain' || w.sky === 'storm')) lv.rain = Math.max(lv.rain, 0.55);
      if (w && w.wind > 20) lv.wind = Math.max(lv.wind, 0.35);
      if (h >= 20 || h < 5) lv.night = Math.max(lv.night, 0.3);
      if (h >= 6 && h < 10 && (!w || w.sky === 'clear' || w.sky === 'partly')) lv.birds = Math.max(lv.birds, 0.35);
    }
    if (app.room.items.has('record')) lv.vinyl = Math.min(1, lv.vinyl + 0.15);
    app.audio.setAmbience(lv);
  }

  function applyItems() {
    const owned = new Set(app.state.items || []);
    const hidden = new Set(app.state.hiddenItems || []);
    app.room.items = new Set([...owned].filter((i) => !hidden.has(i)));
  }

  function hoursNow() { if (app.debugHours != null) return app.debugHours; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }

  /* ================= chrome ================= */
  function buildChrome() {
    document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('btn-settings').innerHTML = H.ICON.gear;
    $('btn-settings').onclick = () => H.openSettings(app);
    $('btn-mute').onclick = () => { app.muted = !app.muted; applyAudio(); };
  }

  function setView(v) {
    app.view = v;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
    if (v === 'archive') refreshArchive();
    if (v === 'shop') renderShop();
    if (v === 'world') renderWorld();
    if (v === 'lab') renderLab();
    setTimeout(resizeAll, 0);
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const views = ['room', 'world', 'studio', 'lab', 'archive', 'shop'];
    if (e.key >= '1' && e.key <= '6') setView(views[+e.key - 1]);
    if (e.key === 'm' || e.key === 'M') { app.muted = !app.muted; applyAudio(); }
    if (e.key === 'Escape') { closePop(); }
  }

  /* ================= speech ================= */
  let bubbleUntil = 0, typeTimer = null;
  app.say = function (text, opts = {}) {
    if (!text) return;
    const b = $('bubble');
    const txt = b.querySelector('.bubble-text'), ch = b.querySelector('.bubble-choices');
    if (opts.quiet && performance.now() < bubbleUntil - 1500) return;
    clearInterval(typeTimer);
    b.classList.remove('hidden'); b.classList.toggle('quiet', !!opts.quiet);
    txt.textContent = '';
    ch.innerHTML = '';
    let i = 0; const chars = [...text];
    typeTimer = setInterval(() => { txt.textContent += chars[i++] || ''; if (i >= chars.length) clearInterval(typeTimer); }, 28);
    (opts.choices || []).forEach(([label, fn]) => ch.appendChild(el('button', { onclick: () => { b.classList.add('hidden'); fn(); } }, label)));
    const dur = opts.duration || Math.max(3.5, chars.length * 0.11 + 2);
    bubbleUntil = performance.now() + dur * 1000;
    app.pet.speak(Math.min(2.5, chars.length * 0.06));
    app.audio.babble(text, (app.pet.stats.mood - 50) / 50);
    app.lastLine = text;
    sendMini(true);
  };

  function updateBubble() {
    const b = $('bubble');
    if (b.classList.contains('hidden')) return;
    if (performance.now() > bubbleUntil && !b.querySelector('.bubble-choices').children.length) { b.classList.add('hidden'); return; }
    if (app.view !== 'room') return;
    const p = app.pet;
    let s;
    if (app.room.is3D) s = app.room.headScreen();
    else { const headY = p.y - (p.seated ? 128 : 150) * 1.5 + (p.seated ? 33 : 0) - 10; s = app.room.toScreen(p.x, headY); }
    const cv = roomCanvas();
    const x = H.clamp(s.x, 170, cv.clientWidth - 170), y = H.clamp(s.y, 90, cv.clientHeight - 20);
    b.style.left = x + 'px'; b.style.top = y + 'px';
  }

  /* ================= room HUD ================= */
  const TOOLS = [
    ['pat', '쓰다듬기'], ['snack', '간식'], ['coffee', '커피'], '|', ['note', '음 던지기'], ['drum', '리듬 바꾸기'], ['tempo', '템포'], ['palette', '물감 쏟기'], ['whisper', '속삭이기'], '|', ['talk', '말 걸기'], ['bulb', '불 켜기'], ['knock', '노크'],
  ];

  function buildRoomHud() {
    const tb = $('toolbar');
    TOOLS.forEach((t) => {
      if (t === '|') { tb.appendChild(el('div', { class: 'tool-sep' })); return; }
      const [id, ko] = t;
      tb.appendChild(el('button', { class: 'tool', 'data-tool': id, title: ko, onclick: () => tool(id), html: H.ICON[id] + `<span>${ko}</span>` }));
    });
    $('hud-status').addEventListener('click', () => $('hud-status').classList.toggle('collapsed'));
    if (app.mobile && window.innerWidth < 760) $('hud-status').classList.add('collapsed');
    [$('room-canvas'), $('room3d-canvas')].forEach(bindRoomPointer);
    renderCamButtons();
  }

  /* drag = pan (2D) / orbit (3D), wheel & pinch = zoom, tap = interact */
  function bindRoomPointer(cv) {
    let drag = null, pinch = null;
    const touches = new Map();
    const R = () => app.room;
    cv.addEventListener('pointerdown', (e) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: R().is3D ? 1 : R().camTarget.z };
        drag = null; return;
      }
      drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, cam: R().is3D ? null : Object.assign({}, R().camTarget) };
      cv.setPointerCapture(e.pointerId);
    });
    const endTouch = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
    cv.addEventListener('pointercancel', (e) => { endTouch(e); drag = null; });
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (R().is3D) { R().zoom(pinch.d / Math.max(1, d)); pinch.d = d; }
        else { const t = R().camTarget; R().setCameraTarget(t.x, t.y, H.clamp(pinch.z * d / pinch.d, 1, 4)); }
        goFree(); return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 6) drag.moved = true;
        if (drag.moved) {
          if (R().is3D) R().orbit(e.clientX - drag.lx, e.clientY - drag.ly);
          else {
            const s = R().view.s;
            R().setCameraTarget(drag.cam.x - dx / s, drag.cam.y - dy / s, drag.cam.z);
            R().cam.x = R().camTarget.x; R().cam.y = R().camTarget.y;
          }
          drag.lx = e.clientX; drag.ly = e.clientY;
          goFree(); cv.classList.add('grab');
        }
      } else if (e.pointerType === 'mouse') {
        const hit = R().hitTest(e.clientX - r.left, e.clientY - r.top, app.pet);
        cv.classList.toggle('hover-pet', hit === 'pet' || hit === 'window' || hit === 'kitty');
      }
    });
    cv.addEventListener('pointerup', (e) => {
      endTouch(e);
      cv.classList.remove('grab');
      if (drag && !drag.moved) roomClick(e);
      drag = null;
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (R().is3D) { R().zoom(e.deltaY < 0 ? 1 / 1.12 : 1.12); goFree(); return; }
      const t = R().camTarget;
      const r = cv.getBoundingClientRect();
      const w = R().toWorld(e.clientX - r.left, e.clientY - r.top);
      const nz = H.clamp(t.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 4);
      R().setCameraTarget(H.lerp(t.x, w.x, 0.25 * (nz > t.z ? 1 : -0.3)), H.lerp(t.y, w.y, 0.25 * (nz > t.z ? 1 : -0.3)), nz);
      goFree();
    }, { passive: false });
  }

  function roomCanvas() { return app.room && app.room.is3D ? $('room3d-canvas') : $('room-canvas'); }
  function camList() { return app.room && app.room.is3D ? H.CAMERAS3D : H.CAMERAS; }

  function goFree() { app.camFree = true; app.camMode = 'manual'; app.camName = null; renderCamButtons(); }

  function renderCamButtons() {
    const box = $('cam-btns'); if (!box) return;
    box.innerHTML = '';
    box.appendChild(el('button', { class: 'cam-btn' + (app.camMode === 'auto' ? ' on' : ''), onclick: () => { app.camFree = false; app.camMode = 'auto'; app.settings.visual.camera = 'auto'; renderCamButtons(); } }, '◎ 자동 연출'));
    Object.entries(camList()).forEach(([k, c]) => box.appendChild(el('button', { class: 'cam-btn' + (app.camMode === 'manual' && app.camName === k ? ' on' : ''), onclick: () => setCam(k) }, c.ko)));
  }
  function setCam(k) { app.camMode = 'manual'; app.camFree = false; app.camName = k; app.room.setCamera(k); renderCamButtons(); }

  function roomClick(e) {
    const cv = roomCanvas(); const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const hit = app.room.hitTest(sx, sy, app.pet);
    if (app.splashColor) {
      let x = Math.random() * 0.7 + 0.15, y = Math.random() * 0.7 + 0.15;
      if (hit === 'easel' && app.room.is3D) { const uv = app.room.easelUV(sx, sy); if (uv) { x = uv.x; y = uv.y; } }
      else if (hit === 'easel') { const w = app.room.toWorld(sx, sy); x = H.clamp((w.x - 1215) / 200); y = H.clamp((w.y - 470) / 200); }
      doSplash(x, y, app.splashColor);
      app.splashColor = null; cv.classList.remove('splash-armed'); closePop();
      return;
    }
    if (hit === 'pet') tool('pat');
    else if (hit === 'window') tool('knock');
    else if (hit === 'kitty') app.say(H.fillLine('kitty'));
    else if (hit === 'easel' && app.creation.active) setCam('easel');
  }

  /* ---------- tools ---------- */
  let snackCooldown = 0;
  function tool(id, fromMini) {
    const pet = app.pet, cr = app.creation;
    const creating = cr.state === 'running';
    switch (id) {
      case 'pat': {
        app.audio.sfx('pat');
        pet.flash(pet.act === 'sleep' ? 'stretch' : 'happy', 1.4, 'love');
        for (let i = 0; i < 3; i++) app.room.emit({ type: 'heart', x: pet.x + (Math.random() - 0.5) * 60, y: pet.y - 220, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 20, life: 1.6, size: 16 + Math.random() * 10 });
        if (app.state.patsToday < 12) { pet.nudge('bond', 1); app.state.patsToday++; }
        pet.nudge('mood', 2);
        if (cr.active) cr.log.pats++;
        app.say(H.fillLine(creating && pet.stats.focus > 60 ? 'pet_pat_focus' : 'pet_pat'), { quiet: fromMini });
        break;
      }
      case 'snack': case 'coffee': {
        if (performance.now() < snackCooldown) { app.say('배불러… 조금 이따가!'); break; }
        snackCooldown = performance.now() + (app.fast ? 3000 : 45000);
        const em = id === 'snack' ? ['🍪', '🍩', '🍙', '🍓', '🧁'][Math.floor(Math.random() * 5)] : '☕';
        app.room.emit({ type: 'snack', text: em, x: pet.x - 14, y: pet.y - 320, vx: 0, vy: 60, g: 120, life: 1.4, size: 30 });
        setTimeout(() => { app.audio.sfx('munch'); pet.flash(id === 'coffee' ? 'drink' : 'happy', 2.4, 'happy'); app.say(H.fillLine(id)); }, 900);
        pet.nudge('energy', id === 'snack' ? 12 : 18); pet.nudge('mood', 4); if (id === 'coffee') pet.nudge('focus', 8);
        if (cr.active) cr.log.snacks++;
        break;
      }
      case 'note': openPop('note'); break;
      case 'drum': openPop('drum'); break;
      case 'tempo': openPop('tempo'); break;
      case 'palette': openPop('palette'); break;
      case 'whisper': openPop('whisper'); break;
      case 'talk': talk(); break;
      case 'bulb': app.room.lampOn = !app.room.lampOn; app.audio.sfx('click'); break;
      case 'knock': app.audio.sfx('knock'); pet.flash('surprised', 0.8, 'surprised'); pet.look = { x: pet.x > 520 ? -1 : 1, y: -1 }; setTimeout(() => app.say(H.fillLine('knock', {})), 500); break;
      default: break;
    }
    renderHud();
  }

  function doSplash(x, y, color) {
    if (app.creation.active && app.creation.artPlan) app.creation.intervene('splash', { x, y, color });
    else { app.painter.splash(x, y, color); app.audio.sfx('splash'); app.pet.flash('surprised', 1, 'surprised'); app.say(H.fillLine('splash')); }
  }

  function scaleNotes() {
    const song = app.creation.song;
    const root = song ? song.root + 12 : 60;
    const iv = song ? song.iv : H.SCALES.pentaMajor.iv;
    const out = [];
    for (let i = 0; out.length < 16; i++) out.push(root + iv[i % iv.length] + 12 * Math.floor(i / iv.length));
    return out;
  }

  function throwNote(midi, padEl) {
    if (padEl) { padEl.classList.add('hit'); setTimeout(() => padEl.classList.remove('hit'), 220); }
    const cr = app.creation;
    if (cr.state === 'running' && cr.song && (cr.phaseInfo.ph.id === 'compose' || cr.phaseInfo.ph.id === 'paint')) cr.intervene('note', { midi });
    else { app.audio.note(midi, cr.song ? cr.song.insts.lead : 'epiano', 0.6, 0.6); if (Math.random() < 0.25) app.say(`${H.midiName(midi)}? 예쁜 음이다.`, { quiet: true }); }
  }

  const SPLASH_COLORS = ['#ff4f8b', '#2f45ff', '#ffcf3a', '#2ec4a6', '#ff7a2f', '#7b4fd0', '#1d1d24', '#ffffff'];

  function openPop(kind) {
    const pop = $('tool-pop');
    if (!pop.classList.contains('hidden') && pop.dataset.kind === kind) { closePop(); return; }
    pop.dataset.kind = kind; pop.innerHTML = ''; pop.classList.remove('hidden');
    document.querySelectorAll('.tool').forEach((t) => t.classList.toggle('on', t.dataset.tool === kind || (kind === 'drum' && t.dataset.tool === 'drum')));
    const cr = app.creation;
    const live = cr.state === 'running' && cr.song;
    const head = (a, b) => pop.appendChild(el('div', { class: 'pop-title' }, el('span', null, a), el('span', { class: 'muted' }, b || '')));
    if (kind === 'note') {
      head('THROW A NOTE · 음 던지기', live ? `${cr.song.keyName} ${cr.song.scaleKo} — 지금 곡에 들어가요` : '작곡 중일 때 누르면 곡에 들어가요');
      const pads = el('div', { class: 'pads' });
      scaleNotes().forEach((m) => { const b = el('button', { class: 'pad', onclick: () => throwNote(m, b) }, H.midiName(m)); pads.appendChild(b); });
      pop.appendChild(pads);
    } else if (kind === 'drum') {
      head('SWAP RHYTHM · 리듬 바꾸기', live ? '지금 곡의 드럼이 바뀌어요' : '리듬 랩에서 들어볼 수 있어요');
      const box = el('div', { class: 'genre-pills' });
      H.GENRES.filter((g) => Object.keys(g.drums).length).forEach((g) => box.appendChild(el('button', { class: 'gpill' + (app.state.known[g.id] ? '' : ' locked'), onclick: () => {
        if (live) { cr.intervene('rhythm', { genreId: g.id }); closePop(); }
        else { app.lab.genreId = g.id; setView('lab'); closePop(); }
      } }, g.ko, el('small', null, g.timeSig))));
      pop.appendChild(box);
    } else if (kind === 'tempo') {
      head('TEMPO · 템포 장난', live ? `지금 ${cr.song.bpm} BPM` : '작곡 중일 때만 바뀌어요');
      pop.appendChild(el('div', { class: 'row' }, [-15, -5, 5, 15].map((d) => el('button', { class: 'btn', onclick: () => { if (live) { cr.intervene('tempo', { delta: d }); openPop('tempo'); openPop('tempo'); } else H.toast('작곡 중일 때 써보세요!'); } }, (d > 0 ? '+' : '') + d))));
    } else if (kind === 'palette') {
      head('SPILL PAINT · 물감 쏟기', '색을 고르고 이젤(또는 아무 데나)을 클릭');
      const sw = el('div', { class: 'swatches' });
      SPLASH_COLORS.forEach((c) => sw.appendChild(el('div', { class: 'swatch', style: { background: c }, onclick: (e) => { app.splashColor = c; [...sw.children].forEach((x) => x.classList.remove('sel')); e.target.classList.add('sel'); roomCanvas().classList.add('splash-armed'); } })));
      pop.appendChild(sw);
    } else if (kind === 'whisper') {
      head('WHISPER · 단어 속삭이기', '작품 키워드에 섞여요');
      const inp = el('input', { maxlength: 16, placeholder: '예: 첫눈, 고양이, 바다…' });
      const go = () => { if (inp.value.trim()) { whisper(inp.value.trim()); inp.value = ''; closePop(); } };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      pop.appendChild(el('div', { class: 'row' }, inp, el('button', { class: 'btn primary', onclick: go }, '속삭이기')));
      setTimeout(() => inp.focus(), 30);
    }
  }
  function closePop() { $('tool-pop').classList.add('hidden'); document.querySelectorAll('.tool').forEach((t) => t.classList.remove('on')); }

  function whisper(word) {
    if (app.creation.active) app.creation.intervene('whisper', { word });
    else { app.state.whispers = (app.state.whispers || []).concat([word]).slice(-12); app.say(H.fillLine('whisper', { word })); app.pet.nudge('inspiration', 4); app.saveState(); }
  }

  function talk() {
    const pet = app.pet, cr = app.creation, w = cr.world || app.lastWorld;
    const you = app.settings.userName || '너';
    app.say(`응, ${you}? 무슨 얘기 할래?`, {
      duration: 25,
      choices: [
        ['오늘 기분 어때?', () => {
          const s = pet.stats;
          const m = s.mood > 70 ? '아주 좋아! 오늘은 뭐든 만들 수 있을 것 같아.' : s.mood > 45 ? '그럭저럭 괜찮아. 너랑 있어서 좋아.' : '조금 가라앉았어… 쓰다듬어 줄래?';
          app.say(m + (s.energy < 25 ? ' 근데 좀 졸려.' : '')); pet.nudge('bond', 1);
        }],
        ['무슨 소식 들었어?', () => {
          if (!w) { app.say('아직 오늘 소식을 안 읽었어. 작업을 시작하면 읽어볼게!'); return; }
          const k = w.keywords.slice(0, 3).map((x) => `'${x.w}'`).join(', ');
          const h = w.headlines[0];
          app.say(`오늘은 ${k} 얘기가 많았어.${h ? ` 「${h.title.slice(0, 40)}」 이런 소식도 있었고.` : ''}`, { duration: 9 });
        }],
        ['어떤 곡 만들고 있어?', () => {
          const s = cr.song;
          if (!s) { app.say('아직 정하지 않았어. 오늘 세상을 먼저 들어봐야 해.'); return; }
          app.say(`${s.region}의 ${s.genreKo}! ${s.keyName} ${s.scaleKo}, ${s.bpm} BPM. 제목은 「${s.title}」 (가제)야.`, { duration: 8 });
        }],
        ['같이 집중하자', () => { pet.nudge('focus', 10); pet.nudge('bond', 1); app.say('좋아! 나도 열심히 할게. 너도 화이팅.'); if (!cr.active) app.say('지금 작업 시작할까?', { choices: [['응!', () => cr.start({ extra: app.state.lastWorkDate === H.dateKey() })], ['아니, 그냥 같이 있자', () => app.say('응. 같이 있자.')]] }); }],
        ['잘하고 있어!', () => { pet.nudge('mood', 6); pet.nudge('bond', 2); pet.flash('happy', 1.5, 'love'); app.say('헤헤… 고마워. 힘난다!'); }],
      ],
    });
  }

  /* ---------- HUD status ---------- */
  const ACT_KO = { idle: '쉬는 중', type: '건반 두드리는 중', paint: '그림 그리는 중', read: '읽는 중', sleep: '자는 중', think: '생각하는 중', walk: '걷는 중', happy: '기분 좋음', drink: '마시는 중', listen: '듣는 중', stretch: '기지개', dance: '춤추는 중', surprised: '깜짝!', wave: '손 흔드는 중' };
  function renderHud() {
    const box = $('hud-status'); if (!box) return;
    const s = app.pet.stats, st = app.state, cr = app.creation;
    const lv = H.levelFromXp(st.xp);
    let actHtml;
    if (cr.state === 'running') actHtml = `<b>${cr.phaseInfo.ph.ko}</b> · ${Math.round(cr.progress * 100)}%`;
    else if (cr.state === 'break') actHtml = '<b>휴식 중</b> · 같이 쉬자';
    else if (cr.state === 'finalizing') actHtml = '<b>마무리 중</b> · 녹음 · 저장';
    else actHtml = (st.lastWorkDate === H.dateKey() ? '오늘 작품 완성 · ' : '') + (ACT_KO[app.pet.act] || app.pet.act);
    const bar = (ko, v, cls) => `<div class="stat"><span>${ko}</span><div class="bar"><i class="${cls}" style="width:${v}%"></i></div><em>${Math.round(v)}</em></div>`;
    const phases = cr.active ? `<div class="phases">${H.PHASES.map((p, i) => `<div class="${i < cr.phaseInfo.i || cr.state === 'finalizing' ? 'done' : i === cr.phaseInfo.i ? 'cur' : ''}">${p.ko.split(' ')[0]}</div>`).join('')}</div>` : '';
    const w = cr.world || app.lastWorld;
    const worldHtml = w ? `<div class="st-world"><div class="muted" style="font-size:10.5px">오늘의 세상 · <b style="color:${H.moodWords(w.mood).color}">${H.moodWords(w.mood).ko}</b>${w.weather ? ` · ${w.weather.ko} ${Math.round(w.weather.temp)}°` : ''}</div>${w.keywords.slice(0, 5).map((k) => `<span class="chip${k.whisper ? ' whisper' : ''}">${H.escape(k.w)}</span>`).join('')}</div>` : '';
    box.innerHTML = `<div class="st-name"><b>${H.escape(app.settings.petName)}</b><span>Lv.${lv} · ★${st.stars} · 작품 ${st.works}</span></div><div class="st-act">${actHtml}</div>${bar('기분', s.mood, 'mood')}${bar('에너지', s.energy, 'energy')}${bar('유대감', s.bond, 'bond')}${bar('영감', s.inspiration, 'insp')}${phases}${worldHtml}`;
  }

  function renderRingActions() {
    const box = $('ring-actions'); const cr = app.creation;
    const key = cr.state + (app.paused ? 'p' : '') + (app.state.lastWorkDate === H.dateKey() ? 'd' : '');
    if (box.dataset.key === key) return; box.dataset.key = key; box.innerHTML = '';
    if (cr.state === 'running' || cr.state === 'break') {
      box.appendChild(el('button', { class: 'btn', onclick: () => { app.paused = !app.paused; if (app.paused) app.audio.stop(); else cr.curSec = -1; renderRingActions(); } }, app.paused ? '▶ 계속' : '❚❚ 잠깐'));
      box.appendChild(el('button', { class: 'btn', onclick: async () => { if (await H.confirm('작업을 멈출까요?', '지금까지 한 작업은 저장되지 않아요.')) cr.cancel(); } }, '■'));
    } else if (cr.state !== 'finalizing') {
      const done = app.state.lastWorkDate === H.dateKey();
      box.appendChild(el('button', { class: 'btn primary', onclick: () => startCreation(done) }, done ? '+ 한 곡 더' : '▶ 오늘 작품 시작'));
    }
  }

  function startCreation(extra) {
    if (app.pet.stats.energy < 12 && !app.fast) { app.say('너무 졸려… 간식이나 커피 한 잔이면 할 수 있을 것 같아.'); return; }
    if (app.pet.act === 'sleep') { app.pet.flash('stretch', 1.5); app.say(H.fillLine('wake')); }
    app.creation.start({ extra });
  }

  /* ================= World view ================= */
  function bindWorld() {
    $('whisper-btn').onclick = () => { const v = $('whisper-input').value.trim(); if (v) { whisper(v); $('whisper-input').value = ''; renderWorld(); } };
    $('whisper-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('whisper-btn').click(); });
    $('btn-gather-preview').onclick = async () => {
      $('btn-gather-preview').disabled = true;
      H.toast('세상을 둘러보는 중…');
      const data = await H.gatherWorld(app.settings.sources, null, (id, status, s, n) => { app.srcPreview = app.srcPreview || {}; app.srcPreview[id] = { status, ko: s.ko, n }; renderSources(); });
      app.lastWorld = H.analyzeWorld(data, app.state.history, app.state.whispers);
      app.room.weather = data.weather || app.room.weather;
      app.orbit.setWorld(app.lastWorld); app.orbitBorn = performance.now();
      renderWorld(); renderHud(); applyAmbience();
      $('btn-gather-preview').disabled = false;
    };
    H.on('world:item', () => { if (app.view === 'world') renderHeadlinesLive(); });
    H.on('world:source', () => { if (app.view === 'world') renderSources(); });
    H.on('world:ready', (w) => { app.lastWorld = w; app.room.weather = w.weather || app.room.weather; app.orbit.setWorld(w); app.orbitBorn = performance.now(); applyAmbience(); renderWorld(); renderHud(); });
    H.on('creation:planned', () => { renderSongInfo(); buildPads(); renderHud(); });
    H.on('creation:phase', () => { renderHud(); renderRingActions(); });
    H.on('creation:start', () => { renderHud(); renderRingActions(); closeFinal(); });
    H.on('creation:cancel', () => { renderHud(); renderRingActions(); });
    H.on('creation:finalizing', (e) => showFinalProgress(e));
  }

  function renderSources() {
    const box = $('sources'); box.innerHTML = '';
    const st = Object.assign({}, app.srcPreview || {}, app.creation.srcStatus || {});
    H.SOURCES.forEach((s) => {
      const on = app.settings.sources[s.id] !== false;
      const x = st[s.id];
      const txt = !on ? 'off' : x ? (x.status === 'ok' ? `ok · ${x.n}` : x.status) : '—';
      box.appendChild(el('div', { class: 'src' }, el('span', null, s.ko), el('em', { class: x ? x.status : '' }, txt)));
    });
    const w = app.room.weather;
    box.appendChild(el('div', { class: 'src' }, el('span', null, `날씨 · ${app.settings.sources.city}`), el('em', { class: w ? 'ok' : '' }, w ? `${w.ko} ${Math.round(w.temp)}°C` : '—')));
  }

  function renderHeadlinesLive() {
    const items = app.creation.liveItems;
    const ol = $('headlines');
    ol.innerHTML = '';
    items.slice(-40).reverse().forEach((h) => ol.appendChild(el('li', { class: h.kind }, h.title, el('small', null, h.source))));
    $('head-count').textContent = `${items.length}개 수집 중…`;
  }

  function renderWorld() {
    renderSources();
    const w = app.creation.world || app.lastWorld;
    const meters = $('mood-meters'); meters.innerHTML = '';
    if (!w) {
      meters.appendChild(el('div', { class: 'hint' }, '아직 오늘의 세상을 읽지 않았어요. 작업을 시작하거나 “지금 둘러보기”를 눌러보세요.'));
      if (app.creation.gathering) renderHeadlinesLive();
      return;
    }
    if (app.orbit.world !== w) { app.orbit.setWorld(w); app.orbitBorn = performance.now(); }
    const mw = H.moodWords(w.mood);
    $('mood-word').innerHTML = `<span style="color:${mw.color}">● ${mw.ko}</span>`;
    const m = (ko, v, center) => {
      const track = el('div', { class: 'track' + (center ? ' center' : '') });
      const i = el('i'); if (center) { const x = (v + 1) / 2; i.style.left = Math.min(50, x * 100) + '%'; i.style.width = Math.abs(x - 0.5) * 100 + '%'; } else i.style.width = v * 100 + '%';
      track.appendChild(i);
      return el('div', { class: 'meter' }, el('span', null, ko), track, el('em', null, v.toFixed(2)));
    };
    meters.append(m('밝음/어둠', w.mood.valence, true), m('들뜸', w.mood.arousal), m('긴장', w.mood.tension), m('따뜻함', w.mood.warmth), m('새로움', w.mood.novelty));
    const cb = $('cat-bar'); cb.innerHTML = ''; const cl = $('cat-legend'); cl.innerHTML = '';
    Object.entries(w.cats).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => { if (v < 0.01) return; cb.appendChild(el('i', { style: { width: v * 100 + '%', background: H.CATS[c].color } })); cl.appendChild(el('span', { style: { '--c': H.CATS[c].color } }, `${H.CATS[c].ko} ${Math.round(v * 100)}%`)); });
    const ol = $('headlines'); ol.innerHTML = '';
    w.headlines.forEach((h) => ol.appendChild(el('li', { class: h.kind }, h.title, el('small', null, h.source))));
    $('head-count').textContent = `${w.count}개 중 ${w.headlines.length}개`;
    $('orbit-meta').textContent = `${w.date} · ${w.keywords.length} keywords · ${w.edges.length} links${w.offline ? ' · offline' : ''}`;
  }

  /* ================= Studio ================= */
  let rollPage = null;
  function buildStudio() {
    buildPads();
    const sw = $('studio-swatches');
    SPLASH_COLORS.forEach((c) => sw.appendChild(el('div', { class: 'swatch', style: { background: c }, onclick: (e) => { app.splashColor = c; [...sw.children].forEach((x) => x.classList.remove('sel')); e.target.classList.add('sel'); } })));
    $('cv-paint').addEventListener('click', (e) => {
      const r = e.target.getBoundingClientRect();
      doSplash((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, app.splashColor || SPLASH_COLORS[Math.floor(Math.random() * 6)]);
    });
    $('roll-prev').onclick = () => { const s = curSong(); if (!s) return; rollPage = Math.max(0, (rollPage ?? 0) - 4); $('roll-follow').classList.remove('on'); };
    $('roll-next').onclick = () => { const s = curSong(); if (!s) return; rollPage = Math.min(s.bars - 1, (rollPage ?? 0) + 4); $('roll-follow').classList.remove('on'); };
    $('roll-follow').onclick = () => { rollPage = null; $('roll-follow').classList.add('on'); };
    $('roll-follow').classList.add('on');
    renderTransport();
    renderSongInfo();
  }

  function curSong() { return app.labPlaying ? null : app.creation.song || (app.lastResult && app.lastResult.song) || null; }

  function buildPads() {
    const pads = $('pads'); pads.innerHTML = '';
    scaleNotes().forEach((m) => { const b = el('button', { class: 'pad', onclick: () => throwNote(m, b) }, H.midiName(m)); pads.appendChild(b); });
  }

  function renderSongInfo() {
    const box = $('song-info'); const s = curSong();
    if (!s) { box.innerHTML = '<div class="box-lbl">NOW</div><div class="muted">아직 오늘의 곡이 없어요. 작업이 시작되면 여기에 악보가 그려져요.</div>'; return; }
    const g = H.GENRE[s.genreId];
    box.innerHTML = `<div class="box-lbl">NOW · ${H.escape(g.region)}</div><h3>${H.escape(s.title || '(제목 미정)')}</h3>
      <div class="kv"><span>장르</span><b>${g.ko} · ${g.name}</b><span>조성</span><b>${s.keyName} ${s.scaleKo}</b><span>박자</span><b>${s.timeSig} · ${s.bpm} BPM · swing ${Math.round((s.swing - 0.5) * 200)}%</b>
      <span>악기</span><b>${[s.insts.lead, s.insts.chord, s.insts.bass].filter(Boolean).join(' / ')}</b><span>구성</span><b>${s.sections.map((x) => x.name).join(' → ')} (${s.bars}마디)</b>
      <span>모티프</span><b>${s.motifs.slice(0, 3).map((m) => `'${H.escape(m.word)}' ${m.names.slice(0, 4).join(' ')}`).join('<br>')}</b></div>`;
  }

  function renderTransport() {
    const t = $('transport'); t.innerHTML = '';
    t.appendChild(el('button', { class: 'btn', onclick: () => {
      const s = curSong(); if (!s) { H.toast('아직 곡이 없어요.'); return; }
      if (app.creation.state === 'running' && app.creation.phaseInfo.ph.id === 'compose') { H.toast('작곡 중엔 그 아이가 연주하고 있어요.'); return; }
      app.audio.play(s, { repeat: false, lofi: app.settings.audio.lofi });
    } }, '▶ 처음부터 듣기'));
    t.appendChild(el('button', { class: 'btn', onclick: () => app.audio.stop() }, '■ 멈춤'));
  }

  /* ================= Rhythm Lab ================= */
  app.lab = { genreId: 'bossa', grid: null, bpm: 120, swing: 0.5, chords: true, bass: true, listenFrom: 0, taught: {} };

  function buildLab() {
    $('lab-search').addEventListener('input', renderGenreList);
  }

  function renderLab() { renderGenreList(); selectGenre(app.lab.genreId, true); }

  function renderGenreList() {
    const q = $('lab-search').value.trim().toLowerCase();
    const box = $('genre-list'); box.innerHTML = '';
    const known = app.state.known;
    $('lab-known').textContent = `알고 있는 장르 ${Object.keys(known).length}/${H.GENRES.length}`;
    H.GENRES.filter((g) => !q || (g.name + g.ko + g.region).toLowerCase().includes(q)).forEach((g) => {
      const fam = known[g.id] || 0;
      box.appendChild(el('div', { class: 'g-item' + (g.id === app.lab.genreId ? ' sel' : ''), onclick: () => selectGenre(g.id) },
        el('div', null, el('b', null, g.ko), ' ', el('small', null, g.name)), el('span', { class: 'ts' }, g.timeSig),
        el('small', null, g.region), el('span', { class: 'ts' }, fam ? `익힘 ${Math.round(fam * 100)}%` : '모름'),
        el('div', { class: 'fam' }, el('i', { style: { width: fam * 100 + '%' } }))));
    });
  }

  function selectGenre(id, keepGrid) {
    const g = H.GENRE[id]; if (!g) return;
    const changed = app.lab.genreId !== id || !app.lab.grid;
    app.lab.genreId = id;
    if (changed || !keepGrid) {
      app.lab.grid = {}; Object.keys(g.drums).forEach((k) => { app.lab.grid[k] = g.drums[k].padEnd(g.steps, '.').slice(0, g.steps).split(''); });
      app.lab.bpm = Math.round((g.bpm[0] + g.bpm[1]) / 2); app.lab.swing = g.swing;
    }
    document.querySelectorAll('.g-item').forEach((x, i) => x.classList.toggle('sel', x.querySelector('b') && x.querySelector('b').textContent === g.ko));
    $('lab-head').innerHTML = '';
    $('lab-head').append(
      el('div', { class: 'sub' }, `${g.region} · ${g.timeSig} · ${g.bpm[0]}–${g.bpm[1]} BPM · 음계: ${g.scales.map((s) => H.SCALES[s].ko).join(', ')}`),
      el('h2', null, `${g.ko} `, el('span', { class: 'muted', style: { fontSize: '14px', fontWeight: 400 } }, g.name)),
      el('p', null, g.desc));
    renderGrid(); renderLabControls(); rebuildLabSong();
  }

  function renderGrid() {
    const g = H.GENRE[app.lab.genreId];
    const box = $('lab-grid'); box.innerHTML = '';
    const names = Object.keys(app.lab.grid);
    if (!names.length) box.appendChild(el('div', { class: 'hint' }, '이 장르는 드럼 없이 악기들이 리듬을 만들어요. 아래에서 타악기를 추가해볼 수도 있어요.'));
    names.forEach((n) => {
      const cells = el('div', { class: 'cells', style: { gridTemplateColumns: `repeat(${g.steps}, 1fr)` } });
      app.lab.grid[n].forEach((ch, i) => {
        const c = el('div', { class: 'cell ' + (ch === '.' ? '' : ch) + (i % g.beatSteps === 0 ? ' beat' : ''), 'data-i': i, onclick: () => {
          const order = ['.', 'X', 'x', 'o'];
          const nv = order[(order.indexOf(app.lab.grid[n][i]) + 1) % 4];
          app.lab.grid[n][i] = nv; c.className = 'cell ' + (nv === '.' ? '' : nv) + (i % g.beatSteps === 0 ? ' beat' : '');
          if (nv !== '.') app.audio.drum(n, H.patVel(nv));
          rebuildLabSong();
        } });
        cells.appendChild(c);
      });
      box.appendChild(el('div', { class: 'lab-row', 'data-inst': n }, el('div', { class: 'nm' }, el('button', { title: '빼기', onclick: () => { delete app.lab.grid[n]; renderGrid(); rebuildLabSong(); } }, '×'), el('span', { onclick: () => app.audio.drum(n, 0.9), style: { cursor: 'pointer' } }, H.DRUM_NAMES[n] || n)), cells));
    });
    const add = el('select', null, el('option', { value: '' }, '+ 타악기 추가'), ...Object.keys(H.DRUM_NAMES).filter((k) => !app.lab.grid[k]).map((k) => el('option', { value: k }, H.DRUM_NAMES[k])));
    add.addEventListener('change', () => { if (!add.value) return; app.lab.grid[add.value] = '.'.repeat(g.steps).split(''); renderGrid(); });
    box.appendChild(el('div', { style: { marginTop: '8px' } }, add));
  }

  function renderLabControls() {
    const box = $('lab-controls'); box.innerHTML = '';
    const g = H.GENRE[app.lab.genreId];
    const slider = (ko, key, min, max, step, fmt) => {
      const val = el('b', null, fmt(app.lab[key]));
      const inp = el('input', { type: 'range', min, max, step, value: app.lab[key] });
      inp.addEventListener('input', () => { app.lab[key] = parseFloat(inp.value); val.textContent = fmt(app.lab[key]); if (app.labSong) { app.labSong.bpm = app.lab.bpm; app.labSong.swing = app.lab.swing; } });
      return el('div', { class: 'ctl' }, el('span', null, ko, ' ', val), inp);
    };
    const tog = (ko, key) => { const i = el('input', { type: 'checkbox' }); i.checked = app.lab[key]; i.addEventListener('change', () => { app.lab[key] = i.checked; rebuildLabSong(); }); return el('label', { class: 'ctl', style: { flexDirection: 'row', gap: '6px', alignItems: 'center' } }, i, ko); };
    const playBtn = el('button', { class: 'btn primary', onclick: () => { if (app.labPlaying) stopLab(); else playLab(); renderLabControls(); } }, app.labPlaying ? '■ 멈춤' : '▶ 재생');
    const fam = app.state.known[g.id] || 0;
    const live = app.creation.state === 'running' && app.creation.song;
    box.append(...[playBtn,
      slider('BPM', 'bpm', Math.round(g.bpm[0] * 0.6), Math.round(g.bpm[1] * 1.4), 1, (x) => Math.round(x)),
      slider('스윙', 'swing', 0.5, 0.72, 0.01, (x) => Math.round((x - 0.5) * 200) + '%'),
      tog('화음', 'chords'), tog('베이스', 'bass'),
      el('button', { class: 'btn accent', title: '같이 듣고 나서 누르면 그 아이가 이 장르를 배워요', onclick: teachGenre }, fam ? `들려주기 (익힘 ${Math.round(fam * 100)}%)` : '들려주기 · 가르치기'),
      el('button', { class: 'btn', onclick: () => requestGenre(g.id) }, app.state.request === g.id ? '✓ 다음 곡 요청됨' : '다음 곡은 이걸로!'),
      live ? el('button', { class: 'btn', onclick: () => { const pat = {}; Object.keys(app.lab.grid).forEach((k) => { pat[k] = app.lab.grid[k].join(''); }); app.creation.intervene('rhythm', { genreId: g.id, pattern: pat }); stopLab(); setView('room'); } }, '지금 곡에 이 리듬 넣기 (장난)') : null].filter(Boolean));
  }

  function rebuildLabSong() {
    const g = H.GENRE[app.lab.genreId];
    const base = H.compose({ seed: H.hash('lab' + g.id), genreId: g.id, mood: { valence: g.vibe.v, arousal: g.vibe.a, tension: 0.2 }, keywords: ['rhythm', 'lab', '리듬'], seconds: 40 });
    const sec = base.sections.find((s) => s.name === 'A') || base.sections[1];
    const s0 = sec.start * base.steps, s1 = s0 + 2 * base.steps;
    const song = Object.assign({}, base, { bars: 2, totalSteps: 2 * base.steps, bpm: app.lab.bpm, swing: app.lab.swing, sections: [{ name: 'A', start: 0, len: 2 }] });
    song.notes = base.notes.filter((n) => n.s >= s0 && n.s < s1 && ((n.t === 'bass' && app.lab.bass) || ((n.t === 'chord' || n.t === 'pad') && app.lab.chords) || (n.t === 'lead' && false))).map((n) => Object.assign({}, n, { s: n.s - s0, rev: 0 }));
    song.drums = [];
    for (let b = 0; b < 2; b++) Object.keys(app.lab.grid).forEach((k) => app.lab.grid[k].forEach((ch, i) => { const v = H.patVel(ch); if (v) song.drums.push({ s: b * g.steps + i, n: k, v, rev: 0 }); }));
    song.chords = base.chords.slice(sec.start, sec.start + 2);
    H.indexSong(song);
    const playing = app.labPlaying;
    app.labSong = song;
    if (playing) { const st = app.audio.step; app.audio.song = song; app.audio.step = st % song.totalSteps; }
  }

  function playLab() {
    rebuildLabSong();
    app.labPlaying = true; app.lab.listenFrom = performance.now();
    app.audio.play(app.labSong, { repeat: true, lofi: 0.1 });
    if (app.creation.active) { app.pet.flash('listen', 4); app.say(H.fillLine('lab_listen'), { quiet: true }); }
    else app.pet.flash('dance', 3, 'happy');
  }
  function stopLab() {
    app.labPlaying = false; app.audio.stop();
    if (app.creation.state === 'running') { app.creation.curSec = -1; if (app.creation.phaseInfo.ph.id === 'paint' && app.creation.song) app.audio.play(app.creation.song, { repeat: true, lofi: app.settings.audio.lofi }); }
  }

  function teachGenre() {
    const g = H.GENRE[app.lab.genreId];
    if (!app.labPlaying || performance.now() - app.lab.listenFrom < 6000) { H.toast('먼저 ▶ 재생으로 6초 이상 같이 들어주세요.'); return; }
    const today = H.dateKey();
    const key = g.id + today;
    if (app.lab.taught[key] >= 2) { app.say(`${g.ko}는 오늘 충분히 들었어! 내일 또 들려줘.`); return; }
    app.lab.taught[key] = (app.lab.taught[key] || 0) + 1;
    const before = app.state.known[g.id] || 0;
    app.state.known[g.id] = H.clamp(before + (before ? 0.15 : 0.3));
    app.state.xp += 10;
    app.pet.nudge('inspiration', 6); app.pet.nudge('bond', 1);
    app.pet.flash('happy', 2, 'happy');
    app.say(H.fillLine(before ? 'teach_known' : 'teach', { genre: g.ko }));
    if (!before) H.toast(`새 장르를 배웠어요: ${g.ko}`);
    app.saveState(); renderGenreList(); renderLabControls(); renderHud();
  }

  function requestGenre(id) {
    const g = H.GENRE[id];
    app.state.request = id; app.saveState();
    app.say(H.fillLine(app.state.known[id] ? 'request_ok' : 'request_meh', { genre: g.ko }));
    if (!app.state.known[id]) app.state.known[id] = 0.1;
    renderLabControls();
  }

  function updateLabCursor() {
    if (!app.labPlaying || app.view !== 'lab' || !app.labSong) return;
    const st = Math.floor(app.audio.playStep);
    if (st < 0) return;
    const i = st % app.labSong.steps;
    if (app.lab.lastCursor === i) return;
    app.lab.lastCursor = i;
    document.querySelectorAll('#lab-grid .cell').forEach((c) => c.classList.toggle('play', +c.dataset.i === i));
  }

  /* ================= Archive ================= */
  async function refreshArchive() {
    if (!window.haru) return;
    try { app.works = await window.haru.listWorks(); } catch (e) { app.works = []; }
    renderArchive();
    /* walls */
    app.room.artworks = app.works.slice(0, 4).map((w) => { const img = new Image(); img.src = w.urls.raw || w.urls.png; return img; });
  }

  function renderArchive() {
    const box = $('works'); if (!box) return;
    box.innerHTML = '';
    if (!app.works.length) { box.appendChild(el('div', { class: 'hint', style: { padding: '20px' } }, '아직 작품이 없어요. 첫 작품이 완성되면 여기에 쌓여요.')); return; }
    if (!app.selWork || !app.works.some((w) => w.folder === app.selWork)) { app.selWork = app.works[0].folder; showWork(app.works[0]); }
    app.works.forEach((w, i) => box.appendChild(el('div', { class: 'work' + (app.selWork === w.folder ? ' sel' : ''), onclick: () => { app.selWork = w.folder; renderArchive(); showWork(w); } },
      el('img', { src: w.urls.png || '', loading: 'lazy' }),
      el('div', null, el('b', null, w.meta.title || w.folder), el('small', null, `${w.meta.date} · ${w.meta.genreKo || ''} · ${w.meta.bpm || ''}BPM`), el('br'), el('small', null, (w.meta.keywords || []).slice(0, 4).join(' · '))))));
  }

  function showWork(w) {
    const d = $('work-detail'); d.innerHTML = '';
    const m = w.meta;
    d.appendChild(el('div', { class: 'wd' },
      el('div', null, el('img', { class: 'poster', src: w.urls.png }),
        w.urls.mp4 ? el('video', { src: w.urls.mp4, controls: true, preload: 'metadata' }) : el('div', { class: 'hint' }, '이 작품은 녹화 영상이 없어요.')),
      el('div', null,
        el('h2', null, m.title),
        el('div', { class: 'meta' }, `${m.date} · ${m.genreKo} (${m.region}) · ${m.key} ${m.scale} · ${m.bpm} BPM · ${m.timeSig} · ${m.styleKo} · ${m.moodKo}`),
        el('audio', { src: w.urls.mp3, controls: true, preload: 'metadata' }),
        el('div', { class: 'btns' },
          app.mobile ? null : el('button', { class: 'btn', onclick: () => window.haru.openPath(w.path) }, '폴더 열기'),
          el('button', { class: 'btn', onclick: () => window.haru.showItem(w.files.mp3) }, app.mobile ? 'MP3 공유' : 'MP3'),
          el('button', { class: 'btn', onclick: () => window.haru.showItem(w.files.png) }, app.mobile ? '그림 공유' : 'PNG'),
          w.files.mp4 ? el('button', { class: 'btn', onclick: () => window.haru.showItem(w.files.mp4) }, app.mobile ? '영상 공유' : 'MP4') : null),
        el('pre', null, m.diary || ''),
        el('div', { class: 'hint' }, `키워드: ${(m.keywords || []).join(', ')}`),
        m.log && (m.log.notes || m.log.splash || m.log.rhythm) ? el('div', { class: 'hint' }, `함께한 흔적 — 던진 음 ${m.log.notes || 0} · 쏟은 물감 ${m.log.splash || 0}${m.log.rhythm ? ' · 바꾼 리듬 ' + m.log.rhythm : ''}`) : null)));
  }

  /* ================= Shop ================= */
  function buildShop() { $('btn-open-out').onclick = () => window.haru && window.haru.openOutput(); }
  function renderShop() {
    const st = app.state; const lv = H.levelFromXp(st.xp);
    const lo = H.xpForLevel(lv), hi = H.xpForLevel(lv + 1);
    $('shop-stats').innerHTML = `<div class="lbl">STARS</div><div class="big-num">★ ${st.stars}</div>
      <div class="lbl" style="margin-top:14px">LEVEL ${lv}</div><div class="xpbar"><i style="width:${(st.xp - lo) / (hi - lo) * 100}%"></i></div>
      <div class="hint">작품 ${st.works}개 · 아는 장르 ${Object.keys(st.known).length}개 · 함께한 날 ${st.days}일</div>
      <div class="hint" style="margin-top:10px">별은 작품을 완성할 때, 경험치는 작품과 장르 가르치기로 얻어요. 함께 있어주고 장난을 칠수록 작품 점수가 올라가요.</div>`;
    const box = $('items'); box.innerHTML = '';
    const owned = new Set(st.items || []), hidden = new Set(st.hiddenItems || []);
    H.ITEMS.forEach((it) => {
      const has = owned.has(it.id);
      box.appendChild(el('div', { class: 'item' }, el('b', null, it.ko), el('small', null, it.desc),
        el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('span', { class: 'price' }, has ? '보유' : `★ ${it.price}`),
          has ? el('button', { class: 'btn', onclick: () => { st.hiddenItems = hidden.has(it.id) ? [...hidden].filter((x) => x !== it.id) : [...hidden, it.id]; applyItems(); app.saveState(); renderShop(); } }, hidden.has(it.id) ? '꺼내기' : '치우기')
            : el('button', { class: 'btn primary', disabled: st.stars < it.price ? true : null, onclick: () => buy(it) }, '들이기'))));
    });
  }
  function buy(it) {
    if (app.state.stars < it.price) return;
    app.state.stars -= it.price; app.state.items = (app.state.items || []).concat([it.id]);
    applyItems(); applyAmbience(); app.saveState(); renderShop(); renderHud();
    app.pet.flash('happy', 2, 'love'); app.say(H.fillLine('shop'));
    app.audio.sfx('chime');
  }

  /* ================= finishing ================= */
  const FSTEPS = [['music', '곡 녹음 (오프라인 렌더)'], ['mp3', 'MP3 인코딩'], ['art', '그림 마무리 · 일기 쓰기'], ['video', '타임랩스 영상 만들기'], ['save', '저장'], ['done', '완성']];
  function showFinalProgress(e) {
    const box = $('final-pop');
    if (e.step === 'error') { box.classList.add('hidden'); return; }
    if (e.step === 'done') return;
    box.classList.remove('hidden');
    const idx = FSTEPS.findIndex((s) => s[0] === e.step);
    box.innerHTML = '';
    box.append(el('div', { class: 'lbl' }, 'FINISHING · 마무리 중'), el('div', { class: 'final-steps' }, FSTEPS.map(([k, ko], i) => el('div', { class: i < idx ? 'ok' : i === idx ? 'now' : '' }, ko))));
  }
  function closeFinal() { $('final-pop').classList.add('hidden'); }

  app.onCreationDone = function (cr, record) {
    const st = app.state, s = app.pet.stats;
    const fam = st.known[record.genreId] || 0.1;
    const inter = record.log.notes + record.log.splash + (record.log.rhythm ? 2 : 0) + record.log.whispers.length + Math.min(5, record.log.pats);
    const quality = H.clamp(35 + s.inspiration * 0.25 + fam * 25 + s.mood * 0.1 + Math.min(15, inter * 2.5) + Math.random() * 10, 0, 100);
    const stars = Math.round(10 + quality / 3);
    st.stars += stars; st.xp += 30; st.works++;
    if (!record.extra || st.lastWorkDate !== record.date) st.days++;
    st.lastWorkDate = record.date;
    st.known[record.genreId] = H.clamp(fam + 0.08);
    st.history = (st.history || []).concat([{ date: record.date, keywords: record.keywords, genreId: record.genreId, title: record.title }]).slice(-30);
    app.pet.nudge('energy', -15); app.pet.nudge('inspiration', -20); app.pet.nudge('bond', 3); app.pet.nudge('mood', 5);
    app.saveState();
    app.lastResult = { song: cr.song, record };
    app.audio.sfx('chime');
    app.pet.goTo('center', 'happy', () => { app.pet.flash('wave', 2); });
    app.say(H.fillLine('finish', { title: record.title }), { duration: 7 });
    setTimeout(() => { app.audio.play(cr.song, { lofi: app.settings.audio.lofi, onEnd: () => app.pet.setAct('idle') }); app.pet.setAct('listen'); }, 2500);
    if (app.settings.general.notify && window.haru) window.haru.notify(`${H.josa(app.settings.petName, '이/가')} 오늘의 작품을 완성했어요`, `「${record.title}」 · ${record.genreKo} · ★+${stars}`);
    /* result card */
    const box = $('final-pop'); box.classList.remove('hidden'); box.innerHTML = '';
    const src = URL.createObjectURL(new Blob([new Uint8Array(0)]));
    void src;
    cr.result.poster.toBlob((b) => {
      const url = URL.createObjectURL(b);
      box.append(el('div', { class: 'final-work' }, el('img', { src: url }), el('div', null,
        el('div', { class: 'lbl' }, `TODAY · ${record.date}`), el('h3', null, record.title),
        el('div', { class: 'muted', style: { fontSize: '12px' } }, `${record.genreKo} · ${record.key} ${record.scale} · ${record.bpm} BPM · ${record.styleKo}`),
        el('div', { style: { margin: '8px 0', fontSize: '12.5px' } }, `★ +${stars}  ·  작품 점수 ${Math.round(quality)}`),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: () => { closeFinal(); setView('archive'); } }, '기록에서 보기'),
          record.folder ? el('button', { class: 'btn', onclick: () => window.haru.openPath(record.folder) }, '폴더 열기') : null,
          el('button', { class: 'btn', onclick: closeFinal }, '닫기')))));
    });
    renderHud(); renderRingActions(); renderSongInfo(); refreshArchive();
  };

  /* ================= autopilot (idle life + daily schedule) ================= */
  let nextIdleAt = 0;
  function isNight() { const g = app.settings.general; if (!g.sleepAtNight) return false; const h = hoursNow(); const from = g.sleepFrom % 24; return from > g.sleepTo ? (h >= from || h < g.sleepTo) : (h >= from && h < g.sleepTo) || (g.sleepFrom >= 24 && h < g.sleepTo && h >= from); }

  function autopilot() {
    const cr = app.creation, g = app.settings.general, st = app.state;
    applyVisual(); applyAmbience();
    const today = H.dateKey();
    if (st.patsDate !== today) { st.patsDate = today; st.patsToday = 0; }
    if (!app.settings.setupDone || cr.active) return;
    const h = hoursNow();
    if (g.autoCreate && st.lastWorkDate !== today && h >= g.autoCreateHour && !isNight() && app.pet.stats.energy >= 12) {
      app.say('오늘의 작품, 시작해볼게!');
      setTimeout(() => { if (!cr.active) cr.start({}); }, 2500);
    }
  }

  function idleBrain(dt) {
    const pet = app.pet, cr = app.creation;
    if (cr.active || !app.settings.setupDone) return;
    if (app.holdIdleUntil && performance.now() < app.holdIdleUntil) return;
    if (isNight()) {
      if (pet.act !== 'sleep' && !pet.target) { pet.goTo('nook', 'sleep'); app.say(H.fillLine('night_sleep'), { quiet: true }); }
      pet.nudge('energy', dt * 0.05);
      return;
    }
    if (pet.act === 'sleep' && !pet.override) { pet.setAct('stretch'); app.say(H.fillLine('wake'), { quiet: true }); nextIdleAt = performance.now() + 6000; }
    pet.nudge('energy', dt * 0.02);
    const mw = app.lastWorld;
    pet.stats.mood += ((50 + (mw ? mw.mood.valence * 20 : 0)) - pet.stats.mood) * dt * 0.002;
    if (performance.now() < nextIdleAt || pet.target) return;
    nextIdleAt = performance.now() + (20000 + Math.random() * 40000) / (app.fast ? 4 : 1);
    const opts = [['desk', 'idle'], ['desk', 'type'], ['window', 'think'], ['nook', 'read'], ['center', 'stretch'], ['desk', 'drink'], ['center', 'idle']];
    if (app.audio.playing) opts.push(['center', 'dance'], ['desk', 'listen']);
    if (pet.stats.energy < 25) opts.push(['nook', 'sleep'], ['nook', 'sleep']);
    const [spot, act] = opts[Math.floor(Math.random() * opts.length)];
    pet.goTo(spot, act);
    if (Math.random() < app.settings.general.chatty) {
      const w = app.lastWorld;
      setTimeout(() => app.say(H.fillLine(pet.stats.energy < 25 ? 'sleepy' : 'idle', { kw: w && w.keywords[0] ? w.keywords[Math.floor(Math.random() * Math.min(5, w.keywords.length))].w : '오늘', weather: (app.room.weather || {}).ko || '맑음', temp: app.room.weather ? Math.round(app.room.weather.temp) : 20 }), { quiet: true }), 2500);
    }
  }

  function greet() {
    const st = app.state; const h = hoursNow();
    const days = st.lastVisit ? Math.floor((Date.now() - st.lastVisit) / 86400000) : 0;
    st.lastVisit = Date.now(); app.saveState();
    let key = h < 5 ? 'greet_night' : h < 11 ? 'greet_morning' : h < 17 ? 'greet_afternoon' : h < 21 ? 'greet_evening' : 'greet_night';
    if (days >= 2) key = 'greet_long';
    setTimeout(() => { app.pet.flash('wave', 2.5, 'happy'); app.say(H.fillLine(key, { days })); }, 1200);
    if (app.settings.sources.weather) H.gatherWorld({ weather: true, ...Object.fromEntries(H.SOURCES.map((s) => [s.id, false])), lat: app.settings.sources.lat, lon: app.settings.sources.lon }).then((d) => { if (d.weather) { app.room.weather = d.weather; applyAmbience(); } }).catch(() => {});
  }

  /* ================= loops ================= */
  let lastStep = performance.now(), lastFrame = performance.now();
  function step(dt) {
    dt = Math.min(dt, 0.25);
    app.room.hours = hoursNow();
    app.pet.update(dt);
    app.room.update(dt, app.pet);
    app.creation.tick(dt);
    idleBrain(dt);
    app.room.musicLevel = H.lerp(app.room.musicLevel, app.audio.playing ? 1 : 0, dt * 2);
    autoCamera(dt);
  }

  let camTimer = 0, camPick = 'wide';
  function autoCamera(dt) {
    if (app.camMode !== 'auto') return;
    camTimer -= dt;
    const cr = app.creation, pet = app.pet;
    if (camTimer <= 0) {
      camTimer = 10 + Math.random() * 10;
      let base = 'wide';
      if (cr.state === 'running') base = cr.phaseInfo.ph.cam;
      else if (pet.spot === 'nook') base = 'nook';
      else if (pet.spot === 'desk') base = 'desk';
      else if (pet.spot === 'window') base = 'window';
      const r = Math.random();
      camPick = r < 0.22 ? 'wide' : r < 0.42 && (pet.spot === 'desk') ? 'close' : base;
      if (app.room.is3D && pet.spot === 'desk' && r > 0.42 && r < 0.58) camPick = 'shoulder';
    }
    if (app.room.is3D) {
      const want = pet.target ? 'wide' : camPick;
      if (app.room.camName !== want) app.room.setCamera(want);
      return;
    }
    if (pet.target) { app.room.setCameraTarget(H.lerp(800, pet.x, 0.5), 480, 1.25); return; }
    const c = H.CAMERAS[camPick];
    app.room.setCameraTarget(c.x, c.y, c.z);
  }

  function logicTimer() {
    const now = performance.now();
    if (now - lastStep > 160) { step((now - lastStep) / 1000); lastStep = now; }
  }

  function frame() {
    const now = performance.now();
    const dt = (now - lastFrame) / 1000; lastFrame = now;
    step((now - lastStep) / 1000); lastStep = now;
    void dt;
    render();
    requestAnimationFrame(frame);
  }

  function resizeAll() { /* canvases are fit lazily in render */ }

  function render() {
    const v = app.view;
    if (v === 'room') {
      if (app.room.is3D) { const cv = $('room3d-canvas'); app.room.render(cv.clientWidth, cv.clientHeight); }
      else {
        const cv = $('room-canvas'); const { w, h, dpr } = H.fitCanvas(cv);
        const ctx = cv.getContext('2d');
        app.room.draw(ctx, w, h, app.pet, { dpr });
      }
      updateBubble();
      const rc = $('ring'); const rctx = rc.getContext('2d'); rctx.setTransform(2, 0, 0, 2, 0, 0);
      const cr = app.creation;
      if (cr.state === 'running') H.drawRing(rctx, 150, 150, cr.progress, H.fmtClock(cr.remainingSec), app.paused ? '일시정지' : cr.phaseInfo.ph.ko);
      else if (cr.state === 'break') H.drawRing(rctx, 150, 150, 1 - cr.breakLeft / (cr.pomo ? cr.pomo.brk : 1), H.fmtClock(cr.breakLeft / 1000), '휴식 중', '#3e9b5a');
      else if (cr.state === 'finalizing') H.drawRing(rctx, 150, 150, 1, '…', '마무리 중');
      else { const d = new Date(); H.drawRing(rctx, 150, 150, (d.getHours() * 60 + d.getMinutes()) / 1440, `${H.pad2(d.getHours())}:${H.pad2(d.getMinutes())}`, app.state.lastWorkDate === H.dateKey() ? '오늘 작품 완성' : `${app.settings.general.autoCreateHour}시에 시작` , '#8a8f98'); }
    } else if (v === 'world') {
      const cv = $('orbit-canvas'); const { w, h, dpr } = H.fitCanvas(cv);
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cr = app.creation;
      let reveal = Infinity;
      if (cr.gathering) reveal = 0;
      else if (app.orbitBorn) reveal = (performance.now() - app.orbitBorn) / 180;
      app.orbit.draw(ctx, w, h, performance.now() / 1000, reveal);
      if (!app.orbit.world) { ctx.fillStyle = H.cssVar('--muted'); ctx.font = '12px "Malgun Gothic"'; ctx.fillText(cr.gathering ? '세상의 소리를 모으는 중…' : '아직 오늘의 별자리가 없어요.', 40, h / 2); }
    } else if (v === 'studio') renderStudio();
    else if (v === 'lab') updateLabCursor();
  }

  function fit(id) { const cv = $(id); const r = H.fitCanvas(cv); const ctx = cv.getContext('2d'); ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0); return [ctx, r.w, r.h]; }

  function renderStudio() {
    const A = app.audio;
    if (!A.ctx) return;
    let [c, w, h] = fit('cv-loud'); const rms = app.loud.draw(c, w, h, A); $('lufs').textContent = rms > 0.001 ? (20 * Math.log10(rms)).toFixed(1) + ' dB' : '';
    [c, w, h] = fit('cv-scope'); H.drawScope(c, w, h, A);
    [c, w, h] = fit('cv-spec'); H.drawSpectrum(c, w, h, A);
    [c, w, h] = fit('cv-vec'); H.drawVector(c, w, h, A);
    const song = app.labPlaying ? app.labSong : curSong();
    const ps = A.playing && A.song === song ? A.playStep : -1;
    [c, w, h] = fit('cv-clock'); H.drawBarClock(c, w, h, song, ps);
    const cr = app.creation;
    const reveal = song === cr.song ? cr.reveal + (cr.state === 'finalizing' || cr.state === 'done' ? 1 : 0) : 1;
    const write = song === cr.song && cr.phaseInfo.ph.id === 'compose' && cr.state === 'running' ? songWriteStep(cr) : null;
    [c, w, h] = fit('cv-roll');
    H.drawPianoRoll(c, w, h, song, { playStep: ps, reveal, writeStep: write, fromBar: rollPage != null ? rollPage : (ps < 0 && write != null ? Math.floor(write / song.steps / 4) * 4 : undefined) });
    if (song) $('roll-meta').textContent = `${song.genre} · ${song.keyName} ${song.scaleName} · ${song.bpm} BPM · ${song.timeSig}`;
    const pc = $('cv-paint'); const pr = H.fitCanvas(pc); const pctx = pc.getContext('2d'); pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.drawImage(app.painter.canvas, 0, 0, pc.width, pc.height); void pr;
    [c, w, h] = fit('cv-tone'); H.drawToneGraph(c, w, h, song, ps, reveal);
  }

  function songWriteStep(cr) {
    const s = cr.song; const rv = cr.reveal;
    const si = H.sectionAt(s, rv); const [a, b] = s.secSpan[si]; const sec = s.sections[si];
    const local = (rv - a) / (b - a);
    const lw = local < 0.62 ? (local < 0.25 ? local / 0.25 : local < 0.45 ? (local - 0.25) / 0.2 : (local - 0.45) / 0.17) : (local - 0.62) / 0.38;
    return (sec.start + H.clamp(lw) * sec.len) * s.steps;
  }

  /* ---------- slow timer: HUD + mini ---------- */
  let hudTick = 0;
  function slowTimer() {
    hudTick++;
    if (app.shot && hudTick % 8 === 0) console.warn('[dbg]', 'audio', app.audio.ctx && app.audio.ctx.state, 'playing', app.audio.playing, 'step', Math.round(app.audio.playStep), 'cr', app.creation.state, app.creation.phaseInfo.ph.id, Math.round(app.creation.progress * 100) + '%', 'pet', app.pet.spot, app.pet.act);
    if (hudTick % 2 === 0) { renderHud(); renderRingActions(); }
    if (app.view === 'studio' && hudTick % 3 === 0) renderSongInfo();
    sendMini(false);
  }

  function sendMini(withLine) {
    if (!window.haru) return;
    const cr = app.creation, p = app.pet;
    const pose = p.pose;
    window.haru.miniStatus({
      name: app.settings.petName, cfg: app.settings.character, act: pose.act === 'walk' ? 'idle' : pose.act, emo: pose.emo,
      phase: cr.state === 'running' ? cr.phaseInfo.ph.ko : cr.state === 'break' ? '휴식 중' : cr.state === 'finalizing' ? '마무리 중' : (app.state.lastWorkDate === H.dateKey() ? '오늘 작품 완성' : '쉬는 중'),
      progress: cr.active ? cr.progress : -1, remaining: cr.state === 'running' ? H.fmtClock(cr.remainingSec) : '',
      line: withLine ? app.lastLine : null, playing: app.audio.playing, renderer: app.room && app.room.is3D ? '3d' : '2d',
    });
  }

  window.addEventListener('DOMContentLoaded', () => boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;bottom:0;left:0;color:red;z-index:99">${H.escape(e.stack || e)}</pre>`); }));
})(window.H);
