/* HARU — gathering the day's world: news, trends, curiosity, weather → keywords & mood */
(function (H) {
  'use strict';

  const SOURCES = [
    { id: 'googleNewsKR', ko: '구글 뉴스 · 한국', kind: 'news', type: 'rss', url: 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko', weight: 1.0 },
    { id: 'googleNewsWorld', ko: 'Google News · World', kind: 'news', type: 'rss', url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en', weight: 0.8 },
    { id: 'bbc', ko: 'BBC World', kind: 'news', type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', weight: 0.7 },
    { id: 'trendsKR', ko: '구글 트렌드 · 한국', kind: 'trend', type: 'trends', url: 'https://trends.google.com/trending/rss?geo=KR', weight: 1.6 },
    { id: 'trendsUS', ko: 'Google Trends · US', kind: 'trend', type: 'trends', url: 'https://trends.google.com/trending/rss?geo=US', weight: 1.0 },
    { id: 'wikipedia', ko: '위키백과 · 많이 본 문서', kind: 'curiosity', type: 'wiki', url: '', weight: 0.9 },
    { id: 'hackerNews', ko: 'Hacker News', kind: 'tech', type: 'rss', url: 'https://hnrss.org/frontpage', weight: 0.6 },
  ];
  H.SOURCES = SOURCES;

  /* ---------- lexicons ---------- */
  const POS = ('상승 성공 회복 축하 우승 기쁨 사랑 행복 평화 합의 호황 최고 신기록 개막 축제 출시 혁신 기대 희망 감동 첫눈 미소 협력 승리 흑자 돌파 반등 화해 기적 극복 선물 탄생 결혼 수상 영예 완공 개통 귀환 구조 호평 인기 흥행 대박 웃음 따뜻 봄 꽃 맑음 '
    + 'win wins won record celebrate celebrates hope peace deal rescue rescued breakthrough love joy best launch launches success recovery rally growth award champion festival happy smile cure discovers discovery').split(/\s+/);
  const NEG = ('사망 사고 화재 전쟁 공습 폭락 하락 위기 갈등 논란 비판 혐의 구속 체포 피해 지진 홍수 폭우 태풍 테러 부상 실종 파업 적자 우려 경고 충돌 살인 폭행 침체 불안 소송 사퇴 참사 붕괴 폭발 유출 사기 의혹 반발 규탄 철수 감소 손실 폭염 한파 산불 확산 감염 해킹 중단 결렬 '
    + 'war killed dead death deaths crash fire attack attacks strike strikes crisis fall falls plunge flood floods earthquake storm shooting arrest arrested lawsuit fraud scandal fear fears warning warns conflict collapse explosion hack outbreak protest protests ban cuts layoffs recession').split(/\s+/);
  const TENSE = ('긴급 속보 경고 비상 위협 미사일 군사 대치 선거 압박 관세 규제 제재 탄핵 북한 핵 국경 계엄 최후통첩 '
    + 'breaking urgent missile military election tariff tariffs sanctions nuclear threat threatens border emergency').split(/\s+/);
  const CATS = {
    tech: { ko: '기술', color: '#1fa6c9', words: 'ai 인공지능 반도체 애플 삼성 엔비디아 로봇 앱 구글 오픈ai 챗gpt 클로드 메타 테슬라 칩 스마트폰 아이폰 갤럭시 데이터 클라우드 소프트웨어 해킹 openai google apple nvidia microsoft chip chips robot software startup model llm' },
    economy: { ko: '경제', color: '#3e9b5a', words: '금리 주가 코스피 코스닥 환율 증시 물가 달러 부동산 아파트 수출 경제 은행 투자 비트코인 코인 주식 기업 매출 실적 연준 market stocks economy inflation bank fed bitcoin dollar trade prices earnings' },
    politics: { ko: '정치', color: '#4b4fc9', words: '대통령 국회 선거 장관 여당 야당 정부 총리 국정 의원 정당 민주당 국민의힘 대선 탄핵 president congress senate election minister government parliament vote policy trump' },
    world: { ko: '세계', color: '#2f6fe0', words: '미국 중국 일본 러시아 우크라이나 이스라엘 유럽 북한 가자 이란 영국 프랑스 독일 인도 유엔 나토 us china japan russia ukraine israel europe gaza iran un nato world' },
    culture: { ko: '문화', color: '#c23f8f', words: '영화 드라마 콘서트 아이돌 앨범 전시 공연 넷플릭스 뮤지컬 배우 가수 컴백 음원 웹툰 책 소설 방탄 블랙핑크 뉴진스 film movie music album concert netflix show series book art artist fashion' },
    sports: { ko: '스포츠', color: '#e0782f', words: '축구 야구 농구 배구 리그 경기 우승 손흥민 이강인 올림픽 월드컵 감독 선수 골 득점 홈런 kbo epl nba mlb football soccer league match game team coach player goal olympics cup' },
    nature: { ko: '날씨·자연', color: '#1f9e8f', words: '날씨 기온 눈 비 태풍 지진 미세먼지 한파 폭염 첫눈 단풍 장마 기후 바다 산 숲 동물 climate weather snow rain storm heat wildfire ocean animal species' },
    science: { ko: '과학', color: '#7b4fd0', words: '우주 연구 발견 nasa 백신 과학 위성 로켓 달 화성 블랙홀 유전자 의학 치료 노벨 space research study scientists vaccine rocket moon mars planet telescope dna medicine nobel' },
  };
  const CAT_SET = {};
  Object.keys(CATS).forEach((c) => CATS[c].words.split(/\s+/).forEach((w) => { CAT_SET[w.toLowerCase()] = c; }));
  H.CATS = CATS;

  const STOP_KO = new Set(('뉴스 기자 속보 오늘 종합 단독 사진 영상 위해 대한 관련 통해 이번 지난 내일 어제 올해 지금 그리고 하지만 이후 이전 가운데 모두 정말 진짜 최근 현재 당시 사실 무엇 어떻게 누구 이유 결과 '
    + '것으로 있다 없다 한다 했다 된다 됐다 밝혀 밝혔다 말했다 전했다 나선 나서 위한 대해 따른 따라 앞두고 뒤 등 및 또 더 수 중 약 만 년 월 일 시 분 개 명 곳 건 차 회 번 측 씨 '
    + '이슈 화제 포토 인터뷰 칼럼 사설 오피니언 브리핑 헤드라인 뉴스1 연합뉴스 뉴시스 경향신문 한겨레 조선일보 중앙일보 동아일보 매일경제 한국경제 머니투데이 kbs mbc sbs jtbc ytn').split(/\s+/));
  const STOP_EN = new Set(('the a an and or but of to in on at for with from by as is are was were be been being it its this that these those after before over under into about amid says said say new more most than will would could can may might not no yes '
    + 'his her their our your my he she they we you i who what when where why how all any some one two three first last year years day days week today news live update updates report reports video watch us via just also out up down off get got make makes').split(/\s+/));
  const PARTICLES = ['으로부터', '에서는', '에게서', '까지는', '이라고', '라고', '에서', '에게', '한테', '께서', '으로', '부터', '까지', '처럼', '보다', '마저', '조차', '이나', '이다', '였다', '이며', '하는', '했다', '한다', '하고', '해서', '된다', '됐다', '은', '는', '이', '가', '을', '를', '에', '의', '로', '와', '과', '도', '만', '나'];

  function stripParticle(w) {
    for (const p of PARTICLES) {
      if (w.length > p.length + 1 && w.endsWith(p)) return w.slice(0, -p.length);
    }
    return w;
  }

  function tokenize(text) {
    const out = [];
    const clean = String(text).replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[“”"'‘’…·•|:;,.!?<>«»\/\\#%&*+=~^_{}]/g, ' ');
    clean.split(/\s+/).forEach((raw) => {
      if (!raw) return;
      let w = raw.trim();
      if (/^[0-9.,%-]+$/.test(w)) return;
      if (/[가-힣]/.test(w)) {
        w = w.replace(/[^가-힣a-zA-Z0-9]/g, '');
        w = stripParticle(w);
        if (w.length < 2 || STOP_KO.has(w)) return;
        out.push(w);
      } else {
        const lw = w.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
        if (lw.length < 3 || STOP_EN.has(lw)) return;
        out.push(lw);
      }
    });
    return out;
  }
  H.tokenize = tokenize;

  /* ---------- fetching ---------- */
  async function fetchText(url) {
    if (window.haru && window.haru.fetchText) return window.haru.fetchText(url);
    const r = await fetch(url); return { ok: r.ok, status: r.status, text: await r.text() };
  }

  function parseRSS(xml, src) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const items = [...doc.querySelectorAll('item')].slice(0, 30);
    return items.map((it) => {
      let title = (it.querySelector('title') || {}).textContent || '';
      title = title.replace(/\s+-\s+[^-]{2,40}$/, '').trim(); /* strip " - Publisher" */
      return { title, source: src.ko, sourceId: src.id, kind: src.kind, weight: src.weight, url: (it.querySelector('link') || {}).textContent || '' };
    }).filter((x) => x.title.length > 3);
  }

  function parseTrends(xml, src) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const items = [...doc.getElementsByTagName('item')].slice(0, 25);
    return items.map((it, i) => {
      const title = (it.getElementsByTagName('title')[0] || {}).textContent || '';
      const trafficEl = it.getElementsByTagName('ht:approx_traffic')[0];
      const traffic = trafficEl ? parseInt(trafficEl.textContent.replace(/[^0-9]/g, ''), 10) || 0 : 0;
      const news = [...it.getElementsByTagName('ht:news_item_title')].map((n) => n.textContent).slice(0, 2);
      return { title: title.trim(), source: src.ko, sourceId: src.id, kind: 'trend', weight: src.weight * (1 + Math.log10(1 + traffic) / 6) * (1 - i / 60), traffic, context: news };
    }).filter((x) => x.title);
  }

  async function fetchWiki(src) {
    const d = new Date(Date.now() - 86400000);
    const ymd = `${d.getUTCFullYear()}/${H.pad2(d.getUTCMonth() + 1)}/${H.pad2(d.getUTCDate())}`;
    const out = [];
    for (const lang of ['ko', 'en']) {
      try {
        const r = await fetchText(`https://api.wikimedia.org/feed/v1/wikipedia/${lang}/featured/${ymd}`);
        if (!r.ok) continue;
        const j = JSON.parse(r.text);
        const arts = ((j.mostread && j.mostread.articles) || []).filter((a) => !/^(Special|특수|Main_Page|대문|Wikipedia|위키백과)/.test(a.title)).slice(0, 12);
        arts.forEach((a, i) => out.push({ title: (a.normalizedtitle || a.title || '').replace(/_/g, ' '), source: `위키백과(${lang})`, sourceId: src.id, kind: 'curiosity', weight: src.weight * (1 - i / 30), views: a.views }));
      } catch (e) { /* ignore */ }
    }
    return out;
  }

  async function fetchWeather(s) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&current=temperature_2m,weather_code,is_day,wind_speed_10m,precipitation,cloud_cover&timezone=auto`;
      const r = await fetchText(url);
      if (!r.ok) return null;
      const c = JSON.parse(r.text).current;
      return { temp: c.temperature_2m, code: c.weather_code, isDay: !!c.is_day, wind: c.wind_speed_10m, precip: c.precipitation, cloud: c.cloud_cover, ...describeWeather(c.weather_code) };
    } catch (e) { return null; }
  }

  function describeWeather(code) {
    if (code === 0) return { sky: 'clear', ko: '맑음' };
    if (code <= 2) return { sky: 'partly', ko: '구름 조금' };
    if (code === 3) return { sky: 'cloudy', ko: '흐림' };
    if (code === 45 || code === 48) return { sky: 'fog', ko: '안개' };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { sky: 'rain', ko: '비' };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { sky: 'snow', ko: '눈' };
    if (code >= 95) return { sky: 'storm', ko: '뇌우' };
    return { sky: 'cloudy', ko: '흐림' };
  }
  H.describeWeather = describeWeather;

  H.geocode = async function (name) {
    const r = await fetchText(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=ko`);
    if (!r.ok) return null;
    const j = JSON.parse(r.text);
    return j.results && j.results[0] ? { name: j.results[0].name, lat: j.results[0].latitude, lon: j.results[0].longitude, country: j.results[0].country } : null;
  };

  /* gather(settings.sources, onItem(item), onSource(id, status)) */
  H.gatherWorld = async function (srcSettings, onItem, onSource) {
    const items = [];
    const status = {};
    const list = SOURCES.filter((s) => srcSettings[s.id] !== false);
    (srcSettings.custom || []).forEach((url, i) => { if (url) list.push({ id: 'custom' + i, ko: url.replace(/^https?:\/\//, '').slice(0, 28), kind: 'news', type: 'rss', url, weight: 0.9 }); });
    await Promise.all(list.map(async (src) => {
      onSource && onSource(src.id, 'loading', src);
      try {
        let got = [];
        if (src.type === 'wiki') got = await fetchWiki(src);
        else {
          const r = await fetchText(src.url);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          got = src.type === 'trends' ? parseTrends(r.text, src) : parseRSS(r.text, src);
        }
        status[src.id] = got.length ? 'ok' : 'empty';
        got.forEach((it) => { items.push(it); onItem && onItem(it); });
        onSource && onSource(src.id, status[src.id], src, got.length);
      } catch (e) {
        status[src.id] = 'fail';
        onSource && onSource(src.id, 'fail', src, 0);
      }
    }));
    const weather = srcSettings.weather !== false ? await fetchWeather(srcSettings) : null;
    const offline = items.length < 5;
    if (offline) FALLBACK().forEach((it) => items.push(it));
    return { items, weather, status, offline, at: Date.now() };
  };

  function FALLBACK() {
    const d = new Date();
    const season = ['겨울', '겨울', '봄', '봄', '봄', '여름', '여름', '여름', '가을', '가을', '가을', '겨울'][d.getMonth()];
    const lines = [
      `${season} 하늘 아래 조용한 하루`, '오늘은 세상이 잠시 숨을 고르는 날', '창밖의 바람 소리와 따뜻한 차 한 잔',
      '어딘가에서는 누군가 새 노래를 만들고 있다', '도시의 불빛과 오래된 레코드', '작은 방 안의 커다란 상상',
      '인터넷이 조용한 날에는 내 마음의 소식을 듣는다', '연필 소리, 물감 냄새, 그리고 고양이',
    ];
    return lines.map((t, i) => ({ title: t, source: '마음 속 소식', sourceId: 'inner', kind: 'inner', weight: 0.8 - i * 0.05 }));
  }

  /* ---------- analysis ---------- */
  H.analyzeWorld = function (data, history, whispers) {
    const vocab = {};
    const docs = [];
    const add = (w, amt, item) => {
      const e = vocab[w] || (vocab[w] = { w, score: 0, n: 0, kinds: {}, sample: null });
      e.score += amt; e.n++; e.kinds[item.kind] = (e.kinds[item.kind] || 0) + 1;
      if (!e.sample) e.sample = item.title;
    };
    let pos = 0, neg = 0, tense = 0, total = 0;
    const catScore = {};
    const hint = {};
    data.items.forEach((item) => {
      const toks = [...new Set(tokenize(item.title + ' ' + (item.context || []).join(' ')))];
      if (item.kind === 'trend' || item.kind === 'curiosity') {
        const phrase = item.title.trim();
        if (phrase.length >= 2 && phrase.length <= 24) add(phrase.toLowerCase() === phrase ? phrase : phrase, item.weight * 1.6, item);
      }
      toks.forEach((t) => add(t, item.weight, item));
      docs.push(toks);
      const text = item.title.toLowerCase();
      let p = 0, n = 0, te = 0;
      toks.forEach((t) => { if (POS.includes(t)) p++; if (NEG.includes(t)) n++; if (TENSE.includes(t)) te++; const c = CAT_SET[t]; if (c) catScore[c] = (catScore[c] || 0) + item.weight; });
      POS.forEach((w) => { if (w.length >= 2 && /[가-힣]/.test(w) && text.includes(w) && !toks.includes(w)) p += 0.5; });
      NEG.forEach((w) => { if (w.length >= 2 && /[가-힣]/.test(w) && text.includes(w) && !toks.includes(w)) n += 0.5; });
      pos += p * item.weight; neg += n * item.weight; tense += te * item.weight; total += item.weight;
      H.GENRE_HINTS.forEach((g) => { if (g.re.test(item.title)) g.ids.forEach((id) => { hint[id] = (hint[id] || 0) + item.weight; }); });
    });
    (whispers || []).forEach((w) => { add(w, 4, { kind: 'whisper', title: `너가 속삭인 말: ${w}` }); H.GENRE_HINTS.forEach((g) => { if (g.re.test(w)) g.ids.forEach((id) => { hint[id] = (hint[id] || 0) + 3; }); }); });

    /* idf-ish damping: very common across docs gets slightly lowered */
    const df = {};
    docs.forEach((toks) => toks.forEach((t) => { df[t] = (df[t] || 0) + 1; }));
    const N = Math.max(1, docs.length);
    Object.values(vocab).forEach((e) => {
      const d = df[e.w] || 1;
      e.score *= 0.6 + 0.4 * Math.log(1 + N / d) / Math.log(1 + N);
      if (e.n < 2 && !e.kinds.trend && !e.kinds.curiosity && !e.kinds.whisper) e.score *= 0.55;
    });
    let kws = Object.values(vocab).sort((a, b) => b.score - a.score);
    /* drop near-duplicates (substring of a stronger keyword) */
    const kept = [];
    for (const k of kws) {
      if (kept.length >= 48) break;
      if (kept.some((q) => q.w.includes(k.w) && q.w.length - k.w.length <= 2 && k.w.length >= 2 && q.w !== k.w && /[가-힣]/.test(k.w))) continue;
      kept.push(k);
    }
    kws = kept;
    const maxS = kws[0] ? kws[0].score : 1;
    kws.forEach((k) => {
      k.norm = k.score / maxS;
      k.cat = CAT_SET[k.w.toLowerCase()] || guessCat(k.sample || '') || 'world';
      k.sent = POS.includes(k.w) ? 1 : NEG.includes(k.w) ? -1 : 0;
      k.isNew = !(history || []).some((h) => (h.keywords || []).includes(k.w));
      k.whisper = !!k.kinds.whisper;
    });

    /* co-occurrence edges among kept keywords */
    const idx = {}; kws.forEach((k, i) => { idx[k.w] = i; });
    const edgeMap = {};
    data.items.forEach((item) => {
      const present = kws.filter((k) => item.title.includes(k.w) || item.title.toLowerCase().includes(k.w.toLowerCase())).map((k) => idx[k.w]);
      for (let a = 0; a < present.length; a++) for (let b = a + 1; b < present.length; b++) {
        const key = Math.min(present[a], present[b]) + '-' + Math.max(present[a], present[b]);
        edgeMap[key] = (edgeMap[key] || 0) + item.weight;
      }
    });
    const edges = Object.entries(edgeMap).map(([k, w]) => { const [a, b] = k.split('-').map(Number); return { a, b, w }; }).sort((x, y) => y.w - x.w).slice(0, 120);

    const totalCat = Object.values(catScore).reduce((s, v) => s + v, 0) || 1;
    const cats = {}; Object.keys(CATS).forEach((c) => { cats[c] = (catScore[c] || 0) / totalCat; });
    const novelty = kws.length ? kws.slice(0, 20).filter((k) => k.isNew).length / Math.min(20, kws.length) : 0.5;
    const valence = H.clamp((pos - neg) / Math.max(1, (pos + neg) * 0.9 + total * 0.08), -1, 1);
    const tension = H.clamp(tense / Math.max(1, total * 0.12) * 0.6 + neg / Math.max(1, total * 0.25) * 0.4, 0, 1);
    const trendHeat = data.items.filter((i) => i.kind === 'trend').reduce((s, i) => s + Math.log10(1 + (i.traffic || 0)), 0) / 60;
    const warmth = H.clamp((cats.culture || 0) * 1.4 + (cats.sports || 0) + (cats.nature || 0) * 0.6 + Math.max(0, valence) * 0.4, 0, 1);
    let arousal = H.clamp(0.25 + tension * 0.45 + H.clamp(trendHeat, 0, 0.3) + (cats.sports || 0) * 0.4 + (cats.tech || 0) * 0.2 - (cats.nature || 0) * 0.2, 0, 1);
    const w = data.weather;
    if (w) {
      if (w.sky === 'rain' || w.sky === 'fog') arousal = H.clamp(arousal - 0.12);
      if (w.sky === 'storm') arousal = H.clamp(arousal + 0.1);
    }
    const topCat = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0] || 'world';
    const seen = new Set();
    const take = (kinds, n) => data.items.filter((i) => kinds.includes(i.kind) && !seen.has(i.title)).sort((a, b) => b.weight - a.weight).slice(0, n).map((h) => { seen.add(h.title); return h; });
    const pickHeads = [...take(['news'], 10), ...take(['trend'], 4), ...take(['curiosity', 'tech'], 4)];

    return {
      date: H.dateKey(), keywords: kws, edges, cats, topCat, hint,
      mood: { valence, arousal, tension, warmth, novelty },
      headlines: pickHeads.length ? pickHeads : data.items.slice(0, 8),
      count: data.items.length, weather: data.weather, offline: data.offline, status: data.status,
      whispers: whispers || [],
    };
  };

  function guessCat(text) {
    const toks = tokenize(text);
    const sc = {};
    toks.forEach((t) => { const c = CAT_SET[t]; if (c) sc[c] = (sc[c] || 0) + 1; });
    const best = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
    return best || null;
  }

  H.moodWords = function (m) {
    const v = m.valence, a = m.arousal;
    if (v > 0.3 && a > 0.55) return { ko: '들뜬', en: 'elated', color: '#f0a33a' };
    if (v > 0.3) return { ko: '포근한', en: 'warm', color: '#e9b872' };
    if (v < -0.3 && a > 0.55) return { ko: '어수선한', en: 'restless', color: '#d0564b' };
    if (v < -0.3) return { ko: '가라앉은', en: 'heavy', color: '#5b6b9a' };
    if (a > 0.6) return { ko: '분주한', en: 'busy', color: '#e07a3f' };
    if (a < 0.3) return { ko: '고요한', en: 'still', color: '#7fa8c9' };
    return { ko: '잔잔한', en: 'calm', color: '#8fb3a8' };
  };
})(window.H);
