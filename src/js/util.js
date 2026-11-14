/* HARU — shared helpers (classic script, attaches to window.H) */
window.H = window.H || {};
(function (H) {
  'use strict';

  H.hash = function (str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  H.rng = function (seed) {
    let a = (typeof seed === 'string' ? H.hash(seed) : seed >>> 0) || 1;
    const f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    f.weighted = (items, wfn) => {
      let total = 0; const ws = items.map((it) => { const w = Math.max(0, wfn(it)); total += w; return w; });
      let r = f() * total;
      for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    };
    f.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
    return f;
  };

  H.clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  H.lerp = (a, b, t) => a + (b - a) * t;
  H.smooth = (t) => t * t * (3 - 2 * t);
  H.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  H.damp = (a, b, lambda, dt) => H.lerp(a, b, 1 - Math.exp(-lambda * dt));

  H.pad2 = (n) => String(n).padStart(2, '0');
  H.dateKey = (d = new Date()) => `${d.getFullYear()}-${H.pad2(d.getMonth() + 1)}-${H.pad2(d.getDate())}`;
  H.timeKey = (d = new Date()) => `${H.pad2(d.getHours())}${H.pad2(d.getMinutes())}`;
  H.fmtClock = (sec) => { sec = Math.max(0, Math.round(sec)); return `${H.pad2(Math.floor(sec / 60))}:${H.pad2(sec % 60)}`; };
  H.koDate = (d = new Date()) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;

  /* ---------- value noise (2D, smooth) ---------- */
  H.makeNoise = function (seed) {
    const r = H.rng(seed);
    const perm = new Uint8Array(512);
    const p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = (h, x, y) => { const g = h & 7; const u = g < 4 ? x : y; const v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); };
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    return function (x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const A = perm[X] + Y, B = perm[X + 1] + Y;
      return H.lerp(H.lerp(grad(perm[A], x, y), grad(perm[B], x - 1, y), u),
        H.lerp(grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1), u), v) * 0.25;
    };
  };

  /* ---------- color ---------- */
  H.hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${H.clamp(s, 0, 100)}%,${H.clamp(l, 0, 100)}%,${a})`;
  H.hexToRgb = (hex) => {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  H.rgbToHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => H.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  H.mix = (a, b, t) => { const A = H.hexToRgb(a), B = H.hexToRgb(b); return H.rgbToHex({ r: H.lerp(A.r, B.r, t), g: H.lerp(A.g, B.g, t), b: H.lerp(A.b, B.b, t) }); };
  H.shade = (hex, amt) => (amt >= 0 ? H.mix(hex, '#ffffff', amt) : H.mix(hex, '#000000', -amt));
  H.rgba = (hex, a) => { const c = H.hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };

  /* ---------- event bus ---------- */
  const listeners = {};
  H.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return () => { listeners[ev] = listeners[ev].filter((f) => f !== fn); }; };
  H.emit = (ev, data) => { (listeners[ev] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(ev, e); } }); };

  H.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  H.nextFrame = () => new Promise((r) => setTimeout(r, 0));

  H.midiName = (m) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  H.midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  H.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  H.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    return e;
  };

  H.escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  H.cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  H.fitCanvas = function (canvas, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = w || canvas.clientWidth; h = h || canvas.clientHeight;
    const W = Math.max(1, Math.round(w * dpr)), Hh = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W || canvas.height !== Hh) { canvas.width = W; canvas.height = Hh; }
    return { w, h, dpr };
  };
})(window.H);
