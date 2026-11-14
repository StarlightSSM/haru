/* HARU — one day's creation session: gather → think → compose → paint → finalize */
(function (H) {
  'use strict';

  const PHASES = [
    { id: 'gather', ko: '세상 읽는 중', w: 0.12, spot: 'nook', act: 'read', cam: 'nook' },
    { id: 'think', ko: '생각 정리 중', w: 0.05, spot: 'window', act: 'think', cam: 'window' },
    { id: 'compose', ko: '작곡 중', w: 0.45, spot: 'desk', act: 'type', cam: 'desk' },
    { id: 'paint', ko: '그림 그리는 중', w: 0.38, spot: 'easel', act: 'paint', cam: 'easel' },
  ];
  H.PHASES = PHASES;

  function phaseAt(p) {
    let acc = 0;
    for (let i = 0; i < PHASES.length; i++) {
      const a = acc; acc += PHASES[i].w;
      if (p < acc || i === PHASES.length - 1) return { i, ph: PHASES[i], local: H.clamp((p - a) / PHASES[i].w) };
    }
    return { i: 3, ph: PHASES[3], local: 1 };
  }
  const phaseStart = (i) => PHASES.slice(0, i).reduce((s, p) => s + p.w, 0);

  class Creation {
    constructor(app) {
      this.app = app;
      this.state = 'idle';           /* idle | running | break | finalizing | done */
      this.log = { notes: 0, rhythm: null, splash: 0, whispers: [], pats: 0, snacks: 0, tempo: 0 };
      this.interventions = [];
      this.liveItems = [];
      this.srcStatus = {};
      this.lastLine = 0;
      this.timelapse = new H.Timelapse();
      this.recCanvas = document.createElement('canvas'); this.recCanvas.width = 1280; this.recCanvas.height = 720;
      this.recCam = Object.assign({}, H.CAMERAS.wide);
    }

    get active() { return this.state === 'running' || this.state === 'break' || this.state === 'finalizing'; }
    get progress() { return this.totalMs ? H.clamp(this.elapsed / this.totalMs) : 0; }
    get phaseInfo() { return phaseAt(this.progress); }
    get reveal() { const pi = this.phaseInfo; return pi.i < 2 ? 0 : pi.i === 2 ? pi.local : 1; }
    get remainingSec() { return Math.max(0, (this.totalMs - this.elapsed) / 1000); }

    sessionMs() {
      const g = this.app.settings.general;
      if (this.app.fast) return 50000;
      return Math.max(1, g.sessionMinutes) * 60000;
    }

    async start(opts = {}) {
      if (this.active) return;
      const app = this.app;
      this.extra = !!opts.extra;
      this.date = H.dateKey();
      this.seed = opts.seed || H.hash(this.date + ':' + Date.now());
      this.totalMs = this.sessionMs();
      this.elapsed = opts.elapsed || 0;
      this.startedAt = Date.now();
      this.state = 'running';
      this.world = opts.world || null;
      this.song = null; this.plan = null; this.artPlan = null;
      this.log = opts.log || { notes: 0, rhythm: null, splash: 0, whispers: [], pats: 0, snacks: 0, tempo: 0 };
      this.interventions = opts.interventions || [];
      this.liveItems = []; this.srcStatus = {};
      this.lastPhase = -1; this.workAccum = 0; this.breakLeft = 0;
      this.pendingSplashes = [];
      app.painter.clear();
      const pomo = app.settings.general.pomodoro;
      this.pomo = pomo && pomo.on && !app.fast ? { work: pomo.work * 60000, brk: pomo.brk * 60000 } : null;
      /* recording */
      const songSec = app.settings.creation.songSeconds;
      const fps = app.settings.creation.videoFps;
      this.recFrames = Math.round(songSec * fps * 0.82);
      this.recInterval = Math.max(1000 / fps, (this.totalMs - this.elapsed) / this.recFrames);
      this.nextRecAt = 0;
      this.recording = false;
      if (app.settings.creation.video) {
        try { this.recording = await this.timelapse.start({ width: 1280, height: 720, fps, withAudio: app.settings.creation.videoAudio, bitrate: app.mobile ? 2.5e6 : 5e6 }); } catch (e) { console.warn(e); this.recording = false; }
      }
      if (this.world) this.prepareFromWorld(opts);
      else this.beginGather();
      this.persist();
      H.emit('creation:start', this);
    }

    beginGather() {
      const app = this.app;
      this.gathering = true;
      this.gatherDone = false;
      app.say(H.fillLine('gather_start'));
      const src = app.settings.sources;
      H.gatherWorld(src, (item) => {
        this.liveItems.push(item);
        if (this.liveItems.length % 3 === 1) app.room.emit({ type: 'text', text: item.title.slice(0, 18) + (item.title.length > 18 ? '…' : ''), x: 300 + Math.random() * 400, y: 200 + Math.random() * 150, target: { x: 320, y: 600 }, vx: 0, vy: 0, life: 3.2, size: 13 });
        H.emit('world:item', item);
      }, (id, status, s, n) => { this.srcStatus[id] = { status, ko: s.ko, n }; H.emit('world:source', { id, status, ko: s.ko, n }); })
        .then((data) => {
          const whispers = (app.state.whispers || []).slice(-6).concat(this.log.whispers);
          this.world = H.analyzeWorld(data, app.state.history, whispers);
          this.gatherDone = true; this.gathering = false;
          if (data.offline) app.say(H.fillLine('gather_offline'));
          else app.say(H.fillLine('gather_kw', { kw: this.world.keywords[0] ? this.world.keywords[0].w : '세상' }));
          this.prepareFromWorld({});
          H.emit('world:ready', this.world);
        })
        .catch((e) => { console.error(e); this.gatherDone = true; this.world = H.analyzeWorld({ items: [], weather: null, status: {}, offline: true }, [], []); this.prepareFromWorld({}); });
    }

    prepareFromWorld(opts) {
      const app = this.app, w = this.world;
      const r = H.rng(this.seed);
      const st = app.state;
      /* the pet picks a sound by its own taste first, then a rhythm that suits it */
      const fixedStyle = app.settings.creation.musicStyle && app.settings.creation.musicStyle !== 'auto' ? app.settings.creation.musicStyle : null;
      /* always draw from the seeded rng (keeps a resumed session identical), then honour a saved choice */
      let choice = H.chooseStyle(w.mood, Object.assign({}, H.DEFAULT_TASTE, st.taste), { r, request: opts.styleId ? null : st.styleRequest || fixedStyle, recent: (st.history || []).map((h) => h.style).filter(Boolean) });
      if (opts.styleId && H.STYLE[opts.styleId]) choice = { id: opts.styleId, why: 'resume' };
      if (st.styleRequest && choice.id === st.styleRequest) { choice.why = 'request'; st.styleRequest = null; }
      if (fixedStyle && choice.id === fixedStyle && choice.why === 'request') choice.why = 'love';
      this.styleChoice = choice;
      const musicStyle = H.STYLE[choice.id];
      const genreId = opts.genreId || H.chooseGenre(w.mood, w.hint, st.known, st.request, r, musicStyle);
      if (st.request && genreId === st.request) st.request = null;
      const keywords = w.keywords.slice(0, 4).map((k) => k.w);
      this.plan = { seed: this.seed, genreId, styleId: choice.id, mood: w.mood, keywords, seconds: app.settings.creation.songSeconds, scale: opts.scale, root: opts.root };
      this.song = H.compose(this.plan);
      this.plan.scale = this.song.scaleName; this.plan.root = this.song.root;
      H.samples && H.samples.ensure(H.songSamples(this.song)).catch(() => {});
      this.song.title = opts.title || H.makeTitle(w, this.seed);
      const style = H.chooseArtStyle(w.mood, r, app.settings.creation.artStyle);
      const palette = H.makePalette(w.mood, w.cats, this.seed);
      this.artPlan = H.planPainting({ seed: this.seed, style, palette, keywords: w.keywords, edges: w.edges });
      app.painter.setPlan(this.artPlan);
      app.room.neonText = keywords[0] || '';
      /* replay interventions (resume) */
      (opts.interventions || []).forEach((iv) => this.applyIntervention(iv, true));
      H.emit('creation:planned', this);
    }

    /* ---------- main tick (called ~10x/s, independent of rendering) ---------- */
    tick(dt) {
      if (this.state === 'idle' || this.state === 'done' || this.state === 'finalizing') return;
      const app = this.app, pet = app.pet;
      if (app.paused) return;
      if (this.state === 'break') {
        this.breakLeft -= dt * 1000;
        if (this.breakLeft <= 0) { this.state = 'running'; app.say(H.fillLine('back_to_work')); this.lastPhase = -1; }
        this.capture(dt);
        return;
      }
      /* advance time, but wait at the end of gather until data arrives */
      let next = this.elapsed + dt * 1000;
      const gatherEnd = PHASES[0].w * this.totalMs;
      if (!this.song && next > gatherEnd - 50) next = Math.min(next, gatherEnd - 50);
      this.elapsed = Math.min(this.totalMs, next);
      if (this.pomo) {
        this.workAccum += dt * 1000;
        if (this.workAccum >= this.pomo.work && this.progress < 0.97) {
          this.workAccum = 0; this.state = 'break'; this.breakLeft = this.pomo.brk;
          app.audio.stop(); pet.goTo('nook', 'drink'); app.say(H.fillLine('break'));
          return;
        }
      }
      const pi = this.phaseInfo;
      if (pi.i !== this.lastPhase) this.enterPhase(pi.i);
      const ph = pi.ph;
      /* per-phase behaviour */
      if (ph.id === 'compose' && this.song) {
        const reveal = pi.local;
        const si = H.sectionAt(this.song, reveal);
        if (si !== this.curSec && !app.labPlaying) {
          this.curSec = si;
          const sec = this.song.sections[si];
          const loop = [sec.start * this.song.steps, (sec.start + sec.len) * this.song.steps];
          if (!app.audio.playing || app.audio.song !== this.song) app.audio.play(this.song, { loop, filter: (ev) => (ev.rev ?? 0) <= this.reveal + 0.0001, lofi: app.settings.audio.lofi });
          else app.audio.setLoop(loop);
        }
        if (pet.act === 'type' && Math.random() < dt * 9) app.audio.sfx('key');
        if (Math.random() < dt * 0.5) app.room.emit({ type: 'note', text: Math.random() < 0.5 ? '♪' : '♫', x: 760 + Math.random() * 80, y: 520, vx: (Math.random() - 0.5) * 20, vy: -35, life: 2.2, color: Math.random() < 0.3 ? '#ff6f91' : '#5b6cff' });
        pet.nudge('focus', dt * 0.4);
      } else if (ph.id === 'paint' && this.artPlan) {
        const last = app.painter.advance(pi.local);
        if (last && last.color && last.type !== 'bg') pet.brushColor = last.color;
        if (Math.random() < dt * 1.2) app.audio.sfx('brush');
        if (Math.random() < dt * 0.8) app.room.emit({ type: 'dot', color: pet.brushColor, x: 1215 + Math.random() * 200, y: 470 + Math.random() * 200, vx: 0, vy: 10, life: 1, size: 3 });
      } else if (ph.id === 'gather') {
        if (Math.random() < dt * 0.4) app.audio.sfx('page');
      }
      pet.nudge('energy', -dt * (this.app.fast ? 0.05 : 0.012));
      /* chatter */
      if (performance.now() - this.lastLine > 26000 && Math.random() < dt * 0.15) this.chatter(ph.id);
      this.capture(dt);
      if (this.elapsed >= this.totalMs && this.song) this.finalize();
      if (Math.random() < dt * 0.2) this.persist();
    }

    enterPhase(i) {
      const app = this.app, pet = app.pet, ph = PHASES[i];
      this.lastPhase = i; this.curSec = -1;
      if (ph.id === 'gather') { app.audio.stop(); pet.goTo('nook', 'read'); }
      if (ph.id === 'think') {
        app.audio.stop();
        pet.goTo('window', 'think', () => {
          if (!this.world) return;
          const g = H.GENRE[this.song.genreId];
          app.say(H.fillLine('think', { mood: H.moodWords(this.world.mood).ko, genre: g.ko, kw: (this.world.keywords[0] || {}).w, kw2: (this.world.keywords[1] || {}).w }));
          /* then explain the taste pick */
          if (this.styleChoice && this.styleChoice.why !== 'resume') setTimeout(() => { if (this.state === 'running') app.say(H.styleReason(this.styleChoice, this.world.mood), { duration: 6 }); }, 5200);
        });
      }
      if (ph.id === 'compose') {
        pet.goTo('desk', 'type', () => {
          if (!this.song) return;
          app.say(H.fillLine('compose_start', { genre: this.song.genreKo, key: this.song.keyName, scale: this.song.scaleKo, bpm: this.song.bpm }));
        });
      }
      if (ph.id === 'paint') {
        app.audio.stop();
        this.pendingSplashes.splice(0).forEach((s) => app.painter.splash(s.x, s.y, s.color));
        pet.goTo('easel', 'paint', () => {
          app.say(H.fillLine('paint_start', { style: (H.ART_STYLES.find((s) => s.id === this.artPlan.style) || {}).ko }));
          if (this.song && !app.labPlaying) app.audio.play(this.song, { repeat: true, lofi: app.settings.audio.lofi });
        });
      }
      H.emit('creation:phase', ph);
    }

    chatter(phase) {
      const app = this.app;
      this.lastLine = performance.now();
      const kw = this.world && this.world.keywords.length ? this.world.keywords[Math.floor(Math.random() * Math.min(8, this.world.keywords.length))].w : '오늘';
      const key = phase === 'compose' ? 'compose_focus' : phase === 'paint' ? 'paint_focus' : phase === 'gather' ? 'gather_kw' : 'idle';
      app.say(H.fillLine(key, { kw }), { quiet: true });
    }

    /* director camera for the recording */
    capture(dt) {
      if (!this.recording || !this.timelapse.active) return;
      const pi = this.phaseInfo;
      const app = this.app;
      const base = this.state === 'break' ? H.CAMERAS.nook : H.CAMERAS[pi.ph.cam] || H.CAMERAS.wide;
      const cyc = Math.floor(this.elapsed / 12000) % 4;
      const want = cyc === 3 ? H.CAMERAS.wide : base;
      this.recCamName = cyc === 3 ? 'wide' : this.state === 'break' ? 'nook' : (pi.ph.cam === 'desk' && cyc === 1 && app.room.is3D ? 'shoulder' : pi.ph.cam);
      const k = 1 - Math.exp(-dt * 1.5);
      this.recCam.x += (want.x - this.recCam.x) * k; this.recCam.y += (want.y - this.recCam.y) * k;
      this.recCam.z += (Math.min(want.z, 2.2) - this.recCam.z) * k;
      const now = performance.now();
      if (now < this.nextRecAt) return;
      this.nextRecAt = now + this.recInterval;
      if (this.timelapse.frames >= this.recFrames) return;
      const ctx = this.recCanvas.getContext('2d');
      const d = new Date();
      H.drawProcessFrame(ctx, 1280, 720, {
        room: app.room, pet: app.petRenderState(), painter: app.painter, song: this.song, cam: this.recCam, camName: this.recCamName,
        playStep: app.audio.playStep, reveal: this.reveal, petName: app.settings.petName,
        phaseKo: this.state === 'break' ? '쉬는 중' : pi.ph.ko, progress: this.progress,
        date: H.dateKey(d), clock: `${H.pad2(d.getHours())}:${H.pad2(d.getMinutes())}`,
        extra: this.song ? `${this.song.genre} · ${this.song.bpm}BPM` : '',
      });
      this.timelapse.addFrame(this.recCanvas);
    }

    /* ---------- user mischief ---------- */
    intervene(kind, payload) {
      const iv = Object.assign({ kind, at: this.progress }, payload);
      const ok = this.applyIntervention(iv, false);
      if (ok) { this.interventions.push(iv); this.persist(); }
      return ok;
    }

    applyIntervention(iv, silent) {
      const app = this.app, pet = app.pet;
      const phase = this.phaseInfo.ph.id;
      const tol = pet.tolerance(phase === 'compose' || phase === 'paint');
      const good = silent ? true : Math.random() < tol;
      switch (iv.kind) {
        case 'note': {
          if (!this.song) return false;
          let step = iv.step;
          if (step == null) { const ps = app.audio.playStep; step = ps >= 0 ? ps : this.reveal * this.song.totalSteps; }
          iv.step = Math.round(step);
          H.insertUserNote(this.song, iv.step, iv.midi, Math.max(0, this.reveal - 0.0001));
          this.log.notes++;
          if (!silent) {
            app.audio.note(iv.midi, this.song.insts.lead, 0.6, 0.7);
            app.room.emit({ type: 'note', text: '♪', x: 800 + (Math.random() - 0.5) * 300, y: 350, target: { x: 800, y: 590 }, vx: 0, vy: 0, life: 1.6, color: '#ff4f8b', size: 30 });
            if (good) { pet.flash('happy', 1.4, 'happy'); app.say(H.fillLine('note_good', { note: H.midiName(iv.midi) })); pet.nudge('bond', 0.6); }
            else { pet.flash('surprised', 1.0, 'annoyed'); app.say(H.fillLine('note_annoyed')); pet.nudge('focus', -6); }
          }
          return true;
        }
        case 'rhythm': {
          if (!this.song) return false;
          const from = iv.fromStep ?? Math.max(0, Math.ceil((app.audio.playStep >= 0 ? app.audio.playStep : this.reveal * this.song.totalSteps)));
          iv.fromStep = from;
          H.swapDrums(this.song, iv.genreId, from, Math.max(0, this.reveal - 0.0001), iv.pattern);
          this.log.rhythm = H.GENRE[iv.genreId].ko;
          if (!silent) { pet.flash('dance', 2.2, good ? 'happy' : 'surprised'); app.say(H.fillLine('rhythm', { genre: H.GENRE[iv.genreId].ko })); }
          return true;
        }
        case 'tempo': {
          if (!this.song) return false;
          this.song.bpm = H.clamp(this.song.bpm + iv.delta, 50, 300);
          this.log.tempo += iv.delta;
          if (!silent) app.say(H.fillLine(iv.delta > 0 ? 'tempo_up' : 'tempo_down'));
          return true;
        }
        case 'splash': {
          this.log.splash++;
          if (phase !== 'paint') this.pendingSplashes.push(iv);
          else app.painter.splash(iv.x, iv.y, iv.color);
          if (!silent) { app.audio.sfx('splash'); pet.flash('surprised', 1.2, good ? 'happy' : 'annoyed'); app.say(H.fillLine('splash')); if (!good) pet.nudge('focus', -5); }
          return true;
        }
        case 'whisper': {
          const word = String(iv.word || '').trim().slice(0, 16);
          if (!word) return false;
          this.log.whispers.push(word);
          app.state.whispers = (app.state.whispers || []).concat([word]).slice(-12);
          if (this.world && this.artPlan && phase !== 'paint') {
            this.world.keywords.unshift({ w: word, score: (this.world.keywords[0] || { score: 1 }).score, norm: 1, cat: 'culture', sent: 0, isNew: true, whisper: true, kinds: { whisper: 1 } });
            this.artPlan = H.planPainting({ seed: this.seed, style: this.artPlan.style, palette: this.artPlan.palette, keywords: this.world.keywords, edges: this.world.edges.map((e) => ({ a: e.a + 1, b: e.b + 1, w: e.w })) });
            app.painter.setPlan(this.artPlan);
          }
          if (!silent) { pet.feel('happy', 2); app.say(H.fillLine('whisper', { word })); pet.nudge('inspiration', 5); }
          return true;
        }
        default: return false;
      }
    }

    /* ---------- finishing ---------- */
    async finalize() {
      if (this.state === 'finalizing') return;
      this.state = 'finalizing';
      const app = this.app;
      app.audio.stop();
      app.pet.goTo('desk', 'type');
      app.say(H.fillLine('finalize'));
      H.emit('creation:finalizing', { step: 'start' });
      const step = (s, p) => H.emit('creation:finalizing', { step: s, p });
      try {
        app.painter.advance(1);
        step('music', 0);
        const buf = await H.renderSong(this.song);
        step('mp3', 0.25);
        const mp3 = await H.encodeMp3(buf, 192, (p) => step('mp3', 0.25 + p * 0.2));
        step('art', 0.5);
        const w = this.world;
        const styleKo = (H.ART_STYLES.find((s) => s.id === this.artPlan.style) || {}).ko;
        const diary = await H.writeDiary({ world: w, song: this.song, art: { styleKo }, log: this.log, petName: app.settings.petName, date: this.date }, app.settings.ai);
        if (diary.title) this.song.title = diary.title;
        const meta = {
          title: this.song.title, date: this.date, genre: `${this.song.genre}`, key: `${this.song.keyName} ${this.song.scaleKo}`, bpm: this.song.bpm,
          styleKo, moodKo: H.moodWords(w.mood).ko, keywords: w.keywords.slice(0, 8).map((k) => k.w), artist: app.settings.petName,
          you: this.log.notes || this.log.splash || this.log.rhythm || this.log.whispers.length ? `with you: ${[this.log.notes ? this.log.notes + ' notes' : '', this.log.splash ? this.log.splash + ' splashes' : '', this.log.rhythm ? 'rhythm' : '', this.log.whispers.length ? 'whispers' : ''].filter(Boolean).join(', ')}` : '',
        };
        const poster = H.renderPoster(this.artPlan, meta, app.settings.creation.posterSize);
        const raw = H.renderArt(this.artPlan, app.settings.creation.posterSize);
        const posterBytes = await canvasBytes(poster);
        const rawBytes = await canvasBytes(raw);
        step('video', 0.65);
        let mp4 = null;
        if (this.recording && this.timelapse.active) {
          const end = this.recCanvas.getContext('2d');
          H.drawEndCard(end, 1280, 720, poster, meta);
          const songSec = H.songDuration(this.song);
          const remain = Math.max(2, songSec - this.timelapse.seconds);
          await this.timelapse.hold(this.recCanvas, Math.min(remain, 60));
          mp4 = await this.timelapse.finish(buf);
        }
        step('save', 0.9);
        const diaryMd = `# ${this.song.title}\n\n_${this.date} · ${app.settings.petName}_\n\n${diary.diary}\n\n---\n\n- 장르: ${this.song.genreKo} (${H.GENRE[this.song.genreId].region})\n${this.song.styleKo ? `- 스타일: ${this.song.styleKo} — ${H.styleReason(this.styleChoice || { id: this.song.style, why: 'whim' }, w.mood)}\n- 악기: ${H.songInstKo(this.song)}\n` : ''}- 조성: ${this.song.keyName} ${this.song.scaleKo} · ${this.song.bpm} BPM · ${this.song.timeSig}\n- 그림: ${styleKo}\n- 오늘의 키워드: ${w.keywords.slice(0, 12).map((k) => k.w).join(', ')}\n- 기분: ${H.moodWords(w.mood).ko} (valence ${w.mood.valence.toFixed(2)}, arousal ${w.mood.arousal.toFixed(2)})\n${w.weather ? `- 날씨: ${w.weather.ko} ${Math.round(w.weather.temp)}°C\n` : ''}\n## 오늘 읽은 소식\n\n${w.headlines.slice(0, 12).map((h) => `- ${h.title} _(${h.source})_`).join('\n')}\n`;
        const record = {
          title: this.song.title, date: this.date, createdAt: Date.now(), extra: this.extra,
          genreId: this.song.genreId, genre: this.song.genre, genreKo: this.song.genreKo, region: H.GENRE[this.song.genreId].region,
          musicStyle: this.song.style || null, musicStyleKo: this.song.styleKo || null, styleWhy: this.styleChoice ? this.styleChoice.why : null, insts: this.song.insts,
          key: this.song.keyName, scale: this.song.scaleKo, bpm: this.song.bpm, timeSig: this.song.timeSig, durationSec: Math.round(buf.duration),
          style: this.artPlan.style, styleKo, mood: w.mood, moodKo: H.moodWords(w.mood).ko, keywords: w.keywords.slice(0, 16).map((k) => k.w),
          headlines: w.headlines.slice(0, 12).map((h) => ({ title: h.title, source: h.source })), weather: w.weather,
          log: this.log, diary: diary.diary, diaryBy: diary.by, petName: app.settings.petName, motifs: this.song.motifs,
          files: { mp3: 'music.mp3', png: 'art.png', raw: 'art_square.png', mp4: mp4 ? 'process.mp4' : null, md: 'diary.md' },
        };
        const files = [
          { name: 'music.mp3', data: mp3 }, { name: 'art.png', data: posterBytes }, { name: 'art_square.png', data: rawBytes },
          { name: 'diary.md', data: diaryMd }, { name: 'meta.json', data: JSON.stringify(record, null, 2) },
        ];
        if (mp4) files.push({ name: 'process.mp4', data: mp4 });
        const folder = `${this.date}_${H.timeKey()}_${slug(this.song.title)}`;
        const saved = await app.saveWork(folder, files);
        record.folder = saved && saved.path;
        step('done', 1);
        this.state = 'done';
        this.result = { record, buf, poster };
        app.state.creation = null;
        app.onCreationDone(this, record);
      } catch (e) {
        console.error('finalize failed', e);
        this.state = 'done';
        app.state.creation = null;
        app.toast('작품 저장 중 문제가 생겼어요: ' + (e.message || e), 'error');
        H.emit('creation:finalizing', { step: 'error', error: String(e) });
      }
    }

    cancel() {
      this.timelapse.cancel();
      this.state = 'idle';
      this.app.audio.stop();
      this.app.state.creation = null;
      this.app.saveState();
      H.emit('creation:cancel');
    }

    persist() {
      if (!this.active || this.state === 'finalizing') return;
      this.app.state.creation = {
        date: this.date, seed: this.seed, elapsed: this.elapsed, totalMs: this.totalMs, extra: this.extra,
        world: this.world ? Object.assign({}, this.world) : null,
        genreId: this.plan && this.plan.genreId, styleId: this.plan && this.plan.styleId, scale: this.plan && this.plan.scale, root: this.plan && this.plan.root, title: this.song && this.song.title,
        interventions: this.interventions, log: this.log,
      };
      this.app.saveState();
    }

    async resume(saved) {
      await this.start({ seed: saved.seed, elapsed: saved.elapsed, world: saved.world, extra: saved.extra, log: saved.log, interventions: saved.interventions, genreId: saved.genreId, styleId: saved.styleId, scale: saved.scale, root: saved.root, title: saved.title });
      this.date = saved.date;
      this.totalMs = saved.totalMs || this.totalMs;
      if (!saved.world) return;
      const pi = this.phaseInfo;
      if (pi.i === 3) this.app.painter.advance(pi.local);
    }
  }

  function slug(s) { return String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 40) || 'untitled'; }
  function canvasBytes(c) { return new Promise((res) => c.toBlob(async (b) => res(new Uint8Array(await b.arrayBuffer())), 'image/png')); }
  H.canvasBytes = canvasBytes;

  H.Creation = Creation;
})(window.H);
