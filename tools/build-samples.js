/* Builds src/assets/samples/ from openly licensed sample libraries (dev tool; needs ffmpeg on PATH).
 *   VCSL  (CC0)       https://github.com/sgossner/VCSL
 *   VSCO-2-CE (CC0)   https://github.com/sgossner/VSCO-2-CE
 *   tonejs-instruments samples (CC BY 3.0) https://github.com/nbrosowsky/tonejs-instruments
 * Picks a few notes per instrument, trims/normalizes to mono MP3, measures the real pitch (YIN)
 * and writes manifest.json.   Usage: node tools/build-samples.js [--only id,id]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'assets', 'samples');
const CACHE = path.join(process.env.LOCALAPPDATA || require('os').tmpdir(), 'haru-build', 'samples-cache');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const SRC = {
  vcsl: { repo: 'sgossner/VCSL', branch: 'master', license: 'CC0-1.0' },
  vsco: { repo: 'sgossner/VSCO-2-CE', branch: 'master', license: 'CC0-1.0' },
  tonejs: { repo: 'nbrosowsky/tonejs-instruments', branch: 'master', license: 'CC-BY-3.0' },
};

/* pitched instruments: dirs searched in order; `match` filters file names; `step` = min semitone gap between picks */
const INSTRUMENTS = [
  { id: 'piano', src: 'vcsl', dirs: [['Chordophones/Zithers/Grand Piano, Kawai/Sustains/', /_v3_rr1/]], step: 3, len: 5, range: [24, 100] },
  { id: 'epiano', src: 'vcsl', dirs: [['Electrophones/TX81Z/FM Piano/', /_vl2/]], step: 3, len: 4, range: [28, 96] },
  { id: 'vibes', src: 'vcsl', dirs: [['Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/', /_v2_rr1/]], step: 2, len: 3.5 },
  { id: 'marimba', src: 'vcsl', dirs: [['Idiophones/Struck Idiophones/Marimba/', /_med_01/]], step: 2, len: 2.2 },
  { id: 'glock', src: 'vcsl', dirs: [['Idiophones/Struck Idiophones/Glockenspiel/', /glock_medium_/]], step: 2, len: 2.2 },
  { id: 'kalimba', src: 'vcsl', dirs: [['Idiophones/Plucked Idiophones/Kalimba, Kenya/', /\.wav$/]], step: 2, len: 2.2 },
  { id: 'sax', src: 'vcsl', dirs: [['Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/', /_vl2_rr1/]], step: 3, len: 2.6 },
  { id: 'strings', src: 'vsco', dirs: [['Strings/Cello Section/susvib/', /_v1_1\.wav$/, [0, 50]], ['Strings/Violin Section/susVib/', /_v1\.wav$/, [51, 120]]], step: 3, len: 4.5 },
  { id: 'pizz', src: 'vsco', dirs: [['Strings/Violin Section/Pizz/', /_v2_rr1/]], step: 3, len: 1.4 },
  { id: 'upright', src: 'vsco', dirs: [['Strings/Solo Contrabass/Pizz/', /_v1_rr1/]], step: 3, len: 2.2, fixOct: 1 },
  { id: 'harp', src: 'vsco', dirs: [['Strings/Harp/', /\.wav$/]], step: 2, len: 3 },
  { id: 'flute', src: 'vsco', dirs: [['Woodwinds/Flute/susvib/', /_v1_1\.wav$/]], step: 2, len: 3 },
  { id: 'clarinet', src: 'vsco', dirs: [['Woodwinds/Clarinet/susLong/', /_v2_rr1/]], step: 3, len: 3 },
  { id: 'trumpet', src: 'vsco', dirs: [['Brass/Trumpet/sus/', /_v1_rr1/]], step: 3, len: 2.5 },
  { id: 'horn', src: 'vsco', dirs: [['Brass/F Horn/sus/', /_v2_1\.wav$/]], step: 3, len: 3 },
  { id: 'ebass', src: 'tonejs', dirs: [['samples/bass-electric/', /\.mp3$/]], step: 3, len: 2.2 },
  { id: 'nylon', src: 'tonejs', dirs: [['samples/guitar-nylon/', /\.mp3$/]], step: 3, len: 2.6 },
  { id: 'acoustic', src: 'tonejs', dirs: [['samples/guitar-acoustic/', /\.mp3$/]], step: 3, len: 2.6 },
  { id: 'eguitar', src: 'tonejs', dirs: [['samples/guitar-electric/', /\.mp3$/]], step: 3, len: 2.4 },
];

