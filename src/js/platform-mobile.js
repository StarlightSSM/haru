/* HARU — mobile platform layer (Android / iOS via Capacitor).
   Provides the same window.haru API that Electron's preload gives the desktop app. */
(function () {
  'use strict';
  if (window.haru) return; /* desktop (Electron) */
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.nativePromise && (!Cap.isNativePlatform || Cap.isNativePlatform()));
  const call = (plugin, method, opts) => Cap.nativePromise(plugin, method, opts || {});
  const DIR = 'DOCUMENTS';
  const ROOT = 'HARU';
  document.documentElement.classList.add('mobile');
  if (Cap && Cap.getPlatform) document.documentElement.classList.add('plat-' + Cap.getPlatform());

  const listeners = {};
  const emit = (ch, d) => (listeners[ch] || []).forEach((fn) => { try { fn(d); } catch (e) { console.error(e); } });

  /* ---------- storage ---------- */
  async function prefGet(key) {
    if (native) { try { const r = await call('Preferences', 'get', { key }); return r.value ? JSON.parse(r.value) : null; } catch (e) { return null; } }
    try { return JSON.parse(localStorage.getItem('haru:' + key) || 'null'); } catch (e) { return null; }
  }
  async function prefSet(key, val) {
    const s = JSON.stringify(val);
    if (native) { try { await call('Preferences', 'set', { key, value: s }); } catch (e) { console.warn(e); } }
    else { try { localStorage.setItem('haru:' + key, s); } catch (e) { /* */ } }
  }

  /* ---------- files ---------- */
  function b64(bytes) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  async function writeBinary(path, bytes) {
    const CHUNK = 3 * 1024 * 1024; /* multiple of 3 keeps base64 chunks independent */
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const part = b64(bytes.subarray(i, Math.min(bytes.length, i + CHUNK)));
      await call('Filesystem', i === 0 ? 'writeFile' : 'appendFile', { path, data: part, directory: DIR, recursive: true });
    }
    if (!bytes.length) await call('Filesystem', 'writeFile', { path, data: '', directory: DIR, recursive: true });
  }
  async function uriOf(path) {
    const r = await call('Filesystem', 'getUri', { path, directory: DIR });
    return r.uri;
  }
  const webUrl = (uri) => (Cap.convertFileSrc ? Cap.convertFileSrc(uri) : uri);

  /* in-browser fallback store for works (no Capacitor): keep only the latest few in memory */
  const memWorks = [];

  window.haru = {
    platform: native ? Cap.getPlatform() : 'web',
    async init() {
      const settings = (await prefGet('settings')) || {};
      const state = (await prefGet('state')) || {};
      let version = '1.0.0';
      if (native) { try { version = (await call('App', 'getInfo')).version; } catch (e) { /* */ } }
      return { settings, state, fast: /fast/.test(location.search), hasKey: false, version, versions: { electron: '—', platform: native ? Cap.getPlatform() : 'web' }, shot: null, mobile: true };
    },
    saveSettings: (s) => prefSet('settings', s),
    saveState: (s) => prefSet('state', s),
    applyWindowSettings: async () => true,
    toMini: async () => true,
    miniStatus: () => {},
    async fetchText(url) {
      if (native) {
        try {
          const r = await call('CapacitorHttp', 'request', { url, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) HARU/1.0', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' }, responseType: 'text', connectTimeout: 12000, readTimeout: 12000 });
          const text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
          return { ok: r.status >= 200 && r.status < 300, status: r.status, text };
        } catch (e) { return { ok: false, status: 0, text: '', error: String(e) }; }
      }
      try { const r = await fetch(url); return { ok: r.ok, status: r.status, text: await r.text() }; } catch (e) { return { ok: false, status: 0, text: '' }; }
    },
    async saveWork(folder, files) {
      const safe = String(folder).replace(/[\\/:*?"<>|]/g, '_').slice(0, 90);
      if (!native) { memWorks.unshift({ folder: safe, files }); return { path: safe }; }
      for (const f of files) {
        const path = `${ROOT}/${safe}/${f.name}`;
        if (typeof f.data === 'string') await call('Filesystem', 'writeFile', { path, data: f.data, directory: DIR, encoding: 'utf8', recursive: true });
        else await writeBinary(path, f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data));
      }
      return { path: `${ROOT}/${safe}` };
    },
    async listWorks() {
      if (!native) {
        return memWorks.map((w) => {
          const urls = {}, files = {};
          const meta = JSON.parse(w.files.find((f) => f.name === 'meta.json').data);
          const map = { mp3: 'music.mp3', png: 'art.png', raw: 'art_square.png', mp4: 'process.mp4' };
          const types = { mp3: 'audio/mpeg', png: 'image/png', raw: 'image/png', mp4: 'video/mp4' };
          Object.entries(map).forEach(([k, n]) => { const f = w.files.find((x) => x.name === n); if (f) { urls[k] = URL.createObjectURL(new Blob([f.data], { type: types[k] })); files[k] = n; } });
          return { folder: w.folder, path: w.folder, meta, urls, files };
        });
      }
      let dirs = [];
      try { dirs = (await call('Filesystem', 'readdir', { path: ROOT, directory: DIR })).files || []; } catch (e) { return []; }
      const out = [];
      for (const d of dirs) {
        const name = typeof d === 'string' ? d : d.name;
        if (d.type && d.type !== 'directory') continue;
        try {
          const m = await call('Filesystem', 'readFile', { path: `${ROOT}/${name}/meta.json`, directory: DIR, encoding: 'utf8' });
          const meta = JSON.parse(m.data);
          const files = {}, urls = {};
          for (const [k, fn] of Object.entries(meta.files || {})) {
            if (!fn) continue;
            try { const u = await uriOf(`${ROOT}/${name}/${fn}`); files[k] = u; urls[k] = webUrl(u); } catch (e) { /* missing */ }
          }
          out.push({ folder: name, path: `${ROOT}/${name}`, meta, files, urls });
        } catch (e) { /* not a work folder */ }
      }
      out.sort((a, b) => (b.meta.createdAt || 0) - (a.meta.createdAt || 0));
      return out;
    },
    /* "open" on mobile = system share sheet (save to gallery / files / send) */
    async openPath(p) {
      if (!native) return;
      try {
        const metaUri = await uriOf(`${p}/art.png`);
        await call('Share', 'share', { title: 'HARU', files: [metaUri] });
      } catch (e) { emit('toast', '파일 위치: 내 파일 › Documents › ' + p); }
    },
    async showItem(uri) {
      if (!native) { window.open(uri); return; }
      try { await call('Share', 'share', { title: 'HARU', files: [uri] }); } catch (e) { console.warn(e); }
    },
    async openOutput() { emit('toast', native ? (Cap.getPlatform() === 'ios' ? '파일 앱 › 나의 iPhone › HARU 폴더에 저장돼요.' : '내 파일 › 내장 저장공간 › Documents › HARU 폴더에 저장돼요.') : '브라우저 버전은 기록을 저장하지 않아요.'); },
    async openData() { emit('toast', '앱 데이터는 앱 안에 저장돼요.'); },
    async chooseDir() { return null; },
    async notify(title, body) {
      if (!native) return false;
      try {
        const p = await call('LocalNotifications', 'checkPermissions');
        if (p.display !== 'granted') { const q = await call('LocalNotifications', 'requestPermissions'); if (q.display !== 'granted') return false; }
        await call('LocalNotifications', 'schedule', { notifications: [{ id: Math.floor(Date.now() % 2e9), title, body }] });
        return true;
      } catch (e) { return false; }
    },
    setApiKey: async () => false,
    aiDiary: async () => ({ ok: false, error: 'mobile' }),
    aiTest: async () => ({ ok: false, error: '모바일 버전에서는 아직 지원하지 않아요' }),
    mini: { poke() {}, open() {}, hover() {}, dragStart() {}, dragEnd() {}, menu() {} },
    on(ch, fn) { (listeners[ch] = listeners[ch] || []).push(fn); },
  };

  if (native && Cap.addListener) {
    Cap.addListener('App', 'appStateChange', (s) => emit('visibility', !!(s && s.isActive)));
    Cap.addListener('App', 'backButton', () => emit('back'));
  }
})();
