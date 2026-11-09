const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { webSecurity: false } });
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') console.log('[page]', e.message); });
  await win.loadFile(path.join(__dirname, 'vrm-preview.html'));
  const dir = pathToFileURL(path.join(__dirname, '..', 'src', 'assets', 'avatars')).href;
  console.log(JSON.stringify(await win.webContents.executeJavaScript(`stageTest(${JSON.stringify(dir)})`)));
  app.quit();
});
