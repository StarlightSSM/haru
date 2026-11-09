/* HARU — procedural chibi character (used by the room and the desktop mini avatar) */
(function (H) {
  'use strict';

  H.SPECIES = [
    { id: 'human', ko: '사람' }, { id: 'cat', ko: '고양이' }, { id: 'bunny', ko: '토끼' },
    { id: 'bear', ko: '곰' }, { id: 'fox', ko: '여우' }, { id: 'sprout', ko: '새싹 요정' },
  ];
  H.HAIR_STYLES = [
    { id: 'bob', ko: '단발' }, { id: 'long', ko: '긴 머리' }, { id: 'short', ko: '짧은 머리' },
    { id: 'bun', ko: '똥머리' }, { id: 'twin', ko: '양갈래' }, { id: 'messy', ko: '부스스' },
  ];
  H.OUTFITS = [{ id: 'hoodie', ko: '후드티' }, { id: 'overall', ko: '멜빵' }, { id: 'sweater', ko: '스웨터' }, { id: 'smock', ko: '화가 앞치마' }];
  H.ACCESSORIES = [
    { id: 'headphones', ko: '헤드폰' }, { id: 'beret', ko: '베레모' }, { id: 'glasses', ko: '안경' },
    { id: 'ribbon', ko: '리본' }, { id: 'flower', ko: '꽃' }, { id: 'scarf', ko: '목도리' }, { id: 'none', ko: '없음' },
  ];
  H.DEFAULT_CHARACTER = {
    species: 'cat', hairStyle: 'bob', outfit: 'hoodie', accessory: 'headphones',
    skin: '#fbe3d3', hair: '#3d3557', eye: '#2b2840', cloth: '#7d8cff', accent: '#ffcf6b', cheek: true, voice: 1.0,
  };

  const INK = '#2e2a3a';

  /* pose: { t, act, facing, blink(0..1 open), look:{x,y}, emo, seated, held, talk(0..1), walkPhase } */
  H.drawCharacter = function (ctx, cfg, pose) {
    cfg = Object.assign({}, H.DEFAULT_CHARACTER, cfg || {});
    const t = pose.t || 0;
    const act = pose.act || 'idle';
    const face = pose.facing || 0;
    const seated = !!pose.seated;
    const emo = pose.emo || 'neutral';
    const lw = 2.2;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (seated) ctx.translate(0, 22);

    const breath = Math.sin(t * 2.1) * 0.012;
    let bounce = 0, headTilt = Math.sin(t * 0.7) * 0.02, bodyLean = 0;
    if (act === 'happy') bounce = Math.abs(Math.sin(t * 9)) * -5;
    if (act === 'walk') bounce = Math.abs(Math.sin(t * 10)) * -3;
    if (act === 'type') { headTilt = 0.04 + Math.sin(t * 1.3) * 0.03; }
    if (act === 'paint') { headTilt = 0.06 * (face || 1); bodyLean = 0.03 * (face || 1); }
    if (act === 'sleep') { headTilt = 0.22; bounce = 4; }
    if (act === 'think') headTilt = -0.08;
    if (act === 'listen') headTilt = Math.sin(t * 3) * 0.08;
    if (act === 'surprised') bounce = -6;
    if (act === 'dance') { bounce = Math.abs(Math.sin(t * 6)) * -6; headTilt = Math.sin(t * 6) * 0.12; bodyLean = Math.sin(t * 6) * 0.05; }
    ctx.translate(0, bounce);
    ctx.rotate(bodyLean);

    const C = cfg.cloth, Cd = H.shade(C, -0.18), Cl = H.shade(C, 0.25);
    const hairD = H.shade(cfg.hair, -0.15);
    const pants = H.shade(cfg.cloth, -0.45);

    /* ---------- tail (behind) ---------- */
    drawTail(ctx, cfg, t, act, lw);

    /* ---------- legs ---------- */
    if (!seated) {
      const wp = act === 'walk' ? Math.sin(t * 10) : 0;
      [-1, 1].forEach((s) => {
        const lift = act === 'walk' ? Math.max(0, wp * s) * 5 : 0;
        ctx.fillStyle = pants; ctx.strokeStyle = INK; ctx.lineWidth = lw;
        H.roundRect(ctx, s * 11 - 5, -24 - lift, 10, 20, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fafafa';
        ctx.beginPath(); ctx.ellipse(s * 12, -4 - lift, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }

    /* ---------- body ---------- */
    ctx.save();
    ctx.scale(1, 1 + breath);
    const top = -68, hem = -20;
    ctx.fillStyle = C; ctx.strokeStyle = INK; ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-21, top + 2);
    ctx.quadraticCurveTo(-27, (top + hem) / 2, -28, hem);
    ctx.quadraticCurveTo(0, hem + 7, 28, hem);
    ctx.quadraticCurveTo(27, (top + hem) / 2, 21, top + 2);
    ctx.quadraticCurveTo(0, top - 6, -21, top + 2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (cfg.outfit === 'hoodie') {
      ctx.fillStyle = Cd; ctx.beginPath(); ctx.ellipse(0, top + 1, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = Cl; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-5, top + 6); ctx.lineTo(-6, top + 20); ctx.moveTo(5, top + 6); ctx.lineTo(6, top + 20); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.fillStyle = Cd;
      H.roundRect(ctx, -14, -40, 28, 11, 4); ctx.fill(); ctx.stroke();
    } else if (cfg.outfit === 'overall') {
      ctx.fillStyle = '#f7f3ea'; ctx.beginPath(); ctx.ellipse(0, top + 3, 13, 6, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = H.shade(cfg.accent, -0.1); ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      H.roundRect(ctx, -15, -52, 30, 30, 5); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, -52); ctx.lineTo(-16, top + 3); ctx.moveTo(12, -52); ctx.lineTo(16, top + 3); ctx.lineWidth = 3; ctx.strokeStyle = H.shade(cfg.accent, -0.25); ctx.stroke();
      ctx.fillStyle = INK; [-9, 9].forEach((x) => { ctx.beginPath(); ctx.arc(x, -49, 1.6, 0, 7); ctx.fill(); });
    } else if (cfg.outfit === 'sweater') {
      ctx.strokeStyle = Cd; ctx.lineWidth = 1.4;
      for (let y = top + 10; y < hem - 2; y += 7) { ctx.beginPath(); ctx.moveTo(-22, y); ctx.lineTo(22, y + 1); ctx.stroke(); }
      ctx.fillStyle = Cl; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(0, top + 1, 14, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (cfg.outfit === 'smock') {
      ctx.fillStyle = '#f4efe4'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-15, top + 6); ctx.lineTo(-20, hem + 1); ctx.quadraticCurveTo(0, hem + 6, 20, hem + 1); ctx.lineTo(15, top + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ['#f06a6a', '#5ba3f0', '#f2c14e', '#6cc28a'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-8 + i * 5, -36 + (i % 2) * 7, 2.2, 0, 7); ctx.fill(); });
    }
    if (cfg.accessory === 'scarf') {
      ctx.fillStyle = cfg.accent; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      H.roundRect(ctx, -20, top - 4, 40, 11, 5); ctx.fill(); ctx.stroke();
      H.roundRect(ctx, 6, top + 4, 9, 18, 3); ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    /* ---------- arms ---------- */
    const hands = handTargets(act, t, face, pose);
    drawArms(ctx, cfg, hands, act, t, lw, pose);

    /* ---------- head ---------- */
    ctx.save();
    ctx.translate(0, -100);
    ctx.rotate(headTilt);
    drawHead(ctx, cfg, pose, act, emo, face, t, lw, hairD);
    ctx.restore();

    /* held items drawn above */
    drawHeld(ctx, cfg, hands, act, t, pose);

    ctx.restore();
  };

  function handTargets(act, t, face, pose) {
    const f = face || 1;
    switch (act) {
      case 'type': { const a = Math.sin(t * 18) > 0 ? 2 : 0, b = Math.sin(t * 18 + 1.7) > 0 ? 2 : 0; return { l: [-17, -42 - a], r: [17, -42 - b] }; }
      case 'paint': { const ang = t * 3.2; return { l: [-22 * f, -44], r: [30 * f + Math.cos(ang) * 6, -74 + Math.sin(ang * 1.3) * 7] }; }
      case 'read': return { l: [-13, -52 + Math.sin(t) * 1], r: [13, -52 + Math.sin(t) * 1] };
      case 'sleep': return { l: [-10, -40], r: [10, -40] };
      case 'think': return { l: [-22, -34], r: [6 * f, -80] };
      case 'surprised': return { l: [-30, -82], r: [30, -82] };
      case 'happy': return { l: [-7, -54], r: [7, -54] };
      case 'drink': { const sip = (Math.sin(t * 1.2) + 1) / 2; return { l: [-22, -36], r: [8, -60 - sip * 22] }; }
      case 'wave': return { l: [-24, -34], r: [34 + Math.sin(t * 9) * 6, -96] };
      case 'listen': return { l: [-35, -100], r: [35, -100] };
      case 'stretch': { const s = (Math.sin(t * 1.5) + 1) / 2; return { l: [-20 - s * 4, -140 - s * 10], r: [20 + s * 4, -140 - s * 10] }; }
      case 'walk': { const s = Math.sin(t * 10); return { l: [-24 - s * 4, -32], r: [24 - s * 4, -32] }; }
      case 'dance': { const s = Math.sin(t * 6); return { l: [-28, -70 + s * 20], r: [28, -70 - s * 20] }; }
      case 'grumpy': return { l: [-10, -50], r: [10, -50] };
      default: { const s = Math.sin(t * 1.4) * 1.5; return { l: [-25, -32 + s], r: [25, -32 - s] }; }
    }
  }

  function drawArms(ctx, cfg, hands, act, t, lw, pose) {
    const C = cfg.cloth;
    [['l', -1], ['r', 1]].forEach(([k, s]) => {
      const sx = s * 20, sy = -60;
      const [hx, hy] = hands[k];
      const ex = (sx + hx) / 2 + s * 7, ey = (sy + hy) / 2 + 6;
      ctx.strokeStyle = INK; ctx.lineWidth = 12 + lw * 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
      ctx.strokeStyle = C; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(ex, ey, hx, hy); ctx.stroke();
      ctx.fillStyle = cfg.skin; ctx.strokeStyle = INK; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }

  function drawHeld(ctx, cfg, hands, act, t, pose) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    if (act === 'read') {
      const [lx, ly] = hands.l, [rx] = hands.r;
      ctx.fillStyle = '#2f3240'; H.roundRect(ctx, lx - 4, ly - 22, rx - lx + 8, 26, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9ecff'; H.roundRect(ctx, lx - 1, ly - 19, rx - lx + 2, 20, 2); ctx.fill();
      ctx.fillStyle = '#7aa0d6';
      for (let i = 0; i < 4; i++) { const w = ((Math.sin(t * 0.8 + i) + 1) / 2) * 10 + 8; ctx.fillRect(lx + 1, ly - 16 + i * 4.5, w, 1.6); }
    } else if (act === 'paint') {
      const [rx, ry] = hands.r, [lx, ly] = hands.l;
      ctx.strokeStyle = '#8a5a3b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 12 * (pose.facing || 1), ry - 10); ctx.stroke();
      ctx.fillStyle = pose.brushColor || '#5b7cfa'; ctx.beginPath(); ctx.arc(rx + 13 * (pose.facing || 1), ry - 11, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8d2ae'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(lx, ly - 2, 14, 9, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ['#f06a6a', '#5ba3f0', '#f2c14e', pose.brushColor || '#6cc28a'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx - 8 + i * 5, ly - 4 + (i % 2) * 4, 2.2, 0, 7); ctx.fill(); });
    } else if (act === 'drink') {
      const [rx, ry] = hands.r;
      ctx.fillStyle = '#f5f1ea'; H.roundRect(ctx, rx - 6, ry - 12, 12, 14, 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(rx + 7, ry - 5, 3.5, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
  }

  function drawTail(ctx, cfg, t, act, lw) {
    const sp = cfg.species;
    ctx.strokeStyle = INK; ctx.lineWidth = lw;
    const wag = Math.sin(t * (act === 'happy' ? 8 : 2)) * (act === 'happy' ? 0.5 : 0.25);
    if (sp === 'cat') {
      ctx.save(); ctx.translate(18, -26); ctx.rotate(wag);
      ctx.strokeStyle = INK; ctx.lineWidth = 9 + lw * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(22, 4, 26, -24, 16, -36); ctx.stroke();
      ctx.strokeStyle = cfg.hair; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(22, 4, 26, -24, 16, -36); ctx.stroke();
      ctx.restore();
    } else if (sp === 'fox') {
      ctx.save(); ctx.translate(16, -26); ctx.rotate(wag * 0.6 - 0.3);
      ctx.fillStyle = H.mix(cfg.hair, '#e8874a', 0.5);
      ctx.beginPath(); ctx.ellipse(18, -10, 22, 11, -0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff8ef'; ctx.beginPath(); ctx.ellipse(32, -24, 8, 6, -0.7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (sp === 'bunny') {
      ctx.fillStyle = '#fffaf4'; ctx.beginPath(); ctx.arc(22, -24, 7, 0, 7); ctx.fill(); ctx.stroke();
    } else if (sp === 'bear') {
      ctx.fillStyle = cfg.hair; ctx.beginPath(); ctx.arc(22, -24, 6, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  function drawEars(ctx, cfg, lw, t, back) {
    const sp = cfg.species;
    ctx.strokeStyle = INK; ctx.lineWidth = lw;
    const inner = '#f6b8c6';
    if (sp === 'cat' || sp === 'fox') {
      if (!back) return;
      const big = sp === 'fox' ? 1.25 : 1;
      const twitch = Math.sin(t * 0.9) > 0.97 ? 0.15 : 0;
      [-1, 1].forEach((s) => {
        ctx.save(); ctx.translate(s * 24, -26); ctx.rotate(s * (0.32 + (s > 0 ? twitch : 0)));
        ctx.fillStyle = sp === 'fox' ? H.mix(cfg.hair, '#e8874a', 0.5) : cfg.hair;
        ctx.beginPath(); ctx.moveTo(-11 * big, 6); ctx.lineTo(0, -20 * big); ctx.lineTo(11 * big, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(-5 * big, 3); ctx.lineTo(0, -11 * big); ctx.lineTo(5 * big, 3); ctx.closePath(); ctx.fill();
        ctx.restore();
      });
    } else if (sp === 'bunny') {
      if (!back) return;
      [-1, 1].forEach((s) => {
        ctx.save(); ctx.translate(s * 13, -26); ctx.rotate(s * 0.18 + Math.sin(t * 1.3 + s) * 0.05 + (s > 0 ? 0.35 : 0));
        ctx.fillStyle = '#fffaf4';
        ctx.beginPath(); ctx.ellipse(0, -24, 8, 25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = inner; ctx.beginPath(); ctx.ellipse(0, -22, 3.5, 17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    } else if (sp === 'bear') {
      if (!back) return;
      [-1, 1].forEach((s) => {
        ctx.fillStyle = cfg.hair; ctx.beginPath(); ctx.arc(s * 25, -24, 10, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(s * 25, -24, 5, 0, 7); ctx.fill();
      });
    } else if (sp === 'sprout') {
      if (back) return;
      ctx.strokeStyle = '#4f8a4b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(2, -40, 0, -46); ctx.stroke();
      ctx.fillStyle = '#7cc46e'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      const sway = Math.sin(t * 1.6) * 0.2;
      [[-1, -0.6], [1, 0.6]].forEach(([s, a]) => { ctx.save(); ctx.translate(0, -46); ctx.rotate(a + sway); ctx.beginPath(); ctx.ellipse(s * 9, 0, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); });
    } else if (sp === 'human') {
      if (back) return;
      ctx.fillStyle = cfg.skin;
      [-1, 1].forEach((s) => { ctx.beginPath(); ctx.ellipse(s * 33, 2, 5, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    }
  }

  function drawHead(ctx, cfg, pose, act, emo, face, t, lw, hairD) {
    const fx = (face || 0) * 4;
    /* hair back */
    ctx.fillStyle = hairD; ctx.strokeStyle = INK; ctx.lineWidth = lw;
    const hs = cfg.hairStyle;
    if (hs === 'long') { ctx.beginPath(); ctx.moveTo(-36, -6); ctx.quadraticCurveTo(-42, 40, -30, 58); ctx.lineTo(30, 58); ctx.quadraticCurveTo(42, 40, 36, -6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (hs === 'bob') { ctx.beginPath(); ctx.moveTo(-37, -4); ctx.quadraticCurveTo(-42, 26, -30, 30); ctx.lineTo(30, 30); ctx.quadraticCurveTo(42, 26, 37, -4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (hs === 'twin') {
      [-1, 1].forEach((s) => { const sw = Math.sin(t * 2 + s) * 3; ctx.beginPath(); ctx.ellipse(s * 40 + sw, 22, 10, 24, s * -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    }
    if (hs === 'bun') { ctx.fillStyle = cfg.hair; ctx.beginPath(); ctx.arc(0, -36, 13, 0, 7); ctx.fill(); ctx.stroke(); }
    drawEars(ctx, cfg, lw, t, true);

    /* face */
    ctx.fillStyle = cfg.skin; ctx.strokeStyle = INK; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 31, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawEars(ctx, cfg, lw, t, false);

    /* blush */
    if (cfg.cheek || emo === 'happy' || emo === 'love') {
      ctx.fillStyle = emo === 'love' ? 'rgba(255,120,150,0.55)' : 'rgba(255,140,150,0.35)';
      [-1, 1].forEach((s) => { ctx.beginPath(); ctx.ellipse(s * 20 + fx * 0.6, 10, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); });
    }

    /* eyes */
    const blink = pose.blink ?? 1;
    const look = pose.look || { x: 0, y: 0 };
    const eyeY = 2;
    ctx.fillStyle = cfg.eye; ctx.strokeStyle = INK;
    [-1, 1].forEach((s) => {
      const ex = s * 13 + fx, ey = eyeY;
      ctx.lineWidth = 2.4;
      if (act === 'sleep' || emo === 'sleepy') {
        ctx.beginPath(); ctx.arc(ex, ey - 1, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      } else if (emo === 'happy' || emo === 'love') {
        ctx.beginPath(); ctx.arc(ex, ey + 3, 5.5, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
      } else if (emo === 'annoyed') {
        ctx.beginPath(); ctx.moveTo(ex - 5, ey); ctx.lineTo(ex + 5, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 6, ey - 9 + (s > 0 ? -2 : 2)); ctx.lineTo(ex + 6, ey - 9 + (s > 0 ? 2 : -2)); ctx.stroke();
      } else {
        const big = emo === 'surprised' ? 1.35 : 1;
        const open = emo === 'focus' ? 0.6 : 1;
        const h = 6.6 * big * Math.max(0.08, blink) * open;
        ctx.beginPath(); ctx.ellipse(ex + look.x * 1.5, ey + look.y * 1.2 + (1 - open) * 2, 4.6 * big, h, 0, 0, Math.PI * 2); ctx.fill();
        if (blink > 0.4) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ex + look.x * 1.5 - 1.5, ey - 2.4 * big + look.y, 1.7 * big, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + look.x * 1.5 + 1.6, ey + 2.2 * big + look.y, 0.9, 0, 7); ctx.fill();
          ctx.fillStyle = cfg.eye;
        }
        if (emo === 'focus') { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 6, ey - 4); ctx.lineTo(ex + 6, ey - 4); ctx.stroke(); }
        if (emo === 'sad') { ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(ex - 5, ey - 10 + (s > 0 ? 2 : -2)); ctx.lineTo(ex + 5, ey - 10 + (s > 0 ? -2 : 2)); ctx.stroke(); }
      }
    });

    /* mouth */
    const mx = fx * 0.8, my = 14;
    const talk = pose.talk || 0;
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = '#c4505e';
    if (talk > 0.05 || emo === 'surprised' || act === 'surprised') {
      const o = emo === 'surprised' ? 4 : 1.5 + talk * 3;
      ctx.beginPath(); ctx.ellipse(mx, my + 1, 3, o, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (emo === 'happy' || emo === 'love') {
      ctx.beginPath(); ctx.moveTo(mx - 5, my - 1); ctx.quadraticCurveTo(mx, my + 7, mx + 5, my - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (emo === 'annoyed' || emo === 'sad') {
      ctx.beginPath(); ctx.moveTo(mx - 4, my + 2); ctx.quadraticCurveTo(mx, my - 2, mx + 4, my + 2); ctx.stroke();
    } else if (cfg.species === 'cat' || cfg.species === 'fox') {
      ctx.beginPath(); ctx.moveTo(mx - 5, my); ctx.quadraticCurveTo(mx - 2.5, my + 3, mx, my); ctx.quadraticCurveTo(mx + 2.5, my + 3, mx + 5, my); ctx.stroke();
    } else if (emo === 'focus' || act === 'sleep') {
      ctx.beginPath(); ctx.moveTo(mx - 3, my + 1); ctx.lineTo(mx + 3, my + 1); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(mx - 4, my); ctx.quadraticCurveTo(mx, my + 4, mx + 4, my); ctx.stroke();
    }

    /* bangs */
    ctx.fillStyle = cfg.hair; ctx.strokeStyle = INK; ctx.lineWidth = lw;
    ctx.beginPath();
    if (hs === 'short' || hs === 'messy') {
      ctx.moveTo(-34, -2);
      ctx.quadraticCurveTo(-36, -34, 0, -34);
      ctx.quadraticCurveTo(36, -34, 34, -2);
      const tips = hs === 'messy' ? [[24, -12], [14, -6], [4, -14], [-8, -6], [-18, -13], [-28, -4]] : [[22, -14], [10, -10], [-2, -16], [-14, -10], [-26, -12]];
      tips.forEach(([x, y], i) => ctx.lineTo(x + fx * 0.4, y + (i % 2 ? 4 : 0)));
    } else {
      ctx.moveTo(-36, 4);
      ctx.quadraticCurveTo(-38, -36, 0, -35);
      ctx.quadraticCurveTo(38, -36, 36, 4);
      ctx.quadraticCurveTo(30, -8, 24, -10);
      ctx.quadraticCurveTo(18, -4, 12 + fx * 0.3, -12);
      ctx.quadraticCurveTo(4, -4, -4 + fx * 0.3, -13);
      ctx.quadraticCurveTo(-12, -4, -18, -11);
      ctx.quadraticCurveTo(-28, -8, -36, 4);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-6, -22, 14, 1.15 * Math.PI, 1.55 * Math.PI); ctx.stroke();

    /* accessories */
    ctx.strokeStyle = INK; ctx.lineWidth = lw;
    const acc = cfg.accessory;
    if (acc === 'headphones') {
      ctx.strokeStyle = INK; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, -2, 39, 1.05 * Math.PI, 1.95 * Math.PI); ctx.stroke();
      ctx.strokeStyle = cfg.accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, -2, 39, 1.05 * Math.PI, 1.95 * Math.PI); ctx.stroke();
      ctx.fillStyle = cfg.accent; ctx.strokeStyle = INK; ctx.lineWidth = lw;
      [-1, 1].forEach((s) => { H.roundRect(ctx, s * 37 - 7, -10, 14, 22, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = H.shade(cfg.accent, -0.2); H.roundRect(ctx, s * 37 - 3, -6, 6, 14, 3); ctx.fill(); ctx.fillStyle = cfg.accent; });
    } else if (acc === 'beret') {
      ctx.fillStyle = H.shade(cfg.accent, -0.3);
      ctx.beginPath(); ctx.ellipse(-6, -31, 30, 11, -0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, -42); ctx.lineTo(-4, -48); ctx.stroke();
    } else if (acc === 'glasses') {
      ctx.lineWidth = 1.8; ctx.strokeStyle = INK;
      [-1, 1].forEach((s) => { ctx.beginPath(); ctx.arc(s * 13 + fx, 2, 9, 0, Math.PI * 2); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(-4 + fx, 1); ctx.lineTo(4 + fx, 1); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; [-1, 1].forEach((s) => { ctx.beginPath(); ctx.arc(s * 13 + fx, 2, 8, 0, Math.PI * 2); ctx.fill(); });
    } else if (acc === 'ribbon') {
      ctx.fillStyle = cfg.accent;
      ctx.save(); ctx.translate(24, -26); ctx.rotate(0.3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -8); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, -8); ctx.lineTo(12, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (acc === 'flower') {
      ctx.save(); ctx.translate(-26, -24);
      ctx.fillStyle = cfg.accent;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + t * 0.2; ctx.beginPath(); ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 4, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    if (act === 'sleep') {
      ctx.fillStyle = INK; ctx.font = 'bold 12px "Segoe UI", sans-serif';
      for (let i = 0; i < 3; i++) { const p = ((t * 0.4 + i / 3) % 1); ctx.globalAlpha = 1 - p; ctx.fillText('z', 30 + p * 18, -30 - p * 30 - i * 2); }
      ctx.globalAlpha = 1;
    }
  }

  /* blinking helper: returns 0..1 eye openness */
  H.blinkAt = function (t, seed = 0) {
    const period = 3.6 + (seed % 7) * 0.2;
    const ph = (t + seed) % period;
    if (ph < 0.12) return Math.abs(ph - 0.06) / 0.06;
    return 1;
  };
})(window.H);