/* drums: one kit voice = up to 2 round-robin files */
const DRUMS = {
  kick: ['vcsl', 'Membranophones/Struck Membranophones/Bass Drum 1/', /BDrumNew_hit_v5_rr[12]_Sum/, 0.7],
  snare: ['vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/', /Snare2_HitSN_v5_rr[12]_Mid/, 0.7],
  snareSoft: ['vcsl', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1/', /Snare2_HitNS_v2_rr[12]_Mid/, 0.6],
  hat: ['vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/', /HiHat_HitC_v3_rr[12]_Mid/, 0.35],
  hatOpen: ['vcsl', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal/', /HiHat_HitO_rr1_Mid/, 1.1],
  clap: ['vcsl', 'Idiophones/Struck Idiophones/Claps/', /^Clap_rr[12]\.wav/, 0.6],
  rim: ['vcsl', 'Idiophones/Struck Idiophones/Woodblock/', /wood_click3_vl[12]/, 0.3],
  shaker: ['vcsl', 'Idiophones/Struck Idiophones/Shaker, Small/', /Mid_ShakerHighFaster_(Down|Up)_rr1/, 0.3],
  tamb: ['vcsl', 'Idiophones/Struck Idiophones/Tambourine 1/', /Tamb1_(Hit_v1|Shake)_rr1_Mid/, 0.6],
  claves: ['vcsl', 'Idiophones/Struck Idiophones/Claves/', /Claves1_Hit_v2_rr1/, 0.4],
  congaHi: ['vcsl', 'Membranophones/Struck Membranophones/Conga/', /Quinto_HitFM1_v2_rr[12]/, 0.6],
  congaLo: ['vcsl', 'Membranophones/Struck Membranophones/Conga/', /Conga_HitN_v2_rr[12]/, 0.7],
  bongo: ['vcsl', 'Membranophones/Struck Membranophones/Bongos/', /BongoH_Hit1_v2_rr[12]/, 0.5],
  agogo: ['vcsl', 'Idiophones/Struck Idiophones/Agogo Bells/', /Agogo_(High|Low)_v2_rr1/, 0.6],
  cowbell: ['vcsl', 'Idiophones/Struck Idiophones/Cowbells/', /Cowbell1_Hit_v3_rr1/, 0.5],
  darbuka: ['vcsl', 'Membranophones/Struck Membranophones/Darbuka/', /Darbuka_[13]_hit_vl2_rr1/, 0.6],
  frameLo: ['vcsl', 'Membranophones/Struck Membranophones/Frame Drum/', /HDrumL_Hit_v3_rr[12]/, 1.0],
  tomLo: ['vcsl', 'Membranophones/Struck Membranophones/Tom 2/', /Stick\/TomL_HitS_v3_rr[12]/, 0.9],
  slit: ['vcsl', 'Idiophones/Struck Idiophones/Slit Drum/', /LogDrum(Hi|Lo)_MedM_v2_rr1/, 0.8],
  crash: ['vcsl', 'Idiophones/Struck Idiophones/Suspended Cymbal 1/', /susCymb1_hit_f1/, 2.6],
  gong: ['vcsl', 'Idiophones/Struck Idiophones/Gong 1/', /^gong_mf\.wav/, 4],
  triangle: ['vcsl', 'Idiophones/Struck Idiophones/Triangles/', /Legacy\/1\/triangle1_hit_mp\.wav/, 1.5],
};

/* ---------------- helpers ---------------- */
const PCS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function labelMidi(name) {
  const m = name.replace(/s(-?\d)/, '#$1').match(/(?:^|[_/\s-])([A-G](?:#|b)?)(-?\d)(?=[_.\s]|$)/) || name.match(/^([A-G](?:#|b)?)(-?\d)\./);
  if (!m) return null;
  return (parseInt(m[2], 10) + 1) * 12 + PCS[m[1]];
}
function get(url, file) {
  return new Promise((res, rej) => {
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) return res(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const go = (u, n = 0) => https.get(u, { headers: { 'User-Agent': 'haru-build' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && n < 5) { r.resume(); return go(r.headers.location, n + 1); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error(r.statusCode + ' ' + u)); }
      const w = fs.createWriteStream(file); r.pipe(w); w.on('finish', () => w.close(() => res(file)));
    }).on('error', rej);
    go(url);
  });
}
function getJSON(url) {
  return new Promise((res, rej) => https.get(url, { headers: { 'User-Agent': 'haru-build' } }, (r) => { let d = ''; r.on('data', (c) => { d += c; }); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
}
const rawUrl = (src, p) => `https://raw.githubusercontent.com/${SRC[src].repo}/${SRC[src].branch}/${p.split('/').map(encodeURIComponent).join('/')}`;
async function tree(src) {
  const f = path.join(CACHE, src + '-tree.json');
  if (!fs.existsSync(f)) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(await getJSON(`https://api.github.com/repos/${SRC[src].repo}/git/trees/${SRC[src].branch}?recursive=1`))); }
  return JSON.parse(fs.readFileSync(f, 'utf8')).tree.filter((x) => x.type === 'blob');
}
function ff(args) { const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(String(r.stderr)); return r.stdout; }
function peakDb(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(r.stderr); return m ? parseFloat(m[1]) : 0;
}
/* normalize first (some recordings peak at -47 dBFS), trim leading silence, cut, fade, mono MP3 */
function convert(inFile, outFile, len) {
  const gain = -2 - peakDb(inFile), fade = Math.min(0.5, len * 0.25);
  ff(['-i', inFile, '-ac', '1', '-ar', '44100', '-af', `volume=${gain.toFixed(2)}dB,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.003,atrim=0:${len},afade=t=out:st=${Math.max(0.05, len - fade)}:d=${fade}`, '-c:a', 'libmp3lame', '-q:a', '4', outFile]);
  if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 2000) throw new Error('empty output ' + outFile);
}
/* YIN pitch detection on 0.06–0.36 s of the processed sample */
function detectMidi(file) {
  const buf = ff(['-i', file, '-ss', '0.06', '-t', '0.3', '-ac', '1', '-ar', '44100', '-f', 'f32le', '-']);
  const x = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
  const sr = 44100, W = 3072, maxTau = Math.floor(sr / 30), minTau = Math.floor(sr / 4500);
  if (x.length < W + maxTau) return null;
  const d = new Float32Array(maxTau + 1);
  for (let t = 1; t <= maxTau; t++) { let s = 0; for (let i = 0; i < W; i++) { const v = x[i] - x[i + t]; s += v * v; } d[t] = s; }
  let run = 0; const cm = new Float32Array(maxTau + 1); cm[0] = 1;
  for (let t = 1; t <= maxTau; t++) { run += d[t]; cm[t] = d[t] * t / (run || 1); }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) if (cm[t] < 0.15) { while (t + 1 <= maxTau && cm[t + 1] < cm[t]) t++; tau = t; break; }
  if (tau < 0) { let best = Infinity; for (let t = minTau; t <= maxTau; t++) if (cm[t] < best) { best = cm[t]; tau = t; } if (best > 0.4) return null; }
  const a = cm[tau - 1] || cm[tau], b = cm[tau], c = cm[tau + 1] || cm[tau];
  const refined = tau + (a - c) / (2 * (a - 2 * b + c) || 1);
  const f0 = sr / refined;
  return 69 + 12 * Math.log2(f0 / 440);
}

/* ---------------- main ---------------- */
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifestFile = path.join(OUT, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { instruments: {}, drums: {} };
  const trees = {};
  for (const inst of INSTRUMENTS) {
    if (ONLY.length && !ONLY.includes(inst.id)) continue;
    trees[inst.src] = trees[inst.src] || await tree(inst.src);
    const cands = [];
    for (const [dir, re, r2] of inst.dirs) {
      trees[inst.src].filter((x) => x.path.startsWith(dir) && re.test(x.path.slice(dir.length))).forEach((x) => {
        const lm = labelMidi(path.basename(x.path)); if (lm == null) return;
        if (r2 && (lm < r2[0] || lm > r2[1])) return;
        if (inst.range && (lm < inst.range[0] || lm > inst.range[1])) return;
        if (!cands.some((c) => c.lm === lm)) cands.push({ lm, path: x.path });
      });
    }
    cands.sort((a, b) => a.lm - b.lm);
    const picks = []; for (const c of cands) if (!picks.length || c.lm - picks[picks.length - 1].lm >= inst.step) picks.push(c);
    const zones = [];
    fs.rmSync(path.join(OUT, inst.id), { recursive: true, force: true });
    fs.mkdirSync(path.join(OUT, inst.id), { recursive: true });
    for (const [i, p] of picks.entries()) {
      const raw = path.join(CACHE, inst.src, p.path);
      try { await get(rawUrl(inst.src, p.path), raw); } catch (e) { console.warn('skip', p.path, e.message); continue; }
      const name = `${String(i).padStart(2, '0')}.mp3`, out = path.join(OUT, inst.id, name);
      try { convert(raw, out, inst.len); } catch (e) { console.warn('skip', p.path, e.message); continue; }
      zones.push({ lm: p.lm, det: detectMidi(out), file: `${inst.id}/${name}` });
    }
    /* libraries disagree on octave naming: take the majority octave offset between label and measured pitch,
       then keep a per-zone fine-tune only where the measurement agrees with it */
    const votes = {};
    zones.forEach((z) => { if (z.det != null) { const o = Math.round((z.det - z.lm) / 12); votes[o] = (votes[o] || 0) + 1; } });
    const oct = inst.fixOct != null ? inst.fixOct : Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || 0) + (inst.oct || 0);
    zones.forEach((z) => {
      z.midi = z.lm + oct * 12; z.cents = 0;
      if (z.det != null && Math.abs(z.det - z.midi) < 0.3) z.cents = Math.round((z.det - z.midi) * 100);
      delete z.lm; delete z.det;
    });
    zones.sort((a, b) => a.midi - b.midi);
    manifest.instruments[inst.id] = { src: inst.src, license: SRC[inst.src].license, zones };
    console.log(inst.id.padEnd(9), zones.length, 'zones oct', oct, zones.map((z) => z.midi + (z.cents ? `(${z.cents > 0 ? '+' : ''}${z.cents})` : '')).join(' '));
  }
  for (const [name, [src, dir, re, len]] of Object.entries(DRUMS)) {
    if (ONLY.length && !ONLY.includes(name) && !ONLY.includes('drums')) continue;
    trees[src] = trees[src] || await tree(src);
    const files = trees[src].filter((x) => x.path.startsWith(dir) && re.test(x.path.slice(dir.length))).slice(0, 2);
    const outs = [];
    fs.mkdirSync(path.join(OUT, 'drums'), { recursive: true });
    for (const [i, f] of files.entries()) {
      const raw = path.join(CACHE, src, f.path);
      await get(rawUrl(src, f.path), raw);
      const out = path.join(OUT, 'drums', `${name}${i + 1}.mp3`);
      convert(raw, out, len); outs.push(`drums/${name}${i + 1}.mp3`);
    }
    manifest.drums[name] = { src, license: SRC[src].license, files: outs };
    console.log('drum', name.padEnd(10), outs.length);
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1));
  let total = 0; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else total += fs.statSync(p).size; } })(OUT);
  console.log('total', (total / 1048576).toFixed(1), 'MB');
})().catch((e) => { console.error(e); process.exit(1); });
