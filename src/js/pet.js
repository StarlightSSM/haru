/* HARU — the companion: stats, movement, moods, words */
(function (H) {
  'use strict';

  const LINES = {
    greet_morning: ['좋은 아침! 오늘은 세상이 무슨 얘기를 하고 있을까?', '왔구나! 커피 내려놨어.', '음… 아직 잠이 덜 깼어. 그래도 너 보니까 좋다.'],
    greet_afternoon: ['어서 와! 점심은 먹었어?', '오후 햇빛이 좋다. 같이 있자.', '마침 너 생각하고 있었어.'],
    greet_evening: ['저녁이네. 오늘 하루 어땠어?', '노을 봤어? 오늘 색 예뻤어.', '왔구나. 같이 쉬자.'],
    greet_night: ['이 시간까지 안 자고 뭐 해? …나도 안 자지만.', '밤이 조용해서 좋아.', '쉿, 다들 자는 시간이야.'],
    greet_long: ['보고 싶었어… {days}일 만이야.', '왜 이제 왔어! 그동안 그린 거 보여줄게.'],
    gather_start: ['오늘 소식 좀 읽어볼게.', '세상 구경 시작~', '뉴스랑 트렌드 모으는 중이야. 잠깐만!'],
    gather_kw: ["'{kw}'… 다들 이 얘기만 하네.", "'{kw}'{^kw|이라는/라는} 말이 자꾸 보여.", "오, '{kw}'? 처음 보는 단어야.", "'{kw}' 얘기가 많아. 사람들이 궁금한가 봐."],
    gather_offline: ['오늘은 인터넷이 조용하네. 내 마음의 소식을 들어볼게.'],
    think: ['오늘 세상은 좀 {mood} 느낌이야.', '{mood} 하루네. 이런 날엔 {genre|은/는} 어떨까?', "'{kw}'{^kw|이랑/랑} '{kw2}'{^kw2|을/를} 섞어볼래."],
    compose_start: ['좋아, {genre|으로/로} 가볼게. {key} {scale}!', '첫 코드부터 잡아볼게.', '오늘 박자는 {bpm}으로.'],
    compose_focus: ['음… 여기서 코드를 바꿀까.', "이 멜로디는 '{kw}'에서 나온 거야.", '쉿, 지금 좋은 부분이야.', '베이스 라인 넣는 중…', '드럼은 살짝 늦게, 더 느긋하게.', '이 부분 반복하면 좋겠다.'],
    paint_start: ['이제 그림 차례!', '소리를 색으로 바꿔볼게.', '오늘은 {style|으로/로} 그려볼래.'],
    paint_focus: ['붓이 잘 나가네.', "'{kw}'는 이 근처에 그려야지.", '한 겹만 더…', '물감이 마르기 전에!', '음악 들으면서 그리니까 손이 춤춰.'],
    finalize: ['마무리하는 중… 녹음하고, 그림 말리고!', '거의 다 됐어. 두근두근.'],
    finish: ['다 됐다! 오늘의 곡은 「{title}」{^title|이야/야}.', '완성! 들어볼래? 「{title}」.', '오늘도 하나 만들었어. 같이 있어줘서 고마워.'],
    pet_pat: ['헤헤.', '으응… 좋아.', '간지러워!', '더 해줘.', '(골골)'],
    pet_pat_focus: ['앗, 지금 집중 중인데… 그래도 좋아.', '조금만 이따가!', '히, 방해꾼.'],
    snack: ['와, 고마워!', '냠냠… 힘이 난다!', '이거 내가 좋아하는 거!'],
    coffee: ['커피 최고.', '눈이 번쩍!', '따뜻하다…'],
    note_good: ['오? {note}… 그거 좋은데?', '그 음 넣어볼게!', '네가 던진 음, 여기 쓸게.'],
    note_annoyed: ['야! 방해하지 마~', '음… 이건 좀 안 어울리는데. 그래도 남겨둘게.', '깜짝이야!'],
    rhythm: ['리듬이 바뀌었어! {genre}…? 재밌다.', '오, 몸이 저절로 움직여.', '이 박자 따라가 볼게!'],
    tempo_up: ['빨라졌다! 손가락이 바빠.', '두근두근.'],
    tempo_down: ['느긋해졌어.', '천천히, 천천히.'],
    splash: ['앗! 물감이…! …근데 이 색 예쁘다.', '이 얼룩, 살려볼게.', '으앗! 이거 일부러 그랬지?'],
    whisper: ["'{word}'? 그 단어 기억해 둘게.", "'{word}'{^word|이라/라}… 오늘 작품에 넣어볼게."],
    knock: ['누구세요~?', '아, 너구나!', '창밖에 뭐가 있어?'],
    idle: ["오늘 '{kw}' 얘기 들었어?", '창밖 구름이 꼭 음표 같아.', '{weather|이고/고} {temp}도래.', '뭐 하고 있어?', '심심하면 리듬 랩에서 놀자!', '벽에 걸린 그림, 기억나?', '너는 오늘 어떤 하루였어?'],
    sleepy: ['하암… 졸려.', '눈꺼풀이 무거워…'],
    night_sleep: ['잘 자… 내일 또 만들자.', 'zzz…'],
    wake: ['잘 잤다! 오늘도 만들어볼까.', '으음… 벌써 아침이야?'],
    teach: ['우와, 이게 {genre|이야/야}? 처음 들어봐!', '{genre}… 배웠어! 다음에 써볼게.', '이 리듬 진짜 좋다. 기억할게.'],
    teach_known: ['{genre}, 이제 꽤 익숙해!', '이거 저번에 알려준 거지? 더 잘 알게 됐어.'],
    request_ok: ['좋아, 다음 곡은 {genre|으로/로}!', '알겠어. {genre|으로/로} 만들어볼게.'],
    request_meh: ['음… {genre}? 아직 잘 모르는데. 그래도 해볼게!'],
    break: ['잠깐 쉬자. 너도 스트레칭!', '휴식 시간~ 물 마셔.'],
    back_to_work: ['다시 시작!', '자, 이어서 해볼까.'],
    lab_listen: ['오, 이 리듬 뭐야?', '잠깐, 귀 기울이는 중…'],
    kitty: ['쉿, 냥이 자는 중이야.', '냥이도 음악 좋아해.'],
    shop: ['우와, 이거 내 방에 둬도 돼?', '고마워! 방이 더 좋아졌어.'],
  };
  H.LINES = LINES;

  /* Korean particle by final consonant: H.josa('연차', '이랑/랑') → '연차랑' */
  H.josa = function (w, pair) {
    w = String(w ?? '');
    const [a, b] = pair.split('/');
    const ch = w.trim().slice(-1); const code = ch.charCodeAt(0);
    let bat;
    if (code >= 0xac00 && code <= 0xd7a3) { const jong = (code - 0xac00) % 28; bat = jong !== 0 && !(a === '으로' && jong === 8); }
    else if (/[0-9]/.test(ch)) bat = '013678'.includes(ch);
    else bat = /[bcdgjklmnpqtx]$/i.test(ch);
    return w + (bat ? a : b);
  };
  H.fillLine = function (key, vars = {}, r = Math.random) {
    const pool = LINES[key] || [key];
    let s = pool[Math.floor(r() * pool.length)];
    return s.replace(/\{(\^?)(\w+)(?:\|([^}]+))?\}/g, (_, only, k, pair) => {
      const v = vars[k] !== undefined ? String(vars[k]) : '';
      if (!pair) return v;
      const full = H.josa(v, pair);
      return only ? full.slice(v.length) : full;
    });
  };

  H.DEFAULT_STATE = {
    stats: { mood: 62, energy: 85, focus: 40, bond: 15, inspiration: 45 },
    level: 1, xp: 0, stars: 60, works: 0, days: 0,
    known: { lofi: 0.6, bossa: 0.4, citypop: 0.35, ambient: 0.4, jazzwaltz: 0.3, reggae: 0.25 },
    items: [], lastVisit: 0, lastWorkDate: '', history: [], request: null, styleRequest: null, taste: null, whispers: [], creation: null,
    patsToday: 0, patsDate: '', firstRun: true,
  };

  class Pet {
    constructor(state, cfg) {
      this.state = state; this.cfg = cfg;
      const sp = H.SPOTS.desk;
      this.x = sp.x; this.y = sp.y; this.spot = 'desk'; this.seated = true;
      this.target = null; this.wantAct = 'idle'; this.act = 'idle'; this.facing = 0; this.flip = false;
      this.emo = 'neutral'; this.emoUntil = 0; this.override = null; this.talkUntil = 0;
      this.t = 0; this.look = { x: 0, y: 0 }; this.brushColor = '#5b7cfa';
      this.onArrive = null;
    }
    get stats() { return this.state.stats; }

    goTo(spot, act, onArrive) {
      const s = H.SPOTS[spot];
      if (!s) return;
      this.wantAct = act || 'idle';
      this.onArrive = onArrive || null;
      if (this.spot === spot && !this.target) { this.act = this.wantAct; this.seated = s.seated; this.facing = s.facing || 0; onArrive && onArrive(); return; }
      /* walk around the desk instead of through it */
      const behind = (y) => y < 700;
      const fin = { spot, x: s.x, y: s.y };
      const curY = this.target ? this.target.y : this.y;
      this.path = behind(curY) !== behind(s.y)
        ? (behind(curY) ? [{ x: 1100, y: 650 }, { x: 1100, y: 815 }, fin] : [{ x: 1100, y: 815 }, { x: 1100, y: 650 }, fin])
        : [fin];
      this.target = this.path.shift();
      this.seated = false;
    }

    setAct(act) { this.wantAct = act; if (!this.target) this.act = act; }
    flash(act, sec, emo) { this.override = { act, until: this.t + sec }; if (emo) this.feel(emo, sec); }
    feel(emo, sec = 3) { this.emo = emo; this.emoUntil = this.t + sec; }
    speak(sec) { this.talkUntil = this.t + sec; }

    update(dt) {
      this.t += dt;
      if (this.target) {
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);
        const sp = 190 * dt;
        if (d <= sp && this.path && this.path.length) {
          this.x = this.target.x; this.y = this.target.y; this.target = this.path.shift();
        } else if (d <= sp) {
          this.x = this.target.x; this.y = this.target.y; this.spot = this.target.spot; this.target = null;
          const s = H.SPOTS[this.spot];
          this.seated = s.seated; this.facing = s.facing || 0; this.act = this.wantAct;
          const cb = this.onArrive; this.onArrive = null; cb && cb();
        } else {
          this.x += dx / d * sp; this.y += dy / d * sp;
          this.act = 'walk'; this.facing = Math.sign(dx) || this.facing;
        }
      }
      if (this.emoUntil && this.t > this.emoUntil) { this.emo = 'neutral'; this.emoUntil = 0; }
      if (this.override && this.t > this.override.until) this.override = null;
      /* idle look-around */
      if (Math.random() < dt * 0.4) this.look = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 1.2 };
    }

    get pose() {
      const act = this.override ? this.override.act : this.act;
      let emo = this.emo;
      if (emo === 'neutral') {
        if (act === 'type' || act === 'paint') emo = 'focus';
        else if (act === 'sleep') emo = 'sleepy';
        else if (this.stats.energy < 18) emo = 'sleepy';
        else if (this.stats.mood < 25) emo = 'sad';
      }
      const talk = this.t < this.talkUntil ? Math.abs(Math.sin(this.t * 16)) : 0;
      return { t: this.t, act, facing: this.facing, emo, seated: this.seated, blink: H.blinkAt(this.t, 3), look: act === 'type' ? { x: 0, y: 1 } : act === 'read' ? { x: 0, y: 1 } : this.look, talk, brushColor: this.brushColor };
    }

    nudge(stat, amt) { this.stats[stat] = H.clamp(this.stats[stat] + amt, 0, 100); }

    /* how she takes a prank, 0..1 */
    tolerance(creating) {
      const s = this.stats;
      return H.clamp(0.35 + s.bond / 140 + s.mood / 320 - (creating ? s.focus / 260 : 0));
    }
  }
  H.Pet = Pet;

  H.levelFromXp = (xp) => Math.floor(Math.sqrt(xp / 30)) + 1;
  H.xpForLevel = (lv) => 30 * (lv - 1) * (lv - 1);
})(window.H);
