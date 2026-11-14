/* dev: phone-size www/ with simulated system-bar insets (as Capacitor injects them). `electron tools/shot-safearea.js <outdir>` */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ show: false, useContentSize: true, width: 412, height: 892, webPreferences: { offscreen: true } });
  const file = path.join(__dirname, '..', 'www', 'index.html');
  await win.loadFile(file);
  await win.webContents.executeJavaScript(`localStorage.clear(); true`);
  await win.loadFile(file);
  /* what Capacitor's SystemBars plugin injects in edge-to-edge mode */
  const inject = `document.documentElement.style.setProperty('--safe-area-inset-top','40px'); document.documentElement.style.setProperty('--safe-area-inset-bottom','48px'); true`;
  await win.webContents.executeJavaScript(inject);
  await wait(4000);
  fs.writeFileSync(path.join(out, 'sa_creator.png'), (await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`document.querySelector('.modal-foot .btn.primary').click(); true`);
  await wait(2500);
  fs.writeFileSync(path.join(out, 'sa_room.png'), (await win.webContents.capturePage()).toPNG());
  app.quit();
});
