/* HARU — UI helpers: icons, toasts, modals, settings form, character creator */
(function (H) {
  'use strict';
  const el = H.el;

  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  H.ICON = {
    pat: P('<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10V5a1.5 1.5 0 0 1 3 0v5"/><path d="M13 10V6a1.5 1.5 0 0 1 3 0v6"/><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.5 14a1.5 1.5 0 0 1 2.4-1.8L8 13.5"/>'),
    snack: P('<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1"/><circle cx="14.5" cy="8.5" r="1"/><circle cx="15" cy="14" r="1"/><circle cx="10" cy="15" r="1"/>'),
    coffee: P('<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>'),
    note: P('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
    drum: P('<ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"/><path d="M15 3l3 3M9 3L6 6"/>'),
    tempo: P('<path d="M8 21h8l-1.5-14h-5z"/><path d="M12 15l4-9"/><path d="M6 21h12"/>'),
    palette: P('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>'),
    whisper: P('<path d="M4 12h3l4-5v10l-4-5"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    talk: P('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.4A8 8 0 1 1 21 12z"/>'),
    bulb: P('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>'),
    knock: P('<rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="15" cy="12" r="1"/>'),
    gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    vol: P('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    mute: P('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
    play: P('<path d="M7 4l13 8-13 8z"/>'),
    pause: P('<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>'),
    stop: P('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
    sparkle: P('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>'),
  };

  /* ---------- toasts ---------- */
  H.toast = function (msg, kind) {
    const t = el('div', { class: 'toast' + (kind ? ' ' + kind : '') }, msg);
    document.getElementById('toast-root').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, kind === 'error' ? 6000 : 3200);
  };

  /* ---------- modal ---------- */
  H.modal = function ({ title, body, foot, wide, onClose }) {
    const root = document.getElementById('modal-root');
    const close = () => { back.remove(); onClose && onClose(); };
    const closeBtn = el('button', { class: 'icon-btn', onclick: close, title: '닫기', html: P('<path d="M6 6l12 12M18 6L6 18"/>') });
    const m = el('div', { class: 'modal', style: wide ? { width: 'min(1040px, 96vw)' } : {} },
      el('div', { class: 'modal-head' }, el('h2', null, title), closeBtn),
      el('div', { class: 'modal-body' }, body),
      foot ? el('div', { class: 'modal-foot' }, foot) : null);
    const back = el('div', { class: 'modal-back', onmousedown: (e) => { if (e.target === back) close(); } }, m);
    root.appendChild(back);
    return { close, el: m };
  };

  H.confirm = function (title, text) {
    return new Promise((res) => {
      let done = false;
      const m = H.modal({
        title, body: el('p', null, text),
        foot: [el('button', { class: 'btn', onclick: () => { done = true; m.close(); res(false); } }, '취소'), el('button', { class: 'btn primary', onclick: () => { done = true; m.close(); res(true); } }, '확인')],
        onClose: () => { if (!done) res(false); },
      });
    });
  };

  /* ---------- path helpers ---------- */
  H.getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  H.setPath = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };

  /* ---------- settings form ---------- */
  function control(f, settings, onChange) {
    const v = H.getPath(settings, f.key);
    const set = (val) => { H.setPath(settings, f.key, val); onChange(f.key, val); };
    if (f.type === 'switch') {
      const inp = el('input', { type: 'checkbox' }); inp.checked = !!v;
      inp.addEventListener('change', () => set(inp.checked));
      return el('label', { class: 'switch' }, inp, el('span'));
    }
    if (f.type === 'range') {
      const fmt = f.fmt || ((x) => x);
      const val = el('span', { class: 'val' }, String(fmt(v)));
      const inp = el('input', { type: 'range', min: f.min, max: f.max, step: f.step || 1, value: v });
      inp.addEventListener('input', () => { const n = parseFloat(inp.value); val.textContent = fmt(n); set(n); });
      return el('div', { class: 'ctl-wrap' }, inp, val);
    }
    if (f.type === 'select') {
      const s = el('select', null, f.options.map(([ov, ol]) => { const o = el('option', { value: String(ov) }, ol); if (String(ov) === String(v)) o.selected = true; return o; }));
      s.addEventListener('change', () => { const raw = s.value; const opt = f.options.find(([ov]) => String(ov) === raw); set(opt ? opt[0] : raw); });
      return s;
    }
    if (f.type === 'text' || f.type === 'password') {
      const inp = el('input', { type: f.type, value: v ?? '', placeholder: f.placeholder || '' });
      inp.addEventListener('change', () => set(inp.value));
      return f.button ? el('div', { class: 'ctl-wrap' }, inp, el('button', { class: 'btn', onclick: () => f.button.fn(inp) }, f.button.ko)) : inp;
    }
    if (f.type === 'textarea') {
      const ta = el('textarea', { rows: 3, placeholder: f.placeholder || '' }); ta.value = (v || []).join('\n');
      ta.addEventListener('change', () => set(ta.value.split(/\n/).map((x) => x.trim()).filter(Boolean)));
      return ta;
    }
    if (f.type === 'button') return el('div', { class: 'ctl-wrap' }, ...(f.buttons || [f]).map((b) => el('button', { class: 'btn' + (b.danger ? '' : ''), onclick: b.fn }, b.label)));
    if (f.type === 'info') return el('div', { class: 'muted', style: { fontSize: '12px' } }, f.text());
    return el('span', null, '?');
  }

  H.openSettings = function (app, startTab) {
    const s = app.settings;
    const pct = (x) => Math.round(x * 100) + '%';
    const sections = [
      {
        id: 'general', ko: '일반', fields: [
          { key: 'petName', ko: '그 아이의 이름', type: 'text' },
          { key: 'userName', ko: '나를 부르는 이름', sub: '대화에서 너를 이렇게 불러요', type: 'text' },
          { key: 'general.autoCreate', ko: '매일 자동으로 작품 만들기', sub: '오늘 작품이 없으면 정해진 시간에 시작', type: 'switch' },
          { key: 'general.autoCreateHour', ko: '자동 시작 시각', type: 'range', min: 0, max: 23, fmt: (x) => x + '시' },
          { key: 'general.sessionMinutes', ko: '작업 시간 (관찰 시간)', sub: '수집 → 작곡 → 그림까지 걸리는 시간', type: 'select', options: [[3, '3분 (빠르게)'], [6, '6분'], [12, '12분'], [25, '25분 (뽀모도로 1회)'], [45, '45분'], [60, '60분'], [120, '2시간']] },
          { key: 'general.pomodoro.on', ko: '뽀모도로 휴식 넣기', sub: '함께 집중하고, 함께 쉬어요', type: 'switch' },
          { key: 'general.pomodoro.work', ko: '집중 구간', type: 'range', min: 5, max: 60, fmt: (x) => x + '분' },
          { key: 'general.pomodoro.brk', ko: '휴식 구간', type: 'range', min: 1, max: 20, fmt: (x) => x + '분' },
          { key: 'general.chatty', ko: '말 거는 빈도', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct },
          { key: 'general.sleepAtNight', ko: '밤에는 잠자기', type: 'switch' },
          { key: 'general.sleepFrom', ko: '잠드는 시각', type: 'range', min: 20, max: 28, fmt: (x) => (x % 24) + '시' },
          { key: 'general.sleepTo', ko: '일어나는 시각', type: 'range', min: 4, max: 11, fmt: (x) => x + '시' },
          { key: 'general.notify', ko: '완성 알림 받기', type: 'switch' },
        ],
      },
      {
        id: 'window', ko: '창 · 미니 아바타', fields: [
          { key: 'general.minimizeToMini', ko: '최소화하면 미니 아바타로', sub: '“–” 버튼을 누르면 바탕화면에 작은 아이가 떠다녀요', type: 'switch' },
          { key: 'general.closeAction', ko: '닫기(X) 버튼 동작', type: 'select', options: [['tray', '트레이로 숨기기 (계속 작업)'], ['quit', '완전히 종료']] },
          { key: 'general.autoStart', ko: '윈도우 시작 시 자동 실행', type: 'switch' },
          { key: 'general.startHidden', ko: '시작할 때 미니 아바타로', type: 'switch' },
          { key: 'mini.mode', ko: '미니 아바타 움직임', type: 'select', options: [['float', '둥둥 떠다니기'], ['walk', '작업표시줄 위를 걷기'], ['corner', '오른쪽 아래 구석'], ['still', '그 자리에 가만히']] },
          { key: 'mini.size', ko: '크기', type: 'range', min: 0.6, max: 2, step: 0.05, fmt: (x) => x.toFixed(2) + '×' },
          { key: 'mini.opacity', ko: '투명도', type: 'range', min: 0.3, max: 1, step: 0.05, fmt: pct },
          { key: 'mini.speed', ko: '움직임 속도', type: 'range', min: 0.2, max: 3, step: 0.1, fmt: (x) => x.toFixed(1) + '×' },
          { key: 'mini.alwaysOnTop', ko: '항상 위에 표시', type: 'switch' },
          { key: 'mini.bubble', ko: '말풍선 · 진행률 표시', type: 'switch' },
          { key: 'mini.showWhenMainVisible', ko: '메인 창이 열려 있어도 표시', type: 'switch' },
          { key: '_mini', ko: '', type: 'button', buttons: [{ label: '지금 미니 아바타로 전환', fn: () => window.haru && window.haru.toMini() }] },
        ],
      },
      {
        id: 'sources', ko: '수집처 · 날씨', fields: [
          ...H.SOURCES.map((src) => ({ key: 'sources.' + src.id, ko: src.ko, sub: src.kind === 'trend' ? '사람들이 많이 검색한 말' : src.kind === 'curiosity' ? '사람들이 궁금해한 문서' : src.kind === 'tech' ? '기술 커뮤니티' : '뉴스 헤드라인', type: 'switch' })),
          { key: 'sources.custom', ko: '나만의 RSS 주소', sub: '한 줄에 하나씩', type: 'textarea', placeholder: 'https://example.com/rss' },
          { key: 'sources.weather', ko: '날씨 반영', sub: '창밖 풍경과 음악 분위기에 반영', type: 'switch' },
          {
            key: 'sources.city', ko: '내 도시', type: 'text', button: {
              ko: '찾기', fn: async (inp) => {
                const g = await H.geocode(inp.value).catch(() => null);
                if (g) { s.sources.lat = g.lat; s.sources.lon = g.lon; s.sources.city = `${g.name}`; inp.value = g.name; app.saveSettings(); H.toast(`${g.name} (${g.country}) — ${g.lat.toFixed(2)}, ${g.lon.toFixed(2)}`); }
                else H.toast('도시를 찾지 못했어요.', 'error');
              },
            },
          },
        ],
      },
      {
        id: 'audio', ko: '소리', fields: [
          { key: 'audio.master', ko: '전체 음량', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
          { key: 'audio.music', ko: '음악', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
          { key: 'audio.ambient', ko: '환경음', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
          { key: 'audio.sfx', ko: '효과음 · 목소리', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
          { key: 'audio.lofi', ko: '로파이 질감 (먼지 · 테이프)', type: 'range', min: 0, max: 1, step: 0.01, fmt: pct },
          { key: 'audio.voice', ko: '말할 때 목소리(삐약음)', type: 'switch' },
          { key: 'character.voice', ko: '목소리 높이', type: 'range', min: 0.6, max: 1.6, step: 0.05, fmt: (x) => x.toFixed(2) },
          { key: 'audio.autoWeather', ko: '날씨에 맞춰 환경음 자동', sub: '비 오는 날엔 빗소리, 밤엔 풀벌레', type: 'switch' },
          ...[['rain', '빗소리'], ['vinyl', '레코드 잡음'], ['wind', '바람'], ['cafe', '카페'], ['fire', '모닥불'], ['waves', '파도'], ['night', '풀벌레'], ['birds', '새소리'], ['keys', '키보드 타건음']].map(([k, ko]) => ({ key: 'audio.amb.' + k, ko: '환경음 · ' + ko, type: 'range', min: 0, max: 1, step: 0.01, fmt: pct })),
        ],
      },
      {
        id: 'creation', ko: '창작 · 저장', fields: [
          { key: 'creation.songSeconds', ko: '곡 길이', type: 'range', min: 30, max: 180, step: 15, fmt: (x) => x + '초' },
          { key: 'creation.musicStyle', ko: '음악 스타일', sub: '맡기면 그 아이가 취향과 기분으로 골라요', type: 'select', options: [['auto', '그 아이 취향에 맡기기'], ...H.STYLES.map((x) => [x.id, x.ko])] },
          { key: 'creation.artStyle', ko: '그림 스타일', type: 'select', options: [['auto', '그날 기분에 맡기기'], ...H.ART_STYLES.map((a) => [a.id, a.ko])] },
          { key: 'creation.posterSize', ko: '그림 해상도 (가로)', type: 'select', options: [[1200, '1200px'], [1600, '1600px'], [2400, '2400px']] },
          { key: 'creation.video', ko: '작업 과정 녹화 (MP4 타임랩스)', type: 'switch' },
          { key: 'creation.videoFps', ko: '영상 프레임', type: 'select', options: [[24, '24 fps'], [30, '30 fps']] },
          { key: 'creation.videoAudio', ko: '영상에 완성곡 넣기', type: 'switch' },
          { key: 'general.outputDir', ko: '저장 폴더', sub: '비우면 문서\\HARU', type: 'text', button: { ko: '선택', fn: async (inp) => { const d = await window.haru.chooseDir(); if (d) { inp.value = d; s.general.outputDir = d; app.saveSettings(); } } } },
        ],
      },
      {
        id: 'visual', ko: '화면', fields: [
          { key: 'visual.renderer', ko: '방 그래픽', sub: '오래된 기기에서 버벅이면 2D로 바꿔보세요', type: 'select', options: [['3d', '3D 애니풍 (기본)'], ['2d', '2D 가벼운 모드']] },
          { key: 'visual.theme', ko: '테마', type: 'select', options: [['auto', '시간 따라 자동 (밤엔 어둡게)'], ['light', '밝게'], ['dark', '어둡게']] },
          { key: 'visual.camera', ko: '방 시점', type: 'select', options: [['auto', '자동 연출 (하는 일 따라)'], ['manual', '직접 고르기']] },
          { key: 'visual.showHud', ko: '방에 상태판 보이기', type: 'switch' },
          { key: 'visual.reduceMotion', ko: '움직임 줄이기', type: 'switch' },
          { key: 'visual.uiScale', ko: 'UI 크기', type: 'range', min: 0.8, max: 1.4, step: 0.05, fmt: (x) => Math.round(x * 100) + '%' },
        ],
      },
      {
        id: 'ai', ko: 'AI 일기 (선택)', fields: [
          { key: '_aiinfo', ko: '설명', type: 'info', text: () => '켜면 그날의 일기와 제목을 Claude가 그 아이의 말투로 써줘요. 끄면 내장 문장으로 써요. API 키는 이 컴퓨터에 암호화되어 저장되고, 일기를 쓸 때만 키워드·헤드라인·곡 정보가 Anthropic API로 전송돼요.' },
          { key: 'ai.enabled', ko: 'Claude로 일기 쓰기', type: 'switch' },
          { key: 'ai.model', ko: '모델', type: 'select', options: [['claude-opus-5-5', 'Claude Opus 5.5 (기본)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (가장 저렴)']] },
          { key: '_key', ko: 'Anthropic API 키', sub: app.hasKey ? '저장됨 — 바꾸려면 새로 입력' : '아직 없음', type: 'text', placeholder: 'sk-ant-…', button: { ko: '저장', fn: async (inp) => { if (!inp.value) return; await window.haru.setApiKey(inp.value.trim()); inp.value = ''; app.hasKey = true; H.toast('API 키를 저장했어요.'); } } },
          { key: '_test', ko: '', type: 'button', buttons: [{ label: '연결 테스트', fn: async () => { const r = await window.haru.aiTest(s.ai.model); H.toast(r.ok ? '연결 성공: ' + r.text : '실패: ' + r.error, r.ok ? '' : 'error'); } }] },
        ],
      },
      {
        id: 'data', ko: '데이터', fields: [
          { key: '_open', ko: '폴더', type: 'button', buttons: [{ label: '작품 폴더 열기', fn: () => window.haru.openOutput() }, { label: '앱 데이터 폴더 열기', fn: () => window.haru.openData() }] },
          { key: '_char', ko: '캐릭터', type: 'button', buttons: [{ label: '캐릭터 다시 꾸미기', fn: () => { mm.close(); H.openCreator(app); } }] },
          { key: '_reset', ko: '처음부터', sub: '스탯·별·방 아이템이 초기화돼요 (작품 파일은 남아요)', type: 'button', buttons: [{ label: '그 아이와 처음부터 다시', fn: async () => { if (await H.confirm('정말 초기화할까요?', '작품 파일은 지워지지 않아요.')) app.resetPet(); } }] },
          { key: '_ver', ko: '버전', type: 'info', text: () => `HARU ${app.version || ''} · Electron ${app.versions ? app.versions.electron : ''}` },
        ],
      },
    ];

    if (app.mobile) {
      const drop = new Set(['window', 'ai']);
      for (let i = sections.length - 1; i >= 0; i--) if (drop.has(sections[i].id)) sections.splice(i, 1);
      sections.forEach((sec) => { sec.fields = sec.fields.filter((f) => !['general.outputDir', '_open', 'general.notify'].includes(f.key) || f.key === 'general.notify'); });
    }
    const tabs = el('div', { class: 'set-tabs' });
    const pane = el('div', { class: 'set-pane' });
    const show = (id) => {
      [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      pane.innerHTML = '';
      const sec = sections.find((x) => x.id === id);
      pane.appendChild(el('div', { class: 'set-sec' }, el('h3', null, sec.ko),
        ...sec.fields.map((f) => el('div', { class: 'field' }, el('label', null, f.ko, f.sub ? el('small', null, f.sub) : null), control(f, s, (k, v) => app.onSettingChanged(k, v))))));
    };
    sections.forEach((sec) => tabs.appendChild(el('button', { 'data-id': sec.id, onclick: () => show(sec.id) }, sec.ko)));
    const mm = H.modal({ title: '설정', body: el('div', { class: 'set-layout' }, tabs, pane), wide: true, onClose: () => app.saveSettings() });
    show(startTab || 'general');
  };

  /* ---------- character creator ---------- */
  H.openCreator = function (app, first) {
    const cfg = Object.assign({}, H.DEFAULT_CHARACTER, app.settings.character || {});
    let name = app.settings.petName || '모모';
    const use3D = !!(app.room && app.room.is3D && H.CharStage);
    const cv = el('canvas', { width: 600, height: 680 });
    let raf, t = 0, act = 'wave', stage = null;
    if (use3D) { try { stage = new H.CharStage(cv, { bg: '#f3f1ec' }); stage.setModel(cfg); } catch (e) { stage = null; } }
    const draw = () => {
      t += 1 / 60;
      if (stage) {
        raf = requestAnimationFrame(draw);
        try { stage.render(1 / 60, { t, act, emo: act === 'happy' ? 'happy' : 'neutral', blink: H.blinkAt(t), look: { x: Math.sin(t * 0.6) * 0.5, y: 0 } }, 300, 340, Math.sin(t * 0.4) * 0.35); }
        catch (e) { if (!draw.err) { draw.err = 1; console.error('creator preview', e); } }
        return;
      }
      const ctx = cv.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 600, 680);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.ellipse(300, 600, 120, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(300, 600); ctx.scale(3, 3);
      H.drawCharacter(ctx, cfg, { t, act, emo: act === 'happy' ? 'happy' : 'neutral', blink: H.blinkAt(t), look: { x: Math.sin(t * 0.6), y: 0 }, facing: 0 });
      raf = requestAnimationFrame(draw);
    };
    const opts = (label, list, key) => el('div', { class: 'opt-group' }, el('div', null, label), el('div', { class: 'opts' }, list.map((o) => {
      const b = el('button', { class: cfg[key] === o.id ? 'on' : '', onclick: () => { cfg[key] = o.id; [...b.parentNode.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); act = 'happy'; setTimeout(() => { act = 'idle'; }, 900); if (stage) stage.setModel(cfg); } }, o.ko);
      return b;
    })));
    const color = (label, key) => { const i = el('input', { type: 'color', value: cfg[key] }); i.addEventListener('input', () => { cfg[key] = i.value; }); i.addEventListener('change', () => { if (stage) stage.setModel(cfg); }); return el('label', null, label, i); };
    /* 3D model picker (bundled CC0 VRoid models, procedural, or the user's own VRM) */
    const proceduralOnly = [];
    const syncGroups = () => proceduralOnly.forEach((g) => g.classList.toggle('hidden', use3D && cfg.model !== 'procedural'));
    const fileInp = el('input', { type: 'file', accept: '.vrm', style: { display: 'none' } });
    fileInp.addEventListener('change', async () => {
      const f = fileInp.files[0]; if (!f) return;
      try { H.toast('VRM 불러오는 중…'); await app.importVrm(f); cfg.model = 'custom'; cfg.vrmName = f.name; stage && (stage.key = '', stage.setModel(cfg)); renderModels(); syncGroups(); H.toast('내 3D 아바타를 불러왔어요: ' + f.name); }
      catch (e) { H.toast('VRM 파일을 읽지 못했어요: ' + (e.message || e), 'error'); }
    });
    const modelBox = el('div', { class: 'model-pick' });
    const renderModels = () => {
      modelBox.innerHTML = '';
      (H.AVATARS || []).forEach((m) => {
        if (m.id === 'custom' && !app.settings.character.vrmName && cfg.model !== 'custom') {
          modelBox.appendChild(el('button', { class: 'model-card', onclick: () => fileInp.click() }, el('div', { class: 'mthumb plus' }, '+'), el('b', null, 'VRM 불러오기'), el('small', null, 'VRoid Studio 등에서 만든 파일')));
          return;
        }
        modelBox.appendChild(el('button', { class: 'model-card' + (cfg.model === m.id ? ' on' : ''), onclick: () => {
          if (m.id === 'custom' && cfg.model === 'custom') { fileInp.click(); return; }
          cfg.model = m.id; renderModels(); syncGroups(); if (stage) stage.setModel(cfg); act = 'happy'; setTimeout(() => { act = 'idle'; }, 900);
        } }, m.thumb ? el('img', { class: 'mthumb', src: m.thumb }) : el('div', { class: 'mthumb' }, m.id === 'custom' ? 'VRM' : '✎'), el('b', null, m.ko), el('small', null, m.id === 'custom' ? (app.settings.character.vrmName || m.sub) : m.sub)));
      });
    };
    renderModels();
    const nameInp = el('input', { value: name, maxlength: 12 }); nameInp.addEventListener('input', () => { name = nameInp.value; });
    const userInp = el('input', { value: app.settings.userName || '', maxlength: 12, placeholder: '예: 수민' });
    const presets = [
      { skin: '#fbe3d3', hair: '#3d3557', eye: '#2b2840', cloth: '#7d8cff', accent: '#ffcf6b' },
      { skin: '#f7dccb', hair: '#e8b04a', eye: '#3a2a1a', cloth: '#f28c8c', accent: '#7cc4ff' },
      { skin: '#e9c4a6', hair: '#6b4a3a', eye: '#2a1d14', cloth: '#87b887', accent: '#f5e2a6' },
      { skin: '#fde8e0', hair: '#f4f1ee', eye: '#5a6fb0', cloth: '#b9a7e6', accent: '#ff9db0' },
      { skin: '#d9a98a', hair: '#1f1f2a', eye: '#1a1a22', cloth: '#2f3240', accent: '#ff6f61' },
    ];
    const pg = (node) => { proceduralOnly.push(node); return node; };
    const body = el('div', { class: 'creator' }, cv, el('div', null,
      el('div', { class: 'opt-group' }, el('div', null, 'NAME · 이름'), el('div', { class: 'row' }, nameInp)),
      el('div', { class: 'opt-group' }, el('div', null, 'YOU · 그 아이가 부를 내 이름'), el('div', { class: 'row' }, userInp)),
      use3D ? el('div', { class: 'opt-group' }, el('div', null, 'MODEL · 3D 캐릭터'), modelBox, fileInp) : null,
      pg(opts('SPECIES · 종족', H.SPECIES, 'species')),
      pg(opts('HAIR · 머리', H.HAIR_STYLES, 'hairStyle')),
      pg(opts('OUTFIT · 옷', H.OUTFITS, 'outfit')),
      opts('ACCESSORY · 소품', use3D ? H.ACCESSORIES.filter((a) => a.id === 'headphones' || a.id === 'none' || cfg.model === 'procedural') : H.ACCESSORIES, 'accessory'),
      pg(el('div', { class: 'opt-group' }, el('div', null, 'COLORS · 색'), el('div', { class: 'colors' }, color('피부', 'skin'), color('머리/털', 'hair'), color('눈', 'eye'), color('옷', 'cloth'), color('포인트', 'accent')))),
      pg(el('div', { class: 'opt-group' }, el('div', null, 'PRESETS'), el('div', { class: 'swatches' }, presets.map((p) => el('div', { class: 'swatch', style: { background: `linear-gradient(135deg, ${p.hair} 50%, ${p.cloth} 50%)` }, onclick: () => { Object.assign(cfg, p); m.close(); app.settings.character = cfg; H.openCreator(app, first); } }))))),
      use3D ? el('div', { class: 'hint' }, '시부·비비는 pixiv VRoid의 CC0(퍼블릭 도메인) 샘플 모델이에요.') : null,
    ));
    syncGroups();
    const m = H.modal({
      title: first ? '나만의 아이 만들기' : '캐릭터 꾸미기', body, wide: true,
      foot: [el('button', { class: 'btn primary', onclick: () => {
        app.settings.character = cfg; app.settings.petName = (name || '모모').trim(); app.settings.userName = userInp.value.trim();
        app.settings.setupDone = true; app.saveSettings(); app.applyCharacter(); m.close();
        if (first) app.onFirstSetupDone();
      } }, first ? '이 아이로 시작하기' : '저장')],
      onClose: () => { cancelAnimationFrame(raf); if (stage) stage.dispose(); },
    });
    draw();
  };
})(window.H);
