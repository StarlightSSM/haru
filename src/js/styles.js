/* HARU — music styles ("taste"): sound personas the pet can choose from by its own liking.
 * Styles are original descriptions of a sound (instruments, kit, mix, arrangement habits) —
 * they are not copies of any composer's music. Recordings: assets/samples/CREDITS.md
 */
(function (H) {
  'use strict';

  /* insts: override of the genre's lead/chord/pad/bass (arrays = pick one), plus optional
   *   double  — octave-doubled lead (soft)      arp     — arpeggiated chord layer
   *   counter — long counter-melody layer
   * genres: affinity (pulls the genre choice), kit: drum-voice overrides, fx: mix, bpm: preferred tempo window
   */
  H.STYLES = [
    {
      id: 'bluesky', ko: '청량 퓨전 OST', en: 'Blue-sky Fusion', color: '#4aa8ff',
      desc: '맑은 하늘색 학원 게임 OST 같은 느낌. 빠른 템포, 반짝이는 피아노 아르페지오, 글로켄 더블링, 탄탄한 일렉 베이스와 팝 드럼.',
      tags: ['밝음', '빠름', '반짝임'], vibe: { v: 0.75, a: 0.75 },
      genres: { jfusion: 3, citypop: 1.4, house: 0.6, son: 0.5, highlife: 0.4 },
      insts: { lead: ['piano', 'piano', 'trumpet'], chord: 'epiano', pad: 'strings', bass: 'ebass', double: 'glock', arp: 'piano', counter: 'strings' },
      arp: { rate: 1, shape: 'broken', oct: 12, vel: 0.5 },
      kit: {}, fx: { lofi: 0, reverb: 0.22, air: -0.5 }, lofiOk: false, bpm: [138, 176],
    },
    {
      id: 'lofipiano', ko: '로파이 피아니스트', en: 'Lo-fi Pianist', color: '#c79a6b',
      desc: '조용한 방에서 녹음한 듯한 따뜻한 피아노. 느린 비트, 부드러운 스네어, 테이프의 살짝 바랜 질감.',
      tags: ['따뜻함', '느긋함', '빈티지'], vibe: { v: 0.05, a: 0.25 },
      genres: { lofi: 3, boombap: 1.5, jazzwaltz: 0.6, reggae: 0.3 },
      insts: { lead: ['piano', 'epiano', 'vibes'], chord: ['epiano', 'piano'], pad: null, bass: 'upright' },
      kit: { s: 'snareSoft', c: 'snareSoft' }, fx: { lofi: 0.5, reverb: 0.24 }, lofiOk: true, bpm: [66, 86],
    },
    {
      id: 'cinematic', ko: '시네마틱 스트링', en: 'Cinematic Strings', color: '#8c6bd6',
      desc: '영화 엔딩 크레딧처럼 넓게 펼쳐지는 현악과 호른, 하프 아르페지오. 드럼보다 팀파니 같은 북.',
      tags: ['웅장함', '감성', '넓음'], vibe: { v: 0.1, a: 0.5 },
      genres: { ambient: 1.4, tango: 1, celtic: 0.8, flamenco: 0.6, jfusion: 0.5, maghreb: 0.4 },
      insts: { lead: ['strings', 'horn', 'flute'], chord: 'harp', pad: 'strings', bass: 'strings', arp: 'harp', counter: 'horn' },
      arp: { rate: 2, shape: 'up', oct: 0, vel: 0.45 },
      kit: { k: 'frameLo', s: 'snareSoft', h: 'shaker', o: 'tamb', c: 'snareSoft', kickBody: 0 }, fx: { lofi: 0, reverb: 0.5, air: -1 }, lofiOk: false, bpm: [70, 120],
    },
    {
      id: 'cafebossa', ko: '카페 보사', en: 'Café Bossa', color: '#e0a35a',
      desc: '오후 세 시의 카페. 나일론 기타 컴핑, 플루트 멜로디, 림샷과 셰이커만으로 가볍게.',
      tags: ['산뜻함', '여유', '어쿠스틱'], vibe: { v: 0.5, a: 0.35 },
      genres: { bossa: 3, samba: 1, jazzwaltz: 0.7, son: 0.5 },
      insts: { lead: ['flute', 'vibes', 'clarinet'], chord: 'nylon', pad: null, bass: 'upright', counter: 'vibes' },
      kit: { s: 'rim', h: 'shaker' }, fx: { lofi: 0.08, reverb: 0.26 }, lofiOk: false, bpm: [118, 142],
    },
    {
      id: 'jazztrio', ko: '재즈 트리오', en: 'Jazz Trio', color: '#5a6b8c',
      desc: '피아노·콘트라베이스·브러시 드럼의 작은 클럽. 가끔 테너 색소폰이 끼어들어요.',
      tags: ['스윙', '즉흥', '어른스러움'], vibe: { v: 0.3, a: 0.45 },
      genres: { jazzwaltz: 2.6, swing: 2.6, boombap: 0.5, bossa: 0.4 },
      insts: { lead: ['piano', 'sax', 'vibes'], chord: 'piano', pad: null, bass: 'upright' },
      kit: { s: 'snareSoft', c: 'snareSoft', k: 'kick', kickBody: 0.4 }, fx: { lofi: 0.12, reverb: 0.22 }, lofiOk: false,
    },
    {
      id: 'folk', ko: '어쿠스틱 포크', en: 'Acoustic Folk', color: '#7fae5c',
      desc: '통기타 스트로크와 클라리넷, 피치카토. 탬버린을 흔들며 들판을 걷는 기분.',
      tags: ['소박함', '자연', '걷기'], vibe: { v: 0.55, a: 0.5 },
      genres: { celtic: 2.4, highlife: 0.7, reggae: 0.5, bossa: 0.5, citypop: 0.3 },
      insts: { lead: ['clarinet', 'flute', 'acoustic'], chord: 'acoustic', pad: null, bass: 'upright', counter: 'pizz' },
      kit: { k: 'frameLo', s: 'snareSoft', h: 'tamb', kickBody: 0.3 }, fx: { lofi: 0.05, reverb: 0.25 }, lofiOk: false,
    },
    {
      id: 'ambientpiano', ko: '앰비언트 피아노', en: 'Ambient Piano', color: '#8fc0c9',
      desc: '빈 공간에 피아노 한 음씩. 현악이 아주 멀리서 숨 쉬고, 하프가 물결처럼 흘러요.',
      tags: ['고요함', '여백', '잔향'], vibe: { v: 0.15, a: 0.08 },
      genres: { ambient: 3, lofi: 0.5, gamelan: 0.4 },
      insts: { lead: ['piano', 'vibes', 'harp'], chord: 'strings', pad: 'strings', bass: 'strings', arp: 'harp' },
      arp: { rate: 4, shape: 'up', oct: 12, vel: 0.32 },
      kit: {}, fx: { lofi: 0, reverb: 0.75, air: -1.5 }, lofiOk: false,
    },
    {
      id: 'citynight', ko: '시티팝 나이트', en: 'City Night', color: '#ff7aa8',
      desc: '네온이 번지는 밤 고속도로. 일렉 피아노 코드, 색소폰, 클린 기타 커팅, 탄력 있는 베이스.',
      tags: ['세련됨', '밤', '그루브'], vibe: { v: 0.55, a: 0.6 },
      genres: { citypop: 3, house: 1, synthwave: 1, boombap: 0.4, jfusion: 0.6 },
      insts: { lead: ['sax', 'epiano', 'eguitar'], chord: 'epiano', pad: 'strings', bass: 'ebass', arp: 'eguitar' },
      arp: { rate: 2, shape: 'chop', oct: 0, vel: 0.4 },
      kit: {}, fx: { lofi: 0.12, reverb: 0.3 }, lofiOk: false,
    },
    {
      id: 'worldperc', ko: '월드 퍼커션', en: 'World Percussion', color: '#e46a3c',
      desc: '콩가·봉고·다르부카·아고고 같은 진짜 손북들. 마림바와 칼림바가 그 위에서 통통 튀어요.',
      tags: ['리듬', '흙냄새', '여행'], vibe: { v: 0.5, a: 0.75 },
      genres: { afrobeat: 2, highlife: 2, son: 2, samba: 1.4, amapiano: 1, maghreb: 1, raga: 0.8, gamelan: 0.8, dembow: 0.8, aksak: 0.8, flamenco: 0.6 },
      insts: { lead: ['marimba', 'kalimba', 'flute'], chord: ['nylon', 'marimba'], bass: 'ebass' },
      kit: { tb: 'darbuka', tbl: 'frameLo', bell: 'agogo', cg: 'congaHi', cgl: 'congaLo', h: 'shaker', jg: 'darbuka', log: 'slit' }, fx: { lofi: 0.05, reverb: 0.2 }, lofiOk: false,
    },
    {
      id: 'chiptune', ko: '레트로 칩튠', en: 'Retro Chip', color: '#6fd36f',
      desc: '옛날 게임기 소리. 네모난 파형, 삼각파 베이스, 노이즈 드럼. 일부러 전자음!',
      tags: ['8비트', '장난', '추억'], vibe: { v: 0.6, a: 0.8 },
      genres: { synthwave: 2, jfusion: 1.4, celtic: 0.6, techno: 0.4 },
      insts: { lead: 'chip', chord: 'chip', pad: null, bass: 'chipbass', arp: 'chip' },
      arp: { rate: 1, shape: 'up', oct: 12, vel: 0.3 },
      kit: { k: null, s: null, h: null, o: null, c: null, r: null, sh: null, crash: null }, synthKit: true, fx: { lofi: 0, reverb: 0.12 }, lofiOk: false,
    },
  ];
  H.STYLE = {};
  H.STYLES.forEach((s) => { H.STYLE[s.id] = s; });

  /* the pet's innate liking (it changes over time) */
  H.DEFAULT_TASTE = { bluesky: 0.55, lofipiano: 0.6, cinematic: 0.4, cafebossa: 0.5, jazztrio: 0.38, folk: 0.4, ambientpiano: 0.5, citynight: 0.45, worldperc: 0.3, chiptune: 0.15 };

  /* genres whose lead instrument is part of their identity keep it */
  const SIGNATURE = ['sitar', 'oud', 'gayageum', 'bandoneon', 'metal', 'bell', 'whistle'];

  /* choose a style: taste × today's mood × a bit of novelty.  returns { id, why } */
  H.chooseStyle = function (mood, taste, opts = {}) {
    const r = opts.r || Math.random;
    if (opts.request && H.STYLE[opts.request]) return { id: opts.request, why: 'request' };
    const recent = opts.recent || [];
    const parts = {};
    const pick = r.weighted ? r.weighted.bind(r) : null;
    const w = (s) => {
      const t = H.clamp(taste[s.id] ?? 0.3, 0.02, 1);
      const d = Math.hypot((s.vibe.v - mood.valence) * 0.9, (s.vibe.a - mood.arousal) * 1.2);
      const fit = 1 / (0.35 + d);
      const nov = recent.slice(-2).includes(s.id) ? 0.5 : recent.slice(-5).includes(s.id) ? 0.85 : 1.15;
      parts[s.id] = { t, fit, nov };
      return Math.pow(t + 0.1, 1.6) * fit * nov;
    };
    const id = pick ? pick(H.STYLES, w).id : H.STYLES.slice().sort((a, b) => w(b) - w(a))[0].id;
    H.STYLES.forEach((s) => { if (!parts[s.id]) w(s); });
    const p = parts[id];
    const favorite = Object.keys(taste).sort((a, b) => (taste[b] || 0) - (taste[a] || 0))[0];
    const why = id === favorite && p.t > 0.5 ? 'love' : p.fit > 1.6 ? 'mood' : p.nov > 1 && !recent.includes(id) ? 'new' : p.nov > 1 ? 'again' : 'whim';
    return { id, why };
  };

  H.styleReason = function (choice, mood) {
    const s = H.STYLE[choice.id]; if (!s) return '';
    const mw = H.moodWords ? H.moodWords(mood).ko : '';
    return ({
      request: `네가 추천해준 ${s.ko}! 한번 해볼게.`,
      love: `역시 난 ${s.ko}가 제일 좋아. 오늘도 이걸로!`,
      mood: `오늘 기분이 ${mw}라서… ${s.ko} 쪽이 끌려.`,
      new: `오늘은 ${s.ko} 느낌으로 처음 해볼래. 두근두근.`,
      again: `오랜만에 ${s.ko} 해볼까?`,
      whim: `음… 그냥 오늘은 ${s.ko}! 이유는 비밀.`,
    })[choice.why] || `${s.ko}로 할게.`;
  };

  /* resolve a style against a genre → concrete instruments (deterministic for a seed) */
  H.styleInsts = function (style, g, base, r) {
    const out = Object.assign({}, base);
    if (!style) return out;
    const pickOne = (v) => (Array.isArray(v) ? v[Math.floor(r() * v.length)] : v);
    const si = style.insts || {};
    ['lead', 'chord', 'bass'].forEach((k) => {
      if (si[k] === undefined) return;
      if (k === 'lead' && SIGNATURE.includes(base.lead)) return;
      if (k === 'chord' && !base.chord) return;
      if (k === 'chord' && ['metal'].includes(base.chord)) return;
      if (k === 'bass' && ['metal', 'logdrum'].includes(base.bass)) return;
      out[k] = pickOne(si[k]);
    });
    if (si.pad !== undefined && g.pad !== 'tanpura') out.pad = pickOne(si.pad);
    ['double', 'arp', 'counter'].forEach((k) => { if (si[k]) out[k] = pickOne(si[k]); });
    return out;
  };

  /* taste drifts: liked things grow, the rest relax slowly toward the middle */
  H.nudgeTaste = function (state, id, amount) {
    state.taste = Object.assign({}, H.DEFAULT_TASTE, state.taste || {});
    if (!H.STYLE[id]) return;
    Object.keys(state.taste).forEach((k) => { if (k !== id) state.taste[k] = H.lerp(state.taste[k], 0.4, 0.01); });
    state.taste[id] = H.clamp(state.taste[id] + amount, 0.03, 1);
  };
})(window.H);

(function (H) {
  'use strict';
  /* human-readable instrument list of a song */
  H.songInstKo = function (song) {
    const I = song.insts || {};
    return ['lead', 'double', 'chord', 'arp', 'counter', 'pad', 'bass'].filter((k) => I[k]).map((k) => H.instKo(I[k]))
      .filter((v, i, a) => a.indexOf(v) === i).join(' · ');
  };
})(window.H);
