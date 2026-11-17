/* HARU ??sound: procedural instruments, drums, ambience, live scheduler, offline render */
(function (H) {
  'use strict';

  const TRACK_GAIN = { lead: 0.8, lead2: 0.72, chord: 0.42, pad: 0.3, bass: 0.75, arp: 0.38, counter: 0.45 };
  /* stereo seat + reverb send per track (a clean, wide mix instead of everything dead-centre) */
  const SEAT = { lead: [0.04, 0.32], lead2: [-0.1, 0.36], chord: [-0.24, 0.22], pad: [0.18, 0.5], bass: [0, 0.02], arp: [0.32, 0.3], counter: [-0.36, 0.34], drum: [0, 0.07] };
  /* echo send per track (tempo-synced stereo delay) */
  const ECHO = { lead: 0.16, lead2: 0.2, arp: 0.24, counter: 0.14, chord: 0.05 };

  function noiseBuffer(ctx, sec = 2, type = 'white') {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w;
    }
    return buf;
  }

  function crackleBuffer(ctx, sec = 4) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.0009) { const a = (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? -1 : 1); for (let k = 0; k < 30 && i + k < len; k++) d[i + k] += a * Math.exp(-k / 5); }
      d[i] += (Math.random() * 2 - 1) * 0.012;
    }
    return buf;
  }

  /* smooth "clean hall" impulse: short pre-delay, early reflections, damped exponential tail */
  function impulse(ctx, sec = 2.3, decay = 3.0) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.018);
    const buf = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const x = (i - pre) / (len - pre);
        /* damping: the tail gets darker as it decays (one-pole lowpass with falling cutoff) */
        const k = 0.55 - 0.45 * x;
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x, decay) * (i - pre < 300 ? (i - pre) / 300 : 1);
      }
      [0.011, 0.019, 0.027, 0.041].forEach((t, j) => { const i = pre + Math.floor(sr * (t + c * 0.0031)); if (i < len) d[i] += (0.5 - j * 0.09) * (j % 2 ? -1 : 1); });
    }
    return buf;
  }

  /* ================= sample bank (CC0 / CC BY recordings, see assets/samples/CREDITS.md) ================= */
  const bank = { manifest: null, buffers: {}, loading: {}, decodeCtx: null };
  async function readBytes(rel) {
    if (window.haru && window.haru.readAsset) return window.haru.readAsset(rel);
    try { const r = await fetch('assets/' + rel); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch (e) { return null; }
  }
  async function manifest() {
    if (bank.manifest) return bank.manifest;
    if (!bank.mLoading) {
      bank.mLoading = readBytes('samples/manifest.json')
        .then((b) => { bank.manifest = b ? JSON.parse(new TextDecoder().decode(b)) : { instruments: {}, drums: {} }; return bank.manifest; })
        .catch(() => { bank.manifest = { instruments: {}, drums: {} }; return bank.manifest; });
    }
    return bank.mLoading;
  }
  /* decode once at 32 kHz mono (AudioBuffers are shareable between live and offline contexts) */
  async function decode(rel, sr = 32000) {
    const bytes = await readBytes('samples/' + rel);
    if (!bytes) { console.warn('sample missing', rel); return null; }
    bank.decodeCtx = bank.decodeCtx || {};
    const dc = bank.decodeCtx[sr] = bank.decodeCtx[sr] || new OfflineAudioContext(1, sr, sr);
    try { return await dc.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)); } catch (e) { console.warn('sample decode failed', rel, e && e.message); return null; }
  }
  function loadKey(key, files) {
    if (bank.buffers[key]) return Promise.resolve(bank.buffers[key]);
    /* drums keep full bandwidth (crisp hats); pitched instruments are decoded at 32 kHz to save memory */
    const sr = key.startsWith('d:') ? 44100 : 32000;
    if (!bank.loading[key]) bank.loading[key] = Promise.all(files.map((f) => decode(f, sr))).then((bufs) => { bank.buffers[key] = bufs; return bufs; });
    return bank.loading[key];
  }
  H.samples = {
    /* names: sampled instrument ids and/or 'drums' */
    async ensure(names) {
      const m = await manifest();
      const jobs = [];
      new Set(names).forEach((n) => {
        if (n === 'drums') Object.entries(m.drums).forEach(([d, e]) => jobs.push(loadKey('d:' + d, e.files)));
        else if (m.instruments[n]) jobs.push(loadKey('i:' + n, m.instruments[n].zones.map((z) => z.file)));
      });
      await Promise.all(jobs);
    },
    has(name) { return !!bank.buffers['i:' + name]; },
    list() { return bank.manifest ? Object.keys(bank.manifest.instruments) : []; },
    zone(name, midi) {
      const m = bank.manifest, bufs = bank.buffers['i:' + name];
      if (!m || !bufs || !m.instruments[name]) return null;
      const zs = m.instruments[name].zones;
      let best = -1, bd = 1e9;
      /* prefer pitching a sample down slightly (keeps attacks natural) */
      zs.forEach((z, i) => { if (!bufs[i]) return; const dd = midi - z.midi; const cost = dd > 0 ? dd * 1.3 : -dd; if (cost < bd) { bd = cost; best = i; } });
      return best < 0 ? null : { buf: bufs[best], midi: zs[best].midi + (zs[best].cents || 0) / 100 };
    },
    drum(name) { const b = (bank.buffers['d:' + name] || []).filter(Boolean); if (!b.length) return null; return b[Math.floor(Math.random() * b.length)]; },
  };

  /* how each sampled instrument behaves: attack, release, sustained?, tone (lowpass at full velocity), gain */
  const SAMPLED = {
    piano: { a: 0.002, r: 0.35, g: 1.0, tone: 9000, ko: '그랜드 피아노' },
    epiano: { a: 0.002, r: 0.3, g: 0.9, tone: 7000, ko: 'FM 일렉 피아노' },
    vibes: { a: 0.002, r: 0.6, g: 0.8, tone: 9000, ko: '비브라폰' },
    marimba: { a: 0.001, r: 0.2, g: 0.9, tone: 9000, ko: '마림바' },
    glock: { a: 0.001, r: 0.6, g: 0.42, tone: 12000, ko: '글로켄슈필' },
    kalimba: { a: 0.001, r: 0.3, g: 0.8, tone: 9000, ko: '칼림바' },
    sax: { a: 0.03, r: 0.18, g: 0.7, tone: 6000, sus: true, ko: '테너 색소폰' },
    strings: { a: 0.18, r: 0.6, g: 0.7, tone: 7000, sus: true, ko: '현악 앙상블' },
    pizz: { a: 0.001, r: 0.15, g: 0.9, tone: 8000, ko: '피치카토' },
    upright: { a: 0.002, r: 0.12, g: 1.1, tone: 3000, ko: '콘트라베이스' },
    harp: { a: 0.001, r: 0.5, g: 0.85, tone: 9000, ko: '하프' },
    flute: { a: 0.05, r: 0.2, g: 0.6, tone: 8000, sus: true, ko: '플루트' },
    clarinet: { a: 0.04, r: 0.15, g: 0.65, tone: 6000, sus: true, ko: '클라리넷' },
    trumpet: { a: 0.015, r: 0.12, g: 0.55, tone: 7000, sus: true, ko: '트럼펫' },
    horn: { a: 0.06, r: 0.3, g: 0.6, tone: 5000, sus: true, ko: '호른' },
    ebass: { a: 0.002, r: 0.08, g: 1.1, tone: 2600, ko: '일렉 베이스' },
    nylon: { a: 0.001, r: 0.25, g: 0.9, tone: 7000, ko: '나일론 기타' },
    acoustic: { a: 0.001, r: 0.25, g: 0.8, tone: 8000, ko: '어쿠스틱 기타' },
    eguitar: { a: 0.001, r: 0.2, g: 0.7, tone: 5000, ko: '일렉 기타 (클린)' },
  };
  /* synth names that should use a recording when one is loaded */
  const PREFER = { piano: 'piano', epiano: 'epiano', nylon: 'nylon', flute: 'flute', clarinet: 'clarinet', brass: 'trumpet', strings: 'strings', kalimba: 'kalimba', marimba: 'marimba', upright: 'upright', bass: 'ebass', bell: 'vibes' };
  H.SAMPLED = SAMPLED;
  H.sampleFor = (name) => (SAMPLED[name] ? name : PREFER[name]) || null;
  const SYNTH_KO = { chip: '칩 사운드(네모파)', chipbass: '칩 베이스(삼각파)', pad: '신스 패드', synthlead: '신스 리드', pluck: '신스 플럭', organ: '오르간', bandoneon: '반도네온', tanpura: '탄푸라', sitar: '시타르', oud: '우드', gayageum: '가야금', metal: '메탈 공', whistle: '휘슬', synthbass: '신스 베이스', sub: '서브 베이스', logdrum: '로그 드럼', drone: '드론' };
  H.instKo = (name) => { const id = H.sampleFor(name); return (id && SAMPLED[id].ko) || SYNTH_KO[name] || name; };

  /* drum names used by patterns → sampled kit voices (layered with a soft synth body where it helps) */
  H.DEFAULT_KIT = { k: 'kick', s: 'snare', h: 'hat', o: 'hatOpen', c: 'clap', r: 'rim', sh: 'shaker', cl: 'claves', cg: 'congaHi', cgl: 'congaLo', bell: 'agogo', tbl: 'frameLo', tk: 'tomLo', tam: 'tamb', gong: 'gong', log: 'slit', crash: 'crash' };
  const KIT_GAIN = { kick: 0.7, snare: 0.5, snareSoft: 0.6, hat: 0.3, hatOpen: 0.26, clap: 0.42, rim: 0.4, shaker: 0.3, tamb: 0.3, claves: 0.38, congaHi: 0.55, congaLo: 0.6, bongo: 0.5, agogo: 0.32, cowbell: 0.28, darbuka: 0.55, frameLo: 0.7, tomLo: 0.6, slit: 0.6, crash: 0.26, gong: 0.45, triangle: 0.28 };

  /* ================= voices (work on any BaseAudioContext) ================= */
  H.makeVoices = function (ctx) {
    const NB = noiseBuffer(ctx, 2);
    const nodes = {
      osc(type, f, t) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; },
      gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; },
      filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
      noise(t, dur) { const s = ctx.createBufferSource(); s.buffer = NB; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; },
    };
    const { osc, gain, filt } = nodes;

    /* amp envelope helper: returns gain node, schedules ADSR */
    function amp(t, dur, peak, a, d, s, rel) {
      const g = gain(0);
      const p = Math.max(0.0001, peak);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p, t + a);
      g.gain.setTargetAtTime(p * s, t + a, Math.max(0.01, d / 3));
      const endT = t + Math.max(a + 0.01, dur);
      g.gain.setTargetAtTime(0.0001, endT, Math.max(0.01, rel / 4));
      /* terminate the automation timeline, otherwise the node is processed forever */
      g.gain.setValueAtTime(0, endT + rel + 0.04);
      return { g, end: endT + rel + 0.05 };
    }
    function start(oscs, end, tail, t0) {
      oscs.forEach((o) => { o.start(t0); o.stop(end); });
      if (tail && oscs[0]) oscs[0].onended = () => { try { tail.disconnect(); } catch (e) { /* */ } };
    }

    function fm(t, f, dur, v, out, ratio, index, decay, opts = {}) {
      const c = osc(opts.wave || 'sine', f, t), m = osc('sine', f * ratio, t);
      const mg = gain(f * index);
      mg.gain.setValueAtTime(f * index, t);
      mg.gain.exponentialRampToValueAtTime(Math.max(1, f * index * (opts.indexFloor ?? 0.08)), t + Math.max(0.05, decay * 0.6));
      m.connect(mg); mg.connect(c.frequency);
      const e = amp(t, opts.hold ? dur : Math.min(dur, decay), v, opts.a ?? 0.004, decay, opts.sus ?? 0.15, opts.rel ?? decay * 0.6);
      c.connect(e.g); e.g.connect(out);
      const extra = [];
      if (opts.beat) { const b = osc('sine', f + opts.beat, t); const bg = gain(0.5); b.connect(bg); bg.connect(e.g); extra.push(b); }
      start([c, m, ...extra], e.end, e.g, t);
    }

    function subtractive(t, f, dur, v, out, o) {
      const oscs = (o.waves || ['sawtooth']).map((w, i) => { const x = osc(w, f * (o.mults ? o.mults[i] : 1), t); x.detune.value = (o.detune || 0) * (i % 2 ? 1 : -1) * (i ? 1 : 0); return x; });
      /* static filters only: brightness movement = crossfade between a bright and a dark path
         (automating biquad frequency is very expensive in Chromium) */
      const e = amp(t, dur, v, o.a ?? 0.01, o.d ?? 0.3, o.s ?? 0.6, o.r ?? 0.2);
      const mix = gain(1 / Math.sqrt(oscs.length));
      oscs.forEach((x) => x.connect(mix));
      const ny = ctx.sampleRate * 0.45;
      if (o.fEnd) {
        const start = Math.min(ny, f * (o.fStart || 6)), end = Math.min(ny, f * o.fEnd);
        const bright = filt(o.ft || 'lowpass', Math.max(start, end), o.q || 0.8);
        const dark = filt(o.ft || 'lowpass', Math.min(start, end), o.q || 0.8);
        const gb = gain(0), gd = gain(0);
        const opening = end > start;
        const t0 = t + (o.fDelay || 0.005), tc = Math.max(0.01, o.fTime || 0.15);
        gb.gain.setValueAtTime(opening ? 0 : 1, t); gb.gain.setTargetAtTime(opening ? 1 : 0, t0, tc);
        gd.gain.setValueAtTime(opening ? 1 : 0, t); gd.gain.setTargetAtTime(opening ? 0 : 1, t0, tc);
        mix.connect(bright); mix.connect(dark); bright.connect(gb); dark.connect(gd); gb.connect(e.g); gd.connect(e.g);
      } else {
        const fl = filt(o.ft || 'lowpass', Math.min(ny, f * (o.fStart || 6)), o.q || 0.8);
        mix.connect(fl); fl.connect(e.g);
      }
      e.g.connect(out);
      const extra = [];
      if (o.vib) {
        const l = osc('sine', o.vib[0], t); const lg = gain(0); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * o.vib[1], t + (o.vib[2] ?? 0.25));
        l.connect(lg); oscs.forEach((x) => lg.connect(x.frequency)); extra.push(l);
      }
      if (o.bendFrom) oscs.forEach((x, i) => { const base = f * (o.mults ? o.mults[i] : 1); x.frequency.setValueAtTime(base * o.bendFrom, t); x.frequency.exponentialRampToValueAtTime(base, t + (o.bendTime || 0.08)); });
      if (o.breath) { const n = nodes.noise(t, dur + (o.r || 0.2)); const nf = filt('bandpass', f * 2, 1.5); const ng = gain(o.breath); n.connect(nf); nf.connect(ng); ng.connect(e.g); }
      start([...oscs, ...extra], e.end, e.g, t);
    }

    const insts = {
      epiano: (t, f, d, v, out) => { fm(t, f, d, v * 0.55, out, 1, 1.6, 1.8, { sus: 0.25, rel: 0.5, hold: true }); fm(t, f * 2, d, v * 0.08, out, 1, 0.5, 0.6, {}); },
      piano: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.5, out, { waves: ['triangle', 'sine'], mults: [1, 2], fStart: 10, fEnd: 2.5, fTime: 0.4, a: 0.003, d: 1.2, s: 0.2, r: 0.4 }); },
      nylon: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.55, out, { waves: ['triangle', 'sawtooth'], mults: [1, 1], fStart: 7, fEnd: 1.6, fTime: 0.12, a: 0.002, d: 0.7, s: 0.1, r: 0.35 }); },
      pluck: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.45, out, { waves: ['triangle', 'sawtooth'], mults: [1, 1], fStart: 6, fEnd: 1.3, fTime: 0.08, q: 0.9, a: 0.002, d: 0.35, s: 0.05, r: 0.2 }); },
      flute: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.5, out, { waves: ['sine', 'triangle'], mults: [1, 2], fStart: 5, a: 0.07, d: 0.2, s: 0.85, r: 0.15, vib: [5.2, 0.008, 0.3], breath: 0.15 }); },
      whistle: (t, f, d, v, out) => { subtractive(t, f * 2, d, v * 0.4, out, { waves: ['sine'], fStart: 6, a: 0.03, d: 0.1, s: 0.9, r: 0.08, vib: [6.5, 0.01, 0.15], breath: 0.1, bendFrom: 0.97, bendTime: 0.05 }); },
      clarinet: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.35, out, { waves: ['square'], fStart: 3.5, q: 1.2, a: 0.03, d: 0.2, s: 0.8, r: 0.12, vib: [5, 0.005, 0.3] }); },
      brass: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.4, out, { waves: ['sawtooth', 'sawtooth'], detune: 7, fStart: 1.5, fEnd: 5, fTime: 0.06, q: 1.5, a: 0.03, d: 0.25, s: 0.7, r: 0.12, vib: [5.5, 0.004, 0.35] }); },
      organ: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.32, out, { waves: ['sine', 'sine', 'sine', 'sine'], mults: [1, 2, 3, 4], fStart: 12, a: 0.008, d: 0.05, s: 1, r: 0.06, vib: [6.8, 0.002, 0.05] }); },
      synthlead: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.3, out, { waves: ['sawtooth', 'triangle'], detune: 6, fStart: 1.6, fEnd: 3.6, fTime: 0.12, q: 0.9, a: 0.01, d: 0.25, s: 0.6, r: 0.18, vib: [5.5, 0.006, 0.3] }); },
      bandoneon: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.3, out, { waves: ['sawtooth', 'square'], mults: [1, 2], detune: 12, ft: 'bandpass', fStart: 3, q: 0.9, a: 0.05, d: 0.2, s: 0.85, r: 0.15, vib: [4, 0.003, 0.5] }); },
      strings: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.25, out, { waves: ['sawtooth', 'sawtooth', 'sawtooth'], detune: 11, fStart: 4, q: 0.5, a: 0.35, d: 0.5, s: 0.8, r: 0.8, vib: [5, 0.003, 0.6] }); },
      pad: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.25, out, { waves: ['triangle', 'sine', 'sawtooth'], detune: 9, fStart: 1.6, fEnd: 2.6, fTime: 1.5, q: 0.5, a: 0.7, d: 1, s: 0.8, r: 1.4 }); },
      tanpura: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.25, out, { waves: ['sawtooth'], ft: 'bandpass', fStart: 8, fEnd: 3, fTime: 1.2, q: 4, a: 0.02, d: 2, s: 0.5, r: 1.5 }); },
      sitar: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.4, out, { waves: ['sawtooth', 'sawtooth'], mults: [1, 2.003], ft: 'bandpass', fStart: 6, fEnd: 2.5, fTime: 0.5, q: 6, a: 0.003, d: 1.4, s: 0.2, r: 0.6, bendFrom: 0.96, bendTime: 0.12, vib: [6, 0.004, 0.5] }); },
      oud: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.5, out, { waves: ['triangle', 'sawtooth'], fStart: 5, fEnd: 1.2, fTime: 0.1, q: 1.5, a: 0.002, d: 0.45, s: 0.08, r: 0.25, bendFrom: 1.015, bendTime: 0.05 }); },
      gayageum: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.5, out, { waves: ['triangle', 'sawtooth'], fStart: 6, fEnd: 1.5, fTime: 0.15, q: 1.2, a: 0.002, d: 0.9, s: 0.12, r: 0.5, vib: [5.5, 0.012, 0.45], bendFrom: 0.985, bendTime: 0.1 }); },
      bell: (t, f, d, v, out) => fm(t, f, d, v * 0.35, out, 3.5, 2.5, 2.2, { rel: 1.5 }),
      metal: (t, f, d, v, out) => fm(t, f, d, v * 0.35, out, 2.76, 1.4, 1.8, { rel: 1.2, beat: 3.5 }),
      kalimba: (t, f, d, v, out) => fm(t, f, d, v * 0.45, out, 7, 0.9, 1.1, { rel: 0.6 }),
      marimba: (t, f, d, v, out) => fm(t, f, d, v * 0.5, out, 4, 0.8, 0.5, { rel: 0.3 }),
      bass: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.7, out, { waves: ['sine', 'triangle'], fStart: 8, fEnd: 4, q: 0.7, a: 0.006, d: 0.3, s: 0.7, r: 0.08 }); },
      upright: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.75, out, { waves: ['triangle', 'sine'], fStart: 6, fEnd: 2, fTime: 0.12, a: 0.004, d: 0.5, s: 0.25, r: 0.12 }); },
      synthbass: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.5, out, { waves: ['sawtooth'], fStart: 10, fEnd: 2.5, fTime: 0.08, q: 4, a: 0.004, d: 0.2, s: 0.5, r: 0.06 }); },
      sub: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.9, out, { waves: ['sine'], fStart: 20, a: 0.004, d: 0.8, s: 0.7, r: 0.15, bendFrom: 1.6, bendTime: 0.04 }); },
      logdrum: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.8, out, { waves: ['sine', 'triangle'], fStart: 6, a: 0.003, d: 0.35, s: 0.3, r: 0.1, bendFrom: 1.9, bendTime: 0.05 }); },
      chip: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.22, out, { waves: ['square'], fStart: 30, a: 0.002, d: 0.08, s: 0.7, r: 0.04 }); },
      chipbass: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.7, out, { waves: ['triangle'], fStart: 30, a: 0.002, d: 0.1, s: 0.9, r: 0.03 }); },
      drone: (t, f, d, v, out) => { subtractive(t, f, d, v * 0.35, out, { waves: ['sawtooth', 'sawtooth'], detune: 6, fStart: 3, q: 0.5, a: 0.6, d: 1, s: 0.8, r: 1.5 }); },
    };

    /* ---------- drums ---------- */
    function noiseHit(t, v, out, ft, f, q, dec, peak = 1) {
      const n = nodes.noise(t, dec + 0.05); const fl = filt(ft, f, q); const g = gain(0);
      g.gain.setValueAtTime(peak * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      n.connect(fl); fl.connect(g); g.connect(out);
    }
    function toneHit(t, v, out, f0, f1, dec, type = 'sine', bendT = 0.05, peak = 1) {
      const o = osc(type, f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + bendT);
      const g = gain(0); g.gain.setValueAtTime(peak * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + 0.05);
    }
    const drums = {
      k: (t, v, out) => { toneHit(t, v, out, 150, 45, 0.45, 'sine', 0.07, 1.1); noiseHit(t, v, out, 'lowpass', 1500, 0.7, 0.02, 0.3); },
      s: (t, v, out) => { toneHit(t, v, out, 230, 160, 0.12, 'triangle', 0.03, 0.5); noiseHit(t, v, out, 'bandpass', 2400, 0.8, 0.18, 0.8); },
      h: (t, v, out) => noiseHit(t, v, out, 'highpass', 8000, 0.8, 0.045, 0.32),
      o: (t, v, out) => noiseHit(t, v, out, 'highpass', 7000, 0.8, 0.3, 0.28),
      c: (t, v, out) => { [0, 0.011, 0.023].forEach((dt) => noiseHit(t + dt, v, out, 'bandpass', 1300, 1.4, dt === 0.023 ? 0.16 : 0.02, 0.8)); },
      r: (t, v, out) => { toneHit(t, v, out, 1700, 1600, 0.04, 'square', 0.01, 0.25); noiseHit(t, v, out, 'bandpass', 3000, 3, 0.03, 0.3); },
      sh: (t, v, out) => noiseHit(t, v, out, 'highpass', 5500, 0.6, 0.06, 0.22),
      tam: (t, v, out) => { noiseHit(t, v, out, 'highpass', 6500, 0.8, 0.09, 0.25); toneHit(t, v, out, 5200, 5000, 0.05, 'square', 0.02, 0.04); },
      cl: (t, v, out) => toneHit(t, v, out, 2500, 2450, 0.06, 'sine', 0.01, 0.55),
      cg: (t, v, out) => toneHit(t, v, out, 420, 330, 0.18, 'sine', 0.03, 0.7),
      cgl: (t, v, out) => toneHit(t, v, out, 260, 200, 0.25, 'sine', 0.04, 0.75),
      bell: (t, v, out) => { toneHit(t, v, out, 800, 800, 0.25, 'square', 0.01, 0.12); toneHit(t, v, out, 540, 540, 0.25, 'square', 0.01, 0.12); },
      tb: (t, v, out) => { toneHit(t, v, out, 520, 560, 0.22, 'sine', 0.06, 0.55); noiseHit(t, v, out, 'bandpass', 3000, 2, 0.02, 0.2); },
      tbl: (t, v, out) => toneHit(t, v, out, 90, 140, 0.5, 'sine', 0.18, 0.9),
      tk: (t, v, out) => { toneHit(t, v, out, 110, 70, 0.4, 'sine', 0.08, 1); noiseHit(t, v, out, 'lowpass', 800, 0.7, 0.05, 0.3); },
      jg: (t, v, out) => { toneHit(t, v, out, 330, 280, 0.12, 'triangle', 0.02, 0.5); noiseHit(t, v, out, 'bandpass', 1800, 1.2, 0.07, 0.5); },
      gong: (t, v, out) => { fmGong(t, v, out); },
      log: (t, v, out) => toneHit(t, v, out, 180, 120, 0.3, 'sine', 0.06, 0.8),
    };
    function fmGong(t, v, out) {
      const c = osc('sine', 98, t), m = osc('sine', 98 * 1.41, t), mg = gain(60);
      m.connect(mg); mg.connect(c.frequency);
      const g = gain(0); g.gain.setValueAtTime(0.6 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      c.connect(g); g.connect(out); c.start(t); m.start(t); c.stop(t + 4.1); m.stop(t + 4.1);
    }

    /* one recorded note: nearest zone, repitched by playbackRate; velocity drives level and brightness */
    function sampled(id, t, midi, dur, v, out) {
      const z = H.samples.zone(id, midi);
      if (!z) return false;
      const o = SAMPLED[id] || {};
      const src = ctx.createBufferSource(); src.buffer = z.buf;
      const rate = Math.pow(2, (midi - z.midi) / 12);
      src.playbackRate.value = rate;
      const left = z.buf.duration / rate;
      const vel = H.clamp(v, 0.02, 1.2);
      const g = gain(0);
      const peak = Math.pow(vel, 1.35) * (o.g || 1) * 0.9;
      const a = o.a || 0.002;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
      /* sustained instruments hold for the note; struck ones ring a little past it, then get damped */
      const hold = o.sus ? Math.min(dur, left - 0.05) : Math.min(left, Math.max(dur, 0.12) + 0.18);
      const endT = t + Math.max(a + 0.02, hold);
      const rel = o.r || 0.2;
      g.gain.setValueAtTime(peak, endT); g.gain.setTargetAtTime(0.0001, endT, rel / 3);
      g.gain.setValueAtTime(0, endT + rel * 1.6);
      if (o.tone && o.tone < 4000) { const lp = filt('lowpass', o.tone * (0.5 + 0.5 * Math.min(1, vel)), 0.5); src.connect(lp); lp.connect(g); }
      else src.connect(g);
      g.connect(out);
      src.start(t); src.stop(endT + rel * 1.6 + 0.02);
      src.onended = () => { try { g.disconnect(); } catch (e) { /* */ } };
      return true;
    }
    function sampledHit(name, t, v, out) {
      const buf = H.samples.drum(name);
      if (!buf) return false;
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.02;
      const g = gain(Math.pow(H.clamp(v, 0, 1.2), 1.2) * (KIT_GAIN[name] || 0.5));
      src.connect(g); g.connect(out); src.start(t);
      src.onended = () => { try { g.disconnect(); } catch (e) { /* */ } };
      return true;
    }
    /* a clean, round kick body under the recorded (concert) bass drum */
    function softKick(t, v, out) { toneHit(t, v, out, 110, 48, 0.3, 'sine', 0.06, 0.8); }

    return {
      play(name, t, midi, durSec, v, out) {
        const id = H.sampleFor(name);
        if (id && sampled(id, t, midi, durSec, v, out)) return;
        (insts[name] || insts.epiano)(t, H.midiFreq(midi), durSec, v, out);
      },
      /* kit: pattern name → sample voice (missing/null = synth voice) */
      hit(name, t, v, out, kit, crash) {
        const k = kit || H.DEFAULT_KIT;
        const sn = crash ? k.crash : k[name];
        if (sn && sampledHit(sn, t, v, out)) { if (name === 'k' && !crash) softKick(t, v * (k.kickBody ?? 0.8), out); return; }
        (drums[name] || drums.h)(t, v, out);
      },
      nodes,
    };
  };

  /* ---------- master chain (shared live/offline) ---------- */
  function makeChain(ctx, dest, fx) {
    const input = ctx.createGain(); input.gain.value = 1;
    const wobble = ctx.createDelay(0.05); wobble.delayTime.value = 0.012;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.45; const wlg = ctx.createGain(); wlg.gain.value = 0;
    wl.connect(wlg); wlg.connect(wobble.delayTime); wl.start();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32;
    /* gentle "polish": a touch of warmth, slightly tamed air (no harsh fizz) */
    const warm = ctx.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 160; warm.gain.value = 1.2;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9500; air.gain.value = -2;
    const sat = ctx.createWaveShaper();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 2.2; comp.attack.value = 0.02; comp.release.value = 0.25;
    const out = ctx.createGain(); out.gain.value = 0.9;
    const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -4; limit.knee.value = 2; limit.ratio.value = 16; limit.attack.value = 0.003; limit.release.value = 0.12;
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx);
    const verbIn = ctx.createGain(); const verbOut = ctx.createGain();
    const verbHp = ctx.createBiquadFilter(); verbHp.type = 'highpass'; verbHp.frequency.value = 220;
    input.connect(wobble); wobble.connect(lp); lp.connect(hp); hp.connect(warm); warm.connect(air); air.connect(sat); sat.connect(comp); comp.connect(out); out.connect(limit); limit.connect(dest);
    verbIn.connect(verbHp); verbHp.connect(verb); verb.connect(verbOut); verbOut.connect(comp);
    /* ping-pong echo: dotted-eighth left, quarter right, darkened feedback */
    const echoIn = ctx.createGain(); echoIn.gain.value = 1;
    const dL = ctx.createDelay(2), dR = ctx.createDelay(2), fb = ctx.createGain(), eLp = ctx.createBiquadFilter(), eHp = ctx.createBiquadFilter();
    eLp.type = 'lowpass'; eLp.frequency.value = 3800; eHp.type = 'highpass'; eHp.frequency.value = 300; fb.gain.value = 0.32;
    const merge = ctx.createChannelMerger(2), eOut = ctx.createGain(); eOut.gain.value = 0.55;
    echoIn.connect(eHp); eHp.connect(dL); dL.connect(eLp); eLp.connect(dR); dR.connect(fb); fb.connect(dL);
    dL.connect(merge, 0, 0); dR.connect(merge, 0, 1); merge.connect(eOut); eOut.connect(comp); eOut.connect(verbIn);
    const chain = {
      input, out, comp, verbIn, echoIn,
      setTempo(bpm) { const q = 60 / (bpm || 100); dL.delayTime.value = H.clamp(q * 0.75, 0.05, 1.5); dR.delayTime.value = H.clamp(q * 0.25, 0.03, 1); },
      setFx(f) {
        const lofi = H.clamp(f.lofi ?? 0.2);
        lp.frequency.value = 18000 * Math.pow(1 - lofi, 2.2) + 2200;
        wlg.gain.value = lofi > 0.3 ? 0.0018 * lofi : 0;
        /* saturation only when the piece actually wants tape colour */
        if (lofi > 0.35) {
          const k = 1 + (lofi - 0.35) * 6;
          const curve = new Float32Array(1024);
          for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
          sat.curve = curve;
        } else sat.curve = null;
        air.gain.value = f.air ?? -2;
        verbIn.gain.value = H.clamp(f.reverb ?? 0.25) * 2.2;
        verbOut.gain.value = 0.6;
      },
    };
    chain.setFx(fx || {});
    return chain;
  }

  /* per-track buses: gain → pan → chain, plus a reverb send */
  function makeBuses(ctx, chain) {
    const b = {};
    Object.keys(SEAT).forEach((k) => {
      const g = ctx.createGain(); g.gain.value = k === 'drum' ? 0.9 : 1;
      const pan = ctx.createStereoPanner(); pan.pan.value = SEAT[k][0];
      const send = ctx.createGain(); send.gain.value = SEAT[k][1];
      g.connect(pan); pan.connect(chain.input); pan.connect(send); send.connect(chain.verbIn);
      if (ECHO[k]) { const es = ctx.createGain(); es.gain.value = ECHO[k]; pan.connect(es); es.connect(chain.echoIn); b[k + 'Echo'] = es; }
      b[k] = g; b[k + 'Pan'] = pan; b[k + 'Send'] = send;
    });
    b.setSeats = (seats = {}) => Object.keys(SEAT).forEach((k) => { const v = seats[k] || SEAT[k]; b[k + 'Pan'].pan.value = v[0]; b[k + 'Send'].gain.value = v[1]; });
    return b;
  }

  function stepTime(song, i, t0) {
    const sd = H.stepSec(song);
    const swingOff = song.beatSteps === 4 && i % 2 === 1 ? (song.swing - 0.5) * sd * 2 * 0.9 : 0;
    return t0 + i * sd + swingOff;
  }

  function scheduleEvent(voices, song, ev, t, sd, buses) {
    if (ev.n) {
      voices.hit(ev.n, t + (Math.random() - 0.5) * 0.004, ev.v * 0.85, buses.drum, song.kit, ev.crash);
    } else {
      const tr = ev.t || 'lead';
      const inst = song.insts[tr];
      if (!inst) return;
      const human = (Math.random() - 0.5) * 0.006;
      const v = ev.v * (TRACK_GAIN[tr] || 0.6) * (ev.by === 'you' ? 1.15 : 1);
      voices.play(inst, t + human, ev.p, ev.d * sd * 0.95, v, buses[tr] || buses.lead);
      /* octave doubling (e.g. glockenspiel over the piano lead) */
      if (tr === 'lead' && song.insts.double) voices.play(song.insts.double, t + human, ev.p + 12, Math.min(ev.d * sd, 0.6), v * 0.42, buses.arp);
    }
  }

  /* recorded instruments a song needs */
  H.songSamples = function (song) {
    const out = ['drums'];
    Object.values(song.insts || {}).forEach((n) => { const id = n && H.sampleFor(n); if (id) out.push(id); });
    return out;
  };

  /* ================= offline render ================= */
  H.renderSong = async function (song, opts = {}) {
    const sr = 44100;
    const dur = H.songDuration(song);
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const master = ctx.createGain(); master.connect(ctx.destination);
    master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(1, 0.05);
    master.gain.setValueAtTime(1, dur - 2.5); master.gain.linearRampToValueAtTime(0, dur - 0.1);
    const chain = makeChain(ctx, master, song.fx);
    const buses = makeBuses(ctx, chain); buses.setSeats(song.seats); chain.setTempo(song.bpm);
    await H.samples.ensure(H.songSamples(song)).catch(() => {});
    const voices = H.makeVoices(ctx);
    const sd = H.stepSec(song);
    if ((song.fx.lofi || 0) > 0.3) {
      const cr = ctx.createBufferSource(); cr.buffer = crackleBuffer(ctx); cr.loop = true;
      const cg = ctx.createGain(); cg.gain.value = 0.25 * song.fx.lofi; cr.connect(cg); cg.connect(master); cr.start(0); cr.stop(dur);
    }
    const t0 = 0.15;
    /* Schedule just-in-time with suspend(): pre-scheduling every voice makes Chromium
       process all pending nodes on every block (quadratic cost). */
    const WIN = 1.0;
    let nextStep = 0;
    const scheduleUntil = (tEnd) => {
      while (nextStep < song.totalSteps && stepTime(song, nextStep, t0) < tEnd) {
        const evs = song.byStep[nextStep];
        if (evs && evs.length) { const t = stepTime(song, nextStep, t0); evs.forEach((ev) => scheduleEvent(voices, song, ev, t, sd, buses)); }
        nextStep++;
      }
      if (nextStep >= song.totalSteps && !scheduleUntil.ringDone) {
        scheduleUntil.ringDone = true;
        const lastChord = song.chords[song.chords.length - 1];
        if (lastChord && song.insts.chord) lastChord.notes.forEach((p) => voices.play(song.insts.chord || 'pad', stepTime(song, song.totalSteps, t0), p, 1.8, 0.25, buses.chord));
      }
    };
    const hook = (tSusp) => {
      if (tSusp >= dur - 0.05) return;
      ctx.suspend(tSusp).then(() => {
        scheduleUntil(tSusp + WIN * 2);
        opts.onProgress && opts.onProgress(tSusp / dur);
        hook(tSusp + WIN);
        ctx.resume();
      });
    };
    scheduleUntil(WIN * 2);
    hook(WIN);
    const buf = await ctx.startRendering();
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > peak) peak = a; } }
    if (peak > 0.05) { const k = 0.89 / peak; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
    return buf;
  };

  /* ================= live engine ================= */
  class AudioEngine {
    constructor() { this.ctx = null; this.song = null; this.playing = false; this.queue = []; this.levels = { master: 0.8, music: 0.8, ambient: 0.5, sfx: 0.6 }; this.amb = {}; this.voicePitch = 1; this.voiceOn = true; }

    init() {
      if (this.ctx) return;
      const ctx = this.ctx = new AudioContext({ latencyHint: 'playback', sampleRate: 44100 });
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.7;
      this.splitter = ctx.createChannelSplitter(2);
      this.anL = ctx.createAnalyser(); this.anR = ctx.createAnalyser(); this.anL.fftSize = this.anR.fftSize = 1024;
      this.musicGain = ctx.createGain();
      this.chain = makeChain(ctx, this.musicGain, { lofi: 0.3, reverb: 0.3 });
      this.musicGain.connect(this.master);
      this.musicGain.connect(this.analyser);
      this.musicGain.connect(this.splitter); this.splitter.connect(this.anL, 0); this.splitter.connect(this.anR, 1);
      this.buses = makeBuses(ctx, this.chain);
      H.samples.ensure(['piano', 'epiano', 'ebass', 'strings', 'vibes', 'drums']).catch(() => {});
      this.ambGain = ctx.createGain(); this.ambGain.connect(this.master);
      this.sfxGain = ctx.createGain(); this.sfxGain.connect(this.master);
      this.voices = H.makeVoices(ctx);
            this.buildAmbience();
      this.applyLevels();
      this.timer = setInterval(() => this.tick(), 25);
      this.ambTimer = setInterval(() => this.ambientTick(), 120);
    }

    resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

    setLevels(l) { Object.assign(this.levels, l); this.applyLevels(); }
    applyLevels() {
      if (!this.ctx) return;
      const L = this.levels, t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(L.master, t, 0.05);
      this.musicGain.gain.setTargetAtTime(L.music, t, 0.05);
      this.ambGain.gain.setTargetAtTime(L.ambient, t, 0.2);
      this.sfxGain.gain.setTargetAtTime(L.sfx, t, 0.05);
    }

    /* ----- song playback ----- */
    play(song, opts = {}) {
      this.init(); this.resume();
      this.song = song; this.opts = opts;
      this.chain.setFx(Object.assign({}, song.fx, opts.lofi != null && song.lofiOk !== false ? { lofi: Math.max(song.fx.lofi, opts.lofi) } : {}));
      this.buses.setSeats(song.seats); this.chain.setTempo(song.bpm);
      H.samples.ensure(H.songSamples(song)).catch(() => {});
      this.step = opts.from ?? (opts.loop ? opts.loop[0] : 0);
      this.t0 = this.ctx.currentTime + 0.08 - this.step * H.stepSec(song);
      this.nextTime = this.ctx.currentTime + 0.08;
      this.playing = true;
      this.queue = [];
    }
    stop() { this.playing = false; this.queue = []; }
    setLoop(loop) { if (this.opts) this.opts.loop = loop; }
    setFilter(fn) { if (this.opts) this.opts.filter = fn; }

    tick() {
      if (!this.playing || !this.song || !this.ctx) return;
      const song = this.song, ctx = this.ctx;
      const sd = H.stepSec(song);
      let guard = 0;
      while (this.nextTime < ctx.currentTime + 0.15 && guard++ < 64) {
        const i = this.step;
        const evs = song.byStep[i] || [];
        const swingOff = song.beatSteps === 4 && i % 2 === 1 ? (song.swing - 0.5) * sd * 2 * 0.9 : 0;
        const t = Math.max(ctx.currentTime, this.nextTime + swingOff);
        const f = this.opts.filter;
        evs.forEach((ev) => { if (!f || f(ev)) scheduleEvent(this.voices, song, ev, t, sd, this.buses); });
        this.queue.push({ step: i, time: this.nextTime });
        if (this.queue.length > 64) this.queue.shift();
        this.nextTime += sd;
        this.step++;
        const loop = this.opts.loop;
        if (loop && this.step >= loop[1]) this.step = loop[0];
        if (this.step >= song.totalSteps) {
          if (this.opts.repeat) this.step = 0;
          else { this.playing = false; this.opts.onEnd && setTimeout(this.opts.onEnd, 1500); break; }
        }
      }
    }

    /* fractional step currently audible */
    get playStep() {
      if (!this.ctx || !this.queue.length) return -1;
      const now = this.ctx.currentTime;
      let cur = null;
      for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].time <= now) { cur = this.queue[i]; break; }
      if (!cur) return -1;
      return cur.step + H.clamp((now - cur.time) / H.stepSec(this.song), 0, 1);
    }

    /* ----- audition / sfx ----- */
    note(midi, inst = 'epiano', dur = 0.5, v = 0.6) { this.init(); this.resume(); this.voices.play(inst, this.ctx.currentTime + 0.01, midi, dur, v, this.buses.lead); }
    drum(name, v = 0.8, kit) { this.init(); this.resume(); this.voices.hit(name, this.ctx.currentTime + 0.01, v, this.buses.drum, kit || (this.song && this.song.kit)); }

    sfx(kind) {
      this.init(); this.resume();
      const ctx = this.ctx, t = ctx.currentTime + 0.01, out = this.sfxGain, V = this.voices;
      const blip = (f, dt, d = 0.08, type = 'sine', v = 0.25) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t + dt);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(v, t + dt + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + d);
        o.connect(g); g.connect(out); o.start(t + dt); o.stop(t + dt + d + 0.02);
      };
      switch (kind) {
        case 'click': blip(1800, 0, 0.03, 'triangle', 0.08); break;
        case 'pop': blip(600, 0, 0.06); blip(1200, 0.04, 0.08); break;
        case 'chime': [72, 76, 79, 84].forEach((m, i) => V.play('bell', t + i * 0.09, m, 0.8, 0.3, out)); break;
        case 'pat': blip(500, 0, 0.12, 'sine', 0.15); blip(650, 0.09, 0.12, 'sine', 0.12); break;
        case 'splash': { const n = V.nodes.noise(t, 0.4); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.35); const g = ctx.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38); n.connect(f); f.connect(g); g.connect(out); break; }
        case 'knock': [0, 0.14].forEach((dt) => { const o = ctx.createOscillator(); o.frequency.setValueAtTime(180, t + dt); o.frequency.exponentialRampToValueAtTime(80, t + dt + 0.06); const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.1); o.connect(g); g.connect(out); o.start(t + dt); o.stop(t + dt + 0.12); }); break;
        case 'munch': [0, 0.12, 0.24].forEach((dt) => { const n = V.nodes.noise(t + dt, 0.06); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.06); n.connect(f); f.connect(g); g.connect(out); }); break;
        case 'key': { const n = V.nodes.noise(t, 0.03); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 2500; f.Q.value = 2; const g = ctx.createGain(); g.gain.setValueAtTime(0.12 * (this.amb.keysLevel ?? 0.5), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); n.connect(f); f.connect(g); g.connect(out); break; }
        case 'brush': { const n = V.nodes.noise(t, 0.25); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); n.connect(f); f.connect(g); g.connect(out); break; }
        case 'page': { const n = V.nodes.noise(t, 0.3); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); n.connect(f); f.connect(g); g.connect(out); break; }
        default: blip(880, 0, 0.05);
      }
    }

    /* little syllable babble, the character's "voice" */
    babble(text, mood = 0) {
      if (!this.voiceOn) return;
      this.init(); this.resume();
      const ctx = this.ctx; let t = ctx.currentTime + 0.02;
      const chars = [...String(text).replace(/\s+/g, '')].slice(0, 22);
      const base = 520 * this.voicePitch * (1 + mood * 0.08);
      chars.forEach((ch, i) => {
        if (/[.,!???]/.test(ch)) { t += 0.07; return; }
        const c = ch.codePointAt(0);
        const f = base * Math.pow(2, ((c * 7) % 9 - 4) / 12) * (i === chars.length - 1 && /\?/.test(text) ? 1.2 : 1);
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.92, t + 0.05);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2400;
        o.connect(fl); fl.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + 0.07);
        t += 0.062;
      });
    }

    /* ----- ambience ----- */
    buildAmbience() {
      const ctx = this.ctx;
      const mk = (buf, filters, level = 0) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration);
        let node = s;
        filters.forEach((f) => { node.connect(f); node = f; });
        const g = ctx.createGain(); g.gain.value = level; node.connect(g); g.connect(this.ambGain);
        return g;
      };
      const F = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
      const white = noiseBuffer(ctx, 3), pink = noiseBuffer(ctx, 3, 'pink'), brown = noiseBuffer(ctx, 4, 'brown');
      this.amb.nodes = {
        rain: mk(pink, [F('highpass', 600), F('lowpass', 7000)]),
        vinyl: mk(crackleBuffer(ctx, 5), [F('bandpass', 2500, 0.4)]),
        wind: mk(brown, [F('bandpass', 500, 0.8)]),
        cafe: mk(brown, [F('bandpass', 380, 0.9)]),
        fire: mk(brown, [F('lowpass', 500)]),
        waves: mk(pink, [F('lowpass', 900)]),
        night: (() => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.ambGain); return g; })(),
        birds: (() => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.ambGain); return g; })(),
      };
      /* slow modulations */
      const lfo = (target, rate, depth, base) => { const o = ctx.createOscillator(); o.frequency.value = rate; const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(target); o.start(); return base; };
      this.amb.waveLfo = ctx.createGain();
      this.amb.wantLevels = {};
      void lfo; void white;
    }

    setAmbience(levels) {
      this.init();
      const t = this.ctx.currentTime;
      const scale = { rain: 0.5, vinyl: 0.9, wind: 0.7, cafe: 0.6, fire: 0.8, waves: 0.6, night: 1, birds: 1 };
      Object.keys(this.amb.nodes).forEach((k) => {
        const v = (levels[k] || 0) * (scale[k] || 1);
        this.amb.wantLevels[k] = v;
        if (k !== 'waves' && k !== 'wind') this.amb.nodes[k].gain.setTargetAtTime(v, t, 0.4);
      });
      this.amb.keysLevel = levels.keys ?? 0.5;
    }

    ambientTick() {
      if (!this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime, W = this.amb.wantLevels;
      if (W.waves) this.amb.nodes.waves.gain.setTargetAtTime(W.waves * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.5))), t, 0.3);
      else this.amb.nodes.waves.gain.setTargetAtTime(0, t, 0.3);
      if (W.wind) this.amb.nodes.wind.gain.setTargetAtTime(W.wind * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.07 + 1))), t, 0.5);
      else this.amb.nodes.wind.gain.setTargetAtTime(0, t, 0.3);
      if (W.night && Math.random() < 0.12) this.chirp(this.amb.nodes.night, 4200 + Math.random() * 600, 3 + Math.floor(Math.random() * 3), 0.05);
      if (W.birds && Math.random() < 0.04) this.birdCall(this.amb.nodes.birds);
      if (W.cafe && Math.random() < 0.03) this.voices.play('bell', t + 0.01, 84 + Math.floor(Math.random() * 8), 0.2, 0.05 * W.cafe, this.ambGain);
      if (W.fire && Math.random() < 0.3) { const n = this.voices.nodes.noise(t, 0.02); const g = ctx.createGain(); g.gain.setValueAtTime(0.25 * W.fire, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02); n.connect(g); g.connect(this.ambGain); }
      if (W.rain && Math.random() < 0.25) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(2000 + Math.random() * 2500, t); o.frequency.exponentialRampToValueAtTime(800, t + 0.02); const g = ctx.createGain(); g.gain.setValueAtTime(0.03 * W.rain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); o.connect(g); g.connect(this.ambGain); o.start(t); o.stop(t + 0.04); }
    }
    chirp(out, f, n, v) {
      const ctx = this.ctx; let t = ctx.currentTime + 0.01;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.04); t += 0.045;
      }
    }
    birdCall(out) {
      const ctx = this.ctx; let t = ctx.currentTime + 0.01;
      const n = 2 + Math.floor(Math.random() * 4); const f0 = 2500 + Math.random() * 1800;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0 * (1 + Math.random() * 0.2), t); o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.6), t + 0.08);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.1); t += 0.1 + Math.random() * 0.06;
      }
    }

    /* data for visualizers */
    readWave(buf) { if (this.analyser) this.analyser.getByteTimeDomainData(buf); }
    readFreq(buf) { if (this.analyser) this.analyser.getByteFrequencyData(buf); }
    readLR(a, b) { if (this.anL) { this.anL.getFloatTimeDomainData(a); this.anR.getFloatTimeDomainData(b); } }
  }

  H.AudioEngine = AudioEngine;
  H.makeChain = makeChain;
})(window.H);
