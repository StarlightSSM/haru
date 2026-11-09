/* layout check of www/ at phone/tablet sizes: `electron tools/shot-mobile.js <outdir>` */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const out = process.argv[2] || path.join(__dirname, '..', 'shots-mobile');
const sizes = [['phone', 390, 844], ['tabletP', 800, 1280], ['tabletL', 1280, 800]];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ show: false, useContentSize: true, width: 390, height: 844, webPreferences: { backgroundThrottling: false, offscreen: true } });
  win.webContents.on('console-message', (e) => { if (e.level === 'error') console.log('[page]', e.message); });
  const file = path.join(__dirname, '..', 'www', 'index.html');
  await win.loadFile(file);
  await win.webContents.executeJavaScript(`localStorage.setItem('haru:settings', JSON.stringify({ setupDone: true, petName: '모모' })); true`);
  for (const [name, w, h] of sizes) {
    win.setContentSize(w, h);
    await win.loadFile(file).catch(() => {});
    await wait(3500);
    const cap = async (v) => { if (v !== 'room') await win.webContents.executeJavaScript(`document.querySelector('#nav [data-view="${v}"]').click(); true`); await wait(1200); fs.writeFileSync(path.join(out, `${name}_${v}.png`), (await win.webContents.capturePage()).toPNG()); };
    for (const v of ['room', 'world', 'studio', 'lab']) await cap(v);
  }
  app.quit();
});
