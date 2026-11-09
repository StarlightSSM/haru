/* HARU — generative painter: mood + keywords → a stroke list painted over time */
(function (H) {
  'use strict';

  H.ART_STYLES = [
    { id: 'orbit', ko: '궤도 (키워드 별자리)' },
    { id: 'flow', ko: '흐름 (붓결)' },
    { id: 'field', ko: '색면 (컬러 필드)' },
    { id: 'ink', ko: '수묵 산수' },
    { id: 'bauhaus', ko: '바우하우스 기하' },
    { id: 'dots', ko: '점묘' },
  ];

  H.makePalette = function (mood, cats, seed) {
    const r = H.rng(seed);
    const v = mood.valence, a = mood.arousal;
    const catHue = { tech: 195, economy: 140, politics: 235, world: 215, culture: 320, sports: 25, nature: 165, science: 265 };
    const top = Object.keys(cats || {}).sort((x, y) => cats[y] - cats[x])[0] || 'world';
    let hue = v >= 0 ? H.lerp(42, 8, v) : H.lerp(210, 245, -v);
    hue = H.lerp(hue, catHue[top] ?? hue, 0.35) + (r() - 0.5) * 30;
    const sat = 38 + a * 40;
    const toHex = (h, s, l) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = H.hsl(h, s, l); return c.fillStyle; };
    return {
      paper: toHex(hue + 20, 18, 96),
      main: toHex(hue, sat, 48 - mood.tension * 10),
      second: toHex(hue + 35 + r() * 20, sat * 0.8, 62),
      accent: toHex(hue + 180 + (r() - 0.5) * 40, sat + 10, 55),
      deep: toHex(hue - 10, sat * 0.7, 22),
      soft: toHex(hue + 10, sat * 0.4, 82),
      orbit: '#2f45ff',
      hue,
    };
  };

  H.chooseArtStyle = function (mood, r, pref) {
    if (pref && pref !== 'auto' && H.ART_STYLES.some((s) => s.id === pref)) return pref;
    return r.weighted(H.ART_STYLES.map((s) => s.id), (id) => ({
      orbit: 1.2 + mood.arousal, flow: 0.8 + mood.arousal * 1.2, field: 0.6 + (1 - mood.arousal) * 1.2,
      ink: 0.5 + (1 - mood.arousal) + Math.max(0, -mood.valence) * 0.6, bauhaus: 0.6 + mood.novelty, dots: 0.7 + Math.max(0, mood.valence),
    }[id]));
  };

  /* ---------- plans ---------- */
  function planOrbit(P, kws, edges, r) {
    const ops = [];
    const n = H.makeNoise(r.int(1, 99999));
    const kind = r.int(0, 2);
    const curve = (u) => {
      if (kind === 0) { const a = u * Math.PI * 2.4 + 0.6; return { x: 0.5 + Math.cos(a) * (0.12 + u * 0.28), y: 0.5 + Math.sin(a) * (0.12 + u * 0.3) }; }
      if (kind === 1) return { x: 0.18 + u * 0.66 + Math.sin(u * 6.5) * 0.08, y: 0.16 + Math.sin(u * Math.PI) * 0.5 + Math.cos(u * 3) * 0.06 };
      return { x: 0.5 + Math.sin(u * Math.PI * 2 + 0.3) * 0.33, y: 0.15 + u * 0.7 + Math.sin(u * 9) * 0.03 };
    };
    ops.push({ type: 'bg', color: '#f4f5f2' });
    for (let i = 0; i < 14; i++) ops.push({ type: 'line', pts: [[0.06, 0.08 + i * 0.065], [0.08, 0.08 + i * 0.065]], color: '#9aa0aa', w: 0.0008, a: 0.6 });
    ops.push({ type: 'line', pts: [[0.07, 0.08], [0.07, 0.93]], color: '#b6bac2', w: 0.0007, a: 0.8 });
    /* dust along the path */
    for (let i = 0; i < 260; i++) {
      const u = r(); const p = curve(u); const j = 0.02 + r() * 0.05;
      ops.push({ type: 'circle', x: p.x + n(u * 9, i) * j * 2, y: p.y + n(i, u * 9) * j * 2, r: 0.002 + r() * 0.006, color: P.orbit, a: 0.08 + r() * 0.25, fill: true });
    }
    const pos = kws.map((k, i) => { const u = H.clamp(i / Math.max(1, kws.length - 1) * 0.92 + (r() - 0.5) * 0.08, 0, 1); const p = curve(u); return { x: p.x + (r() - 0.5) * 0.06, y: p.y + (r() - 0.5) * 0.06 }; });
    edges.slice(0, 80).forEach((e) => {
      if (!pos[e.a] || !pos[e.b]) return;
      ops.push({ type: 'line', pts: [[pos[e.a].x, pos[e.a].y], [pos[e.b].x, pos[e.b].y]], color: '#1d2240', w: 0.0006 + Math.min(0.002, e.w * 0.0004), a: 0.35 });
    });
    kws.forEach((k, i) => {
      const p = pos[i];
      const R = 0.006 + k.norm * 0.03;
      const count = 2 + Math.round(k.norm * 10);
      for (let c = 0; c < count; c++) {
        const ang = r() * Math.PI * 2, dist = r() * R * 1.4;
        ops.push({ type: 'circle', x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist, r: R * (0.25 + r() * 0.6), color: k.whisper ? P.accent : P.orbit, a: 0.18 + r() * 0.55, fill: true });
      }
      ops.push({ type: 'circle', x: p.x, y: p.y, r: R * 0.55, color: k.whisper ? P.accent : P.orbit, a: 0.9, fill: true });
      if (i < 26) ops.push({ type: 'text', x: p.x + R + 0.006, y: p.y + 0.004, text: k.w + (i < 10 ? '  ' + (k.score).toFixed(1) : ''), size: 0.011 + k.norm * 0.008, color: '#23263a', a: 0.85, mono: false });
    });
    ops.push({ type: 'text', x: 0.07, y: 0.965, text: kws.slice(0, 5).map((k) => k.w).join(' · '), size: 0.011, color: '#7a808c', a: 1, mono: true });
    return ops;
  }

  function planFlow(P, kws, r) {
    const ops = [{ type: 'bg', color: P.paper }];
    const n = H.makeNoise(r.int(1, 99999));
    const freq = 1.2 + r() * 2.2, twist = 1 + r() * 2;
    const cols = [P.main, P.second, P.accent, P.deep, P.soft, P.main];
    const attract = kws.slice(0, 5).map((k) => ({ x: 0.2 + r() * 0.6, y: 0.2 + r() * 0.6, s: k.norm }));
    const N = 520;
    for (let i = 0; i < N; i++) {
      let x = r(), y = r();
      const pts = [[x, y]];
      const len = 18 + r() * 50;
      const step = 0.004 + r() * 0.004;
      for (let k = 0; k < len; k++) {
        let ang = n(x * freq, y * freq) * Math.PI * 2 * twist;
        attract.forEach((a) => { const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy) + 0.05; ang += Math.atan2(dy, dx) * 0.0 + (a.s * 0.15) / d * 0.1; });
        x += Math.cos(ang) * step; y += Math.sin(ang) * step;
        if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) break;
        pts.push([x, y]);
      }
      const late = i / N;
      ops.push({ type: 'stroke', pts, color: cols[Math.floor(r() * cols.length)], w: (0.012 - late * 0.009) * (0.4 + r()), a: 0.25 + r() * 0.5 });
    }
    return ops;
  }

  function planField(P, kws, r) {
    const ops = [{ type: 'bg', color: H.mix(P.deep, P.paper, 0.15) }];
    const bands = r.int(2, 3);
    const cols = r.shuffle([P.main, P.second, P.accent, P.soft]).slice(0, bands);
    let y = 0.07;
    const hTot = 0.86;
    const hs = cols.map(() => 0.5 + r());
    const sum = hs.reduce((a, b) => a + b, 0);
    cols.forEach((c, bi) => {
      const h = hTot * hs[bi] / sum - 0.03;
      for (let l = 0; l < 46; l++) {
        const j = 0.012 * (1 - l / 46);
        ops.push({ type: 'rect', x: 0.08 + (r() - 0.5) * j, y: y + (r() - 0.5) * j, w: 0.84 + (r() - 0.5) * j, h: h + (r() - 0.5) * j, color: l % 7 === 0 ? H.shade(c, 0.12) : c, a: 0.07 + r() * 0.05, soft: 0.02 });
      }
      y += h + 0.03;
    });
    for (let i = 0; i < 400; i++) ops.push({ type: 'circle', x: r(), y: r(), r: 0.0015, color: '#ffffff', a: 0.06, fill: true });
    return ops;
  }

  function planInk(P, kws, r) {
    const ops = [{ type: 'bg', color: '#f3eee2' }];
    const n = H.makeNoise(r.int(1, 99999));
    const sunX = 0.2 + r() * 0.6;
    ops.push({ type: 'circle', x: sunX, y: 0.2 + r() * 0.1, r: 0.06, color: H.mix('#c8483c', P.accent, 0.3), a: 0.75, fill: true });
    const layers = 5;
    for (let L = 0; L < layers; L++) {
      const base = 0.42 + L * 0.1;
      const amp = 0.18 - L * 0.025;
      const f = 1.5 + L * 0.9 + r();
      const off = r() * 100;
      const pts = [];
      for (let i = 0; i <= 80; i++) { const x = i / 80; pts.push([x, base - Math.abs(n(x * f + off, L * 3.1)) * amp * 2.2 - Math.sin(x * Math.PI) * 0.03]); }
      const tone = H.mix('#d7d2c6', '#1e1f24', 0.25 + L / layers * 0.7);
      for (let wsh = 0; wsh < 6; wsh++) ops.push({ type: 'mountain', pts: pts.map(([x, y]) => [x, y + wsh * 0.01]), color: H.mix(tone, P.main, 0.12), a: 0.12 + wsh * 0.02 });
      ops.push({ type: 'stroke', pts, color: '#1e1f24', w: 0.0025 + L * 0.0008, a: 0.5 });
      if (L === 2) for (let m = 0; m < 30; m++) { const x = r(); ops.push({ type: 'stroke', pts: [[x, base - 0.02], [x + (r() - 0.5) * 0.01, base - 0.06 - r() * 0.04]], color: '#2a2b30', w: 0.002, a: 0.35 }); }
    }
    for (let b = 0; b < 5; b++) { const bx = 0.3 + r() * 0.4, by = 0.15 + r() * 0.12; ops.push({ type: 'stroke', pts: [[bx - 0.012, by], [bx, by + 0.006], [bx + 0.012, by]], color: '#222', w: 0.0022, a: 0.8 }); }
    ops.push({ type: 'stroke', pts: [[0.62, 0.86], [0.7, 0.865], [0.74, 0.858]], color: '#222', w: 0.004, a: 0.85 });
    kws.slice(0, 4).forEach((k, i) => ops.push({ type: 'vtext', x: 0.9 - i * 0.045, y: 0.1, text: k.w, size: 0.026, color: '#1e1f24', a: 0.8 }));
    ops.push({ type: 'rect', x: 0.765, y: 0.1, w: 0.04, h: 0.04, color: '#c8483c', a: 0.9, soft: 0 });
    return ops;
  }

  function planBauhaus(P, kws, r) {
    const ops = [{ type: 'bg', color: '#f1ede4' }];
    const cols = ['#e04b3a', '#2f45ff', '#f2c230', '#1d1d24', P.main, P.accent];
    const g = 6;
    for (let i = 0; i <= g; i++) ops.push({ type: 'line', pts: [[0.08 + i * 0.84 / g, 0.08], [0.08 + i * 0.84 / g, 0.92]], color: '#c9c2b4', w: 0.0008, a: 1 });
    for (let i = 0; i <= g; i++) ops.push({ type: 'line', pts: [[0.08, 0.08 + i * 0.84 / g], [0.92, 0.08 + i * 0.84 / g]], color: '#c9c2b4', w: 0.0008, a: 1 });
    const cell = 0.84 / g;
    kws.slice(0, 18).forEach((k, i) => {
      const cx = 0.08 + (r.int(0, g - 1) + 0.5) * cell, cy = 0.08 + (r.int(0, g - 1) + 0.5) * cell;
      const s = cell * (0.5 + k.norm * 1.6);
      const c = cols[i % cols.length];
      const t = r.int(0, 4);
      if (t === 0) ops.push({ type: 'circle', x: cx, y: cy, r: s / 2, color: c, a: 0.92, fill: true });
      else if (t === 1) ops.push({ type: 'rect', x: cx - s / 2, y: cy - s / 4, w: s, h: s / 2, color: c, a: 0.9, soft: 0 });
      else if (t === 2) ops.push({ type: 'half', x: cx, y: cy, r: s / 2, rot: r.int(0, 3) * Math.PI / 2, color: c, a: 0.92 });
      else if (t === 3) ops.push({ type: 'line', pts: [[cx - s, cy - s * r()], [cx + s, cy + s * r()]], color: c, w: 0.006, a: 0.95 });
      else ops.push({ type: 'circle', x: cx, y: cy, r: s / 2.4, color: c, a: 0.95, fill: false, w: 0.008 });
      if (i < 8) ops.push({ type: 'text', x: cx + 0.01, y: cy + s / 2 + 0.02, text: k.w, size: 0.012, color: '#1d1d24', a: 0.9, mono: true });
    });
    return ops;
  }

  function planDots(P, kws, r) {
    const ops = [{ type: 'bg', color: P.paper }];
    const blobs = kws.slice(0, 7).map((k, i) => ({ x: 0.2 + r() * 0.6, y: 0.2 + r() * 0.6, rad: 0.08 + k.norm * 0.2, c: [P.main, P.accent, P.second, P.deep][i % 4] }));
    const horizon = 0.55 + (r() - 0.5) * 0.2;
    for (let i = 0; i < 3800; i++) {
      const x = r(), y = r();
      let c = y < horizon ? H.mix(P.soft, P.second, y / horizon) : H.mix(P.second, P.deep, (y - horizon) / (1 - horizon));
      for (const b of blobs) { const d = Math.hypot(x - b.x, y - b.y); if (d < b.rad && r() < 1 - d / b.rad) { c = b.c; break; } }
      ops.push({ type: 'circle', x, y, r: 0.003 + r() * 0.004, color: c, a: 0.75, fill: true });
    }
    return ops;
  }

  H.planPainting = function (opts) {
    const r = H.rng(opts.seed);
    const style = opts.style;
    const kws = (opts.keywords || []).slice(0, 40);
    const P = opts.palette;
    let ops;
    switch (style) {
      case 'flow': ops = planFlow(P, kws, r); break;
      case 'field': ops = planField(P, kws, r); break;
      case 'ink': ops = planInk(P, kws, r); break;
      case 'bauhaus': ops = planBauhaus(P, kws, r); break;
      case 'dots': ops = planDots(P, kws, r); break;
      default: ops = planOrbit(P, kws, opts.edges || [], r);
    }
    return { style, palette: P, ops, splashes: [] };
  };

  /* ---------- rendering ---------- */
  function drawOp(ctx, op, S) {
    ctx.globalAlpha = op.a ?? 1;
    switch (op.type) {
      case 'bg': ctx.fillStyle = op.color; ctx.fillRect(0, 0, S, S); break;
      case 'circle':
        ctx.beginPath(); ctx.arc(op.x * S, op.y * S, Math.max(0.3, op.r * S), 0, Math.PI * 2);
        if (op.fill !== false) { ctx.fillStyle = op.color; ctx.fill(); } else { ctx.strokeStyle = op.color; ctx.lineWidth = (op.w || 0.002) * S; ctx.stroke(); }
        break;
      case 'line': case 'stroke': {
        const p = op.pts; if (!p.length) break;
        ctx.strokeStyle = op.color; ctx.lineWidth = Math.max(0.4, op.w * S); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(p[0][0] * S, p[0][1] * S);
        if (op.type === 'stroke' && p.length > 2) {
          for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0] * S, p[i][1] * S, mx * S, my * S); }
          ctx.lineTo(p[p.length - 1][0] * S, p[p.length - 1][1] * S);
        } else for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] * S, p[i][1] * S);
        ctx.stroke(); break;
      }
      case 'rect':
        ctx.fillStyle = op.color;
        if (op.soft) { ctx.filter = `blur(${op.soft * S * 0.3}px)`; ctx.fillRect(op.x * S, op.y * S, op.w * S, op.h * S); ctx.filter = 'none'; }
        else ctx.fillRect(op.x * S, op.y * S, op.w * S, op.h * S);
        break;
      case 'half':
        ctx.save(); ctx.translate(op.x * S, op.y * S); ctx.rotate(op.rot || 0); ctx.fillStyle = op.color;
        ctx.beginPath(); ctx.arc(0, 0, op.r * S, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.restore(); break;
      case 'mountain': {
        ctx.fillStyle = op.color; ctx.beginPath(); ctx.moveTo(0, S);
        op.pts.forEach(([x, y]) => ctx.lineTo(x * S, y * S)); ctx.lineTo(S, S); ctx.closePath(); ctx.fill(); break;
      }
      case 'text':
        ctx.fillStyle = op.color;
        ctx.font = `${op.mono ? '' : '500 '}${Math.max(6, op.size * S)}px ${op.mono ? 'Consolas, "Cascadia Mono", monospace' : '"Malgun Gothic", "Segoe UI", sans-serif'}`;
        ctx.fillText(op.text, op.x * S, op.y * S); break;
      case 'vtext': {
        ctx.fillStyle = op.color; const fs = op.size * S;
        ctx.font = `600 ${fs}px "Batang", "Malgun Gothic", serif`;
        [...op.text].slice(0, 6).forEach((ch, i) => ctx.fillText(ch, op.x * S, op.y * S + (i + 1) * fs * 1.15));
        break;
      }
      case 'splash': {
        const cx = op.x * S, cy = op.y * S, R = op.r * S;
        ctx.fillStyle = op.color; const rr = H.rng(op.seed || 1);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; const d = R * (0.7 + rr() * 0.5); i ? ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d) : ctx.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
        ctx.closePath(); ctx.fill();
        for (let i = 0; i < 9; i++) { const a = rr() * Math.PI * 2, d = R * (1.1 + rr() * 0.9); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.06 + rr() * 0.14), 0, 7); ctx.fill(); }
        for (let i = 0; i < 3; i++) { const dx = (rr() - 0.5) * R; ctx.fillRect(cx + dx - R * 0.05, cy, R * 0.1, R * (0.8 + rr() * 1.4)); }
        break;
      }
      default: break;
    }
    ctx.globalAlpha = 1;
  }
  H.drawPaintOp = drawOp;

  /* live painter: owns a canvas, draws ops incrementally as progress advances */
  class Painter {
    constructor(size = 900) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.canvas.height = size;
      this.ctx = this.canvas.getContext('2d');
      this.drawn = 0; this.plan = null;
      this.clear();
    }
    clear() { this.ctx.fillStyle = '#fbf9f4'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.drawn = 0; }
    setPlan(plan) { this.plan = plan; this.clear(); }
    /* progress 0..1 → draw ops up to that point; returns last op drawn (for brush position) */
    advance(progress) {
      if (!this.plan) return null;
      const target = Math.floor(H.clamp(progress) * this.plan.ops.length);
      let last = null;
      const S = this.canvas.width;
      while (this.drawn < target) { last = this.plan.ops[this.drawn]; drawOp(this.ctx, last, S); this.drawn++; }
      return last;
    }
    redraw() { const n = this.drawn; this.clear(); const S = this.canvas.width; for (let i = 0; i < n; i++) drawOp(this.ctx, this.plan.ops[i], S); this.drawn = n; }
    /* user spills paint: insert now; later strokes sometimes adopt the color */
    splash(x, y, color, r = 0.06) {
      if (!this.plan) return;
      const op = { type: 'splash', x, y, r, color, a: 0.85, seed: Math.floor(Math.random() * 1e9), by: 'you' };
      this.plan.ops.splice(this.drawn, 0, op);
      drawOp(this.ctx, op, this.canvas.width); this.drawn++;
      this.plan.splashes.push({ x, y, color });
      for (let i = this.drawn; i < this.plan.ops.length; i++) {
        const o = this.plan.ops[i];
        if ((o.type === 'stroke' || o.type === 'circle') && Math.random() < 0.18) o.color = color;
      }
    }
  }
  H.Painter = Painter;

  H.renderArt = function (plan, size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    plan.ops.forEach((op) => drawOp(ctx, op, size));
    return c;
  };

  /* poster: artwork + caption in the clean instrument style */
  H.renderPoster = function (plan, meta, size = 1600) {
    const W = size, Hh = Math.round(size * 1.13);
    const c = document.createElement('canvas'); c.width = W; c.height = Hh;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f4f1'; ctx.fillRect(0, 0, W, Hh);
    const m = Math.round(W * 0.06), A = W - m * 2;
    const art = H.renderArt(plan, A);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(m + 6, m + 8, A, A);
    ctx.drawImage(art, m, m);
    const u = W / 1600;
    const y0 = m + A + 70 * u;
    ctx.fillStyle = '#16181d';
    ctx.font = `600 ${52 * u}px "Malgun Gothic", "Segoe UI", sans-serif`;
    ctx.fillText(meta.title || '무제', m, y0);
    ctx.font = `${22 * u}px Consolas, "Cascadia Mono", monospace`;
    ctx.fillStyle = '#5c616b';
    ctx.fillText(`${meta.date}  ·  ${meta.genre}  ·  ${meta.key}  ·  ${meta.bpm} BPM`, m, y0 + 48 * u);
    ctx.fillText(`${meta.styleKo}  ·  mood ${meta.moodKo}`, m, y0 + 84 * u);
    ctx.fillStyle = '#2f45ff';
    ctx.fillText((meta.keywords || []).slice(0, 8).join('  /  '), m, y0 + 132 * u);
    ctx.fillStyle = '#8a8f98';
    ctx.textAlign = 'right';
    ctx.fillText(`by ${meta.artist} — HARU`, W - m, y0 + 132 * u);
    if (meta.you) ctx.fillText(meta.you, W - m, y0 + 84 * u);
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m, y0 + 100 * u); ctx.lineTo(W - m, y0 + 100 * u); ctx.stroke();
    return c;
  };
})(window.H);
