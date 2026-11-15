/* dev: phone-size www/ with simulated system-bar insets (as Capacitor injects them). `electron tools/shot-safearea.js <outdir>` */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const out = process.env.SA_OUT || process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const [W, Hh] = (process.env.SA_SIZE || '412x892').split('x').map(Number);
  const tag = process.env.SA_TAG || 'sa';
  const win = new BrowserWindow({ show: false, useContentSize: true, width: W, height: Hh, webPreferences: { offscreen: true } });
  const file = path.join(__dirname, '..', 'www', 'index.html');
  await win.loadFile(file);
  await win.webContents.executeJavaScript(`localStorage.clear(); true`);
  await win.loadFile(file);
  /* what Capacitor's SystemBars plugin injects in edge-to-edge mode */
  const inject = `document.documentElement.style.setProperty('--safe-area-inset-top','40px'); document.documentElement.style.setProperty('--safe-area-inset-bottom','48px'); true`;
  await win.webContents.executeJavaScript(inject);
  await wait(4000);
  fs.writeFileSync(path.join(out, tag + '_creator.png'), (await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('.modal-foot .btn.primary').click(); true`);
  await wait(2500);
  fs.writeFileSync(path.join(out, tag + '_room.png'), (await win.webContents.capturePage()).toPNG());
  for (const v of (process.env.SA_VIEWS || '').split(',').filter(Boolean)) {
    await win.webContents.executeJavaScript(`document.querySelector('#nav button[data-view="${v}"]').click(); true`);
    await wait(2500); await win.webContents.capturePage(); await wait(300);
    fs.writeFileSync(path.join(out, tag + '_' + v + '.png'), (await win.webContents.capturePage()).toPNG());
  }
  app.quit();
});
