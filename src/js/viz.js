/* HARU — instrument-panel visualizers (clean, thin, monochrome + blue) */
(function (H) {
  'use strict';

  const MONO = '"Cascadia Mono", Consolas, "D2Coding", monospace';
  const col = () => ({
    ink: H.cssVar('--ink') || '#1d1f24', muted: H.cssVar('--muted') || '#8a8f98', line: H.cssVar('--line') || '#d9dcdf',
    accent: H.cssVar('--accent') || '#2f45ff', accent2: H.cssVar('--accent2') || '#2aa5d8', faint: H.cssVar('--faint') || '#eceeef',
  });
  H.vizColors = col;

  /* ---------- Orbit: live keyword constellation ---------- */
  class OrbitView {
    constructor() { this.nodes = []; this.world = null; this.seed = 1; }
    setWorld(world) {
      this.world = world;
      this.seed = H.hash(world.date + (world.keywords[0] || {}).w);
      const r = H.rng(this.seed);
      this.kind = r.int(0, 2);
      this.nodes = world.keywords.map((k, i) => ({ k, i, u: H.clamp(i / Math.max(1, world.keywords.length - 1) * 0.95 + (r() - 0.5) * 0.06, 0, 1), jx: (r() - 0.5) * 0.08, jy: (r() - 0.5) * 0.08, born: -1, x: 0.5, y: 0.5 }));
    }
    curve(u, t) {
      const rot = t * 0.03;
      if (this.kind === 0) { const a = u * Math.PI * 2.3 + rot; return { x: 0.52 + Math.cos(a) * (0.1 + u * 0.3), y: 0.48 + Math.sin(a) * (0.1 + u * 0.32) }; }
      if (this.kind === 1) return { x: 0.2 + u * 0.62 + Math.sin(u * 6 + rot) * 0.08, y: 0.18 + Math.sin(u * Math.PI) * 0.5 + Math.cos(u * 3 + rot) * 0.06 };
      return { x: 0.52 + Math.sin(u * Math.PI * 2 + rot) * 0.3, y: 0.12 + u * 0.72 };
    }
    draw(ctx, w, h, t, reveal = Infinity) {
      const C = col();
      ctx.clearRect(0, 0, w, h);
      /* axis */
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(28.5, 40); ctx.lineTo(28.5, h - 30); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.font = `9px ${MONO}`;
      for (let i = 0; i <= 4; i++) { const y = 40 + (h - 70) * i / 4; ctx.fillRect(25, y, 7, 1); ctx.fillText(String(100 - i * 25), 4, y + 3); }
      if (!this.world) return;
      const n = this.nodes;
      n.forEach((nd, i) => {
        const p = this.curve(nd.u, t);
        nd.x = (p.x + nd.jx + Math.sin(t * 0.4 + i) * 0.006) * w;
        nd.y = (p.y + nd.jy + Math.cos(t * 0.37 + i) * 0.006) * h;
        if (i < reveal && nd.born < 0) nd.born = t;
      });
      const vis = n.filter((nd) => nd.born >= 0);
      /* dust */
      const r = H.rng(this.seed + 3);
      ctx.fillStyle = C.accent;
      for (let i = 0; i < 160; i++) {
        const u = r(); if (u * n.length > reveal + 2) continue;
        const p = this.curve(u, t);
        ctx.globalAlpha = 0.06 + r() * 0.16;
        ctx.beginPath(); ctx.arc((p.x + (r() - 0.5) * 0.09) * w, (p.y + (r() - 0.5) * 0.09) * h, 1 + r() * 3, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* edges */
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.6;
      (this.world.edges || []).slice(0, 90).forEach((e) => {
        const a = n[e.a], b = n[e.b];
        if (!a || !b || a.born < 0 || b.born < 0) return;
        ctx.globalAlpha = 0.18 + Math.min(0.4, e.w * 0.05);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      /* nodes */
      vis.forEach((nd) => {
        const age = H.clamp((t - nd.born) / 0.6);
        const R = (4 + nd.k.norm * 22) * H.smooth(age);
        const c = nd.k.whisper ? '#ff5f8f' : C.accent;
        const rr = H.rng(nd.i * 31 + this.seed);
        for (let j = 0; j < 2 + nd.k.norm * 8; j++) {
          ctx.fillStyle = H.rgba(c.startsWith('#') ? c : '#2f45ff', 0.12 + rr() * 0.3);
          ctx.beginPath(); ctx.arc(nd.x + (rr() - 0.5) * R * 1.6, nd.y + (rr() - 0.5) * R * 1.6, R * (0.2 + rr() * 0.5), 0, 7); ctx.fill();
        }
        ctx.fillStyle = c; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, R * 0.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (nd.i < 28) {
          ctx.fillStyle = C.ink; ctx.font = `${nd.i < 6 ? 12 : 10}px "Malgun Gothic", ${MONO}`;
          ctx.fillText(nd.k.w, nd.x + R * 0.6 + 4, nd.y + 3);
          if (nd.i < 12) { ctx.fillStyle = C.muted; ctx.font = `9px ${MONO}`; ctx.fillText(nd.k.score.toFixed(1) + (nd.k.isNew ? ' · new' : ''), nd.x + R * 0.6 + 4, nd.y + 14); }
        }
      });
      /* legend */
      ctx.fillStyle = C.muted; ctx.font = `9px ${MONO}`;
      ctx.fillText(`● keyword  —  co-occurrence   ${vis.length}/${n.length} nodes`, 36, h - 10);
    }
  }
  H.OrbitView = OrbitView;

  /* ---------- Piano roll ---------- */
  H.LIGHT_COLORS = { ink: '#1d1f24', muted: '#8a8f98', line: '#d9dcdf', accent: '#2f45ff', accent2: '#2aa5d8', faint: '#eceeef' };
  H.drawPianoRoll = function (ctx, w, h, song, o = {}) {
    const C = o.colors || col();
    if (!o.noClear) ctx.clearRect(0, 0, w, h);
    if (!song) { ctx.fillStyle = C.muted; ctx.font = `11px ${MONO}`; ctx.fillText('— no score yet —', 16, h / 2); return; }
    const steps = song.steps;
    const play = o.playStep ?? -1;
    const reveal = o.reveal ?? 1;
    const barsVisible = o.bars || 4;
    const pageStart = o.fromBar ?? Math.max(0, Math.floor(Math.max(0, play) / steps / barsVisible) * barsVisible);
    const s0 = pageStart * steps, s1 = s0 + barsVisible * steps;
    const left = 44, top = 18, bottom = h - 34;
    const lo = song.range[0] - 1, hi = song.range[1] + 1;
    const rowH = (bottom - top) / (hi - lo + 1);
    const x = (s) => left + (s - s0) / (s1 - s0) * (w - left - 8);
    /* rows */
    ctx.font = `8px ${MONO}`;
    for (let p = lo; p <= hi; p++) {
      const y = bottom - (p - lo + 1) * rowH;
      const black = [1, 3, 6, 8, 10].includes(p % 12);
      ctx.fillStyle = black ? C.faint : 'transparent';
      if (black) ctx.fillRect(left, y, w - left - 8, rowH);
      ctx.fillStyle = C.line; ctx.fillRect(left - 12, y + rowH / 2, 8, 0.6);
      if (p % 12 === 0 || rowH > 9) { ctx.fillStyle = C.muted; ctx.fillText(H.midiName(p), 2, y + rowH * 0.8); }
    }
    /* bars & beats */
    for (let s = s0; s <= s1; s += song.beatSteps) {
      const isBar = (s % steps) === 0;
      ctx.fillStyle = isBar ? C.muted : C.line;
      ctx.fillRect(Math.round(x(s)), top, isBar ? 1 : 0.5, bottom - top);
      if (isBar) { ctx.fillStyle = C.ink; ctx.font = `10px ${MONO}`; ctx.fillText(String(s / steps + 1), x(s) + 3, 11); }
    }
    /* section label */
    const sec = song.sections.find((sc) => pageStart >= sc.start && pageStart < sc.start + sc.len);
    if (sec) { ctx.fillStyle = C.accent; ctx.font = `9px ${MONO}`; ctx.textAlign = 'right'; ctx.fillText(`${sec.name.toUpperCase()} · ${song.chords[pageStart] ? song.chords[pageStart].name : ''}`, w - 10, 11); ctx.textAlign = 'left'; }
    /* notes */
    song.notes.forEach((n) => {
      if (n.s + n.d < s0 || n.s >= s1) return;
      if ((n.rev ?? 0) > reveal) return;
      const fresh = reveal - (n.rev ?? 0) < 0.012;
      const y = bottom - (H.clamp(n.p, lo, hi) - lo + 1) * rowH;
      const x0 = x(Math.max(n.s, s0)), x1 = x(Math.min(n.s + n.d, s1));
      if (n.t === 'bass') {
        ctx.fillStyle = H.rgba(C.accent.startsWith('#') ? C.accent : '#2f45ff', 0.75);
        ctx.fillRect(x0, bottom + 8 + ((n.p % 12) / 12) * 10, Math.max(2, x1 - x0 - 1), 2.2);
        return;
      }
      if (n.t === 'pad') { ctx.fillStyle = H.rgba('#8a8f98', 0.18); ctx.fillRect(x0, y + rowH * 0.3, x1 - x0, Math.max(1, rowH * 0.4)); return; }
      const active = play >= n.s && play < n.s + n.d;
      ctx.fillStyle = n.by === 'you' ? '#ff4f8b' : active ? C.accent : n.t === 'lead' ? C.ink : C.muted;
      const hh = Math.max(1.5, rowH * (n.t === 'lead' ? 0.62 : 0.4));
      ctx.fillRect(x0 + 0.5, y + (rowH - hh) / 2, Math.max(2, x1 - x0 - 1.5), hh);
      if (fresh) { ctx.strokeStyle = C.accent; ctx.lineWidth = 1; ctx.strokeRect(x0 - 2, y - 2, x1 - x0 + 3, rowH + 4); }
    });
    /* drums strip */
    song.drums.forEach((d) => {
      if (d.s < s0 || d.s >= s1 || (d.rev ?? 0) > reveal) return;
      const xx = x(d.s);
      const lane = { k: 0, s: 1, c: 1, h: 2, o: 2, sh: 2, tam: 2 }[d.n] ?? 3;
      ctx.fillStyle = d.by === 'you' ? '#ff4f8b' : lane === 0 ? C.ink : C.muted;
      ctx.fillRect(xx, h - 10 - lane * 0 - (lane === 0 ? 4 : lane === 1 ? 2 : 0), 1.2, lane === 0 ? 8 : lane === 1 ? 6 : 3);
    });
    /* writing head (composition progress) */
    if (o.writeStep != null && o.writeStep >= s0 && o.writeStep <= s1) {
      ctx.strokeStyle = C.accent; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(o.writeStep), top); ctx.lineTo(x(o.writeStep), bottom); ctx.stroke(); ctx.setLineDash([]);
    }
    /* playhead */
    if (play >= s0 && play <= s1) {
      ctx.fillStyle = C.ink; ctx.fillRect(Math.round(x(play)), top - 4, 1.5, bottom - top + 26);
      ctx.beginPath(); ctx.arc(x(play), top - 4, 3, 0, 7); ctx.fill();
    }
  };

  /* ---------- Oscilloscope / spectrum / vector / loudness ---------- */
  const wave = new Uint8Array(2048), freq = new Uint8Array(1024), L = new Float32Array(1024), R = new Float32Array(1024);
  H.drawScope = function (ctx, w, h, audio) {
    const C = col(); ctx.clearRect(0, 0, w, h);
    audio.readWave(wave);
    ctx.strokeStyle = C.accent2; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 512; i++) { const v = (wave[i * 2] - 128) / 128; const x = i / 511 * w, y = h / 2 + v * h * 0.42; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = C.line; ctx.fillRect(0, h / 2, w, 0.5);
  };
  H.drawSpectrum = function (ctx, w, h, audio) {
    const C = col(); ctx.clearRect(0, 0, w, h);
    audio.readFreq(freq);
    const bars = 22;
    for (let i = 0; i < bars; i++) {
      const lo = Math.floor(Math.pow(i / bars, 2) * 300) + 1, hi = Math.floor(Math.pow((i + 1) / bars, 2) * 300) + 2;
      let m = 0; for (let k = lo; k < hi; k++) m = Math.max(m, freq[k]);
      const bh = (m / 255) * (h - 4);
      ctx.fillStyle = C.ink; ctx.fillRect(4 + i * (w - 8) / bars, h - bh, (w - 8) / bars - 2, bh);
    }
  };
  H.drawVector = function (ctx, w, h, audio) {
    const C = col(); ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = C.line; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
    audio.readLR(L, R);
    ctx.fillStyle = C.ink;
    for (let i = 0; i < 1024; i += 3) {
      const m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5;
      ctx.fillRect(w / 2 + s * w * 1.6, h / 2 - m * h * 0.9, 1, 1);
    }
  };
  H.LoudnessTrail = class {
    constructor() { this.hist = []; }
    draw(ctx, w, h, audio) {
      const C = col(); ctx.clearRect(0, 0, w, h);
      audio.readWave(wave);
      let rms = 0; for (let i = 0; i < 2048; i++) { const v = (wave[i] - 128) / 128; rms += v * v; }
      rms = Math.sqrt(rms / 2048);
      this.hist.push(rms); if (this.hist.length > 240) this.hist.shift();
      ctx.strokeStyle = C.accent2; ctx.lineWidth = 1; ctx.beginPath();
      this.hist.forEach((v, i) => { const x = w - (this.hist.length - i) * (w / 240), y = h / 2 - v * h * 1.8; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      this.hist.slice().reverse().forEach((v, i) => { const x = w - (i + 1) * (w / 240), y = h / 2 + v * h * 1.8; ctx.lineTo(x, y); });
      ctx.stroke();
      return rms;
    }
  };

  /* ---------- bar clock ---------- */
  H.drawBarClock = function (ctx, w, h, song, playStep) {
    const C = col(); ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.max(10, Math.min(w, h) / 2 - 22);
    const beats = song ? song.steps / song.beatSteps : 4;
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.font = `10px ${MONO}`; ctx.textAlign = 'center';
    for (let b = 0; b < beats; b++) {
      const a = b / beats * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3)); ctx.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10)); ctx.stroke();
      ctx.fillStyle = b === 0 ? C.accent2 : C.muted; ctx.fillText(String(b + 1), cx + Math.cos(a) * (R + 20), cy + Math.sin(a) * (R + 20) + 3);
    }
    if (song && playStep >= 0) {
      const inBar = (playStep % song.steps) / song.steps;
      const a = inBar * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = C.accent2; ctx.lineWidth = 6; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, R - 6, -Math.PI / 2, a); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.font = `600 16px ${MONO}`; ctx.fillText(String(Math.floor(playStep / song.steps) + 1), cx, cy + 6);
      ctx.font = `8px ${MONO}`; ctx.fillStyle = C.muted; ctx.fillText('BAR', cx, cy - 9);
    }
    ctx.textAlign = 'left';
  };

  /* ---------- tone graph (melody transitions) ---------- */
  H.drawToneGraph = function (ctx, w, h, song, playStep, reveal = 1) {
    const C = col(); ctx.clearRect(0, 0, w, h);
    if (!song) return;
    const lead = song.notes.filter((n) => n.t === 'lead' && (n.rev ?? 0) <= reveal).sort((a, b) => a.s - b.s);
    if (lead.length < 2) return;
    const count = {}, trans = {};
    lead.forEach((n, i) => { count[n.p] = (count[n.p] || 0) + 1; if (i) { const k = lead[i - 1].p + '>' + n.p; trans[k] = (trans[k] || 0) + 1; } });
    const pitches = Object.keys(count).map(Number).sort((a, b) => a - b);
    const pos = {};
    pitches.forEach((p, i) => { const a = i / pitches.length * Math.PI * 2 - Math.PI / 2; pos[p] = { x: w / 2 + Math.cos(a) * w * 0.36, y: h / 2 + Math.sin(a) * h * 0.36 }; });
    const max = Math.max(...Object.values(count));
    Object.entries(trans).forEach(([k, v]) => {
      const [a, b] = k.split('>').map(Number);
      ctx.strokeStyle = H.rgba('#2aa5d8', 0.15 + Math.min(0.6, v * 0.06)); ctx.lineWidth = Math.min(3, 0.5 + v * 0.3);
      ctx.beginPath(); ctx.moveTo(pos[a].x, pos[a].y); ctx.quadraticCurveTo(w / 2, h / 2, pos[b].x, pos[b].y); ctx.stroke();
    });
    const cur = lead.find((n) => playStep >= n.s && playStep < n.s + n.d);
    let top = pitches[0];
    pitches.forEach((p) => {
      if (count[p] > count[top]) top = p;
      const r = 2 + count[p] / max * 9;
      ctx.fillStyle = cur && cur.p === p ? '#2aa5d8' : C.ink;
      ctx.beginPath(); ctx.arc(pos[p].x, pos[p].y, r, 0, 7); ctx.fill();
      ctx.fillStyle = C.muted; ctx.font = `8px ${MONO}`; ctx.fillText(H.midiName(p), pos[p].x + r + 2, pos[p].y + 3);
    });
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(pos[top].x, pos[top].y, 15, 0, 7); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = `600 9px ${MONO}`; ctx.fillText('MOST PLAYED', pos[top].x + 18, pos[top].y - 4); ctx.fillText('NOTE: ' + H.midiName(top), pos[top].x + 18, pos[top].y + 7);
  };

  /* ---------- session ring (focus timer) ---------- */
  H.drawRing = function (ctx, w, h, frac, label, sub, colorA) {
    const C = col(); ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 8;
    ctx.fillStyle = H.cssVar('--glass') || 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, 7); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = colorA || C.accent; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * H.clamp(frac)); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = C.ink; ctx.textAlign = 'center';
    ctx.font = `600 ${Math.round(R * 0.36)}px ${MONO}`; ctx.fillText(label, cx, cy + R * 0.12);
    ctx.font = `${Math.round(R * 0.17)}px "Malgun Gothic", sans-serif`; ctx.fillStyle = C.muted; ctx.fillText(sub, cx, cy + R * 0.45);
    ctx.textAlign = 'left';
  };
})(window.H);
