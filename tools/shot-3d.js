/* dev: render tools/char3d-preview.html → PNGs. `electron tools/shot-3d.js <outdir> [cfgJSON]` */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
app.whenReady().then(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ show: false, width: 1600, height: 900 });
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') console.log('[page]', e.message); });
  await win.loadFile(path.join(__dirname, 'char3d-preview.html'));
  const imgs = await win.webContents.executeJavaScript(`shoot(${process.argv[3] || '{}'})`);
  imgs.forEach((d, i) => fs.writeFileSync(path.join(out, `char_${i}.png`), Buffer.from(d.split(',')[1], 'base64')));
  console.log('ok', imgs.length);
  app.quit();
});
