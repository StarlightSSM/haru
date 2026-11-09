/* HARU — titles and the day's diary (templates, optionally written by Claude) */
(function (H) {
  'use strict';

  const NOUNS = ['오후', '밤', '궤도', '온도', '산책', '파도', '리듬', '주파수', '정거장', '창문', '소음', '숨', '편지', '안개', '계절', '조각'];
  const TIMES = (h) => (h < 6 ? '새벽' : h < 12 ? '아침' : h < 18 ? '오후' : '밤');

  H.makeTitle = function (world, seed) {
    const r = H.rng(seed);
    const kws = world.keywords.filter((k) => k.w.length <= 10);
    const a = (kws[0] || { w: '하루' }).w, b = (kws[1] || { w: '세상' }).w, c = (kws[r.int(2, Math.min(8, Math.max(2, kws.length - 1)))] || { w: '바람' }).w;
    const mood = H.moodWords(world.mood).ko;
    const forms = [
      () => `${a}의 ${r.pick(NOUNS)}`,
      () => `${mood} ${c}`,
      () => `${a}, 그리고 ${b}`,
      () => `${TIMES(new Date().getHours())}의 ${c}`,
      () => `${c}에게 보내는 ${r.pick(['편지', '노래', '신호', '안부'])}`,
      () => `${b} 너머의 ${r.pick(NOUNS)}`,
    ];
    return r.pick(forms)();
  };

  H.writeDiaryTemplate = function (ctx) {
    const { world, song, art, log, petName, date } = ctx;
    const r = H.rng(H.hash(date + song.title));
    const kws = world.keywords.slice(0, 6).map((k) => k.w);
    const mood = H.moodWords(world.mood);
    const g = H.GENRE[song.genreId];
    const w = world.weather;
    const J = (w2, p) => H.josa(w2, p).slice(String(w2).length);
    const lines = [];
    lines.push(`${H.koDate(new Date())}${w ? `, ${w.ko} ${Math.round(w.temp)}°C` : ''}.`);
    if (world.offline) lines.push('오늘은 바깥 소식이 잘 들리지 않았어. 그래서 내 안의 소리를 들었어.');
    else {
      lines.push(r.pick([
        `오늘 세상은 ${mood.ko} 얼굴이었어. '${kws[0]}', '${kws[1]}', '${kws[2]}' 같은 말들이 자꾸 귀에 들어왔거든.`,
        `'${kws[0]}'… 오늘은 다들 이 얘기를 했어. 그 옆엔 '${kws[1]}'${J(kws[1], '이랑/랑')} '${kws[2]}'도 있었고. 전체적으로는 ${mood.ko} 하루.`,
        `${world.count}개의 소식을 읽었어. 제일 많이 반짝인 건 '${kws[0]}'. 마음이 조금 ${mood.ko} 쪽으로 기울었어.`,
      ]));
      const headItem = world.headlines.find((h) => h.kind === 'news' && h.title.length > 12) || world.headlines[0];
      const head = headItem && headItem.title;
      if (head) lines.push(`특히 「${head.slice(0, 48)}」 이 소식이 오래 남았어.`);
    }
    if (world.mood.valence < -0.25) lines.push('무거운 소식이 많아서, 음악은 일부러 천천히 숨 쉬게 만들었어.');
    else if (world.mood.valence > 0.25) lines.push('좋은 소식들이 있어서 손끝이 가벼웠어.');
    lines.push(`그래서 ${g.region}에서 온 ${H.josa(g.ko, '으로/로')} 곡을 만들었어. ${song.keyName} ${song.scaleKo}, ${song.bpm} BPM. 제목은 「${song.title}」.`);
    if (song.motifs[0]) lines.push(`첫 멜로디는 '${song.motifs[0].word}'${J(song.motifs[0].word, '이라는/라는')} 단어의 글자들로 만들었어 (${song.motifs[0].names.slice(0, 4).join(' ')}).`);
    lines.push(r.pick([
      `그림은 ${art.styleKo} 스타일. 사람들이 같은 걸 이야기할 때 점들이 모이는 게 보였거든.`,
      `그림은 ${H.josa(art.styleKo, '으로/로')} 그렸어. 오늘의 색은 소리를 들으면서 골랐어.`,
      `${art.styleKo} 그림을 그렸어. 붓질 하나하나가 오늘의 소식 하나하나야.`,
    ]));
    const you = [];
    if (log.notes) you.push(`네가 던진 음 ${log.notes}개`);
    if (log.rhythm) you.push(`네가 바꾼 리듬(${log.rhythm})`);
    if (log.splash) you.push(`네가 쏟은 물감 ${log.splash}번`);
    if (log.whispers && log.whispers.length) you.push(`네가 속삭인 '${log.whispers.join("', '")}'`);
    if (you.length) lines.push(`그리고 ${you.join(', ')}… 처음엔 깜짝 놀랐는데, 결국 그게 작품의 일부가 됐어. 고마워.`);
    if (log.pats) lines.push(r.pick(['중간에 쓰다듬어줘서 힘이 났어.', '머리 쓰다듬어 준 거, 사실 좋았어.']));
    if (log.snacks) lines.push('간식도 맛있었어!');
    lines.push(r.pick([
      world.mood.valence < 0 ? '내일은 조금 더 따뜻한 소식이 있으면 좋겠다.' : '내일도 오늘만큼 반짝이면 좋겠다.',
      '내일은 어떤 단어가 나를 기다리고 있을까.',
      `내일도 같이 있어줘. — ${petName}`,
    ]));
    return lines.join('\n');
  };

  H.writeDiary = async function (ctx, aiSettings) {
    const fallback = H.writeDiaryTemplate(ctx);
    if (!aiSettings || !aiSettings.enabled || !window.haru || !window.haru.aiDiary) return { diary: fallback, title: null, by: 'template' };
    try {
      const { world, song, art, log, petName } = ctx;
      const payload = {
        petName, date: H.dateKey(), weather: world.weather ? `${world.weather.ko} ${Math.round(world.weather.temp)}°C` : null,
        mood: { word: H.moodWords(world.mood).ko, ...Object.fromEntries(Object.entries(world.mood).map(([k, v]) => [k, Math.round(v * 100) / 100])) },
        keywords: world.keywords.slice(0, 12).map((k) => k.w), headlines: world.headlines.slice(0, 8).map((h) => h.title),
        music: { genre: song.genreKo, region: H.GENRE[song.genreId].region, key: `${song.keyName} ${song.scaleKo}`, bpm: song.bpm, motifWord: song.motifs[0] && song.motifs[0].word },
        art: art.styleKo, userInvolvement: log, draftTitle: song.title,
      };
      const res = await window.haru.aiDiary(payload);
      if (res && res.ok && res.diary) return { diary: res.diary, title: res.title || null, by: 'claude' };
    } catch (e) { console.warn('ai diary failed', e); }
    return { diary: fallback, title: null, by: 'template' };
  };
})(window.H);
