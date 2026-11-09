/* HARU — Electron main process */
'use strict';
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell, dialog, Notification, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.env.HARU_USERDATA) app.setPath('userData', process.env.HARU_USERDATA);

const FAST = process.argv.includes('--fast') || process.env.HARU_FAST === '1';
const HIDDEN = process.argv.includes('--hidden');
const SHOT = process.env.HARU_SHOT || '';

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId('com.sumin.haru');

const ICON = path.join(__dirname, 'build', 'icon.png');
const dataDir = () => app.getPath('userData');
const fileOf = (n) => path.join(dataDir(), n);

let mainWin = null, miniWin = null, tray = null, quitting = false;
let settings = {}, state = {};
let mainHiddenToMini = false;

function readJSON(f, def) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } }
function writeJSON(f, obj) { try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(obj, null, 2)); fs.renameSync(f + '.tmp', f); } catch (e) { console.error('write fail', f, e); } }
function outputDir() { const d = (settings.general && settings.general.outputDir) || process.env.HARU_OUT || path.join(app.getPath('documents'), 'HARU'); fs.mkdirSync(d, { recursive: true }); return d; }
const g = (o, p, d) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o) ?? d;

/* ================= windows ================= */
function createMain() {
  const dark = isDarkNow();
  mainWin = new BrowserWindow({
    width: 1380, height: 880, minWidth: 1040, minHeight: 680, show: false, icon: ICON,
    title: 'HARU', backgroundColor: dark ? '#111216' : '#eceeec',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: dark ? '#16181d' : '#f6f7f5', symbolColor: dark ? '#e7e8eb' : '#1b1d22', height: 40 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  mainWin.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWin.once('ready-to-show', () => {
    if (HIDDEN || (g(settings, 'general.startHidden', false) && !SHOT)) { hideMainToMini(); }
    else { mainWin.show(); }
    if (SHOT) runShots();
  });
  mainWin.on('minimize', () => {
    if (g(settings, 'general.minimizeToMini', true) && g(settings, 'mini.enabled', true)) {
      setTimeout(() => hideMainToMini(), 60);
    }
  });
  mainWin.on('close', (e) => {
    if (quitting) return;
    if (g(settings, 'general.closeAction', 'tray') === 'tray') { e.preventDefault(); hideMainToMini(); }
    else { quitting = true; }
  });
  mainWin.on('show', () => onMainVisible(true));
  mainWin.on('restore', () => onMainVisible(true));
  mainWin.on('hide', () => onMainVisible(false));
  mainWin.webContents.on('render-process-gone', (e, d) => console.error('renderer gone', d));
  if (SHOT) mainWin.webContents.on('console-message', (e, level, message, line, src) => {
    const lv = e.level ?? level, msg = e.message ?? message;
    if (lv === 'error' || lv === 'warning' || lv >= 2) console.log(`[renderer] ${msg} (${String(e.sourceId ?? src).split('/').pop()}:${e.lineNumber ?? line})`);
  });
  mainWin.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function isDarkNow() { const t = g(settings, 'visual.theme', 'auto'); const h = new Date().getHours(); return t === 'dark' || (t === 'auto' && (h >= 20 || h < 7)); }

function onMainVisible(v) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('visibility', v);
  if (v) { mainHiddenToMini = false; if (miniWin && !g(settings, 'mini.showWhenMainVisible', false)) miniWin.hide(); }
}

function hideMainToMini() {
  if (!mainWin) return;
  mainHiddenToMini = true;
  mainWin.hide();
  if (g(settings, 'mini.enabled', true)) showMini();
}

function showMain() {
  if (!mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show(); mainWin.focus();
  if (miniWin && !g(settings, 'mini.showWhenMainVisible', false)) miniWin.hide();
}

/* ---------- mini avatar ---------- */
const M = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, dir: 1, pauseUntil: 0, drag: null, hover: false, walking: false, falling: false, lastSent: '' };
function miniSize() { const s = g(settings, 'mini.size', 1); return { w: Math.round(180 * s), h: Math.round(220 * s) }; }

function createMini() {
  const { w, h } = miniSize();
  const wa = screen.getPrimaryDisplay().workArea;
  M.x = wa.x + wa.width - w - 40; M.y = wa.y + wa.height - h; M.tx = M.x; M.ty = M.y;
  miniWin = new BrowserWindow({
    width: w, height: h, x: M.x, y: M.y, frame: false, transparent: true, resizable: false, skipTaskbar: true, show: false,
    alwaysOnTop: g(settings, 'mini.alwaysOnTop', true), hasShadow: false, maximizable: false, minimizable: false, fullscreenable: false, icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  miniWin.setAlwaysOnTop(g(settings, 'mini.alwaysOnTop', true), 'floating');
  miniWin.loadFile(path.join(__dirname, 'src', 'mini.html'));
  miniWin.on('closed', () => { miniWin = null; });
  setInterval(miniTick, 33);
}

function showMini() {
  if (!miniWin) createMini();
  applyMiniSettings();
  miniWin.showInactive();
}

function applyMiniSettings() {
  if (!miniWin) return;
  const { w, h } = miniSize();
  const b = miniWin.getBounds();
  if (b.width !== w || b.height !== h) miniWin.setBounds({ x: Math.round(M.x), y: Math.round(M.y), width: w, height: h });
  miniWin.setOpacity(g(settings, 'mini.opacity', 1));
  miniWin.setAlwaysOnTop(g(settings, 'mini.alwaysOnTop', true), 'floating');
  miniWin.webContents.send('mini:settings', settings.mini || {});
  if (!g(settings, 'mini.enabled', true)) miniWin.hide();
  else if (g(settings, 'mini.showWhenMainVisible', false) && mainWin && mainWin.isVisible()) miniWin.showInactive();
}

function miniTick() {
  if (!miniWin || !miniWin.isVisible()) return;
  const { w, h } = miniSize();
  const disp = screen.getDisplayNearestPoint({ x: Math.round(M.x + w / 2), y: Math.round(M.y + h / 2) });
  const wa = disp.workArea;
  const mode = g(settings, 'mini.mode', 'float');
  const sp = g(settings, 'mini.speed', 1);
  const now = Date.now();
  let walking = false;
  if (M.drag) {
    const c = screen.getCursorScreenPoint();
    M.x = c.x - M.drag.ox; M.y = c.y - M.drag.oy; M.vx = M.vy = 0;
  } else if (M.falling) {
    M.vy += 1.6; M.y += M.vy;
    const floor = wa.y + wa.height - h;
    if (M.y >= floor) { M.y = floor; M.vy = 0; M.falling = false; }
  } else if (!M.hover) {
    if (mode === 'float') {
      if (now > M.pauseUntil && (Math.hypot(M.tx - M.x, M.ty - M.y) < 20 || Math.random() < 0.002)) {
        M.tx = wa.x + Math.random() * (wa.width - w); M.ty = wa.y + Math.random() * (wa.height - h);
        M.pauseUntil = now + 2000 + Math.random() * 5000;
      }
      M.vx += (M.tx - M.x) * 0.00012 * sp; M.vy += (M.ty - M.y) * 0.00012 * sp;
      M.vx *= 0.965; M.vy *= 0.965;
      const v = Math.hypot(M.vx, M.vy), vmax = 2.2 * sp;
      if (v > vmax) { M.vx *= vmax / v; M.vy *= vmax / v; }
      M.x += M.vx; M.y += M.vy;
      if (Math.abs(M.vx) > 0.15) M.dir = Math.sign(M.vx);
    } else if (mode === 'walk') {
      const floor = wa.y + wa.height - h;
      M.y += (floor - M.y) * 0.2;
      if (now > M.pauseUntil) {
        walking = true;
        M.x += M.dir * 1.3 * sp;
        if (M.x < wa.x) { M.x = wa.x; M.dir = 1; }
        if (M.x > wa.x + wa.width - w) { M.x = wa.x + wa.width - w; M.dir = -1; }
        if (Math.random() < 0.004) { M.pauseUntil = now + 2500 + Math.random() * 6000; if (Math.random() < 0.5) M.dir *= -1; }
      }
    } else if (mode === 'corner') {
      const tx = wa.x + wa.width - w - 24, ty = wa.y + wa.height - h;
      M.x += (tx - M.x) * 0.06; M.y += (ty - M.y) * 0.06;
    }
  }
  M.x = Math.max(wa.x - w * 0.3, Math.min(wa.x + wa.width - w * 0.7, M.x));
  M.y = Math.max(wa.y, Math.min(wa.y + wa.height - h * 0.6, M.y));
  const b = miniWin.getBounds();
  const nx = Math.round(M.x), ny = Math.round(M.y);
  if (b.x !== nx || b.y !== ny) miniWin.setBounds({ x: nx, y: ny, width: w, height: h });
  M.walking = walking || (mode === 'float' && Math.hypot(M.vx, M.vy) > 0.4);
  const sig = `${M.walking ? 1 : 0}${M.dir}${M.drag ? 1 : 0}`;
  if (sig !== M.lastSent) { M.lastSent = sig; miniWin.webContents.send('mini:motion', { walking: M.walking, dir: M.dir, dragging: !!M.drag, mode }); }
}

/* ---------- tray ---------- */
function createTray() {
  let img = nativeImage.createFromPath(ICON);
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('HARU');
  const menu = () => Menu.buildFromTemplate([
    { label: 'HARU 열기', click: showMain },
    { label: '미니 아바타 보이기', click: () => { settings.mini = settings.mini || {}; settings.mini.enabled = true; showMini(); } },
    { label: '미니 아바타 숨기기', click: () => { if (miniWin) miniWin.hide(); } },
    { type: 'separator' },
    { label: '지금 작품 만들기', click: () => { send('cmd', { create: true }); } },
    { label: '작품 폴더 열기', click: () => shell.openPath(outputDir()) },
    { label: '설정', click: () => { showMain(); send('cmd', { settings: true }); } },
    { type: 'separator' },
    { label: '종료', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu());
  tray.on('click', showMain);
}

function send(ch, data) { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(ch, data); }

/* ================= IPC ================= */
ipcMain.handle('init', () => ({
  settings, state, fast: FAST, hasKey: fs.existsSync(fileOf('key.bin')), version: app.getVersion(), versions: process.versions,
  shot: SHOT ? { time: process.env.HARU_TIME != null ? parseFloat(process.env.HARU_TIME) : undefined, weather: process.env.HARU_WEATHER, noAuto: process.env.HARU_NOAUTO === '1', items: process.env.HARU_ITEMS } : null,
}));
ipcMain.handle('settings:save', (e, s) => { settings = s; writeJSON(fileOf('settings.json'), s); applyWindowSettings(); if (mainWin) { const d = isDarkNow(); try { mainWin.setTitleBarOverlay({ color: d ? '#16181d' : '#f6f7f5', symbolColor: d ? '#e7e8eb' : '#1b1d22' }); } catch (er) { /* */ } } return true; });
ipcMain.handle('state:save', (e, s) => { state = s; writeJSON(fileOf('state.json'), s); return true; });
ipcMain.handle('win:apply', (e, s) => { settings = s; applyWindowSettings(); return true; });
ipcMain.handle('win:toMini', () => { hideMainToMini(); return true; });

function applyWindowSettings() {
  try {
    app.setLoginItemSettings({ openAtLogin: !!g(settings, 'general.autoStart', false), args: g(settings, 'general.startHidden', false) ? ['--hidden'] : [] });
  } catch (e) { /* dev mode may fail */ }
  if (miniWin) applyMiniSettings();
  else if (mainHiddenToMini && g(settings, 'mini.enabled', true)) showMini();
  if (mainWin && mainWin.isVisible() && g(settings, 'mini.showWhenMainVisible', false) && g(settings, 'mini.enabled', true)) showMini();
}

ipcMain.handle('net:fetch', async (e, url) => {
  if (!/^https?:\/\//i.test(url)) return { ok: false, status: 0, text: '' };
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HARU/1.0', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' } });
    let text = await r.text();
    if (text.length > 3e6) text = text.slice(0, 3e6);
    return { ok: r.ok, status: r.status, text };
  } catch (err) { return { ok: false, status: 0, text: '', error: String(err) }; }
  finally { clearTimeout(to); }
});

ipcMain.handle('works:save', async (e, { folder, files }) => {
  const safe = String(folder).replace(/[\\/:*?"<>|]/g, '_').slice(0, 90);
  const dir = path.join(outputDir(), safe);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    const name = path.basename(f.name);
    const data = typeof f.data === 'string' ? Buffer.from(f.data, 'utf8') : Buffer.from(f.data.buffer ? new Uint8Array(f.data.buffer, f.data.byteOffset, f.data.byteLength) : f.data);
    fs.writeFileSync(path.join(dir, name), data);
  }
  return { path: dir };
});

ipcMain.handle('works:list', async () => {
  const root = outputDir();
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch (e) { return out; }
  for (const d of dirs) {
    const p = path.join(root, d);
    const metaF = path.join(p, 'meta.json');
    if (!fs.existsSync(metaF)) continue;
    const meta = readJSON(metaF, null);
    if (!meta) continue;
    const files = {}, urls = {};
    const fm = meta.files || {};
    ['mp3', 'png', 'raw', 'mp4', 'md'].forEach((k) => { if (fm[k] && fs.existsSync(path.join(p, fm[k]))) { files[k] = path.join(p, fm[k]); urls[k] = pathToFileURL(files[k]).href; } });
    out.push({ folder: d, path: p, meta, files, urls });
  }
  out.sort((a, b) => (b.meta.createdAt || 0) - (a.meta.createdAt || 0));
  return out.slice(0, 300);
});

/* bundled read-only assets (e.g. the CC0 avatars) — renderer fetch() can't read file:// */
ipcMain.handle('asset:read', (e, rel) => {
  const base = path.join(__dirname, 'src', 'assets');
  const p = path.normalize(path.join(base, String(rel)));
  if (!p.startsWith(base)) return null;
  try { return new Uint8Array(fs.readFileSync(p)); } catch (err) { return null; }
});
/* user 3D avatar (.vrm) kept in userData; shared with the mini window */
ipcMain.handle('avatar:save', (e, bytes) => { fs.writeFileSync(fileOf('avatar.vrm'), Buffer.from(bytes)); if (miniWin) miniWin.webContents.send('mini:avatar'); return true; });
ipcMain.handle('avatar:read', () => { try { return new Uint8Array(fs.readFileSync(fileOf('avatar.vrm'))); } catch (e) { return null; } });
ipcMain.handle('avatar:clear', () => { try { fs.unlinkSync(fileOf('avatar.vrm')); } catch (e) { /* none */ } if (miniWin) miniWin.webContents.send('mini:avatar'); return true; });

ipcMain.handle('open:path', (e, p) => shell.openPath(p));
ipcMain.handle('open:item', (e, p) => shell.showItemInFolder(p));
ipcMain.handle('open:output', () => shell.openPath(outputDir()));
ipcMain.handle('open:data', () => shell.openPath(dataDir()));
ipcMain.handle('dialog:dir', async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('notify', (e, { title, body }) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({ title, body, icon: ICON, silent: false });
  n.on('click', showMain); n.show(); return true;
});

/* mini <-> main */
ipcMain.on('mini:status', (e, s) => { if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send('mini:status', s); });
ipcMain.on('mini:poke', () => send('mini:poke'));
ipcMain.on('mini:open', () => showMain());
ipcMain.on('mini:hover', (e, v) => { M.hover = !!v; });
ipcMain.on('mini:dragStart', () => { if (!miniWin) return; const c = screen.getCursorScreenPoint(); const b = miniWin.getBounds(); M.drag = { ox: c.x - b.x, oy: c.y - b.y }; });
ipcMain.on('mini:dragEnd', () => { M.drag = null; M.tx = M.x; M.ty = M.y; M.vx = M.vy = 0; if (g(settings, 'mini.mode', 'float') === 'walk') { M.falling = true; M.vy = 0; } });
ipcMain.on('mini:menu', () => {
  const modes = [['float', '둥둥 떠다니기'], ['walk', '작업표시줄 위 걷기'], ['corner', '구석에 있기'], ['still', '가만히 있기']];
  Menu.buildFromTemplate([
    { label: 'HARU 열기', click: showMain },
    { label: '쓰다듬기', click: () => send('mini:poke') },
    { label: '지금 작품 만들기', click: () => send('cmd', { create: true }) },
    { type: 'separator' },
    ...modes.map(([id, ko]) => ({ label: ko, type: 'radio', checked: g(settings, 'mini.mode', 'float') === id, click: () => { settings.mini = settings.mini || {}; settings.mini.mode = id; writeJSON(fileOf('settings.json'), settings); send('settings:external', settings); } })),
    { type: 'separator' },
    { label: '미니 아바타 숨기기', click: () => miniWin && miniWin.hide() },
    { label: '종료', click: () => { quitting = true; app.quit(); } },
  ]).popup({ window: miniWin });
});

/* ---------- optional: Claude-written diary ---------- */
function readKey() {
  try { const buf = fs.readFileSync(fileOf('key.bin')); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8'); } catch (e) { return null; }
}
ipcMain.handle('ai:setKey', (e, key) => {
  const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key, 'utf8');
  fs.writeFileSync(fileOf('key.bin'), buf); return true;
});

let AnthropicCtor = null;
function client() {
  const key = readKey();
  if (!key) throw new Error('API 키가 없어요');
  if (!AnthropicCtor) { const mod = require('@anthropic-ai/sdk'); AnthropicCtor = mod.default || mod.Anthropic || mod; }
  return new AnthropicCtor({ apiKey: key, maxRetries: 2, timeout: 120000 });
}
const DIARY_SYSTEM = `너는 사용자가 키우는 작은 아틀리에 펫이야. 매일 뉴스, 트렌드, 사람들이 궁금해한 것들을 읽고 음악과 그림을 만들어.
주어진 오늘의 데이터(키워드, 헤드라인, 날씨, 세상의 기분, 네가 만든 곡과 그림, 사용자가 작업 중에 한 장난)를 바탕으로 오늘의 일기를 써.
- 한국어 반말, 따뜻하고 솔직한 일기체. 8~12문장. 사용자를 '너'라고 불러.
- 구체적인 키워드나 헤드라인 1~2개를 직접 언급하고, 그게 왜 마음에 남았는지 써.
- 곡(장르, 조성, BPM)과 그림을 왜 그렇게 만들었는지 세상의 기분과 연결해서 써.
- 사용자가 음을 던지거나 물감을 쏟거나 리듬을 바꿨다면, 그게 작품에 어떻게 남았는지 고마워하며 써.
- 비극적인 뉴스는 가볍게 다루지 말고 조심스럽게 언급해.
- 제목은 6~16자의 시적인 한국어 곡 제목.`;
const DIARY_SCHEMA = { type: 'object', properties: { title: { type: 'string' }, diary: { type: 'string' } }, required: ['title', 'diary'], additionalProperties: false };

async function askDiary(model, payload) {
  const c = client();
  const base = { model, max_tokens: 16000, output_config: { effort: 'low' }, system: DIARY_SYSTEM, messages: [{ role: 'user', content: `오늘의 데이터:\n${JSON.stringify(payload, null, 1)}\n\nJSON으로 {"title": ..., "diary": ...} 형식으로 답해.` }] };
  const withFallback = model === 'claude-opus-5-5' || model === 'claude-sonnet-5-5';
  const attempts = [
    Object.assign({}, base, { output_config: { effort: 'low', format: { type: 'json_schema', schema: DIARY_SCHEMA } } }, withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    base,
  ];
  let lastErr = null;
  for (const req of attempts) {
    try {
      const resp = req.betas ? await c.beta.messages.create(req) : await c.messages.create(req);
      if (resp.stop_reason === 'refusal') throw new Error('refusal');
      const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const m = text.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : text);
      if (j && j.diary) return { ok: true, title: String(j.title || '').slice(0, 40), diary: String(j.diary) };
    } catch (err) { lastErr = err; }
  }
  return { ok: false, error: String(lastErr && lastErr.message || lastErr) };
}
ipcMain.handle('ai:diary', async (e, payload) => askDiary(g(settings, 'ai.model', 'claude-opus-5-5'), payload).catch((err) => ({ ok: false, error: String(err) })));
ipcMain.handle('ai:test', async (e, model) => {
  try {
    const resp = await client().messages.create({ model, max_tokens: 1000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: '한 단어로 인사해줘.' }] });
    return { ok: true, text: resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('').slice(0, 40) };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});

/* ================= screenshots (dev) ================= */
async function runShots() {
  const dir = SHOT; fs.mkdirSync(dir, { recursive: true });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cap = async (name) => { const img = await mainWin.webContents.capturePage(); fs.writeFileSync(path.join(dir, name + '.png'), img.toPNG()); };
  const plan = process.env.HARU_SHOT_PLAN || 'basic';
  await wait(5000);
  if (plan === 'basic') {
    await cap('01_room');
    for (const [i, v] of ['world', 'studio', 'lab', 'archive', 'shop'].entries()) { send('cmd', { view: v }); await wait(1800); await cap(`0${i + 2}_${v}`); }
    send('cmd', { view: 'room' }); send('cmd', { cam: 'close' }); await wait(3000); await cap('08_close');
    if (miniWin || true) { hideMainToMini(); await wait(1500); if (miniWin) { const img = await miniWin.webContents.capturePage(); fs.writeFileSync(path.join(dir, '09_mini.png'), img.toPNG()); } }
    quitting = true; app.quit();
  } else if (plan === 'creator') {
    send('cmd', { creator: true }); await wait(5000); await cap('creator');
    const info = await mainWin.webContents.executeJavaScript(`(() => { const s = document.querySelectorAll('canvas'); return [...s].map(c => c.width + 'x' + c.height).join(' ') })()`);
    console.log('canvases', info);
    hideMainToMini(); await wait(4000);
    if (miniWin) { const img = await miniWin.webContents.capturePage(); fs.writeFileSync(path.join(dir, 'mini.png'), img.toPNG()); }
    quitting = true; app.quit();
  } else if (plan === 'cams3d') {
    for (const c of ['wide', 'desk', 'close', 'shoulder', 'window', 'nook', 'easel']) { send('cmd', { cam: c }); await wait(3200); await cap('cam_' + c); }
    for (const a of ['type', 'paint', 'read']) { send('cmd', { act: a }); await wait(11000); await cap('act_' + a); if (a === 'type') { send('cmd', { cam: 'close' }); await wait(3000); await cap('act_type_close'); send('cmd', { cam: 'shoulder' }); await wait(3000); await cap('act_type_shoulder'); } }
    quitting = true; app.quit();
  } else if (plan === 'create') {
    send('cmd', { create: true });
    for (let i = 0; i < 14; i++) {
      await wait(6000);
      await cap(`c${String(i).padStart(2, '0')}_room`);
      if (i === 4) { send('cmd', { intervene: { kind: 'note', midi: 79 } }); send('cmd', { intervene: { kind: 'rhythm', genreId: 'samba' } }); send('cmd', { tool: 'pat' }); }
      if (i === 5) { send('cmd', { intervene: { kind: 'whisper', word: '첫눈' } }); }
      if (i === 6) { send('cmd', { intervene: { kind: 'splash', x: 0.5, y: 0.5, color: '#ff4f8b' } }); }
      if (i === 8) { send('cmd', { intervene: { kind: 'splash', x: 0.3, y: 0.6, color: '#2f45ff' } }); await wait(800); await cap('c08_splash'); }
      if (i === 3 || i === 7) { send('cmd', { view: 'studio' }); await wait(1500); await cap(`c${String(i).padStart(2, '0')}_studio`); send('cmd', { view: i === 3 ? 'world' : 'room' }); await wait(1500); await cap(`c${String(i).padStart(2, '0')}_b`); send('cmd', { view: 'room' }); }
    }
    await wait(30000);
    await cap('c90_done');
    send('cmd', { view: 'archive' }); await wait(2500); await cap('c91_archive');
    send('cmd', { view: 'room' }); send('cmd', { creator: true }); await wait(4000); await cap('c92_creator');
    send('cmd', { closeModal: true });
    hideMainToMini(); await wait(4000);
    if (miniWin) { const img = await miniWin.webContents.capturePage(); fs.writeFileSync(path.join(dir, 'c93_mini.png'), img.toPNG()); }
    quitting = true; app.quit();
  }
}

/* ================= lifecycle ================= */
app.on('second-instance', () => showMain());
app.whenReady().then(() => {
  settings = readJSON(fileOf('settings.json'), {});
  state = readJSON(fileOf('state.json'), {});
  if (process.env.HARU_SETUP === '1') { settings.setupDone = true; }
  createMain();
  createTray();
  createMini();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (quitting) app.quit(); });
