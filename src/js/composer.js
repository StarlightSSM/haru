/* HARU — composer: mood + genre + keywords → a song object */
(function (H) {
  'use strict';

  const BRIGHT = { lydian: 3, major: 2.4, pentaMajor: 2.4, mixolydian: 1.8, pyeongjo: 1.8, yo: 2, slendro: 1.6, dorian: 0.8, blues: 0.3, minor: -0.4, gyemyeon: -0.2, pentaMinor: 0, harmonicMinor: -1, phrygian: -1.6, hijaz: -1.2, pelog: -1, insen: -1.4, bhairav: -1.1 };
  const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  const BASS_INST = { sub: 'sub', logdrum: 'logdrum', walking: 'upright', pedal: 'synthbass', drone: 'drone', gamelan: 'metal' };

  function mod(n, m) { return ((n % m) + m) % m; }

  H.pickScale = function (g, mood, r) {
    const target = mood.valence * 2.6 - mood.tension * 0.6;
    return r.weighted(g.scales, (s) => 1 / (0.4 + Math.abs((BRIGHT[s] ?? 0) - target)) + 0.15);
  };

  H.chooseGenre = function (mood, hint, known, request, r, style) {
    if (request && H.GENRE[request]) return request;
    const ids = Object.keys(known || {}).filter((id) => H.GENRE[id]);
    /* a style lets the pet wander into its favourite genres even before it "knows" them */
    if (style) Object.keys(style.genres || {}).forEach((id) => { if (H.GENRE[id] && style.genres[id] >= 1.4 && !ids.includes(id)) ids.push(id); });
    const pool = ids.length ? ids : H.GENRES.filter((g) => g.start).map((g) => g.id);
    return r.weighted(pool, (id) => {
      const g = H.GENRE[id];
      const d = Math.hypot((g.vibe.v - mood.valence) * 0.9, (g.vibe.a - mood.arousal) * 1.3);
      const fam = (known && known[id]) || 0.2;
      const pull = style ? (style.genres[id] ? 1 + style.genres[id] * 1.2 : 0.3) : 1;
      return ((1.2 / (0.25 + d)) * (0.6 + fam * 0.6) + (hint[id] || 0) * 0.8) * pull;
    });
  };

  /*
   * plan: { seed, genreId, mood, keywords[], seconds, root? }
   */
  H.compose = function (plan) {
    const r = H.rng(plan.seed);
    const g = H.GENRE[plan.genreId] || H.GENRE.lofi;
    const mood = plan.mood || { valence: 0, arousal: 0.4, tension: 0.2 };
    const scaleName = plan.scale || H.pickScale(g, mood, r);
    const sc = H.SCALES[scaleName];
    const iv = sc.iv;
    const L = iv.length;
    const parent = H.SCALES[sc.parent || scaleName].iv.length === 7 ? H.SCALES[sc.parent || scaleName].iv : H.SCALES.major.iv;
    const root = plan.root ?? (52 + Math.floor(r() * 9)); /* E3..C4 */
    const style = H.STYLE && H.STYLE[plan.styleId];
    let bpm = Math.round(H.lerp(g.bpm[0], g.bpm[1], H.clamp(mood.arousal * 0.8 + r() * 0.35)));
    if (style && style.bpm) {
      /* lean into the style's tempo window without leaving the genre's feel entirely */
      const lo = Math.max(style.bpm[0], g.bpm[0] * 0.8), hi = Math.min(style.bpm[1], g.bpm[1] * 1.25);
      if (lo <= hi) bpm = Math.round(H.clamp(bpm, lo, hi));
    }
    const steps = g.steps, beatSteps = g.beatSteps;
    const beats = steps / beatSteps;
    const barSec = beats * 60 / bpm;
    let bars = Math.max(8, Math.round((plan.seconds || 75) / barSec / 2) * 2);
    const density = H.clamp(0.25 + mood.arousal * 0.5 + (g.vibe.a - 0.5) * 0.3 + (r() - 0.5) * 0.15, 0.12, 0.9);

    /* sections */
    const sections = [];
    const intro = bars >= 20 ? 4 : 2;
    const outro = bars >= 16 ? 4 : 2;
    let mid = bars - intro - outro;
    sections.push({ name: 'intro', ko: '인트로', start: 0, len: intro });
    const names = ['A', 'B', 'A2', 'C', 'B2', 'A3', 'D', 'A4'];
    let cur = intro, ni = 0;
    while (mid > 0) {
      const len = mid >= 12 ? 8 : mid;
      sections.push({ name: names[ni % names.length], ko: names[ni % names.length], start: cur, len });
      cur += len; mid -= len; ni++;
    }
    sections.push({ name: 'outro', ko: '아웃트로', start: cur, len: outro });
    bars = cur + outro;

    const progA = r.pick(g.progs);
    const progB = g.progs.length > 1 ? r.pick(g.progs.filter((p) => p !== progA)) : progA;

    /* chords */
    const chordAt = [];
    let prevCenter = root + 5;
    const degName = (deg) => NOTE_NAMES[mod(root + parent[mod(deg - 1, 7)], 12)];
    for (let b = 0; b < bars; b++) {
      const sec = sections.find((s) => b >= s.start && b < s.start + s.len);
      const prog = sec.name.startsWith('B') || sec.name === 'D' ? progB : progA;
      const slow = bpm > 150 || beatSteps === 2;
      const idxInSec = b - sec.start;
      let deg = prog[Math.floor((slow ? idxInSec / 2 : idxInSec)) % prog.length];
      if (sec.name === 'outro' && b >= bars - 2) deg = 1;
      const tones = [0, 2, 4].concat(g.seventh ? [6] : []).map((o) => (deg - 1) + o);
      let notes = tones.map((i) => root + parent[mod(i, 7)] + 12 * Math.floor(i / 7));
      /* voice-lead toward previous center */
      notes = notes.map((n) => { while (n < prevCenter - 7) n += 12; while (n > prevCenter + 7) n -= 12; return n; }).sort((a, b2) => a - b2);
      prevCenter = H.lerp(prevCenter, notes.reduce((s, n) => s + n, 0) / notes.length, 0.5);
      const rootPc = mod(root + parent[mod(deg - 1, 7)], 12);
      const third = mod(parent[mod(deg + 1, 7)] - parent[mod(deg - 1, 7)], 12);
      chordAt.push({ bar: b, deg, notes, rootPc, name: degName(deg) + (third === 3 ? 'm' : '') + (g.seventh ? '7' : '') });
    }

    const song = {
      id: 'song-' + plan.seed, title: '', genreId: g.id, genre: g.name, genreKo: g.ko, region: g.region,
      scaleName, scaleKo: sc.ko, iv, root, keyName: NOTE_NAMES[mod(root, 12)], bpm, steps, beatSteps, timeSig: g.timeSig,
      swing: g.swing, bars, totalSteps: bars * steps, sections, chords: chordAt,
      insts: { lead: g.lead, chord: g.chord, pad: g.pad, bass: BASS_INST[g.bass] || 'bass' },
      fx: Object.assign({ lofi: 0.2, reverb: 0.25 }, g.fx), notes: [], drums: [], motifs: [], density,
      drumGenre: g.id, userNotes: 0,
    };
    if (style) {
      song.style = style.id; song.styleKo = style.ko;
      song.insts = H.styleInsts(style, g, song.insts, r);
      song.fx = Object.assign(song.fx, style.fx);
      song.lofiOk = style.lofiOk;
      song.kit = Object.assign({}, H.DEFAULT_KIT, style.kit);
      if (style.seats) song.seats = style.seats;
    }
    if (!song.kit && H.DEFAULT_KIT) song.kit = Object.assign({}, H.DEFAULT_KIT);
    const N = song.notes, D = song.drums;
    const bassRoot = (pc) => { let n = 36 + pc; if (n < 38) n += 12; return n; };

    /* ----- chords & pad ----- */
    for (let b = 0; b < bars; b++) {
      const c = chordAt[b];
      const base = b * steps;
      if (g.chordPat) {
        const hits = [];
        for (let i = 0; i < steps; i++) if (g.chordPat[i] === 'x') hits.push(i);
        hits.forEach((h, k) => {
          const next = k + 1 < hits.length ? hits[k + 1] : steps;
          const dur = Math.max(1, Math.min(next - h, steps));
          c.notes.forEach((p) => N.push({ s: base + h, d: dur, p, v: 0.5 + (h === 0 ? 0.1 : 0), t: 'chord' }));
        });
      }
      if (song.insts.pad) {
        const padNotes = g.pad === 'tanpura' ? [bassRoot(mod(root, 12)) + 12, bassRoot(mod(root, 12)) + 19] : c.notes.map((p) => p + 12);
        if (g.pad === 'tanpura') { if (b % 2 === 0) padNotes.forEach((p) => N.push({ s: base, d: steps * 2, p, v: 0.35, t: 'pad' })); }
        else padNotes.forEach((p) => N.push({ s: base, d: steps, p, v: 0.32, t: 'pad' }));
      }
    }

    /* ----- bass ----- */
    for (let b = 0; b < bars; b++) {
      const c = chordAt[b], nxt = chordAt[Math.min(bars - 1, b + 1)];
      const R = bassRoot(c.rootPc), F = R + 7, O = R + 12, NR = bassRoot(nxt.rootPc);
      const base = b * steps;
      const put = (s, p, d, v = 0.8, extra) => { if (s < steps) N.push(Object.assign({ s: base + s, d: Math.max(1, d), p, v, t: 'bass' }, extra)); };
      const sec = sections.find((s) => b >= s.start && b < s.start + s.len);
      if (sec.name === 'intro' && b < sec.len / 2 && g.bass !== 'drone') continue;
      switch (g.bass) {
        case 'root': put(0, R, beatSteps * 2 - 1); put(steps / 2, r.chance(0.5) ? F : R, beatSteps * 2 - 1); break;
        case 'lofi': put(0, R, 6); put(10, r.chance(0.5) ? R : F, 4, 0.7); if (r.chance(0.6)) put(14, NR - 1, 2, 0.55); break;
        case 'bossa': put(0, R, 5); put(6, F, 2, 0.6); put(8, F, 5, 0.75); put(14, R, 2, 0.55); break;
        case 'samba': put(0, R, 3); put(4, F, 2, 0.5); put(8, R, 3); put(12, F, 2, 0.5); put(14, R, 2, 0.6); break;
        case 'tumbao': put(6, F, 6, 0.8); put(12, NR, 4, 0.8); break;
        case 'reggae': put(2, R, 2); put(4, R, 3, 0.7); put(8, F, 2, 0.65); put(10, O, 2, 0.6); put(12, R, 3, 0.7); break;
        case 'afro': put(0, R, 2); put(3, R, 1, 0.6); put(6, F, 2, 0.7); put(8, O, 1, 0.6); put(10, R, 2, 0.75); put(13, O - 2, 1, 0.55); put(14, F, 2, 0.6); break;
        case 'logdrum': put(0, R, 3, 0.9); put(6, O, 2, 0.7); put(10, R, 3, 0.8); if (r.chance(0.6)) put(13, F, 2, 0.6); break;
        case 'jig': for (let i = 0; i < steps; i += 3) put(i, (i / 3) % 2 ? F : R, 2, i === 0 ? 0.85 : 0.65); break;
        case 'habanera': [0, 8].forEach((o) => { put(o, R, 3); put(o + 3, F, 1, 0.55); put(o + 4, F, 2, 0.7); put(o + 6, O, 2, 0.6); }); break;
        case 'aksak': put(0, R, 3); put(4, F, 3, 0.7); put(8, R, 5, 0.8); break;
        case 'drone': if (b % 2 === 0) { put(0, mod(root, 12) + 36 < 38 ? mod(root, 12) + 48 : mod(root, 12) + 36, steps * 2, 0.55); } break;
        case 'gamelan': {
          for (let i = 0; i < beats; i++) {
            const deg = [0, 1, 2, 4, 3, 1, 2, 0][(b * beats + i) % 8] % L;
            put(i * beatSteps, root + iv[deg], beatSteps, i === 0 ? 0.7 : 0.5);
          }
          if (b % 2 === 1) put(0, bassRoot(mod(root, 12)), steps * 2, 0.6, { t: 'bass' });
          break;
        }
        case 'octave':
          if (g.id === 'house') { for (let i = 2; i < steps; i += 4) put(i, R, 2, 0.8); }
          else { for (let i = 0; i < steps; i += 2) put(i, (i / 2) % 2 ? O : R, 2, (i / 2) % 2 ? 0.6 : 0.8); }
          break;
        case 'walking': {
          const tones = [R, R + (c.notes[1] - c.notes[0]), F, R + 9, O];
          for (let i = 0; i < beats; i++) {
            let p = i === 0 ? R : i === beats - 1 ? NR + (r.chance(0.5) ? -1 : 1) : r.pick(tones);
            put(i * beatSteps, p, beatSteps, i === 0 ? 0.8 : 0.65);
          }
          break;
        }
        case 'fusion': put(0, R, 2, 0.85); put(3, R, 1, 0.55); put(4, O, 1, 0.6); put(6, R, 2, 0.75); put(8, F, 2, 0.75); put(10, R, 1, 0.55); put(11, O, 1, 0.6); put(14, NR, 2, 0.7); break;
        case 'pedal': for (let i = 0; i < steps; i += 2) put(i, R, 2, (i % 4 === 0) ? 0.8 : 0.6); break;
        case 'sub': put(0, R, Math.round(steps * 0.6), 0.9); if (r.chance(0.5)) put(10, r.chance(0.5) ? R : F, 6, 0.75); break;
        default: put(0, R, steps / 2);
      }
    }

    /* ----- drums ----- */
    const inst = Object.keys(g.drums);
    for (let b = 0; b < bars; b++) {
      const sec = sections.find((s) => b >= s.start && b < s.start + s.len);
      const lastOfSec = b === sec.start + sec.len - 1;
      const base = b * steps;
      inst.forEach((name) => {
        const pat = g.drums[name];
        if (sec.name === 'intro' && !['h', 'sh', 'r', 'tam', 'cl', 'bell', 'gong', 'tb'].includes(name) && b < sec.start + sec.len - 1) return;
        if (sec.name === 'outro' && b >= bars - 2 && ['k', 's', 'c'].includes(name)) return;
        for (let i = 0; i < steps; i++) {
          const v = H.patVel(pat[i] || '.');
          if (!v) continue;
          if (name === 'h' && density < 0.35 && i % 2 === 1 && v < 0.7) continue;
          if (lastOfSec && i >= steps - beatSteps && (name === 'h' || name === 'sh')) continue;
          D.push({ s: base + i, n: name, v: H.clamp(v * (0.9 + r() * 0.2)) });
        }
      });
      /* fills */
      if (lastOfSec && sec.name !== 'outro' && inst.length) {
        const fillInst = inst.includes('s') ? 's' : inst.includes('tk') ? 'tk' : inst.includes('cg') ? 'cg' : inst.includes('jg') ? 'jg' : inst[0];
        const start = steps - beatSteps;
        for (let i = start; i < steps; i++) if (r.chance(0.55 + density * 0.3)) D.push({ s: base + i, n: fillInst, v: 0.45 + 0.4 * (i - start) / beatSteps });
        if (inst.includes('k') || inst.includes('tk')) D.push({ s: (b + 1) * steps, n: inst.includes('o') ? 'o' : 'c', v: 0.6, crash: true });
      }
    }
    song.drums = D.filter((d) => d.s < song.totalSteps);

    /* ----- style layers: arpeggio & counter-melody ----- */
    if (song.insts.arp && style) {
      const A = style.arp || { rate: 2, shape: 'up', oct: 12, vel: 0.4 };
      for (let b = 0; b < bars; b++) {
        const sec = sections.find((x) => b >= x.start && b < x.start + x.len);
        if (sec.name === 'intro' && b < sec.start + sec.len - 1 && A.rate < 4) continue;
        if (sec.name === 'outro' && b >= bars - 1) continue;
        const c = chordAt[b];
        const tones = c.notes.map((p) => p + (A.oct || 0));
        const seq = A.shape === 'updown' ? tones.concat(tones.slice(1, -1).reverse())
          : A.shape === 'broken' ? [tones[0], tones[2] ?? tones[1], tones[1], tones[3] ?? tones[0] + 12, tones[0] + 12, tones[2] ?? tones[1], tones[1], tones[2] ?? tones[0]]
            : A.shape === 'chop' ? [tones[1], tones[2] ?? tones[1], tones[1], tones[0] + 12]
              : tones.concat([tones[0] + 12]);
        let k = 0;
        for (let i = 0; i < steps; i += A.rate) {
          if (A.shape === 'chop' && (i / A.rate) % 2 === 0 && r.chance(0.5)) { k++; continue; }
          const on = i % beatSteps === 0;
          N.push({ s: b * steps + i, d: A.shape === 'chop' ? 1 : Math.max(1, A.rate * (A.rate >= 4 ? 2 : 1)), p: seq[k % seq.length], v: H.clamp((A.vel || 0.4) * (on ? 1.15 : 0.9) + (r() - 0.5) * 0.08), t: 'arp' });
          k++;
        }
      }
    }
    if (song.insts.counter) {
      sections.forEach((sec) => {
        if (!(sec.name.startsWith('B') || sec.name === 'C' || sec.name === 'D' || sec.name === 'A3' || sec.name === 'A4')) return;
        for (let b = sec.start; b < sec.start + sec.len; b += 2) {
          const c = chordAt[b];
          const p = (c.notes[1] ?? c.notes[0]) + 12;
          N.push({ s: b * steps, d: steps * 2 - 1, p, v: 0.42, t: 'counter' });
          if (r.chance(0.5)) N.push({ s: b * steps + steps + beatSteps * 2, d: beatSteps * 2, p: (c.notes[2] ?? p) + 12, v: 0.36, t: 'counter' });
        }
      });
    }

    /* ----- melody: motifs from keywords ----- */
    const words = (plan.keywords || []).filter(Boolean).slice(0, 4);
    while (words.length < 3) words.push(['하루', 'haru', 'world', '오늘'][words.length]);
    const cellsFor = (bs) => bs === 4
      ? [['x...', 1], ['x.x.', 1.2], ['x..x', 0.8], ['xx.x', 0.6], ['.x.x', 0.5], ['x.xx', 0.6], ['xxxx', 0.25], ['....', 0.6], ['..x.', 0.5]]
      : bs === 3 ? [['x..', 1], ['x.x', 1], ['xxx', 0.4], ['.xx', 0.5], ['...', 0.5], ['x.x', 0.6]]
        : [['x.', 1], ['xx', 0.5], ['.x', 0.4], ['..', 0.4]];
    const degToMidi = (deg) => root + 12 + iv[mod(deg, L)] + 12 * Math.floor(deg / L);
    const makeMotif = (word, rr) => {
      const codes = [...word].map((ch) => ch.codePointAt(0));
      const cells = cellsFor(beatSteps);
      const pos = [];
      for (let beat = 0; beat < beats * 2; beat++) {
        const cell = rr.weighted(cells, (c) => {
          const busy = (c[0].match(/x/g) || []).length / c[0].length;
          return c[1] * (1 - Math.abs(busy - density) * 1.4 + 0.3);
        })[0];
        for (let i = 0; i < cell.length; i++) if (cell[i] === 'x') pos.push(beat * beatSteps + i);
      }
      if (!pos.length || pos[0] !== 0) pos.unshift(0);
      let deg = mod(codes[0] || 0, L);
      const notes = pos.map((s, k) => {
        if (k > 0) {
          if (k < codes.length) deg += [-2, -1, 1, 2, 0, 3, -3][mod(codes[k] + k, 7)];
          else deg += rr.weighted([-3, -2, -1, 0, 1, 2, 3], (x) => [0.3, 0.9, 1.6, 0.6, 1.6, 0.9, 0.3][x + 3]);
        }
        deg = H.clamp(deg, -2, L + 4);
        const next = k + 1 < pos.length ? pos[k + 1] : steps * 2;
        return { o: s, deg, d: Math.max(1, Math.min(next - s, beatSteps * 2)) };
      });
      return notes;
    };
    const motifs = words.map((w, i) => ({ word: w, notes: makeMotif(w, H.rng(H.hash(w) ^ plan.seed ^ i)) }));
    song.motifs = motifs.map((m) => ({ word: m.word, names: m.notes.slice(0, 6).map((n) => H.midiName(degToMidi(n.deg))) }));

    const fitChord = (p, chord, strong) => {
      if (!strong) return p;
      const pcs = chord.notes.map((n) => mod(n, 12));
      if (pcs.includes(mod(p, 12))) return p;
      for (const off of [-1, 1, -2, 2]) if (pcs.includes(mod(p + off, 12))) return p + off;
      return p;
    };
    sections.forEach((sec, si) => {
      if (sec.name === 'intro') return;
      const mi = sec.name.startsWith('B') || sec.name === 'D' ? 1 : sec.name === 'C' ? 2 : 0;
      const motif = motifs[mi % motifs.length].notes;
      const mutate = sec.name.length > 1 ? 0.25 : 0.08;
      for (let pb = 0; pb < sec.len; pb += 2) {
        const phraseIdx = pb / 2;
        const isLast = pb + 2 >= sec.len;
        const shift = phraseIdx % 2 === 1 ? r.pick([0, 1, -1, 2]) : 0;
        if (sec.name === 'outro' && phraseIdx > 0) break;
        motif.forEach((m, k) => {
          if (r.chance(mutate * 0.5) && k > 0) return;
          let deg = m.deg + shift + (r.chance(mutate) ? r.pick([-1, 1]) : 0);
          const s = (sec.start + pb) * steps + m.o;
          if (s >= song.totalSteps) return;
          const bar = Math.floor(s / steps);
          let p = degToMidi(deg);
          p = fitChord(p, chordAt[bar], m.o % (beatSteps * 2) === 0);
          let d = m.d;
          if (isLast && k === motif.length - 1) {
            const target = chordAt[bar].rootPc; let q = p;
            for (const off of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) if (mod(p + off, 12) === target) { q = p + off; break; }
            p = q; d = Math.max(d, beatSteps * 2);
          }
          N.push({ s, d, p, v: H.clamp(0.62 + (m.o % beatSteps === 0 ? 0.12 : 0) + (r() - 0.5) * 0.12), t: 'lead' });
        });
      }
    });

    /* ----- reveal schedule: how the piece gets written ----- */
    const totalBars = bars;
    let acc = 0;
    const secSpan = sections.map((s) => { const a = acc; acc += s.len / totalBars; return [a, acc]; });
    const layerWindow = { chord: [0, 0.25], pad: [0.05, 0.3], bass: [0.25, 0.45], drum: [0.45, 0.62], arp: [0.5, 0.65], lead: [0.62, 1], counter: [0.8, 1] };
    const revFor = (s, layer) => {
      const bar = Math.floor(s / steps);
      const si = sections.findIndex((x) => bar >= x.start && bar < x.start + x.len);
      const sec = sections[si];
      const [a, b] = secSpan[si];
      const [la, lb] = layerWindow[layer];
      const within = (bar - sec.start + (s % steps) / steps) / sec.len;
      return a + (b - a) * (la + (lb - la) * within);
    };
    N.forEach((n) => { n.rev = revFor(n.s, n.t); });
    song.drums.forEach((d) => { d.rev = revFor(Math.min(d.s, song.totalSteps - 1), 'drum'); });
    song.secSpan = secSpan;
    H.indexSong(song);
    return song;
  };

  H.indexSong = function (song) {
    const idx = new Array(song.totalSteps + 1);
    for (let i = 0; i <= song.totalSteps; i++) idx[i] = [];
    song.notes.forEach((n) => { if (n.s <= song.totalSteps) idx[n.s].push(n); });
    song.drums.forEach((d) => { if (d.s <= song.totalSteps) idx[d.s].push(d); });
    song.byStep = idx;
    let lo = 127, hi = 0;
    song.notes.forEach((n) => { if (n.t !== 'bass') { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); } });
    song.range = [Math.min(lo, 60), Math.max(hi, 72)];
  };

  H.sectionAt = function (song, progress) {
    for (let i = 0; i < song.sections.length; i++) {
      const [a, b] = song.secSpan[i];
      if (progress >= a && progress < b) return i;
    }
    return song.sections.length - 1;
  };

  H.stepSec = (song) => 60 / song.bpm / song.beatSteps;
  H.songDuration = (song) => song.totalSteps * H.stepSec(song) + 2.5;

  /* --- user mischief --- */
  H.insertUserNote = function (song, step, midi, rev) {
    const s = Math.max(0, Math.min(song.totalSteps - 1, Math.round(step)));
    const n = { s, d: Math.max(2, song.beatSteps), p: midi, v: 0.8, t: 'lead', by: 'you', rev: rev ?? 0 };
    song.notes.push(n); song.userNotes++;
    H.indexSong(song);
    return n;
  };

  H.swapDrums = function (song, genreId, fromStep, rev, patterns) {
    const g = H.GENRE[genreId];
    if (!g) return;
    const pats = patterns || g.drums;
    song.drums = song.drums.filter((d) => d.s < fromStep);
    const startBar = Math.ceil(fromStep / song.steps);
    for (let b = startBar; b < song.bars; b++) {
      Object.keys(pats).forEach((name) => {
        const pat = pats[name];
        for (let i = 0; i < pat.length; i++) {
          const v = H.patVel(pat[i]);
          if (!v) continue;
          const s = b * song.steps + Math.round(i * song.steps / pat.length);
          if (s < song.totalSteps) song.drums.push({ s, n: name, v: v * 0.95, rev: rev ?? 0, by: 'you' });
        }
      });
    }
    song.drumGenre = genreId;
    H.indexSong(song);
  };
})(window.H);
