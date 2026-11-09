/* dev: preview .vrm files with the app's renderer. `electron tools/shot-vrm.js <vrmDir> <outDir> [act]` */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
app.whenReady().then(async () => {
  const [dir, out, act] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { webSecurity: false } });
  win.webContents.on('console-message', (e) => { if (e.level === 'error') console.log('[page]', e.message); });
  await win.loadFile(path.join(__dirname, 'vrm-preview.html'));
  const only = process.env.VRM_ONLY ? process.env.VRM_ONLY.split(',') : null;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.vrm') && (!only || only.some((o) => n.startsWith(o))))) {
    try {
      const imgs = await win.webContents.executeJavaScript(`shootVrm(${JSON.stringify(pathToFileURL(path.join(dir, f)).href)}, ${JSON.stringify(act || 'idle')})`);
      imgs.forEach((d, i) => fs.writeFileSync(path.join(out, `${path.basename(f, '.vrm')}_${act || 'idle'}_${i}.png`), Buffer.from(d.split(',')[1], 'base64')));
      console.log('ok', f);
    } catch (e) { console.log('fail', f, e.message); }
    await win.loadFile(path.join(__dirname, 'vrm-preview.html'));
  }
  app.quit();
});
