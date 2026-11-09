/* HARU — desktop mini avatar */
(function (H) {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  let status = { name: '', cfg: H.DEFAULT_CHARACTER, act: 'idle', emo: 'neutral', phase: '', progress: -1, remaining: '' };
  let motion = { walking: false, dir: 1, dragging: false, mode: 'float' };
  let opts = { bubble: true };
  let line = null, lineUntil = 0, t = 0, last = performance.now(), poked = 0;

  if (window.haru) {
    window.haru.on('mini:status', (s) => { status = Object.assign(status, s); if (s.line) { line = s.line; lineUntil = performance.now() + Math.max(4000, s.line.length * 110); } });
    window.haru.on('mini:motion', (m) => { motion = m; });
    window.haru.on('mini:settings', (s) => { opts = Object.assign(opts, s); });
  }

  /* pointer: click = pat, double click = open, drag = move, right = menu */
  let down = null, clickTimer = null;
  cv.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    down = { x: e.screenX, y: e.screenY, t: performance.now(), dragging: false };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!down || down.dragging) return;
    if (Math.hypot(e.screenX - down.x, e.screenY - down.y) > 4) { down.dragging = true; cv.classList.add('drag'); window.haru.mini.dragStart(); }
  });
  cv.addEventListener('pointerup', () => {
    if (!down) return;
    if (down.dragging) { window.haru.mini.dragEnd(); cv.classList.remove('drag'); }
    else {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; window.haru.mini.open(); }
      else clickTimer = setTimeout(() => { clickTimer = null; poked = performance.now(); window.haru.mini.poke(); }, 260);
    }
    down = null;
  });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); window.haru.mini.menu(); });
  cv.addEventListener('pointerenter', () => window.haru && window.haru.mini.hover(true));
  cv.addEventListener('pointerleave', () => window.haru && window.haru.mini.hover(false));

  function bubble(text, w, y) {
    ctx.font = '12px "Malgun Gothic", sans-serif';
    const maxW = w - 16;
    const words = [...text];
    const lines = []; let cur = '';
    words.forEach((ch) => { if (ctx.measureText(cur + ch).width > maxW - 16) { lines.push(cur); cur = ch; } else cur += ch; });
    if (cur) lines.push(cur);
    const ls = lines.slice(0, 3);
    if (lines.length > 3) ls[2] = ls[2].slice(0, -1) + '…';
    const bw = Math.min(maxW, Math.max(...ls.map((l) => ctx.measureText(l).width)) + 18), bh = ls.length * 16 + 10;
    const bx = (w - bw) / 2;
    ctx.fillStyle = 'rgba(250,251,250,0.96)'; ctx.strokeStyle = '#1b1d22'; ctx.lineWidth = 1;
    H.roundRect(ctx, bx, y, bw, bh, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - 5, y + bh); ctx.lineTo(w / 2, y + bh + 6); ctx.lineTo(w / 2 + 5, y + bh); ctx.fillStyle = 'rgba(250,251,250,0.96)'; ctx.fill();
    ctx.fillStyle = '#1b1d22'; ctx.textAlign = 'center';
    ls.forEach((l, i) => ctx.fillText(l, w / 2, y + 18 + i * 16));
    ctx.textAlign = 'left';
    return bh;
  }

  function pill(w) {
    const txt = status.progress >= 0 ? `${status.phase} · ${Math.round(status.progress * 100)}%` : status.phase;
    if (!txt) return;
    ctx.font = '10.5px "Malgun Gothic", sans-serif';
    const tw = ctx.measureText(txt).width + 16;
    const x = (w - tw) / 2, y = 6;
    ctx.fillStyle = 'rgba(250,251,250,0.9)'; ctx.strokeStyle = 'rgba(27,29,34,0.25)'; ctx.lineWidth = 1;
    H.roundRect(ctx, x, y, tw, 18, 9); ctx.fill(); ctx.stroke();
    if (status.progress >= 0) { ctx.fillStyle = '#2f45ff'; ctx.fillRect(x + 8, y + 15, (tw - 16) * status.progress, 1.5); }
    ctx.fillStyle = '#1b1d22'; ctx.fillText(txt, x + 8, y + 12.5);
  }

  function frame() {
    const now = performance.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    const { w, h, dpr } = H.fitCanvas(cv);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = h / 220;
    let act = status.act || 'idle', emo = status.emo || 'neutral';
    if (motion.walking && motion.mode === 'walk') act = 'walk';
    if (motion.dragging) { act = 'surprised'; emo = 'surprised'; }
    if (now - poked < 1300) { act = 'happy'; emo = 'love'; }
    const floatBob = motion.mode === 'float' && !motion.dragging ? Math.sin(t * 1.6) * 5 * s : 0;
    const base = h - 10 * s + floatBob;
    /* shadow */
    if (motion.mode !== 'float') { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 8 * s, 34 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 4 * s, (26 - floatBob / s) * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save();
    ctx.translate(w / 2, base);
    if (motion.dragging) ctx.rotate(Math.sin(t * 6) * 0.12);
    const sc = 0.92 * s;
    ctx.scale(sc * (motion.dir < 0 && act === 'walk' ? -1 : 1), sc);
    H.drawCharacter(ctx, status.cfg, { t, act, emo, seated: false, blink: H.blinkAt(t, 5), look: { x: Math.sin(t * 0.5), y: 0 }, facing: act === 'walk' ? 1 : 0, talk: now < lineUntil - 2000 ? Math.abs(Math.sin(t * 16)) : 0 });
    ctx.restore();
    if (status.playing && act !== 'sleep') {
      ctx.fillStyle = '#5b6cff'; ctx.font = `${14 * s}px "Segoe UI Symbol"`;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3); ctx.fillText('♪', w * 0.78, h * 0.45 - Math.sin(t * 2) * 6); ctx.globalAlpha = 1;
    }
    if (opts.bubble !== false) {
      if (line && now < lineUntil) bubble(line, w, 4);
      else pill(w);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(window.H);
