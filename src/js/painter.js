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
    { id: 'watercolor', ko: '수채화 (번짐)' },
    { id: 'impasto', ko: '인상주의 붓터치' },
    { id: 'cubism', ko: '입체파 (조각난 면)' },
    { id: 'glass', ko: '스테인드글라스' },
    { id: 'pixel', ko: '픽셀 아트' },
    { id: 'pop', ko: '팝아트 (하프톤)' },
  ];
  /* what each style is about (shown in the taste tab) */
  H.ART_DESC = {
    orbit: '키워드를 별처럼 띄우고, 함께 나온 단어끼리 선으로 이어요.', flow: '보이지 않는 바람결을 따라 수백 개의 붓결이 흘러요.',
    field: '커다란 색의 면 몇 개로 그날의 공기를 칠해요.', ink: '먹의 농담으로 산과 해, 새를 그려요.',
    bauhaus: '원·사각형·반원 같은 기본 도형과 원색으로 짜임새 있게.', dots: '수천 개의 점이 모여 풍경이 돼요.',
    watercolor: '물을 많이 머금은 색이 종이 위에서 번지고 겹쳐요.', impasto: '짧고 두꺼운 붓 자국으로 빛과 하늘을 쌓아 올려요.',
    cubism: '한 장면을 여러 각도로 쪼개 조각난 면으로 다시 맞춰요.', glass: '검은 납선 사이로 빛이 비치는 색유리 조각들.',
    pixel: '네모 칸 하나하나로 옛날 게임 같은 풍경을.', pop: '굵은 외곽선과 하프톤 점, 말풍선 속 오늘의 단어.',
  };

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

  /* mood fit × how well it knows the style (it gets braver with practice, and sometimes tries something new) */
  H.chooseArtStyle = function (mood, r, pref, known) {
    if (pref && pref !== 'auto' && H.ART_STYLES.some((s) => s.id === pref)) return pref;
    const v = mood.valence, a = mood.arousal, nov = mood.novelty || 0;
    const fit = {
      orbit: 1.2 + a, flow: 0.8 + a * 1.2, field: 0.6 + (1 - a) * 1.2,
      ink: 0.5 + (1 - a) + Math.max(0, -v) * 0.6, bauhaus: 0.6 + nov, dots: 0.7 + Math.max(0, v),
      watercolor: 0.7 + (1 - a) * 0.8 + Math.max(0, v) * 0.5, impasto: 0.6 + Math.max(0, v) * 0.8 + a * 0.4,
      cubism: 0.5 + (mood.tension || 0) * 1.2 + nov * 0.5, glass: 0.6 + Math.max(0, v) * 0.4 + (1 - a) * 0.4,
      pixel: 0.5 + a * 0.6 + nov * 0.6, pop: 0.5 + a * 0.9 + Math.max(0, v) * 0.4,
    };
    return r.weighted(H.ART_STYLES.map((s) => s.id), (id) => {
      const k = known ? (known[id] ?? 0) : 0.5;
      return fit[id] * (0.45 + k) + (k < 0.15 ? nov * 0.6 : 0);
    });
  };
  H.DEFAULT_ART_KNOWN = { orbit: 0.6, flow: 0.5, field: 0.45, ink: 0.4, bauhaus: 0.45, dots: 0.5, watercolor: 0.2, impasto: 0.15, cubism: 0.05, glass: 0.1, pixel: 0.15, pop: 0.05 };

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

  function planWatercolor(P, kws, r) {
    const ops = [{ type: 'bg', color: H.mix(P.paper, '#ffffff', 0.4) }];
    const n = H.makeNoise(r.int(1, 99999));
    const wash = (cx, cy, rad, color, layers, alpha) => {
      for (let l = 0; l < layers; l++) {
        const pts = []; const k = 26; const off = r() * 9;
        for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; const d = rad * (0.75 + 0.45 * n(Math.cos(a) * 1.3 + off, Math.sin(a) * 1.3 + l * 0.4)); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85]); }
        ops.push({ type: 'poly', pts, color, a: alpha, soft: 0.006 });
      }
      ops.push({ type: 'poly', pts: [], color, a: 0 });
    };
    /* sky and ground washes, then blooms for keywords */
    wash(0.5, 0.25, 0.55, P.soft, 6, 0.08);
    wash(0.5, 0.9, 0.6, H.mix(P.second, P.soft, 0.4), 6, 0.08);
    kws.slice(0, 9).forEach((k, i) => wash(0.15 + r() * 0.7, 0.2 + r() * 0.6, 0.06 + k.norm * 0.14, [P.main, P.second, P.accent, P.deep][i % 4], 5, 0.07 + r() * 0.05));
    /* hard-edged drips where pigment pooled */
    for (let i = 0; i < 70; i++) ops.push({ type: 'circle', x: r(), y: r(), r: 0.002 + r() * 0.01, color: [P.main, P.accent, P.deep][i % 3], a: 0.12 + r() * 0.2, fill: true });
    for (let i = 0; i < 6; i++) { const x = 0.1 + r() * 0.8; ops.push({ type: 'stroke', pts: [[x, 0.62 + r() * 0.1], [x + (r() - 0.5) * 0.03, 0.74 + r() * 0.12]], color: P.deep, w: 0.0015, a: 0.45 }); }
    return ops;
  }

  function planImpasto(P, kws, r) {
    const ops = [{ type: 'bg', color: H.mix(P.soft, P.second, 0.3) }];
    const horizon = 0.5 + (r() - 0.5) * 0.15;
    const sunX = 0.2 + r() * 0.6, sunY = 0.18 + r() * 0.12;
    const n = H.makeNoise(r.int(1, 99999));
    for (let i = 0; i < 2400; i++) {
      const x = r(), y = r();
      const sky = y < horizon;
      const dSun = Math.hypot(x - sunX, y - sunY);
      let c = sky ? H.mix(H.mix(P.soft, '#ffffff', 0.2), P.second, y / horizon) : H.mix(P.main, P.deep, (y - horizon) / (1 - horizon));
      if (sky && dSun < 0.18) c = H.mix('#fff2c4', c, dSun / 0.18);
      if (!sky && r() < 0.12) c = P.accent;
      /* strokes follow a swirling field in the sky, lie flat on the ground */
      const ang = sky ? n(x * 3, y * 3) * Math.PI * 2 + (dSun < 0.25 ? Math.atan2(y - sunY, x - sunX) + Math.PI / 2 : 0) : (r() - 0.5) * 0.4;
      const L = 0.012 + r() * 0.02;
      ops.push({ type: 'stroke', pts: [[x, y], [x + Math.cos(ang) * L, y + Math.sin(ang) * L]], color: H.shade(c, (r() - 0.5) * 0.18), w: 0.005 + r() * 0.006, a: 0.85 });
    }
    kws.slice(0, 3).forEach((k) => { const x = 0.15 + r() * 0.7; for (let j = 0; j < 40; j++) ops.push({ type: 'stroke', pts: [[x + (r() - 0.5) * 0.03, horizon + 0.02 + j * 0.006], [x + (r() - 0.5) * 0.03, horizon + 0.03 + j * 0.006]], color: P.deep, w: 0.006, a: 0.8 }); });
    return ops;
  }

  function planCubism(P, kws, r) {
    const ops = [{ type: 'bg', color: H.mix('#d8cfbf', P.soft, 0.3) }];
    const muted = [P.main, P.second, P.deep, '#b9a98c', '#6f6a5f', P.accent, H.mix(P.main, '#8c7b63', 0.5)];
    const cx = 0.5, cy = 0.52;
    for (let i = 0; i < 70; i++) {
      const ang = r() * Math.PI * 2, d = Math.pow(r(), 0.8) * 0.42;
      const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d;
      const sz = 0.05 + r() * 0.14, rot = r() * Math.PI;
      const sides = 3 + Math.floor(r() * 2);
      const pts = []; for (let k = 0; k < sides; k++) { const a = rot + k / sides * Math.PI * 2 + (r() - 0.5) * 0.6; pts.push([x + Math.cos(a) * sz * (0.6 + r() * 0.6), y + Math.sin(a) * sz * (0.6 + r() * 0.6)]); }
      ops.push({ type: 'poly', pts, color: muted[i % muted.length], a: 0.55 + r() * 0.35, stroke: '#2a2620', sw: 0.0018 });
    }
    /* a face / guitar hint: arcs and an eye */
    ops.push({ type: 'circle', x: cx - 0.05, y: cy - 0.08, r: 0.05, color: '#2a2620', a: 0.85, fill: false, w: 0.004 });
    ops.push({ type: 'circle', x: cx - 0.05, y: cy - 0.08, r: 0.012, color: '#2a2620', a: 0.9, fill: true });
    ops.push({ type: 'circle', x: cx + 0.08, y: cy + 0.1, r: 0.09, color: '#2a2620', a: 0.8, fill: false, w: 0.003 });
    kws.slice(0, 3).forEach((k, i) => ops.push({ type: 'text', x: 0.1 + i * 0.27, y: 0.12 + r() * 0.05, text: k.w.toUpperCase(), size: 0.022, color: '#2a2620', a: 0.75, mono: true }));
    return ops;
  }

  function planGlass(P, kws, r) {
    const ops = [{ type: 'bg', color: '#1b1a1f' }];
    const G = 9, pts = [];
    for (let j = 0; j <= G; j++) { pts.push([]); for (let i = 0; i <= G; i++) { const edge = i === 0 || j === 0 || i === G || j === G; pts[j].push([i / G + (edge ? 0 : (r() - 0.5) * 0.07), j / G + (edge ? 0 : (r() - 0.5) * 0.07)]); } }
    const hues = [P.main, P.second, P.accent, P.soft, '#e8c35a', '#4f7fd8', '#c24a5a', '#5da36b'];
    const rose = { x: 0.5, y: 0.42, r: 0.3 };
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
      const tri = r() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      tri.forEach((t) => {
        const mx = (t[0][0] + t[1][0] + t[2][0]) / 3, my = (t[0][1] + t[1][1] + t[2][1]) / 3;
        const inRose = Math.hypot(mx - rose.x, my - rose.y) < rose.r;
        const col = inRose ? hues[Math.floor(Math.atan2(my - rose.y, mx - rose.x) / Math.PI * 4 + 8) % hues.length] : hues[Math.floor(r() * hues.length)];
        ops.push({ type: 'poly', pts: t, color: H.shade(col, (r() - 0.5) * 0.25), a: 0.92, stroke: '#141317', sw: 0.006 });
      });
    }
    ops.push({ type: 'circle', x: rose.x, y: rose.y, r: rose.r, color: '#141317', a: 1, fill: false, w: 0.01 });
    ops.push({ type: 'circle', x: rose.x, y: rose.y, r: 0.06, color: '#f2d27a', a: 0.95, fill: true });
    /* light glow */
    for (let i = 0; i < 40; i++) ops.push({ type: 'circle', x: r(), y: r(), r: 0.02 + r() * 0.05, color: '#ffffff', a: 0.03, fill: true });
    return ops;
  }

  function planPixel(P, kws, r) {
    const N = 40, s = 1 / N;
    const ops = [{ type: 'bg', color: P.soft }];
    const horizon = 24 + Math.floor(r() * 5);
    const hills = []; let h = horizon - 4;
    for (let x = 0; x < N; x++) { h += Math.round((r() - 0.5) * 2); h = Math.max(horizon - 9, Math.min(horizon + 1, h)); hills.push(h); }
    const sunX = 6 + Math.floor(r() * 28), sunY = 7 + Math.floor(r() * 5);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let c;
      if (y < hills[x]) {
        c = H.mix(H.shade(P.second, 0.2), P.soft, y / horizon);
        if (Math.hypot(x - sunX, (y - sunY) * 1.1) < 3.4) c = '#ffd45a';
        else if ((x * 7 + y * 13) % 23 === 0 && y < 12) c = '#ffffff';
      } else if (y < horizon + 2) c = (x + y) % 2 ? P.main : H.shade(P.main, -0.15);
      else c = H.mix(P.deep, P.main, ((x * 3 + y) % 5) / 10);
      ops.push({ type: 'rect', x: x * s, y: y * s, w: s + 0.0005, h: s + 0.0005, color: c, a: 1, soft: 0 });
    }
    /* a tiny house and a tree */
    const hx = 8 + Math.floor(r() * 20), hy = hills[hx] - 3;
    [[0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(([dx, dy]) => ops.push({ type: 'rect', x: (hx + dx) * s, y: (hy + dy) * s, w: s, h: s, color: '#f4efe3', a: 1, soft: 0 }));
    [[-1, 0], [0, -1], [1, -1], [2, -1], [3, 0], [0, 0], [1, 0], [2, 0]].forEach(([dx, dy]) => ops.push({ type: 'rect', x: (hx + dx) * s, y: (hy + dy) * s, w: s, h: s, color: '#c8483c', a: 1, soft: 0 }));
    ops.push({ type: 'rect', x: (hx + 1) * s, y: (hy + 2) * s, w: s, h: s, color: '#3a2f2a', a: 1, soft: 0 });
    if (kws[0]) ops.push({ type: 'text', x: 0.04, y: 0.965, text: kws[0].w, size: 0.03, color: '#1d1d24', a: 1, mono: true });
    return ops;
  }

  function planPop(P, kws, r) {
    const ops = [{ type: 'bg', color: '#fff6dc' }];
    const pops = ['#ff4f8b', '#ffd23a', '#2f9bff', '#1d1d24', P.accent];
    const panels = [[0.04, 0.04, 0.44, 0.44], [0.52, 0.04, 0.44, 0.44], [0.04, 0.52, 0.92, 0.44]];
    panels.forEach(([x, y, w, h], pi) => {
      const base = pops[pi % 3];
      ops.push({ type: 'rect', x, y, w, h, color: base, a: 1, soft: 0 });
      /* halftone dots growing toward one corner */
      const step = 0.018;
      for (let yy = y + step / 2; yy < y + h; yy += step) for (let xx = x + step / 2; xx < x + w; xx += step) {
        const t = ((xx - x) / w + (yy - y) / h) / 2;
        ops.push({ type: 'circle', x: xx, y: yy, r: step * 0.45 * t, color: H.shade(base, -0.35), a: 0.9, fill: true });
      }
      ops.push({ type: 'rect', x, y, w, h, color: '#1d1d24', a: 0, soft: 0 });
      ops.push({ type: 'poly', pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color: '#000000', a: 0, stroke: '#1d1d24', sw: 0.008 });
    });
    /* speech bubble with the day's word */
    const word = (kws[0] && kws[0].w) || 'WOW';
    const bx = 0.3 + r() * 0.3, by = 0.68;
    ops.push({ type: 'circle', x: bx, y: by, r: 0.13, color: '#ffffff', a: 1, fill: true });
    ops.push({ type: 'circle', x: bx, y: by, r: 0.13, color: '#1d1d24', a: 1, fill: false, w: 0.007 });
    ops.push({ type: 'poly', pts: [[bx + 0.05, by + 0.11], [bx + 0.13, by + 0.22], [bx + 0.1, by + 0.1]], color: '#ffffff', a: 1, stroke: '#1d1d24', sw: 0.007 });
    ops.push({ type: 'text', x: bx - 0.1, y: by + 0.015, text: word.slice(0, 6) + '!', size: 0.05, color: '#1d1d24', a: 1, mono: false });
    /* starburst */
    const sx = 0.74, sy = 0.26, pts = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, d = i % 2 ? 0.08 : 0.15; pts.push([sx + Math.cos(a) * d, sy + Math.sin(a) * d]); }
    ops.push({ type: 'poly', pts, color: '#ffd23a', a: 1, stroke: '#1d1d24', sw: 0.006 });
    if (kws[1]) ops.push({ type: 'text', x: sx - 0.07, y: sy + 0.012, text: kws[1].w.slice(0, 5), size: 0.03, color: '#1d1d24', a: 1, mono: false });
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
      case 'watercolor': ops = planWatercolor(P, kws, r); break;
      case 'impasto': ops = planImpasto(P, kws, r); break;
      case 'cubism': ops = planCubism(P, kws, r); break;
      case 'glass': ops = planGlass(P, kws, r); break;
      case 'pixel': ops = planPixel(P, kws, r); break;
      case 'pop': ops = planPop(P, kws, r); break;
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
      case 'poly': {
        const p = op.pts; if (!p || p.length < 3) break;
        ctx.beginPath(); ctx.moveTo(p[0][0] * S, p[0][1] * S); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] * S, p[i][1] * S); ctx.closePath();
        if ((op.a ?? 1) > 0) { ctx.fillStyle = op.color; if (op.soft) ctx.filter = `blur(${op.soft * S}px)`; ctx.fill(); ctx.filter = 'none'; }
        if (op.stroke) { ctx.globalAlpha = 1; ctx.strokeStyle = op.stroke; ctx.lineWidth = Math.max(0.6, (op.sw || 0.002) * S); ctx.lineJoin = 'round'; ctx.stroke(); }
        break;
      }
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
    /* user spills paint: it lands now, then the pet adopts that colour —
       nearby strokes blend toward a harmonised family of it, and new strokes grow out of the stain
       in the painting's own style, so the accident becomes part of the picture */
    splash(x, y, color, r = 0.06, seed) {
      if (!this.plan) return null;
      seed = seed ?? Math.floor(Math.random() * 1e9);
      const rr = H.rng(seed);
      const op = { type: 'splash', x, y, r, color, a: 0.85, seed, by: 'you' };
      this.plan.ops.splice(this.drawn, 0, op);
      drawOp(this.ctx, op, this.canvas.width); this.drawn++;
      const P = this.plan.palette;
      const fam = H.colorFamily(color, P);
      let blended = 0;
      for (let i = this.drawn; i < this.plan.ops.length; i++) {
        const o = this.plan.ops[i];
        if (!o.color || o.type === 'bg' || o.type === 'text' || o.type === 'vtext' || o.type === 'splash') continue;
        const c = opCenter(o); if (!c) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        const near = Math.max(0, 1 - d / 0.45);
        if (rr() < 0.1 + near * 0.6) { o.color = H.mix(o.color, fam[Math.floor(rr() * fam.length)], 0.35 + near * 0.5); blended++; }
      }
      /* the answer to the stain, woven into what is still to be painted */
      const resp = respondToSplash(this.plan.style, x, y, fam, rr);
      const left = this.plan.ops.length - this.drawn;
      resp.forEach((o, k) => {
        const at = this.drawn + Math.floor((left > 0 ? left : 0) * ((k + rr()) / resp.length) * 0.85);
        this.plan.ops.splice(Math.min(at, this.plan.ops.length), 0, o);
      });
      const record = { x, y, color, family: fam, blended, added: resp.length, finished: left <= 0 };
      this.plan.splashes.push(record);
      return record;
    }
  }
  H.Painter = Painter;

  function opCenter(o) {
    if (o.x != null && o.y != null) return { x: o.x + (o.w || 0) / 2, y: o.y + (o.h || 0) / 2 };
    if (o.pts && o.pts.length) { const p = o.pts[Math.floor(o.pts.length / 2)]; return { x: p[0], y: p[1] }; }
    return null;
  }

  /* a small family of colours around the spilled one that sits well with the painting */
  H.colorFamily = function (color, P) {
    const base = P && P.main ? P.main : '#888888';
    return [
      color,
      H.mix(color, base, 0.35),
      H.shade(color, 0.3),
      H.shade(color, -0.3),
      H.mix(color, (P && P.soft) || '#ffffff', 0.5),
    ];
  };

  /* new strokes that grow out of the stain, in the language of the current style */
  function respondToSplash(style, x, y, fam, r) {
    const ops = [];
    const pick = () => fam[Math.floor(r() * fam.length)];
    if (style === 'flow') {
      for (let i = 0; i < 46; i++) {
        let px = x + (r() - 0.5) * 0.08, py = y + (r() - 0.5) * 0.08;
        let ang = r() * Math.PI * 2; const pts = [[px, py]];
        for (let k = 0; k < 26 + r() * 30; k++) { ang += (r() - 0.5) * 0.5; px += Math.cos(ang) * 0.006; py += Math.sin(ang) * 0.006; pts.push([px, py]); }
        ops.push({ type: 'stroke', pts, color: pick(), w: 0.002 + r() * 0.006, a: 0.25 + r() * 0.45, from: 'splash' });
      }
    } else if (style === 'dots') {
      for (let i = 0; i < 520; i++) {
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * 0.28;
        ops.push({ type: 'circle', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: 0.003 + r() * 0.004, color: pick(), a: 0.75 * (1 - d / 0.3), fill: true, from: 'splash' });
      }
    } else if (style === 'field') {
      for (let l = 0; l < 30; l++) {
        const j = 0.01 * (1 - l / 30);
        ops.push({ type: 'rect', x: 0.08 + (r() - 0.5) * j, y: y - 0.035 + (r() - 0.5) * j, w: 0.84, h: 0.07, color: l % 6 === 0 ? H.shade(fam[0], 0.15) : fam[1], a: 0.05 + r() * 0.04, soft: 0.02, from: 'splash' });
      }
    } else if (style === 'orbit') {
      for (let i = 0; i < 160; i++) {
        const a = r() * Math.PI * 2, d = 0.04 + r() * 0.12;
        ops.push({ type: 'circle', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, r: 0.002 + r() * 0.006, color: pick(), a: 0.15 + r() * 0.5, fill: true, from: 'splash' });
      }
      ops.push({ type: 'circle', x, y, r: 0.13, color: fam[0], a: 0.6, fill: false, w: 0.0012, from: 'splash' });
    } else if (style === 'ink') {
      for (let i = 0; i < 24; i++) ops.push({ type: 'circle', x: x + (r() - 0.5) * 0.05, y: y + (r() - 0.5) * 0.05, r: 0.02 + r() * 0.07, color: H.mix(fam[1], '#f3eee2', 0.3), a: 0.05 + r() * 0.06, fill: true, from: 'splash' });
      for (let i = 0; i < 5; i++) { const bx = x + (r() - 0.5) * 0.2, by = y - 0.05 - r() * 0.1; ops.push({ type: 'stroke', pts: [[bx, by], [bx + 0.03, by - 0.02 - r() * 0.03], [bx + 0.06, by + r() * 0.01]], color: fam[3], w: 0.0025, a: 0.6, from: 'splash' }); }
    } else if (style === 'bauhaus') {
      ops.push({ type: 'circle', x, y, r: 0.07 + r() * 0.05, color: fam[1], a: 0.9, fill: true, from: 'splash' });
      ops.push({ type: 'half', x: x + 0.1, y: y - 0.06, r: 0.06, rot: Math.floor(r() * 4) * Math.PI / 2, color: fam[3], a: 0.92, from: 'splash' });
      ops.push({ type: 'line', pts: [[x - 0.25, y + 0.12], [x + 0.25, y - 0.12]], color: fam[0], w: 0.006, a: 0.95, from: 'splash' });
    } else {
      /* other styles: a quiet bloom of strokes */
      for (let i = 0; i < 40; i++) {
        const a = r() * Math.PI * 2, d0 = 0.03 + r() * 0.04, d1 = d0 + 0.04 + r() * 0.12;
        ops.push({ type: 'stroke', pts: [[x + Math.cos(a) * d0, y + Math.sin(a) * d0], [x + Math.cos(a + 0.2) * (d0 + d1) / 2, y + Math.sin(a + 0.2) * (d0 + d1) / 2], [x + Math.cos(a) * d1, y + Math.sin(a) * d1]], color: pick(), w: 0.002 + r() * 0.004, a: 0.3 + r() * 0.4, from: 'splash' });
      }
    }
    return ops;
  }
  H.respondToSplash = respondToSplash;

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
