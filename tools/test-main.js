/* dev harness: `electron tools/test-main.js [genre] [outdir]` — times compose/render/mp3/mp4 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, webSecurity: false } });
  win.webContents.on('console-message', (e) => { const m = e.message || ''; if (!m.startsWith('[test]')) console.log('[page]', e.level, m); });
  await win.loadFile(path.join(__dirname, 'test.html'));
  if (process.argv[2] === 'scale') { console.log('scale', JSON.stringify(await win.webContents.executeJavaScript('scale()'))); app.quit(); return; }
  if (process.argv[2] === 'micro') { console.log('micro', JSON.stringify(await win.webContents.executeJavaScript('micro()'))); app.quit(); return; }
  if (process.argv[2] === 'probe') { console.log('probe', await win.webContents.executeJavaScript('probe()')); app.quit(); return; }
  if (process.argv[2] === 'pitch') { const r = await win.webContents.executeJavaScript('pitchTest()'); Object.entries(r).forEach(([k, v]) => console.log('pitch', k.padEnd(9), v)); app.quit(); return; }
  if (process.argv[2] === 'profile') { console.log('profile', JSON.stringify(await win.webContents.executeJavaScript('profile()'))); app.quit(); return; }
  if (process.argv[2].startsWith('prof2=')) { console.log('prof2', JSON.stringify(await win.webContents.executeJavaScript('prof2(' + JSON.stringify(process.argv[2].slice(6)) + ')'))); app.quit(); return; }
  const genres = (process.argv[2] || 'lofi').split(',');
  const outDir = process.argv[3] || process.env.HARU_RENDER_OUT;
  for (const gid of genres) {
    try {
      const r = await win.webContents.executeJavaScript(`runTest(${JSON.stringify(gid)})`);
      console.log(gid, JSON.stringify(r));
      if (outDir) {
        fs.mkdirSync(outDir, { recursive: true });
        const mp3 = await win.webContents.executeJavaScript('Array.from(window.mp3)');
        fs.writeFileSync(path.join(outDir, gid.replace(/:/g, '_') + '.mp3'), Buffer.from(mp3));
        const mp4 = await win.webContents.executeJavaScript('window.mp4 ? Array.from(window.mp4) : null');
        if (mp4) fs.writeFileSync(path.join(outDir, gid.replace(/:/g, '_') + '.mp4'), Buffer.from(mp4));
      }
    } catch (e) { console.log(gid, 'ERROR', e.message); }
  }
  app.quit();
});
