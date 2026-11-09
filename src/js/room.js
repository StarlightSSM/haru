/* HARU — the atelier room: sky, weather, furniture, items, camera, particles */
(function (H) {
  'use strict';

  const W = 1600, HH = 900;
  H.ROOM_W = W; H.ROOM_H = HH;

  H.SPOTS = {
    desk: { x: 800, y: 640, seated: true, zone: 'desk' },
    easel: { x: 1150, y: 805, seated: false, zone: 'floor', facing: 1 },
    nook: { x: 300, y: 790, seated: true, zone: 'nook' },
    window: { x: 520, y: 805, seated: false, zone: 'floor', facing: -1 },
    center: { x: 480, y: 835, seated: false, zone: 'floor' },
    door: { x: 1520, y: 820, seated: false, zone: 'floor' },
  };

  H.CAMERAS = {
    wide: { x: 800, y: 450, z: 1, ko: '전체' },
    desk: { x: 800, y: 520, z: 1.9, ko: '책상' },
    close: { x: 800, y: 500, z: 3.0, ko: '가까이' },
    easel: { x: 1240, y: 600, z: 2.1, ko: '이젤' },
    window: { x: 470, y: 290, z: 1.85, ko: '창밖' },
    nook: { x: 330, y: 650, z: 2.1, ko: '책 읽는 곳' },
  };

  H.ITEMS = [
    { id: 'plant', ko: '몬스테라 화분', price: 30, desc: '방 구석에 초록을.' },
    { id: 'lights', ko: '전구 가랜드', price: 45, desc: '밤이 되면 창가가 반짝여요.' },
    { id: 'record', ko: '턴테이블', price: 80, desc: '음악이 흐르면 레코드가 돌아요. 바이닐 소리 +' },
    { id: 'kitty', ko: '창가의 고양이', price: 120, desc: '창틀에서 졸고 있는 작은 친구.' },
    { id: 'fish', ko: '금붕어 어항', price: 60, desc: '책장 위 작은 바다.' },
    { id: 'globe', ko: '지구본', price: 50, desc: '세계 장르를 배우면 반짝여요.' },
    { id: 'neon', ko: '키워드 네온', price: 150, desc: '오늘의 첫 번째 키워드가 벽에 빛나요.' },
    { id: 'rug', ko: '동그란 러그', price: 40, desc: '발이 따뜻해요.' },
    { id: 'telescope', ko: '망원경', price: 110, desc: '밤하늘의 별이 더 많이 보여요.' },
    { id: 'speaker', ko: '스탠드 스피커', price: 90, desc: '음악에 맞춰 콘이 울려요.' },
    { id: 'floorlamp', ko: '플로어 램프', price: 55, desc: '책 읽는 구석을 따뜻하게.' },
    { id: 'poster', ko: '세계 음악 포스터', price: 35, desc: '벽에 걸린 월드 뮤직 페스티벌 포스터.' },
  ];

  const SKY = [
    [0, '#0b1030', '#1d2350'], [4.5, '#141a46', '#3d3d72'], [6, '#4f6fb8', '#f2b48c'], [7.5, '#7fb4f0', '#d7e8f6'],
    [12, '#5d9fe6', '#c4e1f8'], [16, '#6ea5e2', '#dfe6ee'], [17.8, '#4d63aa', '#f2a46e'], [19.2, '#2b2f6c', '#b46c7c'],
    [20.5, '#141842', '#2f3264'], [24, '#0b1030', '#1d2350'],
  ];
  function skyAt(h) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0]); return [H.mix(a[1], b[1], t), H.mix(a[2], b[2], t)]; }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  H.skyColors = skyAt;
  H.daylight = function (h) {
    if (h < 5 || h > 21) return 0;
    if (h < 7.5) return (h - 5) / 2.5;
    if (h > 18.5) return 1 - (h - 18.5) / 2.5;
    return 1;
  };

  class Room {
    constructor() {
      this.cam = Object.assign({}, H.CAMERAS.wide);
      this.camTarget = Object.assign({}, H.CAMERAS.wide);
      this.particles = [];
      this.items = new Set();
      this.artworks = [];
      this.noise = H.makeNoise(7);
      this.clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * 700, y: 120 + Math.random() * 200, s: 0.6 + Math.random() * 0.8, v: 4 + Math.random() * 6 }));
      this.stars = Array.from({ length: 70 }, () => ({ x: 170 + Math.random() * 600, y: 90 + Math.random() * 300, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
      this.drops = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), v: 0.8 + Math.random() * 0.6 }));
      this.city = Array.from({ length: 22 }, (_, i) => ({ x: 170 + i * 28 + Math.random() * 6, w: 22 + Math.random() * 18, h: 40 + Math.random() * 90, lit: Array.from({ length: 12 }, () => Math.random() < 0.4) }));
      this.weather = null;
      this.hours = 12;
      this.lampOn = false;
      this.paintCanvas = null;
      this.neonText = '';
      this.flash = 0;
      this.musicLevel = 0;
      this.t = 0;
      this.view = { s: 1, ox: 0, oy: 0 };
    }

    setCamera(name, instant) {
      const c = H.CAMERAS[name] || H.CAMERAS.wide;
      this.camTarget = Object.assign({}, c);
      if (instant) this.cam = Object.assign({}, c);
    }
    setCameraTarget(x, y, z) { this.camTarget = { x, y, z }; }

    update(dt, pet) {
      this.t += dt;
      const k = 1 - Math.exp(-dt * 2.2);
      this.cam.x += (this.camTarget.x - this.cam.x) * k;
      this.cam.y += (this.camTarget.y - this.cam.y) * k;
      this.cam.z += (this.camTarget.z - this.cam.z) * k;
      this.clouds.forEach((c) => { c.x += c.v * dt * (this.weather && this.weather.wind ? 1 + this.weather.wind / 15 : 1); if (c.x > 820) c.x = -160; });
      this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
      this.particles.forEach((p) => {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.g) p.vy += p.g * dt;
        if (p.target) { p.x += (p.target.x - p.x) * dt * 1.4; p.y += (p.target.y - p.y) * dt * 1.4; }
      });
      if (this.flash > 0) this.flash -= dt;
      if (this.weather && this.weather.sky === 'storm' && Math.random() < dt * 0.05) this.flash = 0.25;
    }

    emit(p) { this.particles.push(Object.assign({ vx: 0, vy: -20, life: 2, max: p.life || 2 }, p, { max: p.life || 2 })); }

    /* compute view transform for a w×h viewport, cover-fitting the scene at camera zoom */
    computeView(w, h, cam) {
      cam = cam || this.cam;
      /* landscape: cover-fit; portrait (phones/tablets): show more of the room, extend wall/floor */
      const base = h > w ? Math.max(w / 1000, h / 1700) : Math.max(w / W, h / HH);
      const s = base * cam.z;
      const halfW = w / s / 2, halfH = h / s / 2;
      const cx = halfW * 2 >= W ? W / 2 : H.clamp(cam.x, halfW, W - halfW);
      const cy = halfH * 2 >= HH ? HH - halfH + 40 : H.clamp(cam.y, halfH, HH - halfH);
      return { s, ox: w / 2 - cx * s, oy: h / 2 - cy * s };
    }
    toScreen(x, y) { const v = this.view; return { x: x * v.s + v.ox, y: y * v.s + v.oy }; }
    toWorld(x, y) { const v = this.view; return { x: (x - v.ox) / v.s, y: (y - v.oy) / v.s }; }

    hitTest(sx, sy, pet) {
      const p = this.toWorld(sx, sy);
      if (pet) {
        const sc = 1.5, top = pet.y - 150 * sc + (pet.seated ? 22 * sc : 0);
        if (Math.abs(p.x - pet.x) < 50 * sc && p.y > top && p.y < pet.y + 10) return 'pet';
      }
      if (p.x > 170 && p.x < 770 && p.y > 90 && p.y < 470) return 'window';
      if (p.x > 1200 && p.x < 1430 && p.y > 450 && p.y < 690) return 'easel';
      if (p.x > 560 && p.x < 1040 && p.y > 590 && p.y < 780) return 'desk';
      if (this.items.has('kitty') && p.x > 640 && p.x < 760 && p.y > 430 && p.y < 480) return 'kitty';
      if (p.x > 1100 && p.x < 1450 && p.y > 120 && p.y < 260) return 'shelf';
      return null;
    }

    draw(ctx, w, h, pet, opts = {}) {
      const cam = opts.cam || this.cam;
      const v = this.computeView(w, h, cam);
      if (!opts.cam) this.view = v;
      const t = this.t;
      const hrs = this.hours;
      const day = H.daylight(hrs);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (opts.dpr) ctx.scale(opts.dpr, opts.dpr);
      ctx.translate(v.ox, v.oy);
      ctx.scale(v.s, v.s);

      this.drawWall(ctx, day);
      this.drawWindow(ctx, hrs, day, t);
      this.drawWallDecor(ctx, t);
      this.drawShelf(ctx, t);
      this.drawFloor(ctx, day);
      this.drawNook(ctx, t, false);
      this.drawEasel(ctx, t);
      const behindDesk = pet && pet.y < 700;
      if (pet && behindDesk) this.drawPet(ctx, pet);
      this.drawDesk(ctx, t, pet);
      if (pet && !behindDesk) this.drawPet(ctx, pet);
      if (pet && pet.spot === 'nook') this.drawNook(ctx, t, true);
      this.drawFrontItems(ctx, t);
      this.drawParticles(ctx);
      this.drawLighting(ctx, day, hrs, t);
      ctx.restore();
    }

    drawWall(ctx, day) {
      const wall = H.mix('#4b4a63', '#efe9df', 0.35 + day * 0.65);
      ctx.fillStyle = wall; ctx.fillRect(-400, -2000, W + 800, 2705);
      ctx.fillStyle = H.mix('#3a3036', '#b8936f', 0.3 + day * 0.7); ctx.fillRect(-400, 895, W + 800, 2000);
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(-400, -24, W + 800, 6);
      ctx.fillStyle = H.mix(wall, '#c9bfae', 0.35); ctx.fillRect(0, 560, W, 145);
      ctx.strokeStyle = H.rgba('#000000', 0.08); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 560); ctx.lineTo(W, 560); ctx.stroke();
      ctx.strokeStyle = H.rgba('#000000', 0.04); ctx.lineWidth = 1;
      for (let x = 40; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 566); ctx.lineTo(x, 700); ctx.stroke(); }
    }

    drawWindow(ctx, hrs, day, t) {
      const x0 = 170, y0 = 90, x1 = 770, y1 = 470;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
      let [top, bot] = skyAt(hrs);
      const wx = this.weather;
      const gray = wx ? ({ cloudy: 0.45, rain: 0.6, storm: 0.7, fog: 0.55, snow: 0.4, partly: 0.12 }[wx.sky] || 0) : 0;
      if (gray) { top = H.mix(top, H.mix('#7d8597', '#1d2030', 1 - day), gray); bot = H.mix(bot, H.mix('#aab1bd', '#2a2d40', 1 - day), gray); }
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, top); g.addColorStop(1, bot);
      ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      /* stars */
      if (day < 0.6) {
        const tele = this.items.has('telescope') ? 1.6 : 1;
        this.stars.forEach((s, i) => {
          if (i > 70 / (tele > 1 ? 1 : 1.6)) return;
          ctx.fillStyle = `rgba(255,255,240,${(0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s.p))) * (1 - day / 0.6) * (1 - gray)})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * tele * 0.8, 0, 7); ctx.fill();
        });
      }
      /* sun / moon */
      const arc = (h0, h1) => { const p = (hrs - h0) / (h1 - h0); return { x: x0 + 40 + p * (x1 - x0 - 80), y: y1 - 60 - Math.sin(Math.PI * H.clamp(p, 0, 1)) * 240, p }; };
      if (hrs > 5.5 && hrs < 19.5) {
        const s = arc(5.5, 19.5);
        const sg = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 70);
        sg.addColorStop(0, `rgba(255,244,214,${0.95 * (1 - gray)})`); sg.addColorStop(0.3, `rgba(255,226,170,${0.4 * (1 - gray)})`); sg.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(s.x, s.y, 70, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(255,250,232,${1 - gray * 0.8})`; ctx.beginPath(); ctx.arc(s.x, s.y, 20, 0, 7); ctx.fill();
      } else {
        const hh = hrs < 12 ? hrs + 24 : hrs;
        const m = arc(19, 30);
        void hh;
        const mm = { x: x0 + 80 + ((hrs + 24 - 19) % 24) / 11 * (x1 - x0 - 160), y: y0 + 110 + Math.cos(((hrs + 24 - 19) % 24) / 11 * Math.PI) * 30 };
        void m;
        ctx.fillStyle = `rgba(250,246,226,${0.95 - gray * 0.6})`; ctx.beginPath(); ctx.arc(mm.x, mm.y, 18, 0, 7); ctx.fill();
        ctx.fillStyle = top; ctx.beginPath(); ctx.arc(mm.x + 8, mm.y - 5, 15, 0, 7); ctx.fill();
      }
      /* clouds */
      const cloudCol = H.mix(H.mix('#ffffff', '#ffd7c2', hrs > 17 && hrs < 20 ? 0.6 : 0), '#3a3f60', 1 - day);
      const nClouds = 3 + Math.round(gray * 4);
      this.clouds.slice(0, nClouds).forEach((c) => {
        ctx.fillStyle = H.rgba(cloudCol, 0.75 + gray * 0.2);
        const cx = x0 + c.x, cy = c.y, s = c.s * (1 + gray * 0.5);
        [[0, 0, 34], [30, -12, 28], [58, 2, 30], [-28, 6, 24], [86, 8, 20]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, 7); ctx.fill(); });
      });
      /* city */
      this.city.forEach((b, i) => {
        const by = y1 - b.h;
        ctx.fillStyle = H.mix('#9aa6bb', '#1a1c33', 1 - day * 0.85);
        ctx.fillRect(b.x, by, b.w, b.h);
        if (day < 0.7) {
          b.lit.forEach((on, k) => {
            if (!on) return;
            const col = k % 2, row = Math.floor(k / 2);
            const lx = b.x + 4 + col * (b.w / 2 - 2), ly = by + 6 + row * 11;
            if (ly > y1 - 6) return;
            ctx.fillStyle = `rgba(255,214,130,${(0.9 - day) * (0.6 + 0.4 * Math.sin(t * 0.3 + i + k))})`;
            ctx.fillRect(lx, ly, 5, 5);
          });
        }
      });
      /* weather */
      if (wx && (wx.sky === 'rain' || wx.sky === 'storm')) {
        ctx.strokeStyle = `rgba(220,230,255,${0.35 + 0.2 * (1 - day)})`; ctx.lineWidth = 1.2;
        this.drops.forEach((d) => {
          d.y = (d.y + d.v * 0.016 * 1.6) % 1;
          const x = x0 + d.x * (x1 - x0), y = y0 + d.y * (y1 - y0);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); ctx.stroke();
        });
      } else if (wx && wx.sky === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        this.drops.forEach((d, i) => {
          d.y = (d.y + d.v * 0.016 * 0.25) % 1;
          const x = x0 + ((d.x + Math.sin(t * 0.8 + i) * 0.02) % 1) * (x1 - x0), y = y0 + d.y * (y1 - y0);
          ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3) * 0.7, 0, 7); ctx.fill();
        });
      } else if (wx && wx.sky === 'fog') {
        ctx.fillStyle = 'rgba(220,224,232,0.35)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 2})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
      /* glass reflection */
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(x0 + 40, y0); ctx.lineTo(x0 + 140, y0); ctx.lineTo(x0 + 20, y1); ctx.lineTo(x0 - 80, y1); ctx.fill();
      ctx.restore();
      /* frame */
      const frame = '#f6f2ea';
      ctx.strokeStyle = frame; ctx.lineWidth = 14;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, y0); ctx.lineTo((x0 + x1) / 2, y1); ctx.moveTo(x0, 250); ctx.lineTo(x1, 250); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 - 7, y0 - 7, x1 - x0 + 14, y1 - y0 + 14);
      /* sill */
      ctx.fillStyle = '#efe7da'; ctx.fillRect(x0 - 26, y1 + 4, x1 - x0 + 52, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x0 - 26, y1 + 20, x1 - x0 + 52, 5);
      /* curtains */
      const sway = Math.sin(t * 0.6) * 4;
      [[x0 - 48, 1], [x1 + 18, -1]].forEach(([cx, s]) => {
        ctx.fillStyle = '#c9d3e6';
        ctx.beginPath(); ctx.moveTo(cx, y0 - 30); ctx.lineTo(cx + 30, y0 - 30);
        ctx.quadraticCurveTo(cx + 30 + sway * s, (y0 + y1) / 2, cx + 26 + sway, y1 + 40); ctx.lineTo(cx - 4, y1 + 40);
        ctx.quadraticCurveTo(cx + sway * s * 0.5, (y0 + y1) / 2, cx, y0 - 30); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx + 12, y0 - 20); ctx.quadraticCurveTo(cx + 12 + sway, (y0 + y1) / 2, cx + 12, y1 + 36); ctx.stroke();
      });
      ctx.fillStyle = '#8a8070'; ctx.fillRect(x0 - 60, y0 - 36, x1 - x0 + 120, 6);
      /* fairy lights */
      if (this.items.has('lights')) {
        for (let i = 0; i <= 18; i++) {
          const lx = x0 - 20 + i * (x1 - x0 + 40) / 18, ly = y0 - 20 + Math.sin(i / 18 * Math.PI) * 26;
          const on = 0.6 + 0.4 * Math.sin(t * 2 + i * 1.7);
          const c = ['#ffd27a', '#ff9db0', '#9fd8ff', '#b8f5a8'][i % 4];
          ctx.fillStyle = H.rgba(c, 0.5 + on * 0.5); ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let i = 0; i <= 18; i++) { const lx = x0 - 20 + i * (x1 - x0 + 40) / 18, ly = y0 - 20 + Math.sin(i / 18 * Math.PI) * 26; i ? ctx.lineTo(lx, ly) : ctx.moveTo(lx, ly); } ctx.stroke();
      }
      /* sill items */
      this.drawPot(ctx, 220, y1 + 4, 0.8, t);
      if (this.items.has('kitty')) this.drawKitty(ctx, 700, y1 + 6, t);
    }

    drawPot(ctx, x, y, s, t) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.fillStyle = '#5d9a5a';
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.45 + Math.sin(t + i) * 0.04; ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, -26, 8, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#d98b62'; ctx.beginPath(); ctx.moveTo(-16, -18); ctx.lineTo(16, -18); ctx.lineTo(12, 0); ctx.lineTo(-12, 0); ctx.fill();
      ctx.restore();
    }

    drawKitty(ctx, x, y, t) {
      ctx.save(); ctx.translate(x, y);
      const br = Math.sin(t * 1.5) * 1.5;
      ctx.fillStyle = '#f1e2c8'; ctx.strokeStyle = '#2e2a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -14 - br * 0.3, 30, 15 + br * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-26, -20, 13, 0, 7); ctx.fill(); ctx.stroke();
      [[-34, -30], [-19, -31]].forEach(([ex, ey]) => { ctx.beginPath(); ctx.moveTo(ex - 5, ey + 4); ctx.lineTo(ex, ey - 6); ctx.lineTo(ex + 5, ey + 4); ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.arc(-30, -20, 2.5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.moveTo(-20, -20); ctx.arc(-22, -20, 2.5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      ctx.strokeStyle = '#2e2a3a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(26, -8); ctx.quadraticCurveTo(44, -4 + Math.sin(t) * 4, 36, -22); ctx.stroke();
      ctx.strokeStyle = '#f1e2c8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(26, -8); ctx.quadraticCurveTo(44, -4 + Math.sin(t) * 4, 36, -22); ctx.stroke();
      ctx.fillStyle = '#d8a46a'; ctx.beginPath(); ctx.ellipse(6, -22, 9, 5, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawWallDecor(ctx, t) {
      /* clock */
      const now = new Date();
      const cx = 960, cy = 150;
      ctx.fillStyle = '#fbf8f2'; ctx.strokeStyle = '#2e2a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 34, 0, 7); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.lineWidth = i % 3 ? 1 : 2; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * 27, cy - Math.cos(a) * 27); ctx.lineTo(cx + Math.sin(a) * 31, cy - Math.cos(a) * 31); ctx.stroke(); }
      const hh = this.hours, mm = (hh % 1) * 60;
      const ha = (hh % 12) / 12 * Math.PI * 2, ma = mm / 60 * Math.PI * 2;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ha) * 16, cy - Math.cos(ha) * 16); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ma) * 24, cy - Math.cos(ma) * 24); ctx.stroke();
      ctx.strokeStyle = '#e0574f'; ctx.lineWidth = 1; const sa = now.getSeconds() / 60 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(sa) * 27, cy - Math.cos(sa) * 27); ctx.stroke();

      /* framed artworks (past works) */
      const frames = [[850, 250, 110, 110], [978, 262, 84, 84], [870, 380, 70, 70], [960, 372, 100, 80]];
      frames.forEach(([x, y, w, h], i) => {
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x + 4, y + 5, w, h);
        ctx.fillStyle = '#fbf8f1'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#3b3644'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
        const img = this.artworks[i];
        if (img && img.complete && img.naturalWidth) {
          const sw = img.naturalWidth, sh = Math.min(img.naturalHeight, sw);
          ctx.drawImage(img, 0, 0, sw, sh, x + 7, y + 7, w - 14, h - 14);
        } else {
          ctx.strokeStyle = '#d8d2c6'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(x + 10, y + 10, w - 20, h - 20); ctx.setLineDash([]);
        }
      });
      if (this.items.has('poster')) {
        ctx.save(); ctx.translate(60, 140); ctx.rotate(-0.03);
        ctx.fillStyle = '#f2e3c7'; ctx.fillRect(0, 0, 80, 116);
        ctx.fillStyle = '#e0574f'; ctx.beginPath(); ctx.arc(40, 44, 24, 0, 7); ctx.fill();
        ctx.fillStyle = '#2f45ff'; ctx.fillRect(10, 72, 60, 4); ctx.fillRect(10, 80, 40, 4);
        ctx.fillStyle = '#2e2a3a'; ctx.font = 'bold 9px Consolas, monospace'; ctx.fillText('WORLD', 12, 100); ctx.fillText('SOUND FEST', 12, 110);
        ctx.restore();
      }
      if (this.items.has('neon') && this.neonText) {
        ctx.save(); ctx.font = '600 34px "Segoe UI", "Malgun Gothic", sans-serif'; ctx.textAlign = 'center';
        const flick = 0.85 + 0.15 * Math.sin(t * 13) * (Math.random() < 0.02 ? 0 : 1);
        ctx.shadowColor = '#ff5fa2'; ctx.shadowBlur = 18; ctx.fillStyle = `rgba(255,140,190,${flick})`;
        ctx.fillText(this.neonText.slice(0, 10), 1270, 92);
        ctx.restore();
      }
    }

    drawShelf(ctx, t) {
      ctx.fillStyle = '#b48a64'; ctx.fillRect(1100, 250, 360, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(1100, 262, 360, 5);
      const books = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#6d6875', '#b5838d', '#457b9d'];
      let x = 1112;
      books.forEach((c, i) => { const h = 48 + (i * 13) % 26, w = 14 + (i % 3) * 4; ctx.fillStyle = c; ctx.fillRect(x, 250 - h, w, h); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + 3, 250 - h + 8, w - 6, 3); x += w + 2; });
      ctx.save(); ctx.translate(x + 6, 248); ctx.rotate(-0.25); ctx.fillStyle = '#a8dadc'; ctx.fillRect(0, -46, 15, 46); ctx.restore();
      if (this.items.has('record')) {
        const rx = 1330, ry = 238;
        ctx.fillStyle = '#7b5b45'; H.roundRect(ctx, rx - 46, ry - 10, 92, 20, 3); ctx.fill();
        ctx.save(); ctx.translate(rx - 6, ry - 16); ctx.scale(1, 0.32);
        ctx.fillStyle = '#1d1d24'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill();
        ctx.rotate(t * (this.musicLevel > 0.01 ? 3.5 : 0));
        ctx.fillStyle = '#e0574f'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(4, -1, 6, 2);
        ctx.restore();
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx + 34, ry - 22); ctx.lineTo(rx + 18, ry - 14); ctx.stroke();
      }
      if (this.items.has('fish')) {
        const fx = 1410, fy = 212;
        ctx.fillStyle = 'rgba(170,220,255,0.55)'; ctx.strokeStyle = 'rgba(80,120,160,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fx, fy, 30, 0.15 * Math.PI, 2.85 * Math.PI); ctx.fill(); ctx.stroke();
        const sx = fx + Math.sin(t * 0.9) * 14;
        ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.ellipse(sx, fy + 4, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); const d = Math.cos(t * 0.9) > 0 ? -1 : 1; ctx.moveTo(sx + d * 7, fy + 4); ctx.lineTo(sx + d * 14, fy - 1); ctx.lineTo(sx + d * 14, fy + 9); ctx.fill();
      }
      /* second shelf with plants */
      ctx.fillStyle = '#b48a64'; ctx.fillRect(1150, 380, 280, 10);
      this.drawPot(ctx, 1190, 380, 0.7, t + 1);
      ctx.fillStyle = '#e8e2d6'; ctx.fillRect(1240, 340, 40, 40); ctx.fillStyle = '#5b7cfa'; ctx.beginPath(); ctx.arc(1260, 360, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#f3c26b'; ctx.fillRect(1300, 352, 60, 28);
      ctx.fillStyle = '#2e2a3a'; ctx.font = '9px Consolas, monospace'; ctx.fillText('HARU', 1312, 370);
    }

    drawFloor(ctx, day) {
      const g = ctx.createLinearGradient(0, 700, 0, HH);
      g.addColorStop(0, H.mix('#5a4a4a', '#cfae8a', 0.3 + day * 0.7)); g.addColorStop(1, H.mix('#3a3036', '#b8936f', 0.3 + day * 0.7));
      ctx.fillStyle = g; ctx.fillRect(0, 700, W, HH - 700);
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { const y = 705 + i * i * 3.2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let i = -10; i < 22; i++) { ctx.beginPath(); ctx.moveTo(800 + i * 60, 705); ctx.lineTo(800 + i * 120, HH); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 700, W, 6);
      /* window light on floor */
      if (day > 0.2) {
        ctx.fillStyle = `rgba(255,240,200,${0.12 * day})`;
        ctx.beginPath(); ctx.moveTo(260, 720); ctx.lineTo(720, 720); ctx.lineTo(860, 880); ctx.lineTo(300, 880); ctx.fill();
      }
      if (this.items.has('rug')) {
        ctx.fillStyle = '#e6b8a2'; ctx.beginPath(); ctx.ellipse(800, 830, 300, 52, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f7e1d3'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(800, 830, 260, 40, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(120,140,190,0.35)'; H.roundRect(ctx, 560, 790, 480, 70, 8); ctx.fill();
      }
      if (this.items.has('plant')) {
        ctx.save(); ctx.translate(90, 800);
        ctx.fillStyle = '#4f8d57';
        [[-40, -120, -0.6], [30, -140, 0.4], [-10, -175, 0], [50, -95, 0.9], [-55, -80, -1]].forEach(([x, y, a], i) => {
          ctx.save(); ctx.translate(x * 0.5, y * 0.5 + Math.sin(this.t + i) * 2); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -30, 26, 40, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3d7346'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -62); ctx.stroke(); ctx.restore();
        });
        ctx.fillStyle = '#e9e1d4'; ctx.beginPath(); ctx.moveTo(-36, -50); ctx.lineTo(36, -50); ctx.lineTo(28, 10); ctx.lineTo(-28, 10); ctx.fill();
        ctx.restore();
      }
      if (this.items.has('telescope')) {
        ctx.save(); ctx.translate(800, 790); ctx.strokeStyle = '#4b4f63'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, 50); ctx.moveTo(0, 0); ctx.lineTo(20, 50); ctx.moveTo(0, 0); ctx.lineTo(0, 52); ctx.stroke();
        ctx.rotate(-0.7); ctx.fillStyle = '#d9d4e8'; H.roundRect(ctx, -10, -16, 90, 20, 6); ctx.fill(); ctx.strokeStyle = '#2e2a3a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }

    drawNook(ctx, t, front) {
      const x = 300, y = 800;
      if (!front) {
        if (this.items.has('floorlamp')) {
          ctx.strokeStyle = '#3b3644'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(470, 805); ctx.lineTo(470, 520); ctx.quadraticCurveTo(470, 490, 440, 490); ctx.stroke();
          ctx.fillStyle = '#f2d39b'; ctx.beginPath(); ctx.moveTo(410, 470); ctx.lineTo(470, 470); ctx.lineTo(484, 510); ctx.lineTo(396, 510); ctx.fill();
          ctx.fillStyle = '#3b3644'; ctx.beginPath(); ctx.ellipse(470, 806, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#e9a77c';
        ctx.beginPath(); ctx.ellipse(x, y - 30, 120, 70, 0, Math.PI, 0); ctx.ellipse(x, y - 10, 130, 36, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(x - 40, y - 70, 40, 18, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c9d8f2'; H.roundRect(ctx, x + 50, y - 64, 60, 40, 14); ctx.fill();
      } else {
        ctx.fillStyle = '#dd9a70';
        ctx.beginPath(); ctx.ellipse(x, y - 4, 128, 30, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#a7bfe6'; ctx.beginPath(); ctx.moveTo(x - 90, y - 30); ctx.quadraticCurveTo(x, y - 52, x + 80, y - 26); ctx.lineTo(x + 70, y + 8); ctx.quadraticCurveTo(x, y + 16, x - 84, y + 6); ctx.fill();
      }
    }

    drawEasel(ctx, t) {
      const x0 = 1215, y0 = 470, s = 200;
      ctx.strokeStyle = '#8a6040'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(x0 + 30, 805); ctx.lineTo(x0 + s / 2, y0 - 40); ctx.lineTo(x0 + s - 30, 805); ctx.moveTo(x0 + s / 2, y0 - 40); ctx.lineTo(x0 + s / 2 + 20, 800); ctx.stroke();
      ctx.fillStyle = '#9b6e4b'; ctx.fillRect(x0 - 14, y0 + s, s + 28, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x0 + 5, y0 + 6, s, s);
      ctx.fillStyle = '#fbf9f4'; ctx.fillRect(x0, y0, s, s);
      if (this.paintCanvas) ctx.drawImage(this.paintCanvas, x0, y0, s, s);
      ctx.strokeStyle = '#d9d2c4'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, s, s);
      ctx.fillStyle = '#e9e2d6'; ctx.fillRect(1380, 760, 80, 40);
      ['#f06a6a', '#5ba3f0', '#f2c14e', '#6cc28a'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(1392 + i * 18, 754, 7, 0, 7); ctx.fill(); });
    }

    drawDesk(ctx, t, pet) {
      /* lamp */
      const lx = 610;
      ctx.strokeStyle = '#3b3644'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(lx, 600); ctx.lineTo(lx + 20, 500); ctx.lineTo(lx + 80, 470); ctx.stroke();
      ctx.fillStyle = '#3b3644'; ctx.beginPath(); ctx.ellipse(lx, 602, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(lx + 82, 470); ctx.rotate(0.5);
      ctx.fillStyle = this.lampLit ? '#ffd88a' : '#f0c35a'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(14, -26); ctx.lineTo(-14, -26); ctx.closePath(); ctx.fill();
      ctx.restore();
      /* desktop */
      ctx.fillStyle = '#c99b72'; ctx.fillRect(560, 600, 480, 16);
      ctx.fillStyle = '#b5885f'; ctx.fillRect(560, 616, 480, 10);
      ctx.fillStyle = '#a77b55'; ctx.fillRect(580, 626, 440, 120);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(600, 650, 190, 70); ctx.fillRect(810, 650, 190, 70);
      ctx.fillStyle = '#e8d3b8'; ctx.fillRect(690, 682, 20, 5); ctx.fillRect(900, 682, 20, 5);
      ctx.fillStyle = '#8f6646'; ctx.fillRect(585, 746, 18, 58); ctx.fillRect(997, 746, 18, 58);
      /* keyboard */
      ctx.fillStyle = '#2f3240'; H.roundRect(ctx, 715, 588, 170, 16, 3); ctx.fill();
      for (let i = 0; i < 15; i++) {
        const lit = pet && pet.act === 'type' && Math.sin(t * 17 + i * 2.3) > 0.85;
        ctx.fillStyle = lit ? '#ffd27a' : '#f7f5f0'; ctx.fillRect(722 + i * 10.6, 591, 9, 10);
      }
      /* laptop (back of lid) */
      ctx.fillStyle = '#cfd3dc'; ctx.save(); ctx.translate(930, 600); ctx.transform(1, 0, -0.25, 1, 0, 0);
      H.roundRect(ctx, -46, -64, 92, 64, 5); ctx.fill(); ctx.fillStyle = '#e0574f'; ctx.beginPath(); ctx.arc(0, -34, 8, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#b9bdc8'; ctx.fillRect(880, 598, 110, 5);
      /* mug */
      ctx.fillStyle = '#f5f1ea'; ctx.strokeStyle = '#2e2a3a'; ctx.lineWidth = 2;
      H.roundRect(ctx, 664, 574, 22, 26, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(690, 586, 6, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); const sx = 671 + i * 8; ctx.moveTo(sx, 568); ctx.quadraticCurveTo(sx + Math.sin(t * 2 + i) * 4, 556, sx, 544); ctx.stroke(); }
      /* papers */
      ctx.fillStyle = '#fbfaf6'; ctx.save(); ctx.translate(620, 598); ctx.rotate(-0.08); ctx.fillRect(-10, -4, 40, 6); ctx.restore();
      if (this.items.has('globe')) {
        ctx.save(); ctx.translate(1015, 578);
        ctx.fillStyle = '#7ab6e8'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
        ctx.fillStyle = '#7cc46e'; ctx.beginPath(); ctx.ellipse(-4 + Math.sin(t * 0.5) * 6, -4, 7, 5, 0.4, 0, 7); ctx.ellipse(6 + Math.sin(t * 0.5) * 6, 6, 5, 4, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8a6040'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 22, -2.2, 0.6); ctx.stroke();
        ctx.fillStyle = '#8a6040'; ctx.fillRect(-8, 20, 16, 4);
        ctx.restore();
      }
      if (this.items.has('speaker')) {
        const sx = 1080, sy = 640;
        ctx.fillStyle = '#3b3644'; H.roundRect(ctx, sx - 26, sy - 50, 52, 170, 6); ctx.fill();
        const pump = 1 + this.musicLevel * 0.25;
        ctx.fillStyle = '#5a5566'; ctx.beginPath(); ctx.arc(sx, sy + 70, 17 * pump, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy - 20, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#2b2733'; ctx.beginPath(); ctx.arc(sx, sy + 70, 6, 0, 7); ctx.fill();
      }
    }

    drawFrontItems() { }

    drawPet(ctx, pet) {
      ctx.save();
      ctx.translate(pet.x, pet.y);
      const sc = 1.5;
      if (!pet.seated) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 9, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.scale(sc * (pet.flip ? -1 : 1), sc);
      H.drawCharacter(ctx, pet.cfg, pet.pose);
      ctx.restore();
    }

    drawParticles(ctx) {
      this.particles.forEach((p) => {
        const a = H.clamp(p.life / p.max * 1.4);
        ctx.globalAlpha = a;
        if (p.type === 'note') {
          ctx.fillStyle = p.color || '#5b6cff'; ctx.font = `${p.size || 22}px "Segoe UI Symbol", sans-serif`; ctx.fillText(p.text || '♪', p.x, p.y);
        } else if (p.type === 'text') {
          ctx.font = `500 ${p.size || 15}px "Malgun Gothic", "Segoe UI", sans-serif`;
          const w = ctx.measureText(p.text).width + 16;
          ctx.fillStyle = 'rgba(255,255,255,0.88)'; H.roundRect(ctx, p.x - w / 2, p.y - 15, w, 24, 12); ctx.fill();
          ctx.strokeStyle = p.color || 'rgba(47,69,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.fillStyle = '#23263a'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y + 2); ctx.textAlign = 'left';
        } else if (p.type === 'heart') {
          ctx.fillStyle = p.color || '#ff6f91'; ctx.font = `${p.size || 22}px "Segoe UI Symbol", sans-serif`; ctx.fillText('♥', p.x, p.y);
        } else if (p.type === 'dot') {
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 4, 0, 7); ctx.fill();
        } else if (p.type === 'snack') {
          ctx.font = `${p.size || 26}px "Segoe UI Emoji", sans-serif`; ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
      });
    }

    drawLighting(ctx, day, hrs, t) {
      const dark = (1 - day) * 0.62;
      const lampOn = this.lampLit = this.lampOn || day < 0.55;
      if (dark <= 0.01) return;
      if (!this.lightCanvas) { this.lightCanvas = document.createElement('canvas'); this.lightCanvas.width = 800; this.lightCanvas.height = 450; }
      const lc = this.lightCanvas, l = lc.getContext('2d');
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'source-over';
      l.clearRect(0, 0, 800, 450);
      l.fillStyle = `rgba(14,16,44,${dark})`; l.fillRect(0, 0, 800, 450);
      l.scale(0.5, 0.5);
      l.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a) => { const g = l.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); l.fillStyle = g; l.beginPath(); l.arc(x, y, r, 0, 7); l.fill(); };
      if (lampOn) hole(700, 560, 420, 0.95);
      hole(470, 280, 380, 0.25 + day * 0.3);
      if (this.items.has('lights')) hole(470, 90, 300, 0.5);
      if (this.items.has('floorlamp')) hole(440, 560, 300, 0.85);
      if (this.items.has('neon')) hole(1270, 90, 200, 0.6);
      hole(1315, 570, 160, 0.3);
      ctx.drawImage(lc, 0, 0, W, HH);
      ctx.fillStyle = `rgba(14,16,44,${dark})`;
      ctx.fillRect(-400, -2000, W + 800, 2000); ctx.fillRect(-400, HH, W + 800, 2000);
      ctx.fillRect(-400, 0, 400, HH); ctx.fillRect(W, 0, 400, HH);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, c, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, H.rgba(c, a)); g.addColorStop(1, H.rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
      if (lampOn) glow(700, 520, 260, '#ffb35c', 0.22 * (1 - day * 0.5));
      if (this.items.has('lights')) glow(470, 90, 260, '#ff9db0', 0.08);
      if (this.items.has('floorlamp')) glow(440, 510, 200, '#ffc777', 0.16);
      ctx.restore();
    }
  }

  H.Room = Room;
})(window.H);
